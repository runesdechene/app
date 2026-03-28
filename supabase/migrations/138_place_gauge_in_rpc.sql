-- ============================================
-- MIGRATION 138 : Ajouter gauge au primaryTag dans get_place_by_id
-- ============================================
-- Le frontend a besoin de savoir quelle jauge le lieu utilise
-- pour afficher l'icône et le nom corrects

-- On remplace uniquement la construction du primaryTag dans get_place_by_id
-- Le reste de la fonction reste identique

-- Comme la fonction est très longue, on fait un UPDATE chirurgical
-- via CREATE OR REPLACE en reprenant la dernière version (migration 095)
-- et en ajoutant juste 'gauge', t.gauge dans le json_build_object du primaryTag

-- NOTE: Comme on ne peut pas patcher une seule ligne d'une fonction PL/pgSQL,
-- on doit réécrire toute la fonction. Voir ci-dessous.

-- Pour éviter de réécrire 300 lignes, on utilise une approche plus simple :
-- On crée une fonction helper qui retourne le gauge d'un lieu

CREATE OR REPLACE FUNCTION public.get_place_gauge(p_place_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(t.gauge, 'energy')
  FROM place_tags pt
  JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_gauge(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_gauge(TEXT) TO anon;
