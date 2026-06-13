-- 246_fix_visit_gps_influence_stock_and_plant_records_visit.sql
-- WHY : la visite GPS était cassée depuis ~3 mai 2026.
--   1. _visit_place_gps_internal écrivait encore `influence_stock` (colonne droppée
--      en mig 077) → la fonction PLANTAIT à chaque appel, et l'INSERT place_explorers
--      juste au-dessus était rollback avec → AUCUNE visite GPS enregistrée (0 event
--      visit_gps sur 30j). Cassait « Poser ma marque » ET la visite parallèle du plantage.
--      → on retire l'écriture influence_stock (même nettoyage que revisit_place_gps en V077).
--   2. plant_flag ne marquait pas le planteur comme explorateur (il s'appuyait sur un
--      appel parallèle best-effort à visit_place_gps, cassé + fragile). Or planter exige
--      d'être sur place (distance < 200 m vérifiée). → plant_flag inscrit désormais
--      lui-même planteur + partenaires dans place_explorers (planter = visiter).
--   3. Backfill des plantages GPS existants (place_veille.by_influence = false) absents
--      de place_explorers — trigger XP désactivé pour ne pas balancer d'XP rétroactive.
-- Discipline B1 : defs copiées verbatim du live + deltas ciblés.

-- ── 1. Réparation de la visite GPS (retrait influence_stock) ──
CREATE OR REPLACE FUNCTION public._visit_place_gps_internal(p_user_id text, p_place_id text, p_user_lat numeric, p_user_lng numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_faction_id TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_already_visited BOOLEAN;
  v_stock_gain INT;
  v_exploration_gain INT;
  v_new_exploration INT;
  v_actor_name TEXT;
  v_explorer_count INT;
  v_explorer RECORD;
  v_author_id TEXT;
  v_guardian_id TEXT;
  v_carnet_author RECORD;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);

  IF v_distance_km > 0.2 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::NUMERIC, 2));
  END IF;

  SELECT EXISTS(SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id)
  INTO v_already_visited;

  IF v_already_visited THEN
    RETURN json_build_object('error', 'already_visited');
  END IF;

  v_stock_gain := 15;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_visit_gps'), 10) INTO v_exploration_gain;

  INSERT INTO place_explorers (place_id, user_id) VALUES (p_place_id, p_user_id);

  -- V246 : retiré `influence_stock = influence_stock + v_stock_gain` (colonne droppée
  -- en mig 077 — c'est ce write fantôme qui faisait planter toute la fonction).
  UPDATE users SET
    exploration_points = exploration_points + v_exploration_gain
  WHERE id = p_user_id
  RETURNING exploration_points INTO v_new_exploration;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('visit_gps', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object(
      'stockGain', v_stock_gain,
      'explorationGain', v_exploration_gain
    ));

  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM users WHERE id = p_user_id;

  FOR v_explorer IN
    SELECT user_id FROM place_explorers
    WHERE place_id = p_place_id AND user_id != p_user_id
  LOOP
    PERFORM notify_exploration(v_explorer.user_id, p_place_id, v_actor_name);
  END LOOP;

  SELECT COUNT(*) INTO v_explorer_count FROM place_explorers WHERE place_id = p_place_id;
  IF v_explorer_count IN (5, 10, 25, 50) THEN
    SELECT author_id INTO v_author_id FROM places WHERE id = p_place_id;
    v_guardian_id := get_place_guardian(p_place_id);

    IF v_author_id IS NOT NULL THEN
      PERFORM notify(v_author_id, 'milestone_exploration', jsonb_build_object(
        'placeId', p_place_id, 'explorerCount', v_explorer_count
      ));
    END IF;
    IF v_guardian_id IS NOT NULL AND v_guardian_id != v_author_id THEN
      PERFORM notify(v_guardian_id, 'milestone_exploration', jsonb_build_object(
        'placeId', p_place_id, 'explorerCount', v_explorer_count
      ));
    END IF;
    FOR v_carnet_author IN
      SELECT DISTINCT user_id FROM place_contributions
      WHERE place_id = p_place_id AND type = 'carnet'
        AND user_id != COALESCE(v_author_id, '')
        AND user_id != COALESCE(v_guardian_id, '')
    LOOP
      PERFORM notify(v_carnet_author.user_id, 'milestone_exploration', jsonb_build_object(
        'placeId', p_place_id, 'explorerCount', v_explorer_count
      ));
    END LOOP;
  END IF;

  RETURN json_build_object(
    'success', true,
    'stockGain', v_stock_gain,
    'explorationGain', v_exploration_gain,
    'newInfluenceStock', 0,
    'newExploration', v_new_exploration,
    'newGlory', v_new_exploration + (SELECT erudition_points FROM users WHERE id = p_user_id),
    'visitNumber', 1
  );
END;
$function$;

-- ── 2. plant_flag : enregistre la visite (planteur + partenaires présents) ──
-- Copie verbatim du live + 1 ajout : INSERT place_explorers juste après la
-- validation de distance (on est forcément sur place). ON CONFLICT DO NOTHING
-- (doublon silencieux si déjà visité). EXISTS users → garde FK pour les partenaires.
CREATE OR REPLACE FUNCTION public.plant_flag(p_user_id text, p_place_id text, p_user_lat numeric, p_user_lng numeric, p_partners_user_ids text[] DEFAULT '{}'::text[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_faction text; v_place_lat numeric; v_place_lng numeric; v_place_title text;
  v_distance_km numeric; v_expedition_id uuid; v_is_neutral boolean := false;
  v_expedition_faction text; v_factions text[]; v_partner_user_id text;
  v_partner_faction text; v_members_json jsonb; v_now timestamptz := now();
  v_cooldown_hours int := _barem('cooldown.replant_hours', 24);
  v_last_plant timestamptz; v_remaining_hours numeric;
  v_prev_veilleur_exp uuid; v_prev_by_influence boolean; v_prev_previous_exp uuid;
  v_threats_cleared int; v_notif_data jsonb;
  v_solo_bonus integer; v_per_extra integer; v_max_companions integer;
  v_companions_count integer; v_plant_bonus_amount integer;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT faction_id INTO v_user_faction FROM public.users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM public.places WHERE id = p_place_id;
  IF v_place_lat IS NULL THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
  IF v_distance_km > 0.2 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::numeric, 2));
  END IF;

  -- V246 — planter = visiter : distance validée (< 200 m), donc le planteur et ses
  -- partenaires présents sont marqués explorateurs du lieu. Corrige le bug où planter
  -- ne comptait jamais comme une visite (visit_place_gps parallèle cassé). Le trigger
  -- trg_xp_explorer_ins accorde l'XP d'exploration (comportement intended restauré).
  INSERT INTO public.place_explorers (place_id, user_id)
  SELECT p_place_id, uid
  FROM unnest(array[p_user_id] || COALESCE(p_partners_user_ids, '{}')) AS uid
  WHERE EXISTS (SELECT 1 FROM public.users u WHERE u.id = uid)
  ON CONFLICT DO NOTHING;

  SELECT pv.expedition_id, pv.by_influence, pv.previous_expedition_id
  INTO v_prev_veilleur_exp, v_prev_by_influence, v_prev_previous_exp
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  v_solo_bonus := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_solo_bonus'), 50);
  v_per_extra := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_per_extra_member'), 30);
  v_max_companions := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_max_members_for_bonus'), 10);

  v_companions_count := LEAST(COALESCE(array_length(p_partners_user_ids, 1), 0), v_max_companions);
  v_plant_bonus_amount := v_solo_bonus + v_per_extra * v_companions_count;

  -- CAS A
  IF COALESCE(v_prev_by_influence, false) = true
     AND v_prev_previous_exp IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.expedition_members em WHERE em.expedition_id = v_prev_previous_exp AND em.user_id = p_user_id)
  THEN
    UPDATE public.place_veille
    SET expedition_id = v_prev_previous_exp, by_influence = false, previous_expedition_id = NULL,
        planted_at = v_now, veilleur_user_id = p_user_id,
        faction_id = (SELECT faction_id FROM public.expeditions WHERE id = v_prev_previous_exp),
        is_neutral = (SELECT is_neutral FROM public.expeditions WHERE id = v_prev_previous_exp)
    WHERE place_id = p_place_id;

    DELETE FROM public.place_court_action WHERE place_id = p_place_id AND beneficiary_user_id IS DISTINCT FROM p_user_id;
    INSERT INTO public.place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
    VALUES (p_place_id, p_user_id, v_prev_previous_exp, p_user_id, 'plant_bonus', v_plant_bonus_amount);

    DELETE FROM public.place_court_score WHERE place_id = p_place_id;

    v_notif_data := jsonb_build_object('placeId', p_place_id, 'placeTitle', v_place_title,
      'expeditionId', v_prev_veilleur_exp, 'reclaimedBy', v_prev_previous_exp);
    INSERT INTO public.activity_log (type, actor_id, place_id, data)
    VALUES ('place_taken_back_gps', p_user_id, p_place_id, v_notif_data);
    PERFORM public._notify_court_members(v_prev_veilleur_exp, 'place_taken_back_gps', v_notif_data, p_user_id);

    INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
    VALUES (p_place_id, v_prev_previous_exp, p_user_id, v_user_faction, false, v_now);

    SELECT jsonb_agg(jsonb_build_object('userId', em.user_id,
      'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
      'avatarUrl', u.avatar_url, 'factionId', em.faction_id))
    INTO v_members_json
    FROM public.expedition_members em JOIN public.users u ON u.id = em.user_id
    WHERE em.expedition_id = v_prev_previous_exp;

    RETURN json_build_object('success', true, 'mode', 'reclaim_gps', 'placeId', p_place_id,
      'expeditionId', v_prev_previous_exp, 'members', v_members_json, 'plantedAt', v_now,
      'plantBonus', v_plant_bonus_amount);
  END IF;

  -- CAS B
  IF COALESCE(v_prev_by_influence, false) = true
     AND v_prev_veilleur_exp IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.expedition_members em WHERE em.expedition_id = v_prev_veilleur_exp AND em.user_id = p_user_id)
  THEN
    UPDATE public.place_veille SET by_influence = false, previous_expedition_id = NULL, planted_at = v_now, veilleur_user_id = p_user_id
    WHERE place_id = p_place_id;

    DELETE FROM public.place_court_action WHERE place_id = p_place_id AND beneficiary_user_id IS DISTINCT FROM p_user_id;
    INSERT INTO public.place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
    VALUES (p_place_id, p_user_id, v_prev_veilleur_exp, p_user_id, 'plant_bonus', v_plant_bonus_amount);

    DELETE FROM public.place_court_score WHERE place_id = p_place_id AND expedition_id != v_prev_veilleur_exp;

    INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
    VALUES (p_place_id, v_prev_veilleur_exp, p_user_id, v_user_faction, false, v_now);

    SELECT jsonb_agg(jsonb_build_object('userId', em.user_id,
      'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
      'avatarUrl', u.avatar_url, 'factionId', em.faction_id))
    INTO v_members_json
    FROM public.expedition_members em JOIN public.users u ON u.id = em.user_id
    WHERE em.expedition_id = v_prev_veilleur_exp;

    RETURN json_build_object('success', true, 'mode', 'confirm_gps', 'placeId', p_place_id,
      'expeditionId', v_prev_veilleur_exp, 'members', v_members_json, 'plantedAt', v_now,
      'plantBonus', v_plant_bonus_amount);
  END IF;

  -- CAS D — reaffirm_gps : pas d'insert veille_history (mig 167), pas de plant_bonus (mig 166)
  IF COALESCE(v_prev_by_influence, false) = false
     AND v_prev_veilleur_exp IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.expedition_members em WHERE em.expedition_id = v_prev_veilleur_exp AND em.user_id = p_user_id)
  THEN
    UPDATE public.place_veille SET planted_at = v_now, veilleur_user_id = p_user_id WHERE place_id = p_place_id;

    v_notif_data := jsonb_build_object('placeId', p_place_id, 'placeTitle', v_place_title, 'expeditionId', v_prev_veilleur_exp);
    PERFORM public._notify_court_challengers(p_place_id, v_prev_veilleur_exp, 'place_reaffirmed', v_notif_data, p_user_id);

    DELETE FROM public.place_court_action WHERE place_id = p_place_id AND beneficiary_user_id IS DISTINCT FROM p_user_id;
    DELETE FROM public.place_court_score WHERE place_id = p_place_id AND expedition_id != v_prev_veilleur_exp;
    GET DIAGNOSTICS v_threats_cleared = ROW_COUNT;

    IF v_threats_cleared > 0 THEN
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_reaffirmed', p_user_id, p_place_id, v_notif_data || jsonb_build_object('threatsCleared', v_threats_cleared));
    END IF;

    SELECT jsonb_agg(jsonb_build_object('userId', em.user_id,
      'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
      'avatarUrl', u.avatar_url, 'factionId', em.faction_id))
    INTO v_members_json
    FROM public.expedition_members em JOIN public.users u ON u.id = em.user_id
    WHERE em.expedition_id = v_prev_veilleur_exp;

    RETURN json_build_object('success', true, 'mode', 'reaffirm_gps', 'placeId', p_place_id,
      'expeditionId', v_prev_veilleur_exp, 'members', v_members_json, 'plantedAt', v_now,
      'threatsCleared', v_threats_cleared, 'plantBonus', 0);
  END IF;

  -- CAS C
  SELECT MAX(planted_at) INTO v_last_plant
  FROM public.veille_history WHERE user_id = p_user_id AND place_id = p_place_id;

  IF v_last_plant IS NOT NULL AND v_last_plant > (v_now - (v_cooldown_hours || ' hours')::interval) THEN
    v_remaining_hours := EXTRACT(EPOCH FROM ((v_last_plant + (v_cooldown_hours || ' hours')::interval) - v_now)) / 3600.0;
    RETURN json_build_object('error', 'cooldown',
      'remainingHours', ROUND(v_remaining_hours::numeric, 1),
      'cooldownHours', v_cooldown_hours);
  END IF;

  SELECT array_agg(DISTINCT u.faction_id) INTO v_factions
  FROM public.users u
  WHERE (u.id = ANY(p_partners_user_ids) OR u.id = p_user_id) AND u.faction_id IS NOT NULL;

  v_is_neutral := (COALESCE(array_length(v_factions, 1), 0) > 1);
  v_expedition_faction := CASE WHEN v_is_neutral THEN NULL ELSE v_user_faction END;

  DECLARE
    v_planter_name text;
    v_title text;
  BEGIN
    SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_planter_name FROM public.users WHERE id = p_user_id;
    v_title := CASE WHEN COALESCE(array_length(p_partners_user_ids, 1), 0) > 0
      THEN 'Expédition de ' || v_planter_name ELSE NULL END;
    INSERT INTO public.expeditions (place_id, is_neutral, faction_id, title, created_at)
    VALUES (p_place_id, v_is_neutral, v_expedition_faction, v_title, v_now)
    RETURNING id INTO v_expedition_id;
  END;

  INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
  VALUES (v_expedition_id, p_user_id, v_user_faction);

  IF array_length(p_partners_user_ids, 1) > 0 THEN
    FOREACH v_partner_user_id IN ARRAY p_partners_user_ids LOOP
      IF v_partner_user_id = p_user_id THEN CONTINUE; END IF;
      SELECT faction_id INTO v_partner_faction FROM public.users WHERE id = v_partner_user_id;
      IF v_partner_faction IS NOT NULL THEN
        INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
        VALUES (v_expedition_id, v_partner_user_id, v_partner_faction) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  IF v_prev_veilleur_exp IS NOT NULL AND v_prev_veilleur_exp != v_expedition_id THEN
    PERFORM public._notify_court_members(v_prev_veilleur_exp, 'place_taken_back_gps', jsonb_build_object(
      'placeId', p_place_id, 'placeTitle', v_place_title,
      'expeditionId', v_prev_veilleur_exp, 'reclaimedBy', v_expedition_id,
      'plantedByUser', p_user_id), p_user_id);
  END IF;

  INSERT INTO public.place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id, veilleur_user_id)
  VALUES (p_place_id, v_expedition_id, v_expedition_faction, v_is_neutral, v_now, false, NULL, p_user_id)
  ON CONFLICT (place_id) DO UPDATE SET
    expedition_id = EXCLUDED.expedition_id, faction_id = EXCLUDED.faction_id,
    is_neutral = EXCLUDED.is_neutral, planted_at = EXCLUDED.planted_at,
    by_influence = false, previous_expedition_id = NULL, veilleur_user_id = EXCLUDED.veilleur_user_id;

  DELETE FROM public.place_court_action WHERE place_id = p_place_id AND beneficiary_user_id IS DISTINCT FROM p_user_id;
  INSERT INTO public.place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
  VALUES (p_place_id, p_user_id, v_expedition_id, p_user_id, 'plant_bonus', v_plant_bonus_amount);

  DELETE FROM public.place_court_score WHERE place_id = p_place_id;

  INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
  SELECT p_place_id, v_expedition_id, em.user_id, em.faction_id, v_is_neutral, v_now
  FROM public.expedition_members em WHERE em.expedition_id = v_expedition_id;

  SELECT jsonb_agg(jsonb_build_object('userId', em.user_id,
    'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
    'avatarUrl', u.avatar_url, 'factionId', em.faction_id))
  INTO v_members_json
  FROM public.expedition_members em JOIN public.users u ON u.id = em.user_id
  WHERE em.expedition_id = v_expedition_id;

  INSERT INTO public.activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('plant_flag', p_user_id, p_place_id, v_expedition_faction,
    jsonb_build_object('placeTitle', v_place_title, 'isNeutral', v_is_neutral,
      'expeditionId', v_expedition_id, 'memberCount', jsonb_array_length(v_members_json),
      'members', v_members_json));

  RETURN json_build_object('success', true, 'mode', 'plant', 'placeId', p_place_id,
    'isNeutral', v_is_neutral, 'factionId', v_expedition_faction,
    'expeditionId', v_expedition_id, 'members', v_members_json,
    'plantedAt', v_now, 'plantBonus', v_plant_bonus_amount);
END;
$function$;

-- ── 3. Backfill : plantages GPS existants absents de place_explorers ──
-- Trigger XP désactivé : on enregistre la présence sans balancer d'XP rétroactive.
ALTER TABLE public.place_explorers DISABLE TRIGGER trg_xp_explorer_ins;

INSERT INTO public.place_explorers (place_id, user_id)
SELECT DISTINCT pv.place_id, em.user_id
FROM public.place_veille pv
JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id
WHERE pv.by_influence = false
ON CONFLICT DO NOTHING;

ALTER TABLE public.place_explorers ENABLE TRIGGER trg_xp_explorer_ins;
