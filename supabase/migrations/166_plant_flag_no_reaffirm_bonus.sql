-- 166_plant_flag_no_reaffirm_bonus.sql
-- WHY : exploit prod découvert le 11/05/2026. Un user déjà veilleur GPS pouvait
-- re-cliquer "Planter étendard" en boucle. La RPC plant_flag CAS D
-- (reaffirm_gps) insérait un plant_bonus de +50 à chaque appel, sans aucun
-- cooldown (le cooldown 24h n'était checké qu'en CAS C = nouveau plant).
-- Conséquence : score Cour cumulable à l'infini par spam de clic.
--
-- Fix : en mode reaffirm_gps, on garde l'utilité défensive (efface les
-- menaces, met à jour planted_at, log si threats_cleared > 0), mais on
-- N'INSÈRE PLUS de plant_bonus. Le user garde son plant_bonus initial
-- (préservé par le filtre `beneficiary_user_id IS DISTINCT FROM p_user_id`
-- dans le DELETE), il ne peut juste plus en cumuler.
--
-- Méthode : copy-paste baseline ENTIÈRE de pg_get_functiondef + retrait du
-- bloc INSERT INTO public.place_court_action (...plant_bonus...) en CAS D.
-- Aucune autre logique modifiée.
--
-- Audit post-fix : 1 seul user concerné (test interne), 2 doublons nettoyés
-- via DELETE séparé (pas de migration data — tampering ponctuel uniquement).
--
-- NOTE 11/05 (post-revert V0.8.10) : cette mig REST APPLIQUÉE EN PROD malgré
-- le revert du code front (V0.8.10 plantait l'app sur fiche lieu — root cause
-- côté front à investiguer). Le repo et la prod sont désormais cohérents sur
-- la définition SQL de plant_flag.

CREATE OR REPLACE FUNCTION public.plant_flag(p_user_id text, p_place_id text, p_user_lat numeric, p_user_lng numeric, p_partners_user_ids text[] DEFAULT '{}'::text[])
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_faction        text;
  v_place_lat           numeric;
  v_place_lng           numeric;
  v_place_title         text;
  v_distance_km         numeric;
  v_expedition_id       uuid;
  v_is_neutral          boolean := false;
  v_expedition_faction  text;
  v_factions            text[];
  v_partner_user_id     text;
  v_partner_faction     text;
  v_members_json        jsonb;
  v_now                 timestamptz := now();
  v_cooldown_hours      int := _barem('cooldown.replant_hours', 24);
  v_last_plant          timestamptz;
  v_remaining_hours     numeric;
  v_prev_veilleur_exp   uuid;
  v_prev_by_influence   boolean;
  v_prev_previous_exp   uuid;
  v_threats_cleared     int;
  v_notif_data          jsonb;
  v_solo_bonus          integer;
  v_per_extra           integer;
  v_max_companions      integer;
  v_companions_count    integer;
  v_plant_bonus_amount  integer;
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
  IF v_distance_km > 0.1 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::numeric, 2));
  END IF;

  SELECT pv.expedition_id, pv.by_influence, pv.previous_expedition_id
  INTO v_prev_veilleur_exp, v_prev_by_influence, v_prev_previous_exp
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  v_solo_bonus     := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_solo_bonus'),            50);
  v_per_extra      := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_per_extra_member'),      30);
  v_max_companions := COALESCE((SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_max_members_for_bonus'), 10);

  v_companions_count := LEAST(
    COALESCE(array_length(p_partners_user_ids, 1), 0),
    v_max_companions
  );
  v_plant_bonus_amount := v_solo_bonus + v_per_extra * v_companions_count;

  -- CAS A
  IF COALESCE(v_prev_by_influence, false) = true
     AND v_prev_previous_exp IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.expedition_members em WHERE em.expedition_id = v_prev_previous_exp AND em.user_id = p_user_id)
  THEN
    UPDATE public.place_veille
    SET expedition_id          = v_prev_previous_exp,
        by_influence           = false,
        previous_expedition_id = NULL,
        planted_at             = v_now,
        veilleur_user_id       = p_user_id,
        faction_id             = (SELECT faction_id FROM public.expeditions WHERE id = v_prev_previous_exp),
        is_neutral             = (SELECT is_neutral FROM public.expeditions WHERE id = v_prev_previous_exp)
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
    FROM public.expedition_members em
    JOIN public.users u ON u.id = em.user_id
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
    UPDATE public.place_veille
    SET by_influence = false, previous_expedition_id = NULL, planted_at = v_now, veilleur_user_id = p_user_id
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
    FROM public.expedition_members em
    JOIN public.users u ON u.id = em.user_id
    WHERE em.expedition_id = v_prev_veilleur_exp;

    RETURN json_build_object('success', true, 'mode', 'confirm_gps', 'placeId', p_place_id,
      'expeditionId', v_prev_veilleur_exp, 'members', v_members_json, 'plantedAt', v_now,
      'plantBonus', v_plant_bonus_amount);
  END IF;

  -- CAS D — reaffirm_gps : déjà veilleur GPS, refait son plant.
  -- FIX 11/05 : ne plus insérer de plant_bonus (exploit). Le user garde son
  -- plant_bonus initial (préservé par le DELETE filtré beneficiary != user).
  -- Reste utile : efface les menaces, met à jour planted_at, log si nettoyage.
  IF COALESCE(v_prev_by_influence, false) = false
     AND v_prev_veilleur_exp IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.expedition_members em WHERE em.expedition_id = v_prev_veilleur_exp AND em.user_id = p_user_id)
  THEN
    UPDATE public.place_veille SET planted_at = v_now, veilleur_user_id = p_user_id WHERE place_id = p_place_id;

    v_notif_data := jsonb_build_object('placeId', p_place_id, 'placeTitle', v_place_title, 'expeditionId', v_prev_veilleur_exp);
    PERFORM public._notify_court_challengers(p_place_id, v_prev_veilleur_exp, 'place_reaffirmed', v_notif_data, p_user_id);

    DELETE FROM public.place_court_action WHERE place_id = p_place_id AND beneficiary_user_id IS DISTINCT FROM p_user_id;
    -- (volontairement pas de INSERT plant_bonus ici — anti-exploit)

    DELETE FROM public.place_court_score WHERE place_id = p_place_id AND expedition_id != v_prev_veilleur_exp;
    GET DIAGNOSTICS v_threats_cleared = ROW_COUNT;

    INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
    VALUES (p_place_id, v_prev_veilleur_exp, p_user_id, v_user_faction, false, v_now);

    IF v_threats_cleared > 0 THEN
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_reaffirmed', p_user_id, p_place_id, v_notif_data || jsonb_build_object('threatsCleared', v_threats_cleared));
    END IF;

    SELECT jsonb_agg(jsonb_build_object('userId', em.user_id,
      'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
      'avatarUrl', u.avatar_url, 'factionId', em.faction_id))
    INTO v_members_json
    FROM public.expedition_members em
    JOIN public.users u ON u.id = em.user_id
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
    v_title        text;
  BEGIN
    SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_planter_name
    FROM public.users WHERE id = p_user_id;
    v_title := CASE
      WHEN COALESCE(array_length(p_partners_user_ids, 1), 0) > 0
        THEN 'Expédition de ' || v_planter_name
      ELSE NULL
    END;

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
        VALUES (v_expedition_id, v_partner_user_id, v_partner_faction)
        ON CONFLICT DO NOTHING;
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
    expedition_id          = EXCLUDED.expedition_id,
    faction_id             = EXCLUDED.faction_id,
    is_neutral             = EXCLUDED.is_neutral,
    planted_at             = EXCLUDED.planted_at,
    by_influence           = false,
    previous_expedition_id = NULL,
    veilleur_user_id       = EXCLUDED.veilleur_user_id;

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
  FROM public.expedition_members em
  JOIN public.users u ON u.id = em.user_id
  WHERE em.expedition_id = v_expedition_id;

  INSERT INTO public.activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('plant_flag', p_user_id, p_place_id, v_expedition_faction,
    jsonb_build_object('placeTitle', v_place_title, 'isNeutral', v_is_neutral,
      'expeditionId', v_expedition_id,
      'memberCount', jsonb_array_length(v_members_json),
      'members', v_members_json));

  RETURN json_build_object('success', true, 'mode', 'plant', 'placeId', p_place_id,
    'isNeutral', v_is_neutral, 'factionId', v_expedition_faction,
    'expeditionId', v_expedition_id, 'members', v_members_json,
    'plantedAt', v_now, 'plantBonus', v_plant_bonus_amount);
END;
$function$;
