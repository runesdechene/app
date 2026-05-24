-- 172_v07_expeditions_map_lifecycle.sql
-- WHY : la machinerie d'archivage des voyages (mig 109) n'a jamais été branchée
-- à un cron (pg_cron n'était pas activé à l'époque ; il l'est depuis les push,
-- mig 144-146). Résultat : aucune expédition ne quitte jamais 'published', donc
-- les bannières restent sur la carte indéfiniment. On branche le cron, on ramène
-- la grâce carte de 30j à 7j (décision couplée : à J+7 → hors carte + Archives +
-- chat fermé d'un coup), et on ajoute un RPC dédié à la carte qui renvoie aussi
-- les 'passed' (pour le rendu N&B), sans toucher list_voyages_upcoming (qui
-- alimente la liste HUD "à venir" et doit rester published-only).
-- Cf. spec docs/superpowers/specs/2026-05-24-expeditions-map-lifecycle-design.md

-- ============================================================
-- 1. Redéfinir archive_passed_voyages : passed → archived à 7j (était 30j)
--    Copie intégrale de la baseline mig 109, seul l'interval passed→archived change.
-- ============================================================
CREATE OR REPLACE FUNCTION public.archive_passed_voyages()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_passed integer;
  v_archived integer;
  v_deleted integer;
BEGIN
  -- 1. published → passed (RDV atteint)
  UPDATE public.voyages
    SET status = 'passed', updated_at = now()
    WHERE status = 'published' AND rdv_at <= now();
  GET DIAGNOSTICS v_passed = ROW_COUNT;

  -- 2. passed → archived (7j après rdv_at) — grâce carte couplée
  UPDATE public.voyages
    SET status = 'archived', updated_at = now()
    WHERE status = 'passed' AND rdv_at + interval '7 days' <= now();
  GET DIAGNOSTICS v_archived = ROW_COUNT;

  -- 3. cancelled → suppression dure 30j après cancelled_at (inchangé)
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
-- 2. Brancher le cron horaire (pattern aligné mig 144). Minute 7 = hors pic.
-- ============================================================
SELECT cron.unschedule('archive_passed_voyages')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'archive_passed_voyages');
SELECT cron.schedule(
  'archive_passed_voyages',
  '7 * * * *',
  $$ SELECT public.archive_passed_voyages(); $$
);

-- ============================================================
-- 3. RPC carte dédié : copie de list_voyages_upcoming (version courante mig 116)
--    avec un seul changement : WHERE status IN ('published','passed').
--    Renvoie le même shape (cover_image_url, unread_count, chief, status, rdv_at)
--    pour que ExpeditionBanner fonctionne sans changement de type.
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_voyages_for_map()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
  v_result json;
BEGIN
  SELECT json_agg(row_to_json(t) ORDER BY t.rdv_at ASC) INTO v_result FROM (
    SELECT
      v.id, v.name, v.rdv_at, v.rdv_lat, v.rdv_lng, v.rdv_label,
      v.call_text, v.cover_image_url,
      v.slots_max, v.slots_open, v.validation_mode, v.status,
      json_build_object(
        'user_id', u.id,
        'display_name', COALESCE(u.display_name, u.first_name, 'Voyageur'),
        'avatar_url', u.avatar_url,
        'faction_id', u.faction_id,
        'faction_title', f.title,
        'faction_color', f.color
      ) AS chief,
      (SELECT count(*) FROM public.voyage_participants p
       WHERE p.voyage_id = v.id AND p.status = 'validated') AS validated_count,
      CASE
        WHEN v_user_id IS NULL THEN 0
        WHEN v.chief_user_id = v_user_id OR EXISTS (
          SELECT 1 FROM public.voyage_participants p
          WHERE p.voyage_id = v.id AND p.user_id = v_user_id AND p.status = 'validated'
        ) THEN (
          SELECT count(*) FROM public.voyage_messages m
          WHERE m.voyage_id = v.id
            AND m.user_id <> v_user_id
            AND m.created_at > COALESCE(
              (SELECT last_read_at FROM public.voyage_message_reads
                WHERE voyage_id = v.id AND user_id = v_user_id),
              '-infinity'::timestamptz
            )
        )
        ELSE 0
      END AS unread_count
    FROM public.voyages v
    JOIN public.users u ON u.id = v.chief_user_id
    LEFT JOIN public.factions f ON f.id = u.faction_id
    WHERE v.status IN ('published','passed')
  ) t;
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_voyages_for_map() TO authenticated;
