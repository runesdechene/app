-- ============================================
-- MIGRATION 039 : Régénération des 3 ressources
-- ============================================
-- Énergie :     +0.5/h → 12 pts/jour (cycle 7200s, taux fixe 1)
-- Conquête :    +0.25/h → 6 pts/jour (cycle 14400s, taux fixe 1)
-- Construction : +0.25/h → 6 pts/jour (cycle 14400s, taux fixe 1)
-- Cap : 5 max pour les 3
-- ============================================

-- 1. Colonnes regen timestamps
ALTER TABLE users ADD COLUMN IF NOT EXISTS conquest_reset_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS construction_reset_at TIMESTAMPTZ DEFAULT NOW();

-- 1b. Remonter les utilisateurs existants à 5/5
UPDATE users SET conquest_points = 5 WHERE conquest_points < 5;
UPDATE users SET construction_points = 5 WHERE construction_points < 5;

-- ============================================
-- 2. get_user_energy — regen des 3 ressources
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_energy(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Énergie (+0.5/h → 1 pt toutes les 7200s)
  v_energy NUMERIC(4,1);
  v_energy_reset_at TIMESTAMPTZ;
  v_max_energy NUMERIC(4,1) := 5.0;
  v_energy_cycle INT := 7200;
  v_energy_elapsed FLOAT;
  v_energy_ticks INT;
  v_energy_add NUMERIC(4,1);
  v_energy_next_in INT;
  -- Conquête (+0.25/h → 1 pt toutes les 14400s)
  v_conquest NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_max_conquest NUMERIC(6,1) := 5.0;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_add NUMERIC(6,1);
  v_conquest_next_in INT;
  -- Construction (+0.25/h → 1 pt toutes les 14400s)
  v_construction NUMERIC(6,1);
  v_construction_reset_at TIMESTAMPTZ;
  v_max_construction NUMERIC(6,1) := 5.0;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_add NUMERIC(6,1);
  v_construction_next_in INT;
BEGIN
  SELECT energy_points, energy_reset_at,
         conquest_points, conquest_reset_at,
         construction_points, construction_reset_at
  INTO v_energy, v_energy_reset_at,
       v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at
  FROM users WHERE id = p_user_id;

  -- ---- ÉNERGIE (cycle 7200s, taux fixe 1) ----
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

  -- ---- CONQUÊTE (cycle 14400s, taux fixe 1) ----
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

  -- ---- CONSTRUCTION (cycle 14400s, taux fixe 1) ----
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
    'conquestPoints', COALESCE(v_conquest, 0),
    'maxConquest', v_max_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', COALESCE(v_construction, 0),
    'maxConstruction', v_max_construction,
    'constructionNextPointIn', v_construction_next_in
  );
END;
$$;

-- ============================================
-- 3. discover_place — énergie cycle 7200s, taux fixe
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
  v_max_energy NUMERIC(4,1) := 5.0;
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
  v_max_conquest NUMERIC(6,1) := 5.0;
  v_max_construction NUMERIC(6,1) := 5.0;
  -- Conquest regen
  v_conquest_reset_at TIMESTAMPTZ;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_next_in INT;
  -- Construction regen
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
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
    INTO v_energy, v_energy_reset_at
    FROM users WHERE id = p_user_id;

    -- Regen énergie avant de vérifier le coût
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
        conquest_points = LEAST(conquest_points + v_reward_conquest, v_max_conquest),
        construction_points = LEAST(construction_points + v_reward_construction, v_max_construction)
    WHERE id = p_user_id;
  END IF;

  -- Récupérer l'état final
  SELECT energy_points, energy_reset_at,
         conquest_points, conquest_reset_at,
         construction_points, construction_reset_at
  INTO v_energy, v_energy_reset_at,
       v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at
  FROM users WHERE id = p_user_id;

  -- Energy next point
  v_energy_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset_at));
  v_energy_ticks := GREATEST(0, floor(v_energy_elapsed / v_energy_cycle)::int);
  IF v_energy >= v_max_energy THEN
    v_energy_next_in := 0;
  ELSE
    v_energy_next_in := GREATEST(0, (v_energy_cycle - (v_energy_elapsed - v_energy_ticks * v_energy_cycle))::int);
  END IF;

  -- Conquest next point
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- Construction next point
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
-- 4. claim_place — conquête cycle 14400s
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
  v_max_conquest NUMERIC(6,1) := 5.0;
  v_max_construction NUMERIC(6,1) := 5.0;
  -- Conquest regen
  v_conquest_reset_at TIMESTAMPTZ;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_next_in INT;
  -- Construction regen
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
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
        conquest_points = LEAST(conquest_points + v_reward_conquest, v_max_conquest),
        construction_points = LEAST(construction_points + v_reward_construction, v_max_construction)
    WHERE id = p_user_id;
  END IF;

  -- Récupérer l'état final
  SELECT energy_points, conquest_points, conquest_reset_at,
         construction_points, construction_reset_at
  INTO v_energy, v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at
  FROM users WHERE id = p_user_id;

  -- Conquest next point
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- Construction next point
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
    'rewards', json_build_object(
      'energy', v_reward_energy,
      'conquest', v_reward_conquest,
      'construction', v_reward_construction
    ),
    'claimCost', v_claim_cost
  );
END;
$$;
