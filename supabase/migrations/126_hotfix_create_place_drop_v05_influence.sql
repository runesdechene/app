-- 126_hotfix_create_place_drop_v05_influence.sql
-- WHY : HOTFIX prod — _create_place_internal essayait encore d'insérer dans
-- place_influence et user_place_influence (tables V0.5) qui ont été droppées
-- par la mig 077_drop_v05_influence. Conséquence : impossible de créer un
-- lieu en mode GPS depuis l'app (erreur PG sur la première INSERT du bloc
-- v_is_gps). Bug remonté par Uriel le 8 mai 2026.
--
-- Fix : reprise EXACTE de la version courante en prod (B1, copy-paste),
-- avec uniquement le bloc IF v_is_gps THEN nettoyé :
--   - INSERT INTO place_influence : SUPPRIMÉ (table droppée mig 077)
--   - INSERT INTO user_place_influence : SUPPRIMÉ (table droppée mig 077)
--   - place_explorers : CONSERVÉ (table encore en place, utilisée ailleurs)
--   - bonus +10 exploration_points GPS : CONSERVÉ
--
-- Le champ JSON 'permanentInfluence' du retour est conservé (à 30 en GPS,
-- 0 sinon) pour rétrocompat front — n'a plus d'effet réel mais ne casse pas
-- les anciens clients en cache. À nettoyer dans un futur sprint cleanup.
--
-- Le PERFORM recalc_place_content_points reste : la fonction est devenue un
-- NO-OP par mig 087, donc aucun effet, mais l'appel ne plante pas.

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

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
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
    -- V126 : 'permanentInfluence' gardé à 30 dans le JSON de retour pour
    -- rétrocompat front, mais plus aucune écriture dans place_influence /
    -- user_place_influence (tables droppées mig 077). place_explorers et le
    -- bonus +10 exploration_points GPS sont conservés.
    v_influence_gain := 30;
    UPDATE users SET exploration_points = exploration_points + 10
    WHERE id = p_user_id;

    INSERT INTO place_explorers (place_id, user_id)
    VALUES (v_new_id, p_user_id)
    ON CONFLICT DO NOTHING;
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

  -- recalc_place_content_points est devenu NO-OP par mig 087, l'appel reste
  -- pour ne pas casser d'éventuels callers historiques mais n'a plus d'effet.
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
      'permanent', v_is_gps
    )
  );

  RETURN json_build_object(
    'success', true,
    'placeId', v_new_id,
    'isGps', v_is_gps,
    'rewards', json_build_object(
      'permanentInfluence', v_influence_gain,
      'explorationGain', CASE WHEN v_is_gps THEN 15 ELSE 5 END,
      'contentPoints', v_content_pts,
      'isExplorer', v_is_gps
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._create_place_internal(text, text, real, real, text, jsonb, text, text, real, real, text, text, integer)
  TO anon, authenticated, service_role;

COMMIT;
