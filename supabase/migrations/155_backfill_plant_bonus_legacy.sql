-- 155_backfill_plant_bonus_legacy.sql
-- WHY : la mig 152 a installé le modèle user-centric (1 user = 1 mécène = 1 veilleur)
-- mais a oublié de backfiller le bonus de plantage GPS (+50 + 30/compagnon, cap 10)
-- pour les veilleurs antérieurs à la mig. 1270/1838 lieux veillés étaient à
-- score user = 0, renversables pour 1 🪙 (bug Musée Océanographique 10/05).
--
-- Ce patch insère un row 'plant_bonus' rétroactif au profit du veilleur courant
-- pour chaque lieu encore veillé en GPS direct (place_veille.by_influence = false).
-- Skip les bascules à distance (by_influence = true) — pas de plant à honorer.
-- Skip les places ayant déjà un plant_bonus pour ce veilleur (idempotent).
--
-- created_at = pv.planted_at pour préserver la chronologie (les anciens
-- veilleurs gagnent les égalités via MIN(created_at) dans _top_user_for_place).

BEGIN;

INSERT INTO public.place_court_action (
  place_id, user_id, expedition_id, beneficiary_user_id, side, amount, created_at
)
SELECT
  pv.place_id,
  pv.veilleur_user_id,
  pv.expedition_id,
  pv.veilleur_user_id,
  'plant_bonus',
  COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_solo_bonus'), 50)
  + COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_per_extra_member'), 30)
    * LEAST(
        GREATEST(
          (SELECT COUNT(*)::int - 1 FROM public.expedition_members em
           WHERE em.expedition_id = pv.expedition_id),
          0
        ),
        COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_max_members_for_bonus'), 10)
      ),
  pv.planted_at
FROM public.place_veille pv
WHERE pv.veilleur_user_id IS NOT NULL
  AND pv.expedition_id IS NOT NULL
  AND COALESCE(pv.by_influence, false) = false
  AND NOT EXISTS (
    SELECT 1 FROM public.place_court_action pca
    WHERE pca.place_id = pv.place_id
      AND pca.beneficiary_user_id = pv.veilleur_user_id
      AND pca.side = 'plant_bonus'
  );

COMMIT;
