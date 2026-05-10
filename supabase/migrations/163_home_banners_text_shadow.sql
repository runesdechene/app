-- 163_home_banners_text_shadow.sql
-- Shadow configurable sur les textes de la bannière (titre, sous-titre, tag).
-- Global : 1 couleur + 1 force (0→1) qui pilote l'opacity de l'ombre.
-- Default force = 0 → pas de shadow, préserve le rendu actuel (post-mig 162).

ALTER TABLE public.home_banners
  ADD COLUMN shadow_color    TEXT    NOT NULL DEFAULT '#000000',
  ADD COLUMN shadow_strength NUMERIC NOT NULL DEFAULT 0
    CHECK (shadow_strength >= 0 AND shadow_strength <= 1);

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
    'subtitleColor',  subtitle_color,
    'shadowColor',    shadow_color,
    'shadowStrength', shadow_strength
  )
  FROM public.home_banners
  WHERE active = true
  ORDER BY random()
  LIMIT 1;
$$;
