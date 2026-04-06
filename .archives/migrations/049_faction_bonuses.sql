-- ============================================
-- MIGRATION 049 : Bonus de faction sur les jauges
-- ============================================
-- Chaque faction peut accorder un bonus au max des jauges.
-- Max effectif = users.max_X + factions.bonus_X
-- ============================================

-- 1. Colonnes bonus sur factions
ALTER TABLE factions ADD COLUMN IF NOT EXISTS bonus_energy NUMERIC(4,1) NOT NULL DEFAULT 0;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS bonus_conquest NUMERIC(6,1) NOT NULL DEFAULT 0;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS bonus_construction NUMERIC(6,1) NOT NULL DEFAULT 0;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS bonus_regen_energy NUMERIC(4,1) NOT NULL DEFAULT 0;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS bonus_regen_conquest NUMERIC(4,1) NOT NULL DEFAULT 0;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS bonus_regen_construction NUMERIC(4,1) NOT NULL DEFAULT 0;

-- ============================================
-- 2. get_user_energy — LEFT JOIN factions
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
  v_energy_reset_at TIMESTAMPTZ;
  v_max_energy NUMERIC(4,1);
  v_energy_cycle INT := 7200;
  v_energy_elapsed FLOAT;
  v_energy_ticks INT;
  v_energy_add NUMERIC(4,1);
  v_energy_next_in INT;
  v_conquest NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_max_conquest NUMERIC(6,1);
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_add NUMERIC(6,1);
  v_conquest_next_in INT;
  v_construction NUMERIC(6,1);
  v_construction_reset_at TIMESTAMPTZ;
  v_max_construction NUMERIC(6,1);
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_add NUMERIC(6,1);
  v_construction_next_in INT;
  v_notoriety INT;
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
BEGIN
  SELECT u.energy_points, u.energy_reset_at,
         GREATEST(1, u.max_energy + COALESCE(f.bonus_energy, 0)),
         u.conquest_points, u.conquest_reset_at,
         GREATEST(1, u.max_conquest + COALESCE(f.bonus_conquest, 0)),
         u.construction_points, u.construction_reset_at,
         GREATEST(1, u.max_construction + COALESCE(f.bonus_construction, 0)),
         u.notoriety_points,
         GREATEST(600, (7200 * (100 - COALESCE(f.bonus_regen_energy, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_conquest, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_construction, 0)) / 100)::INT),
         COALESCE(f.bonus_energy, 0),
         COALESCE(f.bonus_conquest, 0),
         COALESCE(f.bonus_construction, 0)
  INTO v_energy, v_energy_reset_at, v_max_energy,
       v_conquest, v_conquest_reset_at, v_max_conquest,
       v_construction, v_construction_reset_at, v_max_construction,
       v_notoriety,
       v_energy_cycle, v_conquest_cycle, v_construction_cycle,
       v_bonus_energy, v_bonus_conquest, v_bonus_construction
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  -- ---- ENERGIE ----
  v_energy_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset_at));
  v_energy_ticks := GREATEST(0, floor(v_energy_elapsed / v_energy_cycle)::int);
  v_energy_add := LEAST(v_energy_ticks * 1, v_max_energy - v_energy);

  IF v_energy_add > 0 THEN
    v_energy := v_energy + v_energy_add;
    UPDATE users
    SET energy_points = v_energy,
        energy_reset_at = energy_reset_at + make_interval(secs := v_energy_ticks * v_energy_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_energy >= v_max_energy THEN
    v_energy_next_in := 0;
  ELSE
    v_energy_next_in := GREATEST(0, (v_energy_cycle - (v_energy_elapsed - v_energy_ticks * v_energy_cycle))::int);
  END IF;

  -- ---- CONQUETE ----
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  v_conquest_add := LEAST(v_conquest_ticks * 1, v_max_conquest - v_conquest);

  IF v_conquest_add > 0 THEN
    v_conquest := v_conquest + v_conquest_add;
    UPDATE users
    SET conquest_points = v_conquest,
        conquest_reset_at = conquest_reset_at + make_interval(secs := v_conquest_ticks * v_conquest_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- ---- CONSTRUCTION ----
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  v_construction_add := LEAST(v_construction_ticks * 1, v_max_construction - v_construction);

  IF v_construction_add > 0 THEN
    v_construction := v_construction + v_construction_add;
    UPDATE users
    SET construction_points = v_construction,
        construction_reset_at = construction_reset_at + make_interval(secs := v_construction_ticks * v_construction_cycle)
    WHERE id = p_user_id;
  END IF;

  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'nextPointIn', v_energy_next_in,
    'energyCycle', v_energy_cycle,
    'conquestPoints', COALESCE(v_conquest, 0),
    'maxConquest', v_max_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'conquestCycle', v_conquest_cycle,
    'constructionPoints', COALESCE(v_construction, 0),
    'maxConstruction', v_max_construction,
    'constructionNextPointIn', v_construction_next_in,
    'constructionCycle', v_construction_cycle,
    'notorietyPoints', COALESCE(v_notoriety, 0),
    'bonusEnergy', v_bonus_energy,
    'bonusConquest', v_bonus_conquest,
    'bonusConstruction', v_bonus_construction
  );
END;
$$;

-- ============================================
-- 3. discover_place — LEFT JOIN factions
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
  v_energy_reset_at TIMESTAMPTZ;
  v_already BOOLEAN;
  v_max_energy NUMERIC(4,1);
  v_energy_cycle INT := 7200;
  v_energy_elapsed FLOAT;
  v_energy_ticks INT;
  v_energy_add NUMERIC(4,1);
  v_energy_next_in INT;
  v_cost NUMERIC(4,1);
  v_place_faction VARCHAR(255);
  v_user_faction VARCHAR(255);
  v_reward_energy INT;
  v_reward_conquest INT;
  v_reward_construction INT;
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_next_in INT;
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Lire les max du user + bonus faction + cycles regen
  SELECT GREATEST(1, u.max_energy + COALESCE(f.bonus_energy, 0)),
         GREATEST(1, u.max_conquest + COALESCE(f.bonus_conquest, 0)),
         GREATEST(1, u.max_construction + COALESCE(f.bonus_construction, 0)),
         GREATEST(600, (7200 * (100 - COALESCE(f.bonus_regen_energy, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_conquest, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_construction, 0)) / 100)::INT)
  INTO v_max_energy, v_max_conquest, v_max_construction,
       v_energy_cycle, v_conquest_cycle, v_construction_cycle
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

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
    INTO v_energy, v_energy_reset_at
    FROM users WHERE id = p_user_id;

    v_energy_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset_at));
    v_energy_ticks := GREATEST(0, floor(v_energy_elapsed / v_energy_cycle)::int);
    v_energy_add := LEAST(v_energy_ticks * 1, v_max_energy - v_energy);

    IF v_energy_add > 0 THEN
      v_energy := v_energy + v_energy_add;
      UPDATE users
      SET energy_points = v_energy,
          energy_reset_at = energy_reset_at + make_interval(secs := v_energy_ticks * v_energy_cycle)
      WHERE id = p_user_id;
    END IF;

    IF v_energy < v_cost THEN
      RETURN json_build_object('error', 'Not enough energy', 'energy', v_energy);
    END IF;

    UPDATE users
    SET energy_points = energy_points - v_cost
    WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

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
        conquest_points = LEAST(conquest_points + v_reward_conquest, v_max_conquest),
        construction_points = LEAST(construction_points + v_reward_construction, v_max_construction)
    WHERE id = p_user_id;
  END IF;

  SELECT energy_points, energy_reset_at,
         conquest_points, conquest_reset_at,
         construction_points, construction_reset_at
  INTO v_energy, v_energy_reset_at,
       v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at
  FROM users WHERE id = p_user_id;

  v_energy_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset_at));
  v_energy_ticks := GREATEST(0, floor(v_energy_elapsed / v_energy_cycle)::int);
  IF v_energy >= v_max_energy THEN
    v_energy_next_in := 0;
  ELSE
    v_energy_next_in := GREATEST(0, (v_energy_cycle - (v_energy_elapsed - v_energy_ticks * v_energy_cycle))::int);
  END IF;

  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'energy', v_energy,
    'nextPointIn', v_energy_next_in,
    'conquestPoints', v_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'rewards', json_build_object(
      'energy', v_reward_energy,
      'conquest', v_reward_conquest,
      'construction', v_reward_construction
    )
  );
END;
$$;

-- ============================================
-- 4. claim_place — LEFT JOIN factions
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
  v_fortification INT;
  v_claim_cost NUMERIC(6,1);
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_energy NUMERIC(4,1);
  v_notoriety INT;
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_next_in INT;
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
BEGIN
  -- Recuperer faction + max du user + bonus faction + cycles regen
  SELECT u.faction_id,
         GREATEST(1, u.max_conquest + COALESCE(f.bonus_conquest, 0)),
         GREATEST(1, u.max_construction + COALESCE(f.bonus_construction, 0)),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_conquest, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_construction, 0)) / 100)::INT)
  INTO v_faction_id, v_max_conquest, v_max_construction,
       v_conquest_cycle, v_construction_cycle
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe + lire fortification
  SELECT fortification_level INTO v_fortification
  FROM places WHERE id = p_place_id;

  IF v_fortification IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  v_claim_cost := 1 + COALESCE(v_fortification, 0);

  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest,
      'claimCost', v_claim_cost
    );
  END IF;

  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = 0,
      updated_at = NOW()
  WHERE id = p_place_id;

  INSERT INTO place_claims (place_id, user_id, faction_id)
  VALUES (p_place_id, p_user_id, v_faction_id);

  UPDATE users
  SET conquest_points = conquest_points - v_claim_cost,
      notoriety_points = notoriety_points + 10
  WHERE id = p_user_id;

  SELECT energy_points, conquest_points, conquest_reset_at,
         construction_points, construction_reset_at, notoriety_points
  INTO v_energy, v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at, v_notoriety
  FROM users WHERE id = p_user_id;

  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id,
    'energy', v_energy,
    'conquestPoints', v_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', 0,
    'claimCost', v_claim_cost
  );
END;
$$;

-- ============================================
-- 5. fortify_place — LEFT JOIN factions
-- ============================================

CREATE OR REPLACE FUNCTION public.fortify_place(
  p_user_id TEXT,
  p_place_id TEXT
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
  v_costs INT[] := ARRAY[1, 2, 3, 5];
  v_names TEXT[] := ARRAY['Tour de guet', 'Tour de defense', 'Bastion', 'Befroi'];
  v_construction NUMERIC(6,1);
  v_notoriety INT;
  v_max_construction NUMERIC(6,1);
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
BEGIN
  -- Verifier faction + lire max du user + bonus faction + cycle regen
  SELECT u.faction_id,
         GREATEST(1, u.max_construction + COALESCE(f.bonus_construction, 0)),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_construction, 0)) / 100)::INT)
  INTO v_user_faction, v_max_construction, v_construction_cycle
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  IF v_user_faction IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  SELECT faction_id, fortification_level
  INTO v_place_faction, v_current_level
  FROM places WHERE id = p_place_id;

  IF v_place_faction IS NULL THEN
    RETURN json_build_object('error', 'Place not claimed');
  END IF;

  IF v_place_faction != v_user_faction THEN
    RETURN json_build_object('error', 'Not your faction territory');
  END IF;

  IF v_current_level >= 4 THEN
    RETURN json_build_object('error', 'Max fortification reached');
  END IF;

  v_cost := v_costs[v_current_level + 1];

  SELECT construction_points INTO v_construction FROM users WHERE id = p_user_id;
  IF v_construction < v_cost THEN
    RETURN json_build_object(
      'error', 'Not enough construction points',
      'constructionPoints', v_construction,
      'cost', v_cost
    );
  END IF;

  UPDATE users
  SET construction_points = construction_points - v_cost,
      notoriety_points = notoriety_points + 5
  WHERE id = p_user_id;

  UPDATE places
  SET fortification_level = v_current_level + 1,
      updated_at = NOW()
  WHERE id = p_place_id;

  SELECT construction_points, construction_reset_at, notoriety_points
  INTO v_construction, v_construction_reset_at, v_notoriety
  FROM users WHERE id = p_user_id;

  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', v_current_level + 1,
    'fortificationName', v_names[v_current_level + 1],
    'cost', v_cost
  );
END;
$$;
