-- 053_v07_veteran_marking.sql
-- WHY : marque comme "Vétéran de la Première Époque" tous les users qui ont
-- contribué au moins une fois AVANT le déploiement de la feature niveaux.
--
-- À appliquer JUSTE AVANT le déploiement front pour minimiser la fenêtre où
-- de nouveaux contributeurs (post-mig 040 mais pré-deploy front) seraient
-- considérés comme vétérans alors qu'ils n'auraient connu que le système niveaux.
--
-- Critère : avoir au moins 1 trace d'activité avant 2026-05-01 (lancement V0.7
-- phase 1 / système niveaux). Toutes les sources d'action sont prises en compte
-- (visites, ajouts de lieux, contributions, énigmes, plantages, découvertes).

UPDATE public.users SET veteran_first_era = true
WHERE id IN (
  SELECT DISTINCT user_id FROM public.place_explorers WHERE visited_at < '2026-05-01'
  UNION
  SELECT author_id FROM public.places WHERE author_id IS NOT NULL AND created_at < '2026-05-01'
  UNION
  SELECT user_id FROM public.place_contributions WHERE created_at < '2026-05-01'
  UNION
  SELECT user_id FROM public.enigma_responses WHERE correct = true AND responded_at < '2026-05-01'
  UNION
  SELECT user_id FROM public.veille_history WHERE planted_at < '2026-05-01'
  UNION
  SELECT user_id FROM public.places_discovered WHERE discovered_at < '2026-05-01'
);
