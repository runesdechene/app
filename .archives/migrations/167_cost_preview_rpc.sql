-- ============================================
-- MIGRATION 167 : RPC de preview du coût
-- ============================================
-- Une seule fonction qui calcule le coût d'une action (discover, claim, fortify)
-- Le frontend l'appelle AVANT l'action pour afficher le vrai coût
-- Plus besoin de dupliquer le calcul côté client

CREATE OR REPLACE FUNCTION public.preview_action_cost(
  p_user_id TEXT,
  p_place_id TEXT,
  p_action TEXT,  -- 'discover' | 'claim' | 'fortify'
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_fortify_level INT DEFAULT NULL  -- pour fortify : le level cible
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_cost NUMERIC := 1.0;
  v_dist_mult NUMERIC := 1.0;
  v_tag_reduction NUMERIC := 0;
  v_fortif_cost NUMERIC := 0;
  v_zone_cost NUMERIC := 0;
  v_size_cost NUMERIC := 0;
  v_same_faction_discount BOOLEAN := FALSE;
  v_total NUMERIC;
  v_energy NUMERIC;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC := 0;
  v_place_faction TEXT;
  v_user_faction TEXT;
  v_fortification INT;
  v_zone_multiplier NUMERIC;
  v_size_multiplier NUMERIC;
  v_neighbor_fort NUMERIC := 0;
  v_neighbor_count INT := 0;
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  -- Énergie actuelle
  SELECT energy_points, faction_id INTO v_energy, v_user_faction FROM users WHERE id = p_user_id;

  -- Lieu
  SELECT latitude, longitude, faction_id, COALESCE(fortification_level, 0)
  INTO v_place_lat, v_place_lng, v_place_faction, v_fortification
  FROM places WHERE id = p_place_id;

  -- Base cost du tag
  SELECT COALESCE(t.base_cost, 1.0) INTO v_base_cost
  FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
  WHERE pt.place_id = p_place_id AND pt.is_primary = TRUE LIMIT 1;

  -- Distance
  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL AND v_place_lat IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_dist_mult := distance_multiplier(v_distance_km);
  END IF;

  -- Réduction héritage
  v_tag_reduction := get_faction_tag_reduction(p_user_id, p_place_id);

  -- Coût de base avec distance et réduction
  v_total := (v_base_cost * v_dist_mult) * (1 - v_tag_reduction / 100);

  -- Réduction même faction (discover uniquement)
  IF p_action = 'discover' AND v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
    v_total := v_total * 0.5;
    v_same_faction_discount := TRUE;
  END IF;

  -- Fortification (claim / fortify)
  IF p_action = 'claim' THEN
    v_fortif_cost := COALESCE(v_fortification, 0);

    -- Voisins fortifiés
    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_fort_multiplier'), 0.5) INTO v_zone_multiplier;
    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'territory_size_defense_mult'), 0) INTO v_size_multiplier;

    IF v_place_faction IS NOT NULL THEN
      SELECT COALESCE(SUM(p2.fortification_level), 0) INTO v_neighbor_fort
      FROM places p2 WHERE p2.faction_id = v_place_faction AND p2.id != p_place_id
        AND sqrt(pow((p2.latitude-v_place_lat)*111,2)+pow((p2.longitude-v_place_lng)*79,2))
          <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10);

      IF v_size_multiplier > 0 THEN
        v_blob_ids := ARRAY[p_place_id];
        LOOP
          SELECT array_agg(p2.id) INTO v_new_ids FROM places p2
          WHERE p2.faction_id = v_place_faction AND NOT (p2.id = ANY(v_blob_ids))
            AND EXISTS (SELECT 1 FROM unnest(v_blob_ids) AS bid JOIN places pb ON pb.id = bid
              WHERE sqrt(pow((p2.latitude-pb.latitude)*111,2)+pow((p2.longitude-pb.longitude)*79,2))
                <= COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'zone_detection_radius_km'), 10));
          EXIT WHEN v_new_ids IS NULL;
          v_blob_ids := v_blob_ids || v_new_ids;
        END LOOP;
        v_neighbor_count := array_length(v_blob_ids, 1) - 1;
      END IF;
    END IF;

    v_zone_cost := FLOOR(v_neighbor_fort * v_zone_multiplier);
    v_size_cost := FLOOR(v_neighbor_count * v_size_multiplier);
  END IF;

  IF p_action = 'fortify' AND p_fortify_level IS NOT NULL THEN
    SELECT COALESCE(ct.cost, 1) INTO v_fortif_cost
    FROM construction_types ct WHERE ct.level = p_fortify_level;
  END IF;

  v_total := v_total + v_fortif_cost + v_zone_cost + v_size_cost;
  v_total := GREATEST(0.5, ROUND(v_total * 2) / 2.0);

  RETURN json_build_object(
    'cost', v_total,
    'energy', v_energy,
    'canAfford', v_energy >= v_total,
    'detail', json_build_object(
      'baseCost', v_base_cost,
      'distanceKm', ROUND(v_distance_km::NUMERIC, 1),
      'distanceMult', v_dist_mult,
      'tagReduction', v_tag_reduction,
      'sameFaction', v_same_faction_discount,
      'fortifCost', v_fortif_cost,
      'zoneCost', v_zone_cost,
      'sizeCost', v_size_cost
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_action_cost(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT) TO authenticated;
