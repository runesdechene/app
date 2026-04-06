-- 023_fix_discover_not_explorer.sql
-- Discovering a place ≠ exploring it. Only GPS visits make you an explorer.
-- Remove the auto-insert into place_explorers from discover_place.

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
  v_glory_base INT;
  v_glory_cost_pct NUMERIC;
  v_glory_gain INT;
  v_faction_id TEXT;
  v_exploration_gain INT;
  v_influence_gain INT;
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

  -- Gloire
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'glory_discover'), 2) INTO v_glory_base;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'glory_cost_bonus_pct'), 10) INTO v_glory_cost_pct;
  v_glory_gain := GREATEST(1, ROUND((v_glory_base + v_cost * v_glory_cost_pct / 100) * COALESCE(p_glory_mult, 1)));
  UPDATE users SET notoriety_points = notoriety_points + v_glory_gain WHERE id = p_user_id;

  -- V0.5 : exploration_points + influence_stock
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_place'), 5) INTO v_exploration_gain;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_add_place'), 25) INTO v_influence_gain;

  UPDATE users SET
    exploration_points = exploration_points + v_exploration_gain,
    influence_stock = influence_stock + v_influence_gain
  WHERE id = p_user_id;

  -- NOTE: NO auto-insert into place_explorers — only visit_place_gps does that

  -- V0.5 : influence de contenu initiale pour la faction du découvreur
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NOT NULL THEN
    INSERT INTO place_influence (place_id, faction_id, content_points)
    VALUES (p_place_id, v_faction_id, v_exploration_gain)
    ON CONFLICT (place_id, faction_id)
    DO UPDATE SET content_points = place_influence.content_points + EXCLUDED.content_points;
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  RETURN json_build_object(
    'success', true,
    'cost', v_cost,
    'energy', v_energy,
    'free', p_free,
    'gloryGain', v_glory_gain,
    'explorationGain', v_exploration_gain,
    'influenceGain', v_influence_gain,
    'newInfluenceStock', (SELECT influence_stock FROM users WHERE id = p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC) TO authenticated;
