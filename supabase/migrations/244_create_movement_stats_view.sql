-- 244_create_movement_stats_view.sql
-- WHY : feature « Mur du Mouvement » (repo hub, 2026-06-12). Vue de stats publiques
-- (users_count / places_count). Ré-adoptée en NNN pour aligner le `db push` de ce
-- repo. Idempotente (CREATE OR REPLACE VIEW), déjà en prod.
CREATE OR REPLACE VIEW public.movement_stats AS
SELECT
  (SELECT count(*) FROM public.users)  AS users_count,
  (SELECT count(*) FROM public.places) AS places_count;

GRANT SELECT ON public.movement_stats TO anon, authenticated;
