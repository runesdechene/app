-- ============================================
-- MIGRATION 084 : Fix colonnes activity_log dans claim_place
-- ============================================
-- La table activity_log utilise (type, actor_id, place_id, faction_id, data)
-- mais claim_place utilisait (user_id, action, data) qui n'existent pas.
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_place(p_user_id TEXT, p_place_id TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_faction_id TEXT;
  v_fortification INT;
  v_neighbor_fort INT;
  v_neighbor_count INT;
  v_claim_cost NUMERIC(6,1);
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_max_conquest NUMERIC(6,1);
  v_bonus_conquest NUMERIC(6,1);
  v_current_faction TEXT;
  v_current_claimer TEXT;
  v_notoriety NUMERIC(10,2);
  v_role TEXT;
  v_score INT;
  v_lat DOUBLE PRECISION;
  v_lon DOUBLE PRECISION;
  v_target_score INT;
  v_target_radius DOUBLE PRECISION;
  v_zone_multiplier NUMERIC(4,2);
  v_size_multiplier NUMERIC(4,2);
  v_radius_km NUMERIC(6,1);
  v_lat_delta NUMERIC(8,5);
  v_lon_delta NUMERIC(8,5);
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  -- Faction du joueur
  SELECT faction_id, role INTO v_faction_id, v_role FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Info du lieu
  SELECT faction_id, claimed_by, fortification_level, latitude, longitude
  INTO v_current_faction, v_current_claimer, v_fortification, v_lat, v_lon
  FROM places WHERE id = p_place_id;

  IF v_lat IS NULL THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  -- Deja possede par la meme faction
  IF v_current_faction = v_faction_id THEN
    RETURN json_build_object('error', 'already_owned');
  END IF;

  -- Lire les settings
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_fort_multiplier'), '0.5')::NUMERIC(4,2) INTO v_zone_multiplier;
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'territory_size_defense_mult'), '0')::NUMERIC(4,2) INTO v_size_multiplier;
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_detection_radius_km'), '10')::NUMERIC(6,1) INTO v_radius_km;

  -- Convertir le rayon en delta de coordonnees
  v_lat_delta := v_radius_km / 111.0;
  v_lon_delta := v_radius_km / 79.0;

  -- Fortification voisins (limitee par rayon configurable)
  v_neighbor_fort := 0;
  v_neighbor_count := 0;
  IF v_current_faction IS NOT NULL THEN
    v_target_score := place_influence_score(p_place_id);
    v_target_radius := territory_radius_km(v_target_score);

    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_neighbor_fort
    FROM places p2
    WHERE p2.faction_id = v_current_faction
      AND p2.id != p_place_id
      AND ABS(p2.latitude - v_lat) < v_lat_delta
      AND ABS(p2.longitude - v_lon) < v_lon_delta
      AND (
        territory_radius_km(place_influence_score(p2.id)) + v_target_radius
        >=
        sqrt(
          pow((p2.latitude - v_lat) * 111, 2)
          + pow((p2.longitude - v_lon) * 79, 2)
        )
      );

    -- Taille du territoire (blob entier via boucle iterative)
    v_blob_ids := ARRAY[p_place_id];
    LOOP
      SELECT array_agg(p2.id) INTO v_new_ids
      FROM places p2
      WHERE p2.faction_id = v_current_faction
        AND NOT (p2.id = ANY(v_blob_ids))
        AND EXISTS (
          SELECT 1 FROM places pb
          WHERE pb.id = ANY(v_blob_ids)
            AND territory_radius_km(place_influence_score(p2.id))
              + territory_radius_km(place_influence_score(pb.id))
              >= sqrt(
                pow((p2.latitude - pb.latitude) * 111, 2)
                + pow((p2.longitude - pb.longitude) * 79, 2)
              )
        );
      EXIT WHEN v_new_ids IS NULL;
      v_blob_ids := v_blob_ids || v_new_ids;
    END LOOP;
    v_neighbor_count := array_length(v_blob_ids, 1) - 1;
  END IF;

  -- Cout dynamique : base + fort + zone bonus + territory size bonus
  v_claim_cost := 1
    + COALESCE(v_fortification, 0)
    + FLOOR(v_neighbor_fort * v_zone_multiplier)
    + FLOOR(v_neighbor_count * v_size_multiplier);

  -- Verifier les points de conquete
  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest,
      'claimCost', v_claim_cost,
      'neighborFort', v_neighbor_fort,
      'neighborCount', v_neighbor_count
    );
  END IF;

  -- Max conquete (avec bonus faction)
  SELECT max_conquest INTO v_max_conquest FROM users WHERE id = p_user_id;
  SELECT COALESCE(bonus_conquest, 0) INTO v_bonus_conquest FROM factions WHERE id = v_faction_id;
  v_max_conquest := GREATEST(1, v_max_conquest + v_bonus_conquest);

  -- Deduire les points
  UPDATE users
  SET conquest_points = GREATEST(0, conquest_points - v_claim_cost)
  WHERE id = p_user_id
  RETURNING conquest_points INTO v_conquest;

  -- Reset fortification si changement de faction
  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN
    v_fortification := 0;
  END IF;

  -- Mettre a jour le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = COALESCE(v_fortification, 0)
  WHERE id = p_place_id;

  -- Notoriete
  UPDATE users
  SET notoriety_points = notoriety_points + 10
  WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  -- Log activite
  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'claim',
    p_user_id,
    p_place_id,
    v_faction_id,
    jsonb_build_object(
      'previousFaction', v_current_faction,
      'actorName', (SELECT COALESCE(first_name, 'Quelqu''un') FROM users WHERE id = p_user_id)
    )
  );

  RETURN json_build_object(
    'ok', true,
    'conquestPoints', v_conquest,
    'maxConquest', v_max_conquest,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', 0,
    'claimCost', v_claim_cost,
    'neighborFort', v_neighbor_fort,
    'neighborCount', v_neighbor_count
  );
END;
$$;
