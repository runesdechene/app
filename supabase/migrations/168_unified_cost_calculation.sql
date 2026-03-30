-- ============================================
-- MIGRATION 168 : Calcul de coût unifié
-- ============================================
-- Toutes les RPCs d'action utilisent preview_action_cost pour le calcul
-- UNE SEULE source de vérité. Zéro divergence frontend/backend.

-- ============================================
-- DISCOVER_PLACE : utilise preview_action_cost
-- ============================================
CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote',
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_free BOOLEAN DEFAULT FALSE
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
BEGIN
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN RETURN json_build_object('error', 'already_discovered'); END IF;

  -- Calcul du coût via la source unique
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

  UPDATE users SET notoriety_points = notoriety_points + 2 WHERE id = p_user_id;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  RETURN json_build_object('success', true, 'cost', v_cost, 'energy', v_energy, 'free', p_free);
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;

-- ============================================
-- CLAIM_PLACE : utilise preview_action_cost
-- ============================================
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_free BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_current_faction TEXT;
  v_fortification INT;
  v_claim_cost NUMERIC;
  v_energy NUMERIC;
  v_notoriety INT;
  v_preview JSON;
  v_user_avatar TEXT;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level
  INTO v_current_faction, v_fortification FROM places WHERE id = p_place_id;
  IF v_current_faction = v_faction_id THEN RETURN json_build_object('error', 'already_claimed'); END IF;

  -- Calcul du coût via la source unique
  IF p_free THEN
    v_claim_cost := 0;
  ELSE
    v_preview := preview_action_cost(p_user_id, p_place_id, 'claim', p_user_lat, p_user_lng);
    v_claim_cost := (v_preview->>'cost')::NUMERIC;
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_claim_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'claimCost', v_claim_cost);
  END IF;

  IF v_claim_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_claim_cost) WHERE id = p_user_id
    RETURNING energy_points INTO v_energy;
  END IF;

  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN v_fortification := 0; END IF;

  SELECT avatar_url INTO v_user_avatar FROM users WHERE id = p_user_id;

  UPDATE places SET faction_id = v_faction_id, claimed_by = p_user_id, claimed_at = NOW(),
    claimed_avatar_url = v_user_avatar,
    fortification_level = COALESCE(v_fortification, 0) WHERE id = p_place_id;

  UPDATE users SET notoriety_points = notoriety_points + 5 WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  INSERT INTO place_claims (place_id, user_id, faction_id) VALUES (p_place_id, p_user_id, v_faction_id);

  RETURN json_build_object('success', true, 'energy', v_energy, 'claimCost', v_claim_cost,
    'notorietyPoints', v_notoriety, 'factionId', v_faction_id, 'free', p_free);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;

-- ============================================
-- FORTIFY_PLACE : utilise preview_action_cost
-- ============================================
CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_cost NUMERIC;
  v_next_name TEXT;
  v_energy NUMERIC;
  v_notoriety INT;
  v_place_tags TEXT[];
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_actor_name TEXT;
  v_place_title TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
  v_preview JSON;
  v_base_cost INT;
BEGIN
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level, latitude, longitude
  INTO v_place_faction, v_current_level, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  IF v_place_faction IS NULL OR v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'not_your_faction');
  END IF;

  SELECT ARRAY_AGG(tag_id) INTO v_place_tags FROM place_tags WHERE place_id = p_place_id;

  SELECT ct.cost, ct.name INTO v_base_cost, v_next_name
  FROM construction_types ct WHERE ct.level = v_current_level + 1
    AND (ct.tag_ids IS NULL OR ct.tag_ids && COALESCE(v_place_tags, ARRAY[]::TEXT[]));

  IF v_base_cost IS NULL THEN RETURN json_build_object('error', 'max_level'); END IF;

  -- Calcul du coût via la source unique
  v_preview := preview_action_cost(p_user_id, p_place_id, 'fortify', p_user_lat, p_user_lng, v_current_level + 1);
  v_cost := (v_preview->>'cost')::NUMERIC;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
  END IF;

  UPDATE users SET energy_points = energy_points - v_cost, notoriety_points = notoriety_points + 5
  WHERE id = p_user_id;

  UPDATE places SET fortification_level = v_current_level + 1, updated_at = NOW() WHERE id = p_place_id;

  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = p_user_id;
  SELECT title INTO v_place_title FROM places WHERE id = p_place_id;
  SELECT color, pattern INTO v_faction_color, v_faction_pattern FROM factions WHERE id = v_user_faction;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('fortify', p_user_id, p_place_id, v_user_faction,
    jsonb_build_object('placeTitle', v_place_title, 'placeLatitude', v_place_lat, 'placeLongitude', v_place_lng,
      'actorName', v_actor_name, 'factionColor', v_faction_color, 'factionPattern', v_faction_pattern,
      'fortificationLevel', v_current_level + 1));

  SELECT energy_points, notoriety_points INTO v_energy, v_notoriety FROM users WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'energy', v_energy, 'notorietyPoints', v_notoriety,
    'fortificationLevel', v_current_level + 1, 'fortificationName', v_next_name,
    'cost', v_cost);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fortify_place(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- Nettoyage des anciennes signatures qui pourraient exister
DROP FUNCTION IF EXISTS public.claim_place(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.discover_place(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC);
