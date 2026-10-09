-- 458 — Les Fragments sur la carte, pour tous
--
-- WHY : décision du 08/10/2026 (vault, Explore/_État.md « Fragments ») : le calque Fragments
--   d'Explore, actif par défaut, montre chaque Fragment à son origine avec la petite icône de son
--   illustration ; la mini-carte de la boutique lira la même chose. Lecture seule, ouverte aux
--   visiteurs (anon) : rien ici n'est réservé aux Porteurs.
--
-- SCHEMA CHECKED (08/10/2026, mig 457) : title_fragments(id int, name varchar, visible bool,
--   illustration_url text, heritage text, origine_lat/origine_lng double precision,
--   origine_nom text) ; lecture publique (policy « Anyone can view title_fragments »).

CREATE OR REPLACE FUNCTION public.fragments_sur_la_carte()
RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id,
    'nom', f.name,
    'illustration', f.illustration_url,
    'heritage', f.heritage,
    'origine', f.origine_nom,
    'lat', f.origine_lat,
    'lng', f.origine_lng
  ) ORDER BY f.name), '[]'::jsonb)
  FROM title_fragments f
  WHERE f.visible AND f.origine_lat IS NOT NULL AND f.origine_lng IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.fragments_sur_la_carte() TO anon, authenticated;
