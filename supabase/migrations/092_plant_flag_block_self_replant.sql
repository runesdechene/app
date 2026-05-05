-- 092_plant_flag_block_self_replant.sql
-- WHY : décision Uriel 6/05 — replanter sur son propre lieu plein-veilleur ne
-- doit RIEN faire (pas de gain, pas de reset, pas de cooldown). On bloque
-- carrément en retournant une erreur claire `already_yours`. Plus lisible
-- pour l'UX qu'un resync silencieux qui ne sert à rien.
--
-- Reste verbatim mig 091 + cas D devenu un retour d'erreur.

BEGIN;

CREATE OR REPLACE FUNCTION public.plant_flag(
  p_user_id            text,
  p_place_id           text,
  p_user_lat           numeric,
  p_user_lng           numeric,
  p_partners_user_ids  text[] DEFAULT '{}'::text[]
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
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
  v_prev_veilleur       uuid;
  v_prev_by_influence   boolean;
  v_prev_previous_exp   uuid;
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
  INTO v_prev_veilleur, v_prev_by_influence, v_prev_previous_exp
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  -- ============================================================
  -- CAS A — Reclaim par ancien veilleur déchu
  -- ============================================================
  IF COALESCE(v_prev_by_influence, false) = true
     AND v_prev_previous_exp IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.expedition_members em
       WHERE em.expedition_id = v_prev_previous_exp AND em.user_id = p_user_id
     )
  THEN
    UPDATE public.place_veille
    SET expedition_id          = v_prev_previous_exp,
        by_influence           = false,
        previous_expedition_id = NULL,
        planted_at             = v_now,
        faction_id             = (SELECT faction_id FROM public.expeditions WHERE id = v_prev_previous_exp),
        is_neutral             = (SELECT is_neutral FROM public.expeditions WHERE id = v_prev_previous_exp)
    WHERE place_id = p_place_id;

    DELETE FROM public.place_court_score WHERE place_id = p_place_id;

    INSERT INTO public.activity_log (type, actor_id, place_id, data)
    VALUES ('place_taken_back_gps', p_user_id, p_place_id, jsonb_build_object(
      'placeTitle',   v_place_title,
      'expeditionId', v_prev_veilleur,
      'reclaimedBy',  v_prev_previous_exp
    ));

    INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
    VALUES (p_place_id, v_prev_previous_exp, p_user_id, v_user_faction, false, v_now);

    SELECT jsonb_agg(jsonb_build_object(
      'userId', em.user_id,
      'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
      'avatarUrl', u.avatar_url,
      'factionId', em.faction_id
    ))
    INTO v_members_json
    FROM public.expedition_members em
    JOIN public.users u ON u.id = em.user_id
    WHERE em.expedition_id = v_prev_previous_exp;

    RETURN json_build_object(
      'success',      true,
      'mode',         'reclaim_gps',
      'placeId',      p_place_id,
      'expeditionId', v_prev_previous_exp,
      'members',      v_members_json,
      'plantedAt',    v_now
    );
  END IF;

  -- ============================================================
  -- CAS B — Confirmation IRL par membre de l'expé "par influence"
  -- ============================================================
  IF COALESCE(v_prev_by_influence, false) = true
     AND v_prev_veilleur IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.expedition_members em
       WHERE em.expedition_id = v_prev_veilleur AND em.user_id = p_user_id
     )
  THEN
    UPDATE public.place_veille
    SET by_influence           = false,
        previous_expedition_id = NULL,
        planted_at             = v_now
    WHERE place_id = p_place_id;

    DELETE FROM public.place_court_score WHERE place_id = p_place_id;

    INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
    VALUES (p_place_id, v_prev_veilleur, p_user_id, v_user_faction, false, v_now);

    SELECT jsonb_agg(jsonb_build_object(
      'userId', em.user_id,
      'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
      'avatarUrl', u.avatar_url,
      'factionId', em.faction_id
    ))
    INTO v_members_json
    FROM public.expedition_members em
    JOIN public.users u ON u.id = em.user_id
    WHERE em.expedition_id = v_prev_veilleur;

    RETURN json_build_object(
      'success',      true,
      'mode',         'confirm_gps',
      'placeId',      p_place_id,
      'expeditionId', v_prev_veilleur,
      'members',      v_members_json,
      'plantedAt',    v_now
    );
  END IF;

  -- ============================================================
  -- CAS D — BLOCAGE (V092) : déjà veilleur plein, on refuse.
  -- Décision Uriel : replanter chez soi ne sert à rien, mieux vaut
  -- afficher une erreur claire que faire un noop silencieux.
  -- ============================================================
  IF COALESCE(v_prev_by_influence, false) = false
     AND v_prev_veilleur IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.expedition_members em
       WHERE em.expedition_id = v_prev_veilleur AND em.user_id = p_user_id
     )
  THEN
    RETURN json_build_object(
      'error',         'already_yours',
      'expeditionId',  v_prev_veilleur,
      'placeTitle',    v_place_title
    );
  END IF;

  -- ============================================================
  -- CAS C — Plantage standard
  -- ============================================================

  SELECT MAX(planted_at) INTO v_last_plant
  FROM public.veille_history
  WHERE user_id = p_user_id AND place_id = p_place_id;

  IF v_last_plant IS NOT NULL
     AND v_last_plant > (v_now - (v_cooldown_hours || ' hours')::interval) THEN
    v_remaining_hours := EXTRACT(EPOCH FROM (
      (v_last_plant + (v_cooldown_hours || ' hours')::interval) - v_now
    )) / 3600.0;
    RETURN json_build_object(
      'error', 'cooldown',
      'remainingHours', ROUND(v_remaining_hours::numeric, 1),
      'cooldownHours', v_cooldown_hours
    );
  END IF;

  SELECT array_agg(DISTINCT u.faction_id) INTO v_factions
  FROM public.users u
  WHERE (u.id = ANY(p_partners_user_ids) OR u.id = p_user_id)
    AND u.faction_id IS NOT NULL;

  v_is_neutral := (COALESCE(array_length(v_factions, 1), 0) > 1);
  v_expedition_faction := CASE WHEN v_is_neutral THEN NULL ELSE v_user_faction END;

  INSERT INTO public.expeditions (place_id, is_neutral, faction_id, created_at)
  VALUES (p_place_id, v_is_neutral, v_expedition_faction, v_now)
  RETURNING id INTO v_expedition_id;

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

  INSERT INTO public.place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id)
  VALUES (p_place_id, v_expedition_id, v_expedition_faction, v_is_neutral, v_now, false, NULL)
  ON CONFLICT (place_id) DO UPDATE SET
    expedition_id          = EXCLUDED.expedition_id,
    faction_id             = EXCLUDED.faction_id,
    is_neutral             = EXCLUDED.is_neutral,
    planted_at             = EXCLUDED.planted_at,
    by_influence           = false,
    previous_expedition_id = NULL;

  DELETE FROM public.place_court_score WHERE place_id = p_place_id;

  INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
  SELECT p_place_id, v_expedition_id, em.user_id, em.faction_id, v_is_neutral, v_now
  FROM public.expedition_members em WHERE em.expedition_id = v_expedition_id;

  SELECT jsonb_agg(jsonb_build_object(
    'userId', em.user_id,
    'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
    'avatarUrl', u.avatar_url,
    'factionId', em.faction_id
  ))
  INTO v_members_json
  FROM public.expedition_members em
  JOIN public.users u ON u.id = em.user_id
  WHERE em.expedition_id = v_expedition_id;

  INSERT INTO public.activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('plant_flag', p_user_id, p_place_id, v_expedition_faction,
          jsonb_build_object(
            'placeTitle', v_place_title,
            'isNeutral', v_is_neutral,
            'expeditionId', v_expedition_id,
            'memberCount', jsonb_array_length(v_members_json),
            'members', v_members_json
          ));

  RETURN json_build_object(
    'success',      true,
    'mode',         'plant',
    'placeId',      p_place_id,
    'isNeutral',    v_is_neutral,
    'factionId',    v_expedition_faction,
    'expeditionId', v_expedition_id,
    'members',      v_members_json,
    'plantedAt',    v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.plant_flag(text, text, numeric, numeric, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.plant_flag(text, text, numeric, numeric, text[]) TO service_role;

COMMIT;
