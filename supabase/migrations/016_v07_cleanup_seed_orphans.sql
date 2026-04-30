-- 016_v07_cleanup_seed_orphans.sql
-- WHY : la mig 015 a créé 1 expédition par candidat de seed, mais le fallback
-- `place_explorers` n'était pas dédupliqué par place (plusieurs visiteurs possibles
-- par lieu). Résultat : ~1194 expéditions orphelines non pointées par place_veille.
-- Cette migration nettoie les orphelines et leurs lignes d'historique mensongères.
--
-- Aucune donnée user n'est touchée — uniquement les doublons que le seed lui-même
-- a introduits dans la mig 015.
--
-- Nettoyage en 2 temps :
--   1) Supprimer les lignes veille_history rattachées à des expéditions orphelines
--   2) Supprimer les expéditions orphelines (CASCADE → expedition_members suit)
--
-- Note future : si on rejoue un seed similaire un jour, dédupliquer le fallback
-- via DISTINCT ON (place_id) ORDER BY visited_at DESC dans le CTE.

DELETE FROM public.veille_history
WHERE expedition_id IN (
  SELECT e.id
  FROM public.expeditions e
  LEFT JOIN public.place_veille pv ON pv.expedition_id = e.id
  WHERE pv.expedition_id IS NULL
);

DELETE FROM public.expeditions
WHERE id IN (
  SELECT e.id
  FROM public.expeditions e
  LEFT JOIN public.place_veille pv ON pv.expedition_id = e.id
  WHERE pv.expedition_id IS NULL
);
