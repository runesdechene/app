-- 223_announcement_social.sql
-- WHY : sur l'app, les joueurs doivent pouvoir RÉAGIR (❤️ J'aime) à une annonce et
-- la COMMENTER (fil avec réponses 1 niveau), comme la Discussion des fiches de lieux.
-- Les annonces ne sont pas des lieux → tables dédiées + RPCs SECURITY DEFINER.
-- RLS activée SANS policy : tout l'accès passe par les RPCs (lecture incluse).
-- (Notifications de commentaire : étape suivante, hors v1.)

CREATE TABLE IF NOT EXISTS public.announcement_likes (
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id         text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.announcement_comments (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  announcement_id uuid NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  user_id         text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content         text NOT NULL,
  parent_id       bigint REFERENCES public.announcement_comments(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS announcement_comments_aid_idx
  ON public.announcement_comments (announcement_id, created_at);

ALTER TABLE public.announcement_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;
-- Pas de policy : accès uniquement via les RPCs SECURITY DEFINER ci-dessous.

-- ── ❤️ toggle like sur l'annonce ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_announcement_like(p_announcement_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user text; v_liked boolean; v_count int;
BEGIN
  v_user := (auth.uid())::text;
  IF v_user IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;

  IF EXISTS (SELECT 1 FROM announcement_likes WHERE announcement_id = p_announcement_id AND user_id = v_user) THEN
    DELETE FROM announcement_likes WHERE announcement_id = p_announcement_id AND user_id = v_user;
    v_liked := false;
  ELSE
    INSERT INTO announcement_likes (announcement_id, user_id)
    VALUES (p_announcement_id, v_user) ON CONFLICT DO NOTHING;
    v_liked := true;
  END IF;

  SELECT count(*) INTO v_count FROM announcement_likes WHERE announcement_id = p_announcement_id;
  RETURN jsonb_build_object('success', true, 'liked', v_liked, 'count', v_count);
END; $$;
GRANT EXECUTE ON FUNCTION public.toggle_announcement_like(uuid) TO authenticated;

-- ── 💬 ajouter un commentaire (texte, réponse 1 niveau) ─────────────────────
CREATE OR REPLACE FUNCTION public.add_announcement_comment(
  p_announcement_id uuid,
  p_content         text,
  p_parent_id       bigint DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user text; v_id bigint; v_parent bigint;
BEGIN
  v_user := (auth.uid())::text;
  IF v_user IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
  IF coalesce(btrim(p_content),'') = '' THEN RETURN jsonb_build_object('error','empty'); END IF;
  IF NOT EXISTS (SELECT 1 FROM announcements WHERE id = p_announcement_id AND status = 'published') THEN
    RETURN jsonb_build_object('error','not_found');
  END IF;

  -- Normalise vers la racine (fil à 1 niveau) : répondre à une réponse rattache au parent.
  IF p_parent_id IS NOT NULL THEN
    SELECT coalesce(parent_id, id) INTO v_parent
      FROM announcement_comments
     WHERE id = p_parent_id AND announcement_id = p_announcement_id;
    -- v_parent NULL si parent introuvable → commentaire racine
  END IF;

  INSERT INTO announcement_comments (announcement_id, user_id, content, parent_id)
  VALUES (p_announcement_id, v_user, btrim(p_content), v_parent)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.add_announcement_comment(uuid, text, bigint) TO authenticated;

-- ── lecture sociale : likes + likedByMe + commentaires (auteur joint) ───────
CREATE OR REPLACE FUNCTION public.get_announcement_social(
  p_announcement_id uuid,
  p_user_id         text DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'likeCount', (SELECT count(*) FROM announcement_likes WHERE announcement_id = p_announcement_id),
    'likedByMe', (SELECT EXISTS (
        SELECT 1 FROM announcement_likes
         WHERE announcement_id = p_announcement_id AND user_id = p_user_id)),
    'comments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',        c.id,
        'userId',    c.user_id,
        'userName',  COALESCE(u.display_name, u.first_name, 'Explorateur'),
        'userAvatar', u.avatar_url,
        'content',   c.content,
        'parentId',  c.parent_id,
        'createdAt', c.created_at
      ) ORDER BY c.created_at)
      FROM announcement_comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.announcement_id = p_announcement_id
    ), '[]'::jsonb)
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_announcement_social(uuid, text) TO anon, authenticated;
