-- 052_v07_veteran_places_boost.sql
-- WHY : récompense rétroactive pour les lieux ajoutés AVANT le 2026-03-01.
--
-- Contexte : la mig 050 (Calibration C + backfill 1er mars) a recalculé
-- xp_total pour les actions depuis le 1er mars selon les coefficients V0.7
-- (lieu ajouté = +20). Mais beaucoup de vétérans avaient cartographié des
-- centaines de lieux AVANT cette date, sans en gagner d'XP.
--
-- Cette mig leur attribue un boost rétroactif limité aux lieux ajoutés :
-- +5 par lieu pré-mars (= ÷4 du coefficient V0.7 plein).
-- Le coefficient dépondéré reflète que beaucoup de ces lieux ont été créés
-- à distance (avant l'obligation GPS), donc avec un effort physique moindre.
--
-- xp_epoch reste à 2026-03-01 (set par mig 050). Conséquence : si un de ces
-- lieux pré-mars est supprimé plus tard par modération, le trigger DELETE
-- ne retirera PAS d'XP (created_at < xp_epoch → no-op). C'est cohérent :
-- le boost est gravé.

UPDATE public.users u
SET xp_total = u.xp_total + COALESCE((
  SELECT COUNT(*)::int * 5
  FROM public.places p
  WHERE p.author_id = u.id
    AND p.created_at < '2026-03-01'
), 0);
