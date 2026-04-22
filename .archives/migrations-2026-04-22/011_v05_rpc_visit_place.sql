-- 011_v05_rpc_visit_place.sql
-- V0.5 : Enregistrer une visite GPS, donner influence + exploration

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

  -- Vérifier proximité
  SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);

  IF v_distance_km > 0.1 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::NUMERIC, 2));
  END IF;

  -- Déjà visité ?
  SELECT EXISTS(SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id)
  INTO v_already_visited;

  IF v_already_visited THEN
    RETURN json_build_object('error', 'already_visited');
  END IF;

  -- Lire les gains depuis app_settings
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_visit_gps'), 10) INTO v_influence_gain;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_visit_gps'), 2) INTO v_exploration_gain;

  -- Enregistrer comme explorateur
  INSERT INTO place_explorers (place_id, user_id) VALUES (p_place_id, p_user_id);

  -- Donner influence stock + exploration au joueur
  UPDATE users SET
    influence_stock = influence_stock + v_influence_gain,
    exploration_points = exploration_points + v_exploration_gain
  WHERE id = p_user_id
  RETURNING influence_stock, exploration_points INTO v_new_influence_stock, v_new_exploration;

  -- Ajouter de l'influence de contenu sur le lieu pour la faction du visiteur
  INSERT INTO place_influence (place_id, faction_id, content_points, updated_at)
  VALUES (p_place_id, v_faction_id, v_exploration_gain, NOW())
  ON CONFLICT (place_id, faction_id)
  DO UPDATE SET content_points = place_influence.content_points + v_exploration_gain,
               updated_at = NOW();

  -- Log
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
