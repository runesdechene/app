-- 109_v07_expeditions_archive_cron.sql
-- WHY : transitions automatiques des voyages :
--   1. published → passed à H+RDV (rdv_at <= now())
--   2. passed → archived à RDV+30j (rdv_at + 30 days <= now())
--   3. cancelled → DELETE à cancelled_at+30j
-- Exécuté toutes les heures via pg_cron.
--
-- Note storage : la suppression dure d'un voyage cancelled doit aussi purger
-- les blobs Storage. Le DELETE CASCADE en BDD nettoie les tables relationnelles ;
-- les blobs orphelins seront purgés par un cleanup mensuel séparé (voir
-- docs/db/tech-debt.md à compléter si besoin). Acceptable pour V1.

CREATE OR REPLACE FUNCTION public.archive_passed_voyages()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_passed integer;
  v_archived integer;
  v_deleted integer;
BEGIN
  -- 1. published → passed
  UPDATE public.voyages
    SET status = 'passed', updated_at = now()
    WHERE status = 'published' AND rdv_at <= now();
  GET DIAGNOSTICS v_passed = ROW_COUNT;

  -- 2. passed → archived (30j après rdv_at)
  UPDATE public.voyages
    SET status = 'archived', updated_at = now()
    WHERE status = 'passed' AND rdv_at + interval '30 days' <= now();
  GET DIAGNOSTICS v_archived = ROW_COUNT;

  -- 3. cancelled → suppression dure 30j après cancelled_at
  -- (les blobs Storage orphelins survivent — cleanup séparé)
  DELETE FROM public.voyages
    WHERE status = 'cancelled' AND cancelled_at + interval '30 days' <= now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN json_build_object(
    'passed', v_passed,
    'archived', v_archived,
    'deleted', v_deleted,
    'ran_at', now()
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.archive_passed_voyages() TO service_role;

-- ============================================================
-- Schedule : pg_cron N'EST PAS activé sur ce projet Supabase.
-- → À brancher via une Edge Function Scheduled (déclencheur horaire)
--   qui appelle public.archive_passed_voyages() côté service_role.
-- → Workaround V1 acceptable : un voyage avec rdv_at passé reste "published"
--   en BDD jusqu'à l'appel de cette RPC. Le frontend peut compenser
--   visuellement en comparant rdv_at à now() côté client.
-- → À traiter dans docs/db/tech-debt.md si la suite tarde.
-- ============================================================
