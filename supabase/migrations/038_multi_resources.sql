-- ============================================
-- MIGRATION 038 : Système multi-ressources
-- ============================================
-- Ajoute Points de Conquête et Points de Construction
-- Les tags définissent les récompenses par lieu
-- ============================================

-- 1. Nouvelles colonnes users
ALTER TABLE users ADD COLUMN IF NOT EXISTS conquest_points NUMERIC(6,1) NOT NULL DEFAULT 5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS construction_points NUMERIC(6,1) NOT NULL DEFAULT 5;

-- 2. Colonnes récompenses sur tags
ALTER TABLE tags ADD COLUMN IF NOT EXISTS reward_energy INT NOT NULL DEFAULT 0;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS reward_conquest INT NOT NULL DEFAULT 0;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS reward_construction INT NOT NULL DEFAULT 0;

-- ============================================
-- 3. get_user_energy — retourne aussi conquête + construction
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_energy(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy NUMERIC(4,1);
  v_updated_at TIMESTAMPTZ;
  v_claimed_count INT;
  v_regen_rate INT;
  v_seconds_elapsed FLOAT;
  v_ticks INT;
  v_points_to_add NUMERIC(4,1);
  v_max_energy NUMERIC(4,1) := 5.0;
  v_cycle_seconds INT := 14400;
  v_next_point_in INT;
  v_elapsed_in_tick FLOAT;
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
BEGIN
  SELECT energy_points, energy_reset_at, conquest_points, construction_points
  INTO v_energy, v_updated_at, v_conquest, v_construction
  FROM users WHERE id = p_user_id;

  SELECT count(*)::int INTO v_claimed_count
  FROM places WHERE claimed_by = p_user_id;

  v_regen_rate := 1 + (v_claimed_count / 3);
  v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_updated_at));
  v_ticks := GREATEST(0, floor(v_seconds_elapsed / v_cycle_seconds)::int);
  v_points_to_add := LEAST(v_ticks * v_regen_rate, v_max_energy - v_energy);

  IF v_points_to_add > 0 THEN
    v_energy := v_energy + v_points_to_add;
    UPDATE users
    SET energy_points = v_energy,
        energy_reset_at = energy_reset_at + (v_ticks * interval '4 hours')
    WHERE id = p_user_id;
  END IF;

  IF v_energy >= v_max_energy THEN
    v_next_point_in := 0;
  ELSE
    v_elapsed_in_tick := v_seconds_elapsed - (v_ticks * v_cycle_seconds);
    v_next_point_in := GREATEST(0, (v_cycle_seconds - v_elapsed_in_tick)::int);
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'regenRate', v_regen_rate,
    'claimedCount', v_claimed_count,
    'nextPointIn', v_next_point_in,
    'conquestPoints', COALESCE(v_conquest, 0),
    'constructionPoints', COALESCE(v_construction, 0)
  );
END;
$$;

-- ============================================
-- 4. discover_place — récompenses par tag après découverte
-- ============================================

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
  v_energy NUMERIC(4,1);
  v_updated_at TIMESTAMPTZ;
  v_already BOOLEAN;
  v_claimed_count INT;
  v_regen_rate INT;
  v_seconds_elapsed FLOAT;
  v_ticks INT;
  v_points_to_add NUMERIC(4,1);
  v_max_energy NUMERIC(4,1) := 5.0;
  v_cycle_seconds INT := 14400;
  v_next_point_in INT;
  v_elapsed_in_tick FLOAT;
  v_cost NUMERIC(4,1);
  v_place_faction VARCHAR(255);
  v_user_faction VARCHAR(255);
  v_reward_energy INT;
  v_reward_conquest INT;
  v_reward_construction INT;
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
BEGIN
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM places_discovered
    WHERE user_id = p_user_id AND place_id = p_place_id
  ) INTO v_already;

  IF v_already THEN
    SELECT energy_points, conquest_points, construction_points
    INTO v_energy, v_conquest, v_construction
    FROM users WHERE id = p_user_id;
    RETURN json_build_object(
      'success', true, 'already', true,
      'energy', v_energy,
      'conquestPoints', v_conquest,
      'constructionPoints', v_construction
    );
  END IF;

  IF p_method = 'remote' THEN
    SELECT faction_id INTO v_place_faction FROM places WHERE id = p_place_id;
    SELECT faction_id INTO v_user_faction FROM users WHERE id = p_user_id;

    IF v_place_faction IS NOT NULL AND v_place_faction = v_user_faction THEN
      v_cost := 0.5;
    ELSE
      v_cost := 1.0;
    END IF;

    SELECT energy_points, energy_reset_at
    INTO v_energy, v_updated_at
    FROM users WHERE id = p_user_id;

    SELECT count(*)::int INTO v_claimed_count
    FROM places WHERE claimed_by = p_user_id;

    v_regen_rate := 1 + (v_claimed_count / 3);
    v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_updated_at));
    v_ticks := GREATEST(0, floor(v_seconds_elapsed / v_cycle_seconds)::int);
    v_points_to_add := LEAST(v_ticks * v_regen_rate, v_max_energy - v_energy);

    IF v_points_to_add > 0 THEN
      v_energy := v_energy + v_points_to_add;
      UPDATE users
      SET energy_points = v_energy,
          energy_reset_at = energy_reset_at + (v_ticks * interval '4 hours')
      WHERE id = p_user_id;
    END IF;

    IF v_energy < v_cost THEN
      RETURN json_build_object('error', 'Not enough energy', 'energy', v_energy);
    END IF;

    UPDATE users
    SET energy_points = energy_points - v_cost
    WHERE id = p_user_id;
  END IF;

  -- Insérer la découverte
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- Récompenses basées sur le tag primaire du lieu
  SELECT t.reward_energy, t.reward_conquest, t.reward_construction
  INTO v_reward_energy, v_reward_conquest, v_reward_construction
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE
  LIMIT 1;

  v_reward_energy := COALESCE(v_reward_energy, 0);
  v_reward_conquest := COALESCE(v_reward_conquest, 0);
  v_reward_construction := COALESCE(v_reward_construction, 0);

  IF v_reward_energy > 0 OR v_reward_conquest > 0 OR v_reward_construction > 0 THEN
    UPDATE users
    SET energy_points = LEAST(energy_points + v_reward_energy, v_max_energy),
        conquest_points = conquest_points + v_reward_conquest,
        construction_points = construction_points + v_reward_construction
    WHERE id = p_user_id;
  END IF;

  -- Récupérer l'état final
  SELECT energy_points, energy_reset_at, conquest_points, construction_points
  INTO v_energy, v_updated_at, v_conquest, v_construction
  FROM users WHERE id = p_user_id;

  SELECT count(*)::int INTO v_claimed_count
  FROM places WHERE claimed_by = p_user_id;

  v_regen_rate := 1 + (v_claimed_count / 3);
  v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_updated_at));
  v_ticks := GREATEST(0, floor(v_seconds_elapsed / v_cycle_seconds)::int);

  IF v_energy >= v_max_energy THEN
    v_next_point_in := 0;
  ELSE
    v_elapsed_in_tick := v_seconds_elapsed - (v_ticks * v_cycle_seconds);
    v_next_point_in := GREATEST(0, (v_cycle_seconds - v_elapsed_in_tick)::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'energy', v_energy,
    'regenRate', v_regen_rate,
    'claimedCount', v_claimed_count,
    'nextPointIn', v_next_point_in,
    'conquestPoints', v_conquest,
    'constructionPoints', v_construction,
    'rewards', json_build_object(
      'energy', v_reward_energy,
      'conquest', v_reward_conquest,
      'construction', v_reward_construction
    )
  );
END;
$$;

-- ============================================
-- 5. claim_place — coût conquête + récompenses tag
-- ============================================

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
  v_claim_cost NUMERIC(6,1) := 1.0;
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_energy NUMERIC(4,1);
  v_reward_energy INT;
  v_reward_conquest INT;
  v_reward_construction INT;
BEGIN
  -- Récupérer la faction du user
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Vérifier les points de conquête
  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest
    );
  END IF;

  -- Vérifier que le lieu existe
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Revendiquer le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Historique
  INSERT INTO place_claims (place_id, user_id, faction_id)
  VALUES (p_place_id, p_user_id, v_faction_id);

  -- Déduire le coût de conquête
  UPDATE users
  SET conquest_points = conquest_points - v_claim_cost
  WHERE id = p_user_id;

  -- Récompenses basées sur le tag primaire
  SELECT t.reward_energy, t.reward_conquest, t.reward_construction
  INTO v_reward_energy, v_reward_conquest, v_reward_construction
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE
  LIMIT 1;

  v_reward_energy := COALESCE(v_reward_energy, 0);
  v_reward_conquest := COALESCE(v_reward_conquest, 0);
  v_reward_construction := COALESCE(v_reward_construction, 0);

  IF v_reward_energy > 0 OR v_reward_conquest > 0 OR v_reward_construction > 0 THEN
    UPDATE users
    SET energy_points = LEAST(energy_points + v_reward_energy, 5.0),
        conquest_points = conquest_points + v_reward_conquest,
        construction_points = construction_points + v_reward_construction
    WHERE id = p_user_id;
  END IF;

  -- Récupérer l'état final
  SELECT energy_points, conquest_points, construction_points
  INTO v_energy, v_conquest, v_construction
  FROM users WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id,
    'energy', v_energy,
    'conquestPoints', v_conquest,
    'constructionPoints', v_construction,
    'rewards', json_build_object(
      'energy', v_reward_energy,
      'conquest', v_reward_conquest,
      'construction', v_reward_construction
    ),
    'claimCost', v_claim_cost
  );
END;
$$;
