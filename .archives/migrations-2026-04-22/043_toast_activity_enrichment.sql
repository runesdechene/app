-- 043_toast_activity_enrichment.sql
-- Enrichir les activity_log pour alimenter les toasts V0.5 :
-- 1. contribute_to_place : ajouter un log 'contribute' avec placeTitle/location/actorName
-- 2. answer_enigma : ajouter un log 'enigma_success' quand correct
-- 3. place_influence_action : enrichir data avec placeTitle/location/actorName/factionColor
-- 4. revisit_place_gps : enrichir data avec placeTitle/location/actorName/factionColor

-- ============================================================
-- 1. contribute_to_place — ajouter activity_log
-- ============================================================
CREATE OR REPLACE FUNCTION public.contribute_to_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_type TEXT,
  p_content TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_exploration_gain INT := 0;
  v_erudition_gain INT := 0;
  v_contribution_id INT;
  v_place_title TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_actor_name TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Fetch place + actor + faction info for activity_log
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = p_place_id;

  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM users WHERE id = p_user_id;

  SELECT color, pattern INTO v_faction_color, v_faction_pattern
  FROM factions WHERE id = v_faction_id;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, image_url)
  VALUES (p_place_id, p_user_id, v_faction_id, p_type, p_content, p_image_url)
  ON CONFLICT (place_id, user_id, type)
  DO UPDATE SET content = COALESCE(EXCLUDED.content, place_contributions.content),
               image_url = COALESCE(EXCLUDED.image_url, place_contributions.image_url),
               updated_at = NOW()
  RETURNING id INTO v_contribution_id;

  -- Gains perso (exploration + erudition) — PAS d'influence content sur le lieu
  IF p_type = 'photo' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_photo'), 5) INTO v_exploration_gain;
  ELSIF p_type = 'carnet' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_carnet'), 5) INTO v_exploration_gain;
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'erudition_add_carnet'), 3) INTO v_erudition_gain;
  END IF;

  UPDATE users SET
    exploration_points = exploration_points + v_exploration_gain,
    erudition_points = erudition_points + v_erudition_gain
  WHERE id = p_user_id;

  -- Recalculer les content_points
  PERFORM recalc_place_content_points(p_place_id);

  -- Log activité pour les toasts
  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('contribute', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object(
      'contributionType', p_type,
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern,
      'explorationGain', v_exploration_gain,
      'eruditionGain', v_erudition_gain
    ));

  RETURN json_build_object(
    'success', true,
    'contributionId', v_contribution_id,
    'explorationGain', v_exploration_gain,
    'eruditionGain', v_erudition_gain
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.contribute_to_place(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 2. answer_enigma — ajouter log 'enigma_success' quand correct
-- ============================================================
CREATE OR REPLACE FUNCTION public.answer_enigma(
  p_user_id TEXT,
  p_enigma_id INT,
  p_answer TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enigma RECORD;
  v_correct BOOLEAN;
  v_influence_gain INT := 0;
  v_erudition_gain INT := 0;
  v_diff_key TEXT;
  v_actor_name TEXT;
BEGIN
  SELECT * INTO v_enigma FROM enigmas WHERE id = p_enigma_id;
  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'enigma_not_found');
  END IF;

  v_correct := LOWER(TRIM(p_answer)) = LOWER(TRIM(v_enigma.answer));

  IF v_enigma.type = 'daily' THEN
    v_diff_key := v_enigma.difficulty;
    IF v_correct THEN
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_influence_' || v_diff_key), 3) INTO v_influence_gain;
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_erudition_' || v_diff_key), 1) INTO v_erudition_gain;
    END IF;
  ELSIF v_enigma.type = 'place' THEN
    IF v_correct THEN
      v_influence_gain := COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_influence_base'), 2)
        + COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_influence_per_diff'), 1)
          * (CASE v_enigma.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 END);
      v_erudition_gain := COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_erudition_base'), 2)
        + COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_erudition_per_diff'), 1)
          * (CASE v_enigma.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 END);
    END IF;
  END IF;

  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained)
  VALUES (p_enigma_id, p_user_id, p_answer, v_correct, v_influence_gain, v_erudition_gain);

  IF v_correct THEN
    UPDATE users SET
      influence_stock = influence_stock + v_influence_gain,
      erudition_points = erudition_points + v_erudition_gain
    WHERE id = p_user_id;

    -- Log pour toast : seulement si correct
    SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
    FROM users WHERE id = p_user_id;

    INSERT INTO activity_log (type, actor_id, data)
    VALUES ('enigma_success', p_user_id,
      jsonb_build_object(
        'actorName', v_actor_name,
        'influenceGain', v_influence_gain,
        'eruditionGain', v_erudition_gain,
        'enigmaType', v_enigma.type,
        'difficulty', v_enigma.difficulty
      ));
  END IF;

  RETURN json_build_object(
    'correct', v_correct,
    'answer', v_enigma.answer,
    'explanation', v_enigma.explanation,
    'influenceGain', v_influence_gain,
    'eruditionGain', v_erudition_gain,
    'newInfluenceStock', (SELECT influence_stock FROM users WHERE id = p_user_id),
    'newErudition', (SELECT erudition_points FROM users WHERE id = p_user_id),
    'newGlory', (SELECT exploration_points + erudition_points FROM users WHERE id = p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.answer_enigma(TEXT, INT, TEXT) TO authenticated;

-- ============================================================
-- 3. place_influence_action — enrichir data avec place/actor/faction info
-- ============================================================
CREATE OR REPLACE FUNCTION public.place_influence_action(
  p_user_id TEXT,
  p_place_id TEXT,
  p_points INT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_target_faction_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction_id TEXT;
  v_target_faction TEXT;
  v_stock INT;
  v_is_gps BOOLEAN := FALSE;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_max_remote INT;
  v_today_remote INT;
  v_actual_points INT;
  v_place_title TEXT;
  v_actor_name TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
  v_faction_title TEXT;
BEGIN
  SELECT faction_id, influence_stock INTO v_user_faction_id, v_stock
  FROM users WHERE id = p_user_id;

  IF v_user_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  v_target_faction := COALESCE(p_target_faction_id, v_user_faction_id);

  IF NOT EXISTS (SELECT 1 FROM factions WHERE id = v_target_faction) THEN
    RETURN json_build_object('error', 'invalid_faction');
  END IF;

  IF v_stock < p_points OR p_points <= 0 THEN
    RETURN json_build_object('error', 'not_enough_influence', 'stock', v_stock);
  END IF;

  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_is_gps := v_distance_km < 0.2;
  END IF;

  IF NOT v_is_gps THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_max_remote_per_day'), 5)
    INTO v_max_remote;

    SELECT COALESCE(SUM((data->>'points')::INT), 0) INTO v_today_remote
    FROM activity_log
    WHERE actor_id = p_user_id
      AND type = 'place_influence'
      AND place_id = p_place_id
      AND (data->>'remote')::BOOLEAN = TRUE
      AND created_at::DATE = CURRENT_DATE;

    v_actual_points := LEAST(p_points, v_max_remote - v_today_remote);
    IF v_actual_points <= 0 THEN
      RETURN json_build_object('error', 'daily_remote_limit', 'remaining', GREATEST(0, v_max_remote - v_today_remote));
    END IF;
  ELSE
    v_actual_points := p_points;
  END IF;

  UPDATE users SET influence_stock = influence_stock - v_actual_points
  WHERE id = p_user_id;

  INSERT INTO place_influence (place_id, faction_id, placed_points, updated_at)
  VALUES (p_place_id, v_target_faction, v_actual_points, NOW())
  ON CONFLICT (place_id, faction_id)
  DO UPDATE SET placed_points = place_influence.placed_points + v_actual_points,
               updated_at = NOW();

  -- Enrichir le log avec place/actor/faction info pour les toasts
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM users WHERE id = p_user_id;

  SELECT color, pattern, title INTO v_faction_color, v_faction_pattern, v_faction_title
  FROM factions WHERE id = v_target_faction;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('place_influence', p_user_id, p_place_id, v_target_faction,
    jsonb_build_object(
      'points', v_actual_points,
      'remote', NOT v_is_gps,
      'gps', v_is_gps,
      'target_faction', v_target_faction,
      'own_faction', v_user_faction_id,
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern,
      'factionTitle', v_faction_title
    ));

  RETURN json_build_object(
    'success', true,
    'pointsPlaced', v_actual_points,
    'remainingStock', (SELECT influence_stock FROM users WHERE id = p_user_id),
    'gps', v_is_gps,
    'placeInfluence', (
      SELECT json_agg(json_build_object(
        'factionId', pi.faction_id,
        'placed', pi.placed_points,
        'content', pi.content_points,
        'total', pi.placed_points + pi.content_points
      ))
      FROM place_influence pi WHERE pi.place_id = p_place_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_influence_action(TEXT, TEXT, INT, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- ============================================================
-- 4. revisit_place_gps — enrichir data avec place/actor/faction info
-- ============================================================
CREATE OR REPLACE FUNCTION public.revisit_place_gps(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC,
  p_user_lng NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_already_explored BOOLEAN;
  v_already_today BOOLEAN;
  v_recent_count INT;
  v_base_gain INT;
  v_influence_gain INT;
  v_faction_id TEXT;
  v_place_title TEXT;
  v_actor_name TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
BEGIN
  SELECT EXISTS(SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id)
  INTO v_already_explored;

  IF NOT v_already_explored THEN
    RETURN json_build_object('error', 'not_explored_yet');
  END IF;

  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);

  IF v_distance_km > 0.2 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::NUMERIC, 2));
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM activity_log
    WHERE actor_id = p_user_id
      AND place_id = p_place_id
      AND type = 'revisit_gps'
      AND created_at::DATE = CURRENT_DATE
  ) INTO v_already_today;

  IF v_already_today THEN
    RETURN json_build_object('error', 'already_revisited_today');
  END IF;

  SELECT COUNT(*) INTO v_recent_count
  FROM activity_log
  WHERE actor_id = p_user_id
    AND place_id = p_place_id
    AND type = 'revisit_gps'
    AND created_at > NOW() - INTERVAL '30 days';

  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_revisit_gps'), 10)
  INTO v_base_gain;

  v_influence_gain := CASE
    WHEN v_recent_count <= 1 THEN 10
    WHEN v_recent_count <= 3 THEN 6
    WHEN v_recent_count <= 5 THEN 4
    WHEN v_recent_count <= 8 THEN 3
    ELSE 2
  END;

  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  INSERT INTO place_influence (place_id, faction_id, placed_points, updated_at)
  VALUES (p_place_id, v_faction_id, v_influence_gain, NOW())
  ON CONFLICT (place_id, faction_id)
  DO UPDATE SET placed_points = place_influence.placed_points + v_influence_gain,
               updated_at = NOW();

  -- Enrichir le log pour les toasts
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM users WHERE id = p_user_id;

  SELECT color, pattern INTO v_faction_color, v_faction_pattern
  FROM factions WHERE id = v_faction_id;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('revisit_gps', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object(
      'influenceGain', v_influence_gain,
      'recentCount', v_recent_count,
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern
    ));

  RETURN json_build_object(
    'success', true,
    'influenceGain', v_influence_gain,
    'recentRevisits', v_recent_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revisit_place_gps(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- ============================================================
-- 5. answer_fragment_enigma — ajouter log 'enigma_success' quand correct
-- ============================================================
CREATE OR REPLACE FUNCTION public.answer_fragment_enigma(
  p_user_id TEXT,
  p_enigma_id INT,
  p_answer TEXT,
  p_fragment_id INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enigma RECORD;
  v_correct BOOLEAN;
  v_influence_gain INT := 0;
  v_erudition_gain INT := 0;
  v_actor_name TEXT;
BEGIN
  SELECT * INTO v_enigma FROM enigmas WHERE id = p_enigma_id;
  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'enigma_not_found');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM user_fragments WHERE user_id = p_user_id AND fragment_id = p_fragment_id) THEN
    RETURN json_build_object('error', 'fragment_not_owned');
  END IF;

  v_correct := LOWER(TRIM(p_answer)) = LOWER(TRIM(v_enigma.answer));

  IF v_correct THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_influence'), 5) INTO v_influence_gain;
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_erudition'), 2) INTO v_erudition_gain;
  END IF;

  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained)
  VALUES (p_enigma_id, p_user_id, p_answer, v_correct, v_influence_gain, v_erudition_gain);

  IF v_correct THEN
    UPDATE users SET
      influence_stock = influence_stock + v_influence_gain,
      erudition_points = erudition_points + v_erudition_gain
    WHERE id = p_user_id;

    -- Log enigma_success pour toast
    SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
    FROM users WHERE id = p_user_id;

    INSERT INTO activity_log (type, actor_id, data)
    VALUES ('enigma_success', p_user_id,
      jsonb_build_object(
        'actorName', v_actor_name,
        'influenceGain', v_influence_gain,
        'eruditionGain', v_erudition_gain,
        'enigmaType', 'fragment',
        'fragmentId', p_fragment_id
      ));
  END IF;

  -- Logger pour le tracking quotidien par fragment
  INSERT INTO activity_log (type, actor_id, data)
  VALUES ('fragment_enigma', p_user_id, jsonb_build_object(
    'fragmentId', p_fragment_id,
    'enigmaId', p_enigma_id,
    'correct', v_correct,
    'influenceGain', v_influence_gain,
    'eruditionGain', v_erudition_gain
  ));

  RETURN json_build_object(
    'correct', v_correct,
    'answer', v_enigma.answer,
    'explanation', v_enigma.explanation,
    'influenceGain', v_influence_gain,
    'eruditionGain', v_erudition_gain,
    'newInfluenceStock', (SELECT influence_stock FROM users WHERE id = p_user_id),
    'newErudition', (SELECT erudition_points FROM users WHERE id = p_user_id)
  );
END;
$$;

DROP FUNCTION IF EXISTS public.answer_fragment_enigma(TEXT, INT, TEXT);
GRANT EXECUTE ON FUNCTION public.answer_fragment_enigma(TEXT, INT, TEXT, INT) TO authenticated;
