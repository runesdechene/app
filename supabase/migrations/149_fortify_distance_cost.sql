-- ============================================
-- MIGRATION 149 : Fortification avec coût par distance
-- ============================================

DROP FUNCTION IF EXISTS public.fortify_place(TEXT, TEXT);

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
  v_base_cost INT;
  v_dist_mult NUMERIC := 1.0;
  v_cost NUMERIC;
  v_next_name TEXT;
  v_energy NUMERIC;
  v_notoriety INT;
  v_place_tags TEXT[];
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_actor_name TEXT;
  v_place_title TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
BEGIN
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level, latitude, longitude
  INTO v_place_faction, v_current_level, v_place_lat, v_place_lng
  FROM places WHERE id = p_place_id;

  IF v_place_faction IS NULL OR v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'not_your_faction');
  END IF;

  SELECT ARRAY_AGG(tag_id) INTO v_place_tags FROM place_tags WHERE place_id = p_place_id;

  SELECT ct.cost, ct.name INTO v_base_cost, v_next_name
  FROM construction_types ct WHERE ct.level = v_current_level + 1
    AND (ct.tag_ids IS NULL OR ct.tag_ids && COALESCE(v_place_tags, ARRAY[]::TEXT[]));

  IF v_base_cost IS NULL THEN RETURN json_build_object('error', 'max_level'); END IF;

  -- Multiplicateur de distance
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  v_cost := GREATEST(1, ROUND(v_base_cost * v_dist_mult * 2) / 2.0);

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost, 'distance', v_distance_km);
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
    'cost', v_cost, 'distance', v_distance_km);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fortify_place(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
