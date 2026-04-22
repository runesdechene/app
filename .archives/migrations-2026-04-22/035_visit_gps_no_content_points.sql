-- 035_visit_gps_no_content_points.sql
-- Visite GPS : plus de content_points pérennes, exploration augmentée à 20

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
  v_influence_gain INT;
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

  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_visit_gps'), 10) INTO v_influence_gain;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_visit_gps'), 20) INTO v_exploration_gain;

  INSERT INTO place_explorers (place_id, user_id) VALUES (p_place_id, p_user_id);

  -- Influence stock (à placer) + exploration (gloire)
  -- PAS de content_points pérennes (réservés aux carnets/photos/ajout de lieu)
  UPDATE users SET
    influence_stock = influence_stock + v_influence_gain,
    exploration_points = exploration_points + v_exploration_gain
  WHERE id = p_user_id
  RETURNING influence_stock, exploration_points INTO v_new_influence_stock, v_new_exploration;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('visit_gps', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object('influenceGain', v_influence_gain, 'explorationGain', v_exploration_gain));

  RETURN json_build_object(
    'success', true,
    'influenceGain', v_influence_gain,
    'explorationGain', v_exploration_gain,
    'newInfluenceStock', v_new_influence_stock,
    'newExploration', v_new_exploration,
    'newGlory', v_new_exploration + (SELECT erudition_points FROM users WHERE id = p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.visit_place_gps(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- Mettre à jour le setting par défaut
UPDATE app_settings SET value = '20' WHERE key = 'exploration_visit_gps';
