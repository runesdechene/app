-- 031_exploration_proportional_to_cost.sql
-- Exploration points = coût en énergie de la découverte
-- GPS (sur place) : +10 bonus
-- Gratuit (buff) : minimum 1

CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote',
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_free BOOLEAN DEFAULT FALSE,
  p_glory_mult NUMERIC DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already BOOLEAN;
  v_cost NUMERIC;
  v_energy NUMERIC;
  v_preview JSON;
  v_reward_energy INT := 0;
  v_exploration_gain INT;
  v_gps_bonus INT;
BEGIN
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN RETURN json_build_object('error', 'already_discovered'); END IF;

  IF p_free THEN
    v_cost := 0;
  ELSIF p_method = 'gps' THEN
    v_cost := 0;
  ELSE
    v_preview := preview_action_cost(p_user_id, p_place_id, 'discover', p_user_lat, p_user_lng);
    v_cost := (v_preview->>'cost')::NUMERIC;
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
  END IF;

  IF v_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_cost) WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method) ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT COALESCE(t.reward_energy, 0) INTO v_reward_energy
  FROM place_tags ptag JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE LIMIT 1;

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
  END IF;

  -- Exploration = coût en énergie, avec bonus GPS et minimum 1
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_gps_bonus'), 10) INTO v_gps_bonus;

  IF p_method = 'gps' THEN
    v_exploration_gain := v_gps_bonus;
  ELSE
    v_exploration_gain := GREATEST(1, ROUND(v_cost)::INT);
  END IF;

  UPDATE users SET exploration_points = exploration_points + v_exploration_gain WHERE id = p_user_id;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  RETURN json_build_object(
    'success', true,
    'cost', v_cost,
    'energy', v_energy,
    'free', p_free,
    'explorationGain', v_exploration_gain,
    'influenceGain', 0,
    'newInfluenceStock', (SELECT influence_stock FROM users WHERE id = p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC) TO authenticated;

-- Setting pour le bonus GPS
INSERT INTO app_settings (key, value) VALUES ('exploration_gps_bonus', '10')
ON CONFLICT (key) DO NOTHING;
