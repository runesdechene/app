-- ============================================
-- MIGRATION 024 : Regen d'energie progressive
-- ============================================
-- Remplace le reset quotidien par une regeneration
-- continue. Plus on possede de lieux, plus c'est rapide.
-- Cycle : 4h. Points/cycle = 1 + floor(claimed_count / 3)
-- ============================================

-- ============================================
-- 1. MAJ get_user_energy — regen progressive
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_energy(
  p_user_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy INT;
  v_updated_at TIMESTAMPTZ;
  v_user_faction_id TEXT;
  v_claimed_count INT;
  v_regen_rate INT;
  v_seconds_elapsed FLOAT;
  v_ticks INT;
  v_points_to_add INT;
  v_max_energy INT := 5;
  v_cycle_seconds INT := 14400;  -- 4 heures en secondes
  v_next_point_in INT;
  v_elapsed_in_tick FLOAT;
BEGIN
  SELECT energy_points, energy_reset_at, faction_id
  INTO v_energy, v_updated_at, v_user_faction_id
  FROM users WHERE id = p_user_id;

  -- Compter les lieux revendiques par ce joueur ET toujours dans sa faction actuelle
  SELECT count(*)::int INTO v_claimed_count
  FROM places
  WHERE claimed_by = p_user_id
    AND faction_id = v_user_faction_id;

  -- Taux de regen : 1 base + 1 par tranche de 3 lieux
  v_regen_rate := 1 + (v_claimed_count / 3);

  -- Secondes ecoulees depuis le dernier update
  v_seconds_elapsed := EXTRACT(EPOCH FROM (NOW() - v_updated_at));

  -- Nombre de cycles complets ecoules
  v_ticks := GREATEST(0, floor(v_seconds_elapsed / v_cycle_seconds)::int);

  -- Points a ajouter (cap a max)
  v_points_to_add := LEAST(v_ticks * v_regen_rate, v_max_energy - v_energy);

  IF v_points_to_add > 0 THEN
    v_energy := v_energy + v_points_to_add;

    -- Avancer le timer du nombre de ticks consommes
    UPDATE users
    SET energy_points = v_energy,
        energy_reset_at = energy_reset_at + (v_ticks * interval '4 hours')
    WHERE id = p_user_id;
  END IF;

  -- Calculer le temps avant le prochain point
  IF v_energy >= v_max_energy THEN
    v_next_point_in := 0;
  ELSE
    -- Secondes ecoulees dans le tick courant
    v_elapsed_in_tick := v_seconds_elapsed - (v_ticks * v_cycle_seconds);
    v_next_point_in := GREATEST(0, (v_cycle_seconds - v_elapsed_in_tick)::int);
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'regenRate', v_regen_rate,
    'claimedCount', v_claimed_count,
    'nextPointIn', v_next_point_in
  );
END;
$$;

-- ============================================
-- 2. MAJ discover_place — regen inline
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
  v_energy INT;
  v_updated_at TIMESTAMPTZ;
  v_user_faction_id TEXT;
  v_already BOOLEAN;
  v_claimed_count INT;
  v_regen_rate INT;
  v_seconds_elapsed FLOAT;
  v_ticks INT;
  v_points_to_add INT;
  v_max_energy INT := 5;
  v_cycle_seconds INT := 14400;
  v_next_point_in INT;
  v_elapsed_in_tick FLOAT;
BEGIN
  -- Verifier que le lieu existe
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Verifier si deja decouvert (idempotent)
  SELECT EXISTS(
    SELECT 1 FROM places_discovered
    WHERE user_id = p_user_id AND place_id = p_place_id
  ) INTO v_already;

  IF v_already THEN
    SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
    RETURN json_build_object('success', true, 'already', true, 'energy', v_energy);
  END IF;

  -- Si methode = remote, appliquer la regen puis verifier l'energie
  IF p_method = 'remote' THEN
    SELECT energy_points, energy_reset_at, faction_id
    INTO v_energy, v_updated_at, v_user_faction_id
    FROM users WHERE id = p_user_id;

    -- Regen progressive (lieux revendiques par ce joueur ET dans sa faction actuelle)
    SELECT count(*)::int INTO v_claimed_count
    FROM places
    WHERE claimed_by = p_user_id
      AND faction_id = v_user_faction_id;

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

    IF v_energy < 1 THEN
      RETURN json_build_object('error', 'Not enough energy', 'energy', 0);
    END IF;

    -- Deduire 1 point (sans toucher energy_reset_at)
    UPDATE users
    SET energy_points = energy_points - 1
    WHERE id = p_user_id;
  END IF;

  -- Inserer la decouverte
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- Retourner l'energie restante + infos regen
  SELECT energy_points, energy_reset_at, faction_id
  INTO v_energy, v_updated_at, v_user_faction_id
  FROM users WHERE id = p_user_id;

  SELECT count(*)::int INTO v_claimed_count
  FROM places
  WHERE claimed_by = p_user_id
    AND faction_id = v_user_faction_id;

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
    'nextPointIn', v_next_point_in
  );
END;
$$;
