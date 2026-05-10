-- 161_home_banners_customization.sql
-- Customisation visuelle par bannière : couleur+opacity overlay, couleurs textes.
-- Defaults = valeurs hardcodées actuelles dans HomeBannerCard.css pour
-- préserver le rendu existant des bannières déjà créées.

ALTER TABLE public.home_banners
  ADD COLUMN overlay_color   TEXT    NOT NULL DEFAULT '#0f0a05',
  ADD COLUMN overlay_opacity NUMERIC NOT NULL DEFAULT 0.85
    CHECK (overlay_opacity >= 0 AND overlay_opacity <= 1),
  ADD COLUMN tag_color       TEXT    NOT NULL DEFAULT '#a87838',
  ADD COLUMN title_color     TEXT    NOT NULL DEFAULT '#ffffff',
  ADD COLUMN subtitle_color  TEXT    NOT NULL DEFAULT '#f0e4cc';

-- Étendre la RPC pour retourner les nouveaux champs.
CREATE OR REPLACE FUNCTION public.get_random_home_banner()
RETURNS JSONB
LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'id',             id,
    'imageUrl',       image_url,
    'title',          title,
    'subtitle',       subtitle,
    'linkUrl',        link_url,
    'overlayColor',   overlay_color,
    'overlayOpacity', overlay_opacity,
    'tagColor',       tag_color,
    'titleColor',     title_color,
    'subtitleColor',  subtitle_color
  )
  FROM public.home_banners
  WHERE active = true
  ORDER BY random()
  LIMIT 1;
$$;
