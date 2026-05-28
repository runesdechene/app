-- 175_gps_radius_100_to_200m.sql
-- WHY : decision Uriel 28/05/2026 — le rayon GPS de 100 m est trop strict pour
-- les grands ouvrages (viaducs, ponts, cathedrales, lieux paysagers). Cas
-- concret : RICKNON au pied du viaduc de la Borrèze (Souillac), bouton
-- "Planter mon étendard" gris infonctionnel parce que la coord du POI est sur
-- le tablier et lui en contrebas, dépassant les 100 m haversine.
--
-- Bump global : 100 m → 200 m pour les 3 RPCs qui font ce check :
--   - plant_flag           (mig 166 = derniere version explicite, à 0.1)
--   - revisit_place_gps    (dernière re-création non tracée comme mig dédiée)
--   - _visit_place_gps_internal (helper de visit_place_gps)
--
-- MÉTHODE : on patche dynamiquement via pg_get_functiondef + replace + EXECUTE,
-- pour eviter de recopier 350 lignes de RPC. Idempotent : relancer ne change
-- rien si la fonction est déjà à 0.2.
--
-- DRIFT REPO/PROD : les fichiers mig 166 / definitions historiques de
-- revisit_place_gps et _visit_place_gps_internal restent en repo avec leur
-- valeur 0.1. Le prochain qui édite l'un de ces RPCs doit IMPÉRATIVEMENT
-- partir de pg_get_functiondef en prod (pas du repo) sous peine de réintroduire
-- la valeur 0.1. Noté dans docs/db/tech-debt.md.
--
-- À NOTER : create_place / _visit_place_gps_for_create utilisent un baremo
-- distinct `distance_gps_km` (0.5 km) — INCHANGÉ, sémantique différente
-- (détection automatique "visite GPS au moment de la création" du lieu).

BEGIN;

DO $$
DECLARE
  fn record;
  new_def text;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('plant_flag', 'revisit_place_gps', '_visit_place_gps_internal')
  LOOP
    new_def := pg_get_functiondef(fn.oid);
    new_def := replace(new_def, 'v_distance_km > 0.1', 'v_distance_km > 0.2');
    EXECUTE new_def;
    RAISE NOTICE 'patched: %', fn.proname;
  END LOOP;
END $$;

COMMIT;
