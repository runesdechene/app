-- ============================================
-- MIGRATION 141 : Retour à une seule jauge (Énergie)
-- ============================================
-- Les 4 jauges étaient trop complexes. On revient à l'énergie unique.
-- Le coût varie selon le type de lieu (tag). Les Fragments réduisent les coûts.

-- 1. Ajouter un coût de base par tag (remplace le système de gauge)
ALTER TABLE tags ADD COLUMN IF NOT EXISTS base_cost NUMERIC(4,1) NOT NULL DEFAULT 1.0;

-- 2. Modifier discover_place : toujours dépenser de l'énergie, coût = tag.base_cost
CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already BOOLEAN;
  v_base_cost NUMERIC := 1.0;
  v_cost NUMERIC;
  v_energy NUMERIC;
  v_max_energy NUMERIC;
  v_place_faction TEXT;
  v_user_faction TEXT;
  v_reward_energy INT := 0;
  v_reward_conquest INT := 0;
  v_reward_construction INT := 0;
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

  -- GPS = gratuit
  IF p_method = 'gps' THEN
    v_cost := 0;
  ELSE
    -- Remote : coût réduit si même héritage
    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_place_id;
    SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

    IF v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
      v_cost := v_base_cost * 0.5;
    ELSE
      v_cost := v_base_cost;
    END IF;
  END IF;

  -- Vérifier l'énergie
  SELECT energy_points, max_energy INTO v_energy, v_max_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
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
  SELECT t.reward_energy, t.reward_conquest, t.reward_construction
  INTO v_reward_energy, v_reward_conquest, v_reward_construction
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE
  LIMIT 1;

  v_reward_energy := COALESCE(v_reward_energy, 0);
  v_reward_conquest := COALESCE(v_reward_conquest, 0);
  v_reward_construction := COALESCE(v_reward_construction, 0);

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
  END IF;

  -- Gloire +2
  UPDATE users SET notoriety_points = notoriety_points + 2 WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'cost', v_cost,
    'rewards', json_build_object('energy', v_reward_energy)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT) TO authenticated;

-- 3. Modifier claim_place : toujours dépenser de l'énergie
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
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
  v_claim_cost NUMERIC;
  v_energy NUMERIC;
  v_notoriety INT;
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
  SELECT faction_id, fortification_level INTO v_current_faction, v_fortification FROM places WHERE id = p_place_id;
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
        pow((p2.latitude - (SELECT latitude FROM places WHERE id = p_place_id)) * 111, 2)
        + pow((p2.longitude - (SELECT longitude FROM places WHERE id = p_place_id)) * 79, 2)
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

  -- Coût dynamique basé sur le coût du tag
  v_claim_cost := v_base_cost
    + COALESCE(v_fortification, 0)
    + FLOOR(v_neighbor_fort * v_zone_multiplier)
    + FLOOR(v_neighbor_count * v_size_multiplier);

  -- Vérifier l'énergie
  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'not_enough_energy',
      'energy', v_energy,
      'claimCost', v_claim_cost
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
    'notorietyPoints', v_notoriety,
    'factionId', v_faction_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_place(TEXT, TEXT) TO authenticated;
