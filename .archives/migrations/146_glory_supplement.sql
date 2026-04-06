-- ============================================
-- MIGRATION 146 : Gloire comme joker (complément d'énergie)
-- ============================================
-- Les RPCs discover_place, claim_place et fortify_place acceptent
-- un paramètre optionnel p_use_glory BOOLEAN DEFAULT FALSE
-- Si true ET pas assez d'énergie, la différence est payée en Gloire (notoriety_points)

-- discover_place avec support Gloire
CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote',
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_use_glory BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already BOOLEAN;
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_cost NUMERIC;
  v_energy NUMERIC;
  v_glory INT;
  v_energy_to_pay NUMERIC;
  v_glory_to_pay INT;
  v_place_faction TEXT;
  v_user_faction TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_reward_energy INT := 0;
BEGIN
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN
    RETURN json_build_object('error', 'already_discovered');
  END IF;

  SELECT COALESCE(t.base_cost, 1.0)
  INTO v_base_cost
  FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE LIMIT 1;

  SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  IF p_method = 'gps' THEN
    v_cost := 0;
  ELSE
    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_place_id;
    SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
    v_cost := v_base_cost * v_dist_mult;
    IF v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
      v_cost := v_cost * 0.5;
    END IF;
    v_cost := GREATEST(0.5, ROUND(v_cost * 2) / 2.0);
  END IF;

  SELECT energy_points, COALESCE(notoriety_points, 0) INTO v_energy, v_glory FROM users WHERE id = p_user_id;

  -- Calcul paiement : énergie d'abord, gloire en complément
  IF v_energy >= v_cost THEN
    v_energy_to_pay := v_cost;
    v_glory_to_pay := 0;
  ELSIF p_use_glory AND (v_energy + v_glory) >= v_cost THEN
    v_energy_to_pay := v_energy; -- tout ce qu'on a
    v_glory_to_pay := CEIL(v_cost - v_energy)::INT;
  ELSE
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'glory', v_glory, 'cost', v_cost, 'distance', v_distance_km);
  END IF;

  -- Déduire
  IF v_energy_to_pay > 0 OR v_glory_to_pay > 0 THEN
    UPDATE users SET
      energy_points = GREATEST(0, energy_points - v_energy_to_pay),
      notoriety_points = GREATEST(0, notoriety_points - v_glory_to_pay)
    WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT COALESCE(t.reward_energy, 0) INTO v_reward_energy
  FROM place_tags ptag JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE LIMIT 1;

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
  END IF;

  -- Gloire +2
  UPDATE users SET notoriety_points = notoriety_points + 2 WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'cost', v_cost, 'gloryCost', v_glory_to_pay, 'distance', v_distance_km);
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;

-- Drop l'ancienne signature
DROP FUNCTION IF EXISTS public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC);

-- claim_place avec support Gloire
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_use_glory BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_current_faction TEXT;
  v_fortification INT;
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_claim_cost NUMERIC;
  v_energy NUMERIC;
  v_glory INT;
  v_energy_to_pay NUMERIC;
  v_glory_to_pay INT;
  v_notoriety INT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_zone_multiplier NUMERIC;
  v_size_multiplier NUMERIC;
  v_neighbor_fort NUMERIC := 0;
  v_neighbor_count INT := 0;
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level, latitude, longitude
  INTO v_current_faction, v_fortification, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;

  IF v_current_faction = v_faction_id THEN RETURN json_build_object('error', 'already_claimed'); END IF;

  SELECT COALESCE(t.base_cost, 1.0) INTO v_base_cost
  FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE LIMIT 1;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_fort_multiplier'), 0.5) INTO v_zone_multiplier;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'territory_size_defense_mult'), 0) INTO v_size_multiplier;

  IF v_current_faction IS NOT NULL THEN
    SELECT COALESCE(SUM(p2.fortification_level), 0) INTO v_neighbor_fort
    FROM places p2 WHERE p2.faction_id = v_current_faction AND p2.id != p_place_id
      AND sqrt(pow((p2.latitude - v_place_lat)*111,2)+pow((p2.longitude - v_place_lng)*79,2))
        <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10);

    IF v_size_multiplier > 0 THEN
      v_blob_ids := ARRAY[p_place_id];
      LOOP
        SELECT array_agg(p2.id) INTO v_new_ids FROM places p2
        WHERE p2.faction_id = v_current_faction AND NOT (p2.id = ANY(v_blob_ids))
          AND EXISTS (SELECT 1 FROM unnest(v_blob_ids) AS bid JOIN places pb ON pb.id = bid
            WHERE sqrt(pow((p2.latitude-pb.latitude)*111,2)+pow((p2.longitude-pb.longitude)*79,2))
              <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10));
        EXIT WHEN v_new_ids IS NULL;
        v_blob_ids := v_blob_ids || v_new_ids;
      END LOOP;
      v_neighbor_count := array_length(v_blob_ids, 1) - 1;
    END IF;
  END IF;

  v_claim_cost := (v_base_cost + COALESCE(v_fortification,0) + FLOOR(v_neighbor_fort*v_zone_multiplier) + FLOOR(v_neighbor_count*v_size_multiplier)) * v_dist_mult;
  v_claim_cost := GREATEST(0.5, ROUND(v_claim_cost*2)/2.0);

  SELECT energy_points, COALESCE(notoriety_points, 0) INTO v_energy, v_glory FROM users WHERE id = p_user_id;

  IF v_energy >= v_claim_cost THEN
    v_energy_to_pay := v_claim_cost;
    v_glory_to_pay := 0;
  ELSIF p_use_glory AND (v_energy + v_glory) >= v_claim_cost THEN
    v_energy_to_pay := v_energy;
    v_glory_to_pay := CEIL(v_claim_cost - v_energy)::INT;
  ELSE
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'glory', v_glory, 'claimCost', v_claim_cost, 'distance', v_distance_km);
  END IF;

  UPDATE users SET
    energy_points = GREATEST(0, energy_points - v_energy_to_pay),
    notoriety_points = GREATEST(0, notoriety_points - v_glory_to_pay)
  WHERE id = p_user_id
  RETURNING energy_points, notoriety_points INTO v_energy, v_notoriety;

  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN v_fortification := 0; END IF;

  UPDATE places SET faction_id = v_faction_id, claimed_by = p_user_id, claimed_at = NOW(),
    fortification_level = COALESCE(v_fortification, 0) WHERE id = p_place_id;

  -- Gloire +5
  UPDATE users SET notoriety_points = notoriety_points + 5 WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  INSERT INTO place_claims (place_id, user_id, faction_id) VALUES (p_place_id, p_user_id, v_faction_id);

  RETURN json_build_object('success', true, 'energy', v_energy, 'claimCost', v_claim_cost,
    'gloryCost', v_glory_to_pay, 'notorietyPoints', v_notoriety, 'factionId', v_faction_id, 'distance', v_distance_km);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;

DROP FUNCTION IF EXISTS public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC);

-- fortify_place avec support Gloire
CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_use_glory BOOLEAN DEFAULT FALSE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction TEXT;
  v_place_faction TEXT;
  v_current_level INT;
  v_cost INT;
  v_next_name TEXT;
  v_energy NUMERIC;
  v_glory INT;
  v_energy_to_pay NUMERIC;
  v_glory_to_pay INT;
  v_notoriety INT;
  v_place_tags TEXT[];
  v_actor_name TEXT;
  v_place_title TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
BEGIN
  SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN RETURN json_build_object('error', 'no_faction'); END IF;

  SELECT faction_id, fortification_level INTO v_place_faction, v_current_level FROM places WHERE id = p_place_id;
  IF v_place_faction IS NULL OR v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'not_your_faction');
  END IF;

  SELECT ARRAY_AGG(tag_id) INTO v_place_tags FROM place_tags WHERE place_id = p_place_id;

  SELECT ct.cost, ct.name INTO v_cost, v_next_name
  FROM construction_types ct WHERE ct.level = v_current_level + 1
    AND (ct.tag_ids IS NULL OR ct.tag_ids && COALESCE(v_place_tags, ARRAY[]::TEXT[]));

  IF v_cost IS NULL THEN RETURN json_build_object('error', 'max_level'); END IF;

  SELECT energy_points, COALESCE(notoriety_points, 0) INTO v_energy, v_glory FROM users WHERE id = p_user_id;

  IF v_energy >= v_cost THEN
    v_energy_to_pay := v_cost;
    v_glory_to_pay := 0;
  ELSIF p_use_glory AND (v_energy + v_glory) >= v_cost THEN
    v_energy_to_pay := v_energy;
    v_glory_to_pay := CEIL(v_cost - v_energy)::INT;
  ELSE
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'glory', v_glory, 'cost', v_cost);
  END IF;

  UPDATE users SET
    energy_points = GREATEST(0, energy_points - v_energy_to_pay),
    notoriety_points = GREATEST(0, notoriety_points - v_glory_to_pay) + 5
  WHERE id = p_user_id;

  UPDATE places SET fortification_level = v_current_level + 1, updated_at = NOW() WHERE id = p_place_id;

  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = p_user_id;
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  SELECT color, pattern INTO v_faction_color, v_faction_pattern FROM factions WHERE id = v_user_faction;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('fortify', p_user_id, p_place_id, v_user_faction,
    jsonb_build_object('placeTitle', v_place_title, 'placeLatitude', v_place_lat, 'placeLongitude', v_place_lng,
      'actorName', v_actor_name, 'factionColor', v_faction_color, 'factionPattern', v_faction_pattern,
      'fortificationLevel', v_current_level + 1));

  SELECT energy_points, notoriety_points INTO v_energy, v_notoriety FROM users WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'energy', v_energy, 'gloryCost', v_glory_to_pay,
    'notorietyPoints', v_notoriety, 'fortificationLevel', v_current_level + 1,
    'fortificationName', v_next_name, 'cost', v_cost);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fortify_place(TEXT, TEXT, BOOLEAN) TO authenticated;

DROP FUNCTION IF EXISTS public.fortify_place(TEXT, TEXT);
