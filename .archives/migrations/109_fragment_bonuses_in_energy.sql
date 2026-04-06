-- ============================================
-- MIGRATION 109 : Appliquer les bonus des fragments dans get_user_energy
-- ============================================
-- Les fragments possedes par le joueur cumulen leurs bonus sur
-- les max de ressources et les cycles de regen.
-- Pile : base user → bonus faction → bonus fragments → underdog
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
  v_user_faction TEXT;
  v_underdog_id TEXT;
  v_underdog_mult NUMERIC(4,1) := 1;
  v_is_underdog BOOLEAN := false;
  -- Fragment bonuses
  v_frag_max_energy NUMERIC := 0;
  v_frag_max_conquest NUMERIC := 0;
  v_frag_max_construction NUMERIC := 0;
  v_frag_regen_energy NUMERIC := 0;
  v_frag_regen_conquest NUMERIC := 0;
  v_frag_regen_construction NUMERIC := 0;
BEGIN
  -- ====== 1. Base user + bonus faction ======
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
         COALESCE(f.bonus_construction, 0),
         u.faction_id
  INTO v_energy, v_energy_reset_at, v_max_energy,
       v_conquest, v_conquest_reset_at, v_max_conquest,
       v_construction, v_construction_reset_at, v_max_construction,
       v_notoriety,
       v_energy_cycle, v_conquest_cycle, v_construction_cycle,
       v_bonus_energy, v_bonus_conquest, v_bonus_construction,
       v_user_faction
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  -- ====== 2. Cumuler les bonus des fragments ======
  SELECT
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_energy' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_conquest' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_construction' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_energy' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_conquest' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_construction' THEN tf.bonus_value ELSE 0 END), 0)
  INTO v_frag_max_energy, v_frag_max_conquest, v_frag_max_construction,
       v_frag_regen_energy, v_frag_regen_conquest, v_frag_regen_construction
  FROM user_fragments uf
  JOIN title_fragments tf ON tf.id = uf.fragment_id
  WHERE uf.user_id = p_user_id AND tf.bonus_type IS NOT NULL AND tf.bonus_value != 0;

  -- Appliquer les bonus max des fragments
  v_max_energy := GREATEST(1, v_max_energy + v_frag_max_energy);
  v_max_conquest := GREATEST(1, v_max_conquest + v_frag_max_conquest);
  v_max_construction := GREATEST(1, v_max_construction + v_frag_max_construction);

  -- Appliquer les bonus regen des fragments (reduction du cycle en %)
  IF v_frag_regen_energy != 0 THEN
    v_energy_cycle := GREATEST(300, (v_energy_cycle * (100 - v_frag_regen_energy) / 100)::INT);
  END IF;
  IF v_frag_regen_conquest != 0 THEN
    v_conquest_cycle := GREATEST(300, (v_conquest_cycle * (100 - v_frag_regen_conquest) / 100)::INT);
  END IF;
  IF v_frag_regen_construction != 0 THEN
    v_construction_cycle := GREATEST(300, (v_construction_cycle * (100 - v_frag_regen_construction) / 100)::INT);
  END IF;

  -- ====== 3. Bonus underdog (applique en dernier) ======
  IF v_user_faction IS NOT NULL THEN
    v_underdog_id := get_underdog_faction_id();
    IF v_underdog_id IS NOT NULL AND v_underdog_id = v_user_faction THEN
      v_is_underdog := true;
      SELECT COALESCE(value::NUMERIC, 2) INTO v_underdog_mult
      FROM app_settings WHERE key = 'underdog_multiplier';
      v_energy_cycle := GREATEST(300, (v_energy_cycle / v_underdog_mult)::INT);
      v_conquest_cycle := GREATEST(300, (v_conquest_cycle / v_underdog_mult)::INT);
      v_construction_cycle := GREATEST(300, (v_construction_cycle / v_underdog_mult)::INT);
    END IF;
  END IF;

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
    'bonusEnergy', v_bonus_energy + v_frag_max_energy,
    'bonusConquest', v_bonus_conquest + v_frag_max_conquest,
    'bonusConstruction', v_bonus_construction + v_frag_max_construction,
    'isUnderdog', v_is_underdog,
    'underdogMultiplier', v_underdog_mult
  );
END;
$$;
