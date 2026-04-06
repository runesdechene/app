-- ============================================
-- MIGRATION 142 : Coût par distance
-- ============================================
-- Plus un lieu est loin du joueur, plus il coûte d'énergie.
-- GPS < 500m = x0.5, < 10km = x1, < 50km = x2, > 50km = x3

-- Helper : calcul de distance Haversine en km
CREATE OR REPLACE FUNCTION public.haversine_km(
  lat1 NUMERIC, lng1 NUMERIC,
  lat2 NUMERIC, lng2 NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 6371 * 2 * asin(sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2 +
    cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2
  ));
$$;

-- Helper : multiplicateur de distance
CREATE OR REPLACE FUNCTION public.distance_multiplier(distance_km NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN distance_km < 0.5 THEN 0.5   -- GPS sur place
    WHEN distance_km < 10 THEN 1.0     -- Proche
    WHEN distance_km < 50 THEN 2.0     -- Moyen
    ELSE 3.0                            -- Loin
  END;
$$;

-- Modifier discover_place : ajouter coordonnées joueur + multiplicateur distance
CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote',
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL
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
  v_max_energy NUMERIC;
  v_place_faction TEXT;
  v_user_faction TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_reward_energy INT := 0;
BEGIN
  -- Déjà découvert ?
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN
    RETURN json_build_object('error', 'already_discovered');
  END IF;

  -- Coût de base du lieu (depuis le tag primaire)
  SELECT COALESCE(t.base_cost, 1.0)
  INTO v_base_cost
  FROM place_tags pt
  JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE
  LIMIT 1;

  -- Coordonnées du lieu
  SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;

  -- Calcul distance si coordonnées fournies
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL AND v_place_lng IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  ELSE
    v_dist_mult := 1.0; -- Pas de GPS = coût normal
  END IF;

  -- GPS method = gratuit (distance < 500m vérifié côté client)
  IF p_method = 'gps' THEN
    v_cost := 0;
  ELSE
    -- Réduction si même héritage
    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_place_id;
    SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

    v_cost := v_base_cost * v_dist_mult;

    IF v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
      v_cost := v_cost * 0.5;
    END IF;

    -- Arrondir au 0.5 le plus proche
    v_cost := ROUND(v_cost * 2) / 2.0;
    v_cost := GREATEST(0.5, v_cost);
  END IF;

  -- Vérifier l'énergie
  SELECT energy_points, max_energy INTO v_energy, v_max_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost, 'distance', v_distance_km);
  END IF;

  -- Déduire l'énergie
  IF v_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_cost) WHERE id = p_user_id;
  END IF;

  -- Enregistrer la découverte
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- Récompenses du tag primaire
  SELECT COALESCE(t.reward_energy, 0)
  INTO v_reward_energy
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE
  LIMIT 1;

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
  END IF;

  -- Gloire +2
  UPDATE users SET notoriety_points = notoriety_points + 2 WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'cost', v_cost,
    'distance', v_distance_km,
    'distanceMultiplier', v_dist_mult
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- Modifier claim_place : ajouter coordonnées joueur + multiplicateur distance
CREATE OR REPLACE FUNCTION public.claim_place(
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
  v_faction_id TEXT;
  v_current_faction TEXT;
  v_fortification INT;
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_claim_cost NUMERIC;
  v_energy NUMERIC;
  v_notoriety INT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_zone_multiplier NUMERIC := 0.5;
  v_size_multiplier NUMERIC := 0;
  v_neighbor_fort NUMERIC := 0;
  v_neighbor_count INT := 0;
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  -- Vérifier héritage
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- État du lieu
  SELECT faction_id, fortification_level, latitude, longitude
  INTO v_current_faction, v_fortification, v_place_lat, v_place_lng
  FROM places WHERE id = p_place_id;

  IF v_current_faction = v_faction_id THEN
    RETURN json_build_object('error', 'already_claimed');
  END IF;

  -- Coût de base du lieu
  SELECT COALESCE(t.base_cost, 1.0)
  INTO v_base_cost
  FROM place_tags pt
  JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE
  LIMIT 1;

  -- Calcul distance
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL AND v_place_lng IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  ELSE
    v_dist_mult := 1.0;
  END IF;

  -- Settings zone defense
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_fort_multiplier'), 0.5) INTO v_zone_multiplier;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'territory_size_defense_mult'), 0) INTO v_size_multiplier;

  -- Calcul voisins
  IF v_current_faction IS NOT NULL THEN
    SELECT COALESCE(SUM(p2.fortification_level), 0) INTO v_neighbor_fort
    FROM places p2
    WHERE p2.faction_id = v_current_faction
      AND p2.id != p_place_id
      AND sqrt(
        pow((p2.latitude - v_place_lat) * 111, 2)
        + pow((p2.longitude - v_place_lng) * 79, 2)
      ) <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10);

    IF v_size_multiplier > 0 THEN
      v_blob_ids := ARRAY[p_place_id];
      LOOP
        SELECT array_agg(p2.id) INTO v_new_ids
        FROM places p2
        WHERE p2.faction_id = v_current_faction
          AND NOT (p2.id = ANY(v_blob_ids))
          AND EXISTS (
            SELECT 1 FROM unnest(v_blob_ids) AS bid
            JOIN places pb ON pb.id = bid
            WHERE sqrt(pow((p2.latitude - pb.latitude) * 111, 2) + pow((p2.longitude - pb.longitude) * 79, 2))
              <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10)
          );
        EXIT WHEN v_new_ids IS NULL;
        v_blob_ids := v_blob_ids || v_new_ids;
      END LOOP;
      v_neighbor_count := array_length(v_blob_ids, 1) - 1;
    END IF;
  END IF;

  -- Coût = (base + fortif + zone) × multiplicateur distance
  v_claim_cost := (v_base_cost + COALESCE(v_fortification, 0)
    + FLOOR(v_neighbor_fort * v_zone_multiplier)
    + FLOOR(v_neighbor_count * v_size_multiplier)) * v_dist_mult;

  -- Arrondir au 0.5
  v_claim_cost := ROUND(v_claim_cost * 2) / 2.0;
  v_claim_cost := GREATEST(0.5, v_claim_cost);

  -- Vérifier l'énergie
  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'not_enough_energy',
      'energy', v_energy,
      'claimCost', v_claim_cost,
      'distance', v_distance_km
    );
  END IF;

  -- Déduire l'énergie
  UPDATE users SET energy_points = GREATEST(0, energy_points - v_claim_cost) WHERE id = p_user_id
  RETURNING energy_points INTO v_energy;

  -- Reset fortification si changement d'héritage
  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN
    v_fortification := 0;
  END IF;

  -- Mettre à jour le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = COALESCE(v_fortification, 0)
  WHERE id = p_place_id;

  -- Gloire +5
  UPDATE users SET notoriety_points = notoriety_points + 5 WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  -- Historique
  INSERT INTO place_claims (place_id, user_id, faction_id)
  VALUES (p_place_id, p_user_id, v_faction_id);

  RETURN json_build_object(
    'success', true,
    'energy', v_energy,
    'claimCost', v_claim_cost,
    'distance', v_distance_km,
    'distanceMultiplier', v_dist_mult,
    'notorietyPoints', v_notoriety,
    'factionId', v_faction_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_place(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
