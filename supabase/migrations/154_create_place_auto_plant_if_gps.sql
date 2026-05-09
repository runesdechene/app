-- 154_create_place_auto_plant_if_gps.sql
-- WHY : bug game design (Uriel 9/05 nuit). Quand un user crée un lieu en GPS
-- (distance ≤ 0.5km via app_settings.distance_gps_km), il devrait devenir
-- veilleur automatiquement avec bonus +50 (cf mig 152 user-centric). Aujourd'hui
-- create_place log la distance (V127 "debug du bug auto-plant") mais ne déclenche
-- pas plant_flag — le lieu reste vacant après création, n'importe qui peut le
-- prendre avec 1 Couronne via "Poser ma marque".
--
-- Fix : à la fin du bloc IF v_is_gps THEN dans _create_place_internal, on
-- effectue l'équivalent d'un plant_flag CAS C solo (pas de compagnons à la
-- création — pour ajouter des compagnons, le user pourra plant_flag à nouveau
-- ensuite). Logique inlinée pour respecter feedback_no_coupling_via_perform_rpcs
-- (2/05) — pas de PERFORM RPC dans RPC.
--
-- Reprise B1 verbatim de la mig 127. Modif ciblée : ajout du bloc auto-plant
-- dans IF v_is_gps + déclaration de 2 vars locales.

BEGIN;

CREATE OR REPLACE FUNCTION public._create_place_internal(
  p_user_id      text,
  p_title        text,
  p_latitude     real,
  p_longitude    real,
  p_tag_id       text,
  p_images       jsonb DEFAULT '[]'::jsonb,
  p_address      text  DEFAULT ''::text,
  p_text         text  DEFAULT ''::text,
  p_user_lat     real  DEFAULT NULL::real,
  p_user_lng     real  DEFAULT NULL::real,
  p_carnet_title text  DEFAULT NULL::text,
  p_era_id       text  DEFAULT NULL::text,
  p_year_exact   integer DEFAULT NULL::integer
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_new_id         text;
  v_actor_name     text;
  v_faction_id     text;
  v_influence_gain int := 0;
  v_content_pts    int;
  v_is_gps         boolean := FALSE;
  v_distance_km    numeric;
  v_gps_radius     numeric;
  v_images         jsonb;
  v_carnet_urls    jsonb;
  v_user_pos_provided boolean;
  -- V154 : auto-plant
  v_auto_expedition_id uuid;
  v_solo_bonus         integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM tags WHERE id = p_tag_id) THEN
    RETURN json_build_object('error', 'Tag not found');
  END IF;

  v_images := COALESCE(p_images, '[]'::jsonb);

  SELECT COALESCE((SELECT value::numeric FROM app_settings WHERE key = 'distance_gps_km'), 0.5)
  INTO v_gps_radius;

  v_user_pos_provided := (p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL);

  IF v_user_pos_provided THEN
    v_distance_km := 6371 * acos(
      LEAST(1, GREATEST(-1,
        cos(radians(p_user_lat)) * cos(radians(p_latitude))
        * cos(radians(p_longitude) - radians(p_user_lng))
        + sin(radians(p_user_lat)) * sin(radians(p_latitude))
      ))
    );
    v_is_gps := v_distance_km <= v_gps_radius;
  END IF;

  v_new_id := gen_random_uuid()::text;

  INSERT INTO places (
    id, created_at, updated_at,
    author_id, place_type_id,
    title, text, address,
    latitude, longitude,
    images, private, masked,
    era_id, year_exact
  ) VALUES (
    v_new_id, NOW(), NOW(),
    p_user_id, 'lieu',
    p_title, p_text, p_address,
    p_latitude, p_longitude,
    v_images, false, false,
    p_era_id, p_year_exact
  );

  INSERT INTO place_tags (place_id, tag_id, is_primary)
  VALUES (v_new_id, p_tag_id, true);

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, v_new_id, CASE WHEN v_is_gps THEN 'gps' ELSE 'author' END)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  UPDATE users SET exploration_points = exploration_points + 5
  WHERE id = p_user_id;

  IF v_is_gps THEN
    v_influence_gain := 30;
    UPDATE users SET exploration_points = exploration_points + 10
    WHERE id = p_user_id;

    INSERT INTO place_explorers (place_id, user_id)
    VALUES (v_new_id, p_user_id)
    ON CONFLICT DO NOTHING;

    -- V154 : auto-plant flag (créateur sur place = veilleur initial)
    -- Skipped si user n'a pas de faction (cohérent avec plant_flag mig 152
    -- qui retourne 'no_faction' dans ce cas).
    IF v_faction_id IS NOT NULL THEN
      v_solo_bonus := COALESCE(
        (SELECT value::integer FROM public.app_settings WHERE key = 'plant_flag_solo_bonus'),
        50
      );

      -- Expedition solo (1 membre = créateur, title NULL = mode user-centric)
      INSERT INTO public.expeditions (place_id, is_neutral, faction_id, title, created_at)
      VALUES (v_new_id, false, v_faction_id, NULL, NOW())
      RETURNING id INTO v_auto_expedition_id;

      INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
      VALUES (v_auto_expedition_id, p_user_id, v_faction_id);

      -- place_veille : créateur = veilleur user
      INSERT INTO public.place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id, veilleur_user_id)
      VALUES (v_new_id, v_auto_expedition_id, v_faction_id, false, NOW(), false, NULL, p_user_id);

      -- Bonus +50 (solo, pas de compagnons à la création — pour ajouter des
      -- compagnons, le user devra plant_flag explicitement après)
      INSERT INTO public.place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
      VALUES (v_new_id, p_user_id, v_auto_expedition_id, p_user_id, 'plant_bonus', v_solo_bonus);

      -- veille_history (cohérence avec plant_flag)
      INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
      VALUES (v_new_id, v_auto_expedition_id, p_user_id, v_faction_id, false, NOW());

      -- activity_log plant_flag pour les toasts d'activité de la carte
      INSERT INTO public.activity_log (type, actor_id, place_id, faction_id, data)
      VALUES ('plant_flag', p_user_id, v_new_id, v_faction_id,
        jsonb_build_object(
          'placeTitle',   p_title,
          'isNeutral',    false,
          'expeditionId', v_auto_expedition_id,
          'memberCount',  1,
          'fromCreate',   true,
          'plantBonus',   v_solo_bonus
        ));
    END IF;
  END IF;

  v_content_pts := 10;
  IF jsonb_array_length(v_images) > 0 THEN
    v_content_pts := v_content_pts + 10;
  END IF;

  v_carnet_urls := COALESCE(
    (SELECT jsonb_agg(img->>'url')
       FROM jsonb_array_elements(v_images) AS img
       WHERE img->>'url' IS NOT NULL),
    '[]'::jsonb
  );

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, title, content, images, created_at)
  VALUES (
    v_new_id, p_user_id, v_faction_id, 'carnet',
    NULLIF(TRIM(COALESCE(p_carnet_title, '')), ''),
    COALESCE(NULLIF(TRIM(p_text), ''), 'Lieu découvert.'),
    v_carnet_urls,
    NOW()
  )
  ON CONFLICT (place_id, user_id, type) DO NOTHING;

  PERFORM recalc_place_content_points(v_new_id);

  SELECT COALESCE(first_name, email_address) INTO v_actor_name
  FROM users WHERE id = p_user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'new_place', p_user_id, v_new_id,
    jsonb_build_object(
      'placeTitle', p_title,
      'placeLatitude', p_latitude,
      'placeLongitude', p_longitude,
      'actorName', v_actor_name,
      'isGps', v_is_gps,
      'permanent', v_is_gps,
      'userDistanceKm', CASE WHEN v_distance_km IS NULL THEN NULL ELSE ROUND(v_distance_km, 3) END,
      'userPosProvided', v_user_pos_provided,
      'autoPlanted', v_is_gps AND v_faction_id IS NOT NULL
    )
  );

  RETURN json_build_object(
    'success', true,
    'placeId', v_new_id,
    'isGps', v_is_gps,
    'userDistanceKm', CASE WHEN v_distance_km IS NULL THEN NULL ELSE ROUND(v_distance_km, 3) END,
    'userPosProvided', v_user_pos_provided,
    'autoPlanted', v_is_gps AND v_faction_id IS NOT NULL,
    'rewards', json_build_object(
      'permanentInfluence', v_influence_gain,
      'explorationGain', CASE WHEN v_is_gps THEN 15 ELSE 5 END,
      'contentPoints', v_content_pts,
      'isExplorer', v_is_gps,
      'plantBonus', CASE WHEN v_is_gps AND v_faction_id IS NOT NULL THEN COALESCE(v_solo_bonus, 50) ELSE 0 END
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._create_place_internal(text, text, real, real, text, jsonb, text, text, real, real, text, text, integer)
  TO anon, authenticated, service_role;

COMMIT;
