-- 159_home_banners.sql
-- Table des bannières marketing affichées sur la home page explore-web.
-- Distinct de ad_screens (publicités plein écran à l'entrée carte) :
-- ici la bannière est passive, le user la voit en scrollant la home.
-- Voir docs/superpowers/specs/2026-05-10-home-banner-collection-design.md

CREATE TABLE public.home_banners (
  id          BIGSERIAL PRIMARY KEY,
  image_url   TEXT NOT NULL,
  title       TEXT NOT NULL,
  subtitle    TEXT,
  link_url    TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

-- Lecture publique des bannières actives (consommée par get_random_home_banner)
CREATE POLICY "home_banners read active" ON public.home_banners
  FOR SELECT USING (active = true);

-- CRUD admin via service_role côté hub (pas de policy write : seul service_role bypasse RLS)

CREATE OR REPLACE FUNCTION public.get_random_home_banner()
RETURNS JSONB
LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'id',       id,
    'imageUrl', image_url,
    'title',    title,
    'subtitle', subtitle,
    'linkUrl',  link_url
  )
  FROM public.home_banners
  WHERE active = true
  ORDER BY random()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_random_home_banner() TO anon, authenticated;
