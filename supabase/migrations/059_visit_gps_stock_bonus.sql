-- 059_visit_gps_stock_bonus.sql
-- Visit GPS: +5 stock en plus du permanent
-- Revisit GPS: +3 stock en plus du permanent

CREATE OR REPLACE FUNCTION public.visit_place_gps(
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
  v_faction_id TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_already_visited BOOLEAN;
  v_influence_permanent INT;
  v_influence_stock_bonus INT;
  v_exploration_gain INT;
  v_new_influence_stock INT;
  v_new_exploration INT;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);

  IF v_distance_km > 0.1 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::NUMERIC, 2));
  END IF;

  SELECT EXISTS(SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id)
  INTO v_already_visited;

  IF v_already_visited THEN
    RETURN json_build_object('error', 'already_visited');
  END IF;

  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_visit_gps'), 20) INTO v_influence_permanent;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_visit_gps_stock'), 5) INTO v_influence_stock_bonus;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_visit_gps'), 20) INTO v_exploration_gain;

  INSERT INTO place_explorers (place_id, user_id) VALUES (p_place_id, p_user_id);

  -- Exploration + stock bonus
  UPDATE users SET
    exploration_points = exploration_points + v_exploration_gain,
    influence_stock = influence_stock + v_influence_stock_bonus
  WHERE id = p_user_id
  RETURNING exploration_points, influence_stock INTO v_new_exploration, v_new_influence_stock;

  -- Influence PERMANENTE sur le lieu
  INSERT INTO place_influence (place_id, faction_id, permanent_points, updated_at)
  VALUES (p_place_id, v_faction_id, v_influence_permanent, NOW())
  ON CONFLICT (place_id, faction_id)
  DO UPDATE SET permanent_points = place_influence.permanent_points + v_influence_permanent,
               updated_at = NOW();

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('visit_gps', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object(
      'influenceGain', v_influence_permanent,
      'stockGain', v_influence_stock_bonus,
      'explorationGain', v_exploration_gain,
      'permanent', true
    ));

  RETURN json_build_object(
    'success', true,
    'influenceGain', v_influence_permanent,
    'stockGain', v_influence_stock_bonus,
    'explorationGain', v_exploration_gain,
    'newInfluenceStock', v_new_influence_stock,
    'newExploration', v_new_exploration,
    'newGlory', v_new_exploration + (SELECT erudition_points FROM users WHERE id = p_user_id),
    'permanent', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.visit_place_gps(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- Revisit GPS: +3 stock
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
  v_faction_id TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_visit_count INT;
  v_base_influence INT;
  v_actual_influence INT;
  v_stock_bonus INT;
  v_exploration_gain INT;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);

  IF v_distance_km > 0.1 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::NUMERIC, 2));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error', 'not_visited_yet');
  END IF;

  SELECT COUNT(*) INTO v_visit_count
  FROM activity_log
  WHERE actor_id = p_user_id AND type = 'revisit_gps' AND place_id = p_place_id
    AND created_at::DATE = CURRENT_DATE;

  IF v_visit_count >= 3 THEN
    RETURN json_build_object('error', 'daily_revisit_limit');
  END IF;

  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_revisit_gps'), 10) INTO v_base_influence;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_revisit_gps_stock'), 3) INTO v_stock_bonus;
  -- Diminishing: 100%, 50%, 25%
  v_actual_influence := GREATEST(1, v_base_influence / (1 << v_visit_count));
  v_exploration_gain := GREATEST(1, v_actual_influence / 2);

  -- Exploration + stock
  UPDATE users SET
    exploration_points = exploration_points + v_exploration_gain,
    influence_stock = influence_stock + v_stock_bonus
  WHERE id = p_user_id;

  -- Influence PERMANENTE
  INSERT INTO place_influence (place_id, faction_id, permanent_points, updated_at)
  VALUES (p_place_id, v_faction_id, v_actual_influence, NOW())
  ON CONFLICT (place_id, faction_id)
  DO UPDATE SET permanent_points = place_influence.permanent_points + v_actual_influence,
               updated_at = NOW();

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('revisit_gps', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object(
      'influenceGain', v_actual_influence,
      'stockGain', v_stock_bonus,
      'explorationGain', v_exploration_gain,
      'visitCount', v_visit_count + 1,
      'permanent', true
    ));

  RETURN json_build_object(
    'success', true,
    'influenceGain', v_actual_influence,
    'stockGain', v_stock_bonus,
    'explorationGain', v_exploration_gain,
    'visitCount', v_visit_count + 1,
    'permanent', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revisit_place_gps(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
