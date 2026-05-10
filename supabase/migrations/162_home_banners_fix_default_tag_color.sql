-- 162_home_banners_fix_default_tag_color.sql
-- Fix : la valeur par défaut de tag_color était #a87838 alors que la
-- couleur officielle "sépia" du thème explore-web est #C19A6B (cf
-- index.css : --color-sepia: #C19A6B).
-- Backfill les rangées qui matchent l'ancien default (créées avant ce fix).

ALTER TABLE public.home_banners
  ALTER COLUMN tag_color SET DEFAULT '#C19A6B';

UPDATE public.home_banners
SET tag_color = '#C19A6B'
WHERE tag_color = '#a87838';
