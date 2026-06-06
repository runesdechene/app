-- 219_announcements_schema.sql
-- WHY : Système d'annonces multi-canal (spec 2026-06-05). Le Hub devient la SOURCE
-- DE VÉRITÉ : un article vit ici (Supabase), pas chez Shopify. Chaque canal (blog,
-- app, push, email, insta) est une déclinaison dont l'état de diffusion est tracé
-- dans `channels` (jsonb). L'app lit nativement via RPCs publiques ; le Hub écrit
-- via RPCs admin (SECURITY DEFINER). Audience posée dès v1 ('tout-le-monde').
--
--   - type        : produit | app | marque
--   - status      : draft | published
--   - channels    : { blog, app, push, email, insta } -> none|ready|published|sent
--   - slug        : unique, sert d'URL au lecteur in-app (/article/:slug)

CREATE TABLE IF NOT EXISTS public.announcements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE,
  type                text NOT NULL DEFAULT 'marque'
                        CHECK (type IN ('produit','app','marque')),
  title               text NOT NULL,
  cover_image         text,
  body                text NOT NULL DEFAULT '',        -- Markdown canonique
  push_text           text,                            -- déclinaison push (éditable)
  insta_caption       text,                            -- déclinaison Insta (éditable)
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','published')),
  audience            text NOT NULL DEFAULT 'tout-le-monde',
  shopify_article_id  text,
  channels            jsonb NOT NULL DEFAULT
                        '{"blog":"none","app":"none","push":"none","email":"none","insta":"none"}'::jsonb,
  published_at        timestamptz,
  created_by          text REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS announcements_status_pub_idx
  ON public.announcements (status, published_at DESC);
CREATE INDEX IF NOT EXISTS announcements_slug_idx
  ON public.announcements (slug);

-- updated_at auto
CREATE OR REPLACE FUNCTION public.tg_announcements_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS announcements_touch ON public.announcements;
CREATE TRIGGER announcements_touch
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.tg_announcements_touch();

-- RLS : lecture publique des articles publiés ; écriture jamais directe (RPCs only).
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announcements_public_read_published" ON public.announcements;
CREATE POLICY "announcements_public_read_published"
  ON public.announcements FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

-- (Pas de policy INSERT/UPDATE/DELETE : tout passe par les RPCs SECURITY DEFINER.)

-- ── unaccent fallback : translittère les accents FR courants (unaccent ext. pas garantie)
CREATE OR REPLACE FUNCTION public.unaccent_fallback(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT translate(
    p,
    'àâäáãçèéêëìíîïñòóôöõùúûüýÿœæÀÂÄÁÃÇÈÉÊËÌÍÎÏÑÒÓÔÖÕÙÚÛÜÝŒÆ',
    'aaaaaceeeeiiiinooooouuuuyyoeaeAAAAACEEEEIIIINOOOOOUUUUYOEAE'
  );
$$;

-- ── slug : génère un slug à partir d'un titre (unicité gérée par l'appelant) ──
CREATE OR REPLACE FUNCTION public._announcement_slugify(p_title text)
RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_base text;
BEGIN
  v_base := lower(public.unaccent_fallback(p_title));
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  IF v_base = '' THEN v_base := 'annonce'; END IF;
  RETURN left(v_base, 60);
END; $$;

-- ── Helper admin (réutilisé par toutes les RPCs admin) ──────────────────────
CREATE OR REPLACE FUNCTION public._is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
     WHERE users.id::text = (auth.uid())::text
       AND users.role::text = 'admin'
  );
$$;
GRANT EXECUTE ON FUNCTION public._is_admin() TO authenticated;

-- ── RPC admin : créer une annonce (draft) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_announcement(
  p_type  text,
  p_title text
)
RETURNS public.announcements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_slug text;
  v_n    int := 0;
  v_row  public.announcements;
BEGIN
  IF NOT public._is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  IF coalesce(p_title,'') = '' THEN RAISE EXCEPTION 'title_required'; END IF;

  v_slug := public._announcement_slugify(p_title);
  -- unicité : suffixe -1, -2… si collision
  WHILE EXISTS (SELECT 1 FROM public.announcements WHERE slug = v_slug
                  || CASE WHEN v_n = 0 THEN '' ELSE '-' || v_n END) LOOP
    v_n := v_n + 1;
  END LOOP;
  IF v_n > 0 THEN v_slug := v_slug || '-' || v_n; END IF;

  INSERT INTO public.announcements (slug, type, title, created_by)
  VALUES (v_slug,
          CASE WHEN p_type IN ('produit','app','marque') THEN p_type ELSE 'marque' END,
          p_title,
          (auth.uid())::text)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_announcement(text, text) TO authenticated;

-- ── RPC admin : mettre à jour le contenu (brouillon) ────────────────────────
CREATE OR REPLACE FUNCTION public.update_announcement(
  p_id            uuid,
  p_title         text,
  p_body          text,
  p_cover_image   text,
  p_push_text     text,
  p_insta_caption text,
  p_type          text
)
RETURNS public.announcements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.announcements;
BEGIN
  IF NOT public._is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  UPDATE public.announcements SET
    title         = coalesce(p_title, title),
    body          = coalesce(p_body, body),
    cover_image   = p_cover_image,
    push_text     = p_push_text,
    insta_caption = p_insta_caption,
    type          = CASE WHEN p_type IN ('produit','app','marque') THEN p_type ELSE type END
  WHERE id = p_id
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.update_announcement(uuid,text,text,text,text,text,text) TO authenticated;

-- ── RPC admin : publier (status=published, app=published) ───────────────────
-- Idempotent. Pose published_at une seule fois. L'article devient lisible in-app
-- dès qu'il est published (via la RLS de lecture publique).
CREATE OR REPLACE FUNCTION public.publish_announcement(p_id uuid)
RETURNS public.announcements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.announcements;
BEGIN
  IF NOT public._is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  UPDATE public.announcements SET
    status       = 'published',
    published_at = coalesce(published_at, now()),
    channels     = channels || '{"app":"published"}'::jsonb
  WHERE id = p_id
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.publish_announcement(uuid) TO authenticated;

-- ── RPC admin : marquer l'état d'un canal (blog/push/email/insta) ───────────
CREATE OR REPLACE FUNCTION public.set_announcement_channel(
  p_id      uuid,
  p_channel text,           -- 'blog'|'app'|'push'|'email'|'insta'
  p_state   text,           -- 'none'|'ready'|'published'|'sent'
  p_shopify_article_id text DEFAULT NULL
)
RETURNS public.announcements
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.announcements;
BEGIN
  IF NOT public._is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  IF p_channel NOT IN ('blog','app','push','email','insta') THEN
    RAISE EXCEPTION 'bad_channel';
  END IF;
  IF p_state NOT IN ('none','ready','published','sent') THEN
    RAISE EXCEPTION 'bad_state';
  END IF;
  UPDATE public.announcements SET
    channels = channels || jsonb_build_object(p_channel, p_state),
    shopify_article_id = coalesce(p_shopify_article_id, shopify_article_id)
  WHERE id = p_id
  RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_announcement_channel(uuid,text,text,text) TO authenticated;

-- ── RPC admin : liste complète (journal de comm, tous statuts) ──────────────
CREATE OR REPLACE FUNCTION public.list_announcements_admin()
RETURNS SETOF public.announcements
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._is_admin() THEN RAISE EXCEPTION 'admin_only'; END IF;
  RETURN QUERY SELECT * FROM public.announcements ORDER BY created_at DESC;
END; $$;
GRANT EXECUTE ON FUNCTION public.list_announcements_admin() TO authenticated;

-- ── RPC publique : liste « Nouvelles » (publiées) ──────────────────────────
CREATE OR REPLACE FUNCTION public.list_published_announcements(p_limit int DEFAULT 30)
RETURNS TABLE (
  id uuid, slug text, type text, title text, cover_image text,
  published_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, slug, type, title, cover_image, published_at
    FROM public.announcements
   WHERE status = 'published'
   ORDER BY published_at DESC
   LIMIT greatest(1, least(coalesce(p_limit,30), 100));
$$;
GRANT EXECUTE ON FUNCTION public.list_published_announcements(int) TO anon, authenticated;

-- ── RPC publique : article par slug ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_announcement_by_slug(p_slug text)
RETURNS public.announcements
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.announcements
   WHERE slug = p_slug AND status = 'published'
   LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_announcement_by_slug(text) TO anon, authenticated;
