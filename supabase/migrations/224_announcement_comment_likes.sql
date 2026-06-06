-- 224_announcement_comment_likes.sql
-- WHY : parité complète avec la Discussion des lieux sur les annonces —
--   1. voir QUI a aimé l'annonce (get_announcement_likers, cf. mig 204) ;
--   2. aimer un COMMENTAIRE ou une RÉPONSE + voir qui (table + toggle + likers) ;
--   3. get_announcement_social renvoie désormais votesUp + likedByMe par commentaire.
-- Tout via RPCs SECURITY DEFINER ; RLS activée sans policy.

-- ── 1. likers de l'annonce ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_announcement_likers(p_announcement_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(json_agg(json_build_object(
    'userId', u.id,
    'name',   COALESCE(u.display_name, u.first_name),
    'avatar', u.avatar_url
  ) ORDER BY al.created_at DESC), '[]'::json)
  FROM public.announcement_likes al
  JOIN public.users u ON u.id = al.user_id
  WHERE al.announcement_id = p_announcement_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_announcement_likers(uuid) TO authenticated, anon;

-- ── 2. likes par commentaire ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcement_comment_likes (
  comment_id bigint NOT NULL REFERENCES public.announcement_comments(id) ON DELETE CASCADE,
  user_id    text   NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
ALTER TABLE public.announcement_comment_likes ENABLE ROW LEVEL SECURITY;
-- pas de policy : accès via RPCs SECURITY DEFINER

CREATE OR REPLACE FUNCTION public.toggle_announcement_comment_like(p_comment_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user text; v_liked boolean; v_count int;
BEGIN
  v_user := (auth.uid())::text;
  IF v_user IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
  IF NOT EXISTS (SELECT 1 FROM announcement_comments WHERE id = p_comment_id) THEN
    RETURN jsonb_build_object('error','not_found');
  END IF;

  IF EXISTS (SELECT 1 FROM announcement_comment_likes WHERE comment_id = p_comment_id AND user_id = v_user) THEN
    DELETE FROM announcement_comment_likes WHERE comment_id = p_comment_id AND user_id = v_user;
    v_liked := false;
  ELSE
    INSERT INTO announcement_comment_likes (comment_id, user_id)
    VALUES (p_comment_id, v_user) ON CONFLICT DO NOTHING;
    v_liked := true;
  END IF;

  SELECT count(*) INTO v_count FROM announcement_comment_likes WHERE comment_id = p_comment_id;
  RETURN jsonb_build_object('success', true, 'liked', v_liked, 'votesUp', v_count);
END; $$;
GRANT EXECUTE ON FUNCTION public.toggle_announcement_comment_like(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_announcement_comment_likers(p_comment_id bigint)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(json_agg(json_build_object(
    'userId', u.id,
    'name',   COALESCE(u.display_name, u.first_name),
    'avatar', u.avatar_url
  ) ORDER BY cl.created_at DESC), '[]'::json)
  FROM public.announcement_comment_likes cl
  JOIN public.users u ON u.id = cl.user_id
  WHERE cl.comment_id = p_comment_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_announcement_comment_likers(bigint) TO authenticated, anon;

-- ── 3. get_announcement_social : + votesUp / likedByMe par commentaire ──────
-- (baseline mig 223, on ajoute les 2 champs de like par commentaire)
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
        'id',         c.id,
        'userId',     c.user_id,
        'userName',   COALESCE(u.display_name, u.first_name, 'Explorateur'),
        'userAvatar', u.avatar_url,
        'content',    c.content,
        'parentId',   c.parent_id,
        'createdAt',  c.created_at,
        'votesUp',    (SELECT count(*) FROM announcement_comment_likes cl WHERE cl.comment_id = c.id),
        'likedByMe',  (SELECT EXISTS (SELECT 1 FROM announcement_comment_likes cl
                          WHERE cl.comment_id = c.id AND cl.user_id = p_user_id))
      ) ORDER BY c.created_at)
      FROM announcement_comments c
      LEFT JOIN users u ON u.id = c.user_id
      WHERE c.announcement_id = p_announcement_id
    ), '[]'::jsonb)
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_announcement_social(uuid, text) TO anon, authenticated;
