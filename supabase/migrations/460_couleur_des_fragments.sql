-- 460 — Les Fragments sur la carte prennent la couleur de leur culture
--
-- WHY : Uriel, 08/10/2026 : l'éclat qui marque un Fragment sur la carte (Figma 516:659) prend la
--   couleur attribuée à la culture du Fragment. title_fragments.theme reprend les identifiants des
--   cultures des énigmes (enigma_themes.id), dont la couleur se règle dans le Hub (écran Cultures).
--   Un Fragment sans culture (Jeanne de Flandre, 08/10) renvoie une couleur nulle : l'app garde le
--   rouge de la marque. Définition live du 08/10 copiée entière ; seuls changent la jointure et la
--   clé 'couleur'.
--
-- SCHEMA CHECKED (08/10/2026, live) : title_fragments.theme text (byzantine, celtique, grecque,
--   nordique, ou null) ; enigma_themes(id text, color text, label text).

CREATE OR REPLACE FUNCTION public.fragments_sur_la_carte()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id,
    'nom', f.name,
    'illustration', f.illustration_url,
    'heritage', f.heritage,
    'origine', f.origine_nom,
    'couleur', t.color,
    'lat', f.origine_lat,
    'lng', f.origine_lng
  ) ORDER BY f.name), '[]'::jsonb)
  FROM title_fragments f
  LEFT JOIN enigma_themes t ON t.id = f.theme
  WHERE f.visible AND f.origine_lat IS NOT NULL AND f.origine_lng IS NOT NULL;
$function$;
