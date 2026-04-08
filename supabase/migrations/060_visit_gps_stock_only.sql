-- 060_visit_gps_stock_only.sql
-- Visit GPS: stock only (no permanent), with diminishing returns on revisits
-- Create GPS: keeps 30 permanent (one-time)

-- ============================================================
-- 1. visit_place_gps — stock only, no permanent
-- ============================================================
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
  v_stock_gain INT;
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

  v_stock_gain := 20;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_visit_gps'), 20) INTO v_exploration_gain;

  INSERT INTO place_explorers (place_id, user_id) VALUES (p_place_id, p_user_id);

  UPDATE users SET
    exploration_points = exploration_points + v_exploration_gain,
    influence_stock = influence_stock + v_stock_gain
  WHERE id = p_user_id
  RETURNING exploration_points, influence_stock INTO v_new_exploration, v_new_influence_stock;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('visit_gps', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object(
      'stockGain', v_stock_gain,
      'explorationGain', v_exploration_gain
    ));

  RETURN json_build_object(
    'success', true,
    'stockGain', v_stock_gain,
    'explorationGain', v_exploration_gain,
    'newInfluenceStock', v_new_influence_stock,
    'newExploration', v_new_exploration,
    'newGlory', v_new_exploration + (SELECT erudition_points FROM users WHERE id = p_user_id),
    'visitNumber', 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.visit_place_gps(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- ============================================================
-- 2. revisit_place_gps — stock only, diminishing: 10, 5, 3, 2min
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
  v_faction_id TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_visit_count INT;
  v_stock_gain INT;
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

  -- Count ALL revisits on this place (not just today)
  SELECT COUNT(*) INTO v_visit_count
  FROM activity_log
  WHERE actor_id = p_user_id AND type = 'revisit_gps' AND place_id = p_place_id;

  -- Daily limit: max 1 revisit per day per place
  IF EXISTS (
    SELECT 1 FROM activity_log
    WHERE actor_id = p_user_id AND type = 'revisit_gps' AND place_id = p_place_id
      AND created_at::DATE = CURRENT_DATE
  ) THEN
    RETURN json_build_object('error', 'already_revisited_today');
  END IF;

  -- Diminishing: 10, 5, 3, 2, 2, 2...
  v_stock_gain := CASE
    WHEN v_visit_count = 0 THEN 10
    WHEN v_visit_count = 1 THEN 5
    WHEN v_visit_count = 2 THEN 3
    ELSE 2
  END;
  v_exploration_gain := GREATEST(1, v_stock_gain / 2);

  UPDATE users SET
    exploration_points = exploration_points + v_exploration_gain,
    influence_stock = influence_stock + v_stock_gain
  WHERE id = p_user_id;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('revisit_gps', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object(
      'stockGain', v_stock_gain,
      'explorationGain', v_exploration_gain,
      'visitNumber', v_visit_count + 1
    ));

  RETURN json_build_object(
    'success', true,
    'stockGain', v_stock_gain,
    'explorationGain', v_exploration_gain,
    'visitNumber', v_visit_count + 1,
    'nextVisitGain', CASE
      WHEN v_visit_count + 1 = 1 THEN 5
      WHEN v_visit_count + 1 = 2 THEN 3
      ELSE 2
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revisit_place_gps(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
