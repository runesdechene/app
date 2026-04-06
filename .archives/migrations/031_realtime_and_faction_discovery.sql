-- ============================================
-- MIGRATION 031 : Realtime Activity + Faction Discovery Cost
-- ============================================
-- 1. Activer Realtime sur activity_log (pour toasts temps réel)
-- 2. Changer energy_points en NUMERIC pour supporter coût 0.5
-- 3. Modifier discover_place pour coût dynamique (0.5 si faction alliée)
-- 4. Modifier get_user_energy pour retourner NUMERIC
-- ============================================

-- 1. Realtime sur activity_log (idempotent)

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_log' AND policyname = 'activity_read') THEN
    CREATE POLICY "activity_read" ON activity_log FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Energy en NUMERIC

ALTER TABLE users ALTER COLUMN energy_points TYPE NUMERIC(4,1);

-- 3. get_user_energy (retourne NUMERIC)

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
BEGIN
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
    'nextPointIn', v_next_point_in
  );
END;
$$;

-- 4. discover_place avec coût dynamique

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
BEGIN
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM places_discovered
    WHERE user_id = p_user_id AND place_id = p_place_id
  ) INTO v_already;

  IF v_already THEN
    SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
    RETURN json_build_object('success', true, 'already', true, 'energy', v_energy);
  END IF;

  IF p_method = 'remote' THEN
    -- Déterminer le coût : 0.5 si le lieu appartient à la faction du joueur, 1 sinon
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

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT energy_points, energy_reset_at
  INTO v_energy, v_updated_at
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
    'nextPointIn', v_next_point_in
  );
END;
$$;

-- 5. Backfill : tout lieu revendiqué par un user doit être marqué comme découvert
-- (corrige les claims faits avant l'introduction du fog personnel)

INSERT INTO places_discovered (user_id, place_id, method, discovered_at)
SELECT p.claimed_by, p.id, 'backfill', p.claimed_at
FROM places p
WHERE p.claimed_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM places_discovered pd
    WHERE pd.user_id = p.claimed_by AND pd.place_id = p.id
  );
