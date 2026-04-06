-- ============================================
-- MIGRATION 081 : Multiplicateur de zone fortification configurable
-- ============================================
-- Le multiplicateur etait hardcode a 0.5 dans claim_place.
-- On le stocke dans app_settings pour le rendre configurable depuis le Hub.
-- ============================================

INSERT INTO public.app_settings (key, value)
VALUES ('zone_fort_multiplier', '0.5')
ON CONFLICT (key) DO NOTHING;

-- Mettre a jour claim_place pour lire le multiplicateur depuis app_settings
CREATE OR REPLACE FUNCTION public.claim_place(p_user_id TEXT, p_place_id TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_faction_id TEXT;
  v_fortification INT;
  v_neighbor_fort INT;
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

  -- Lire le multiplicateur depuis app_settings
  SELECT COALESCE(value, '0.5')::NUMERIC(4,2) INTO v_zone_multiplier
  FROM app_settings WHERE key = 'zone_fort_multiplier';
  IF v_zone_multiplier IS NULL THEN v_zone_multiplier := 0.5; END IF;

  -- Fortification des voisins dont le territoire est fusionne (cercles qui se touchent)
  v_neighbor_fort := 0;
  IF v_current_faction IS NOT NULL THEN
    v_target_score := place_influence_score(p_place_id);
    v_target_radius := territory_radius_km(v_target_score);

    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_neighbor_fort
    FROM places p2
    WHERE p2.faction_id = v_current_faction
      AND p2.id != p_place_id
      AND ABS(p2.latitude - v_lat) < 0.09
      AND ABS(p2.longitude - v_lon) < 0.127
      AND (
        territory_radius_km(place_influence_score(p2.id)) + v_target_radius
        >=
        sqrt(
          pow((p2.latitude - v_lat) * 111, 2)
          + pow((p2.longitude - v_lon) * 79, 2)
        )
      );
  END IF;

  -- Cout dynamique : 1 + fort du lieu + bonus zone (multiplicateur configurable)
  v_claim_cost := 1 + COALESCE(v_fortification, 0) + FLOOR(v_neighbor_fort * v_zone_multiplier);

  -- Verifier les points de conquete
  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest,
      'claimCost', v_claim_cost,
      'neighborFort', v_neighbor_fort
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
  INSERT INTO activity_log (user_id, action, data)
  VALUES (
    p_user_id,
    'claim',
    json_build_object(
      'placeId', p_place_id,
      'factionId', v_faction_id,
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
    'neighborFort', v_neighbor_fort
  );
END;
$$;
