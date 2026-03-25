-- ============================================
-- MIGRATION 104 : Bonus Underdog (Baroud d'Honneur)
-- ============================================
-- La faction avec le score de notoriete le plus bas recoit un
-- multiplicateur sur la vitesse de regen de toutes ses ressources.
-- Configurable via app_settings (Hub > Factions).
-- ============================================

-- 1. Settings par defaut
INSERT INTO app_settings (key, value)
VALUES ('underdog_enabled', 'true')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings (key, value)
VALUES ('underdog_multiplier', '2')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 2. get_underdog_faction_id()
-- Retourne l'ID de la faction avec le score de notoriete le plus bas
-- parmi celles qui ont au moins 1 lieu revendique.
-- Retourne NULL si underdog desactive ou < 2 factions actives.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_underdog_faction_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_faction_id TEXT;
  v_active_count INT;
BEGIN
  -- Verifier si le systeme est active
  SELECT (value = 'true') INTO v_enabled
  FROM app_settings WHERE key = 'underdog_enabled';

  IF NOT COALESCE(v_enabled, false) THEN
    RETURN NULL;
  END IF;

  -- Compter les factions actives (au moins 1 lieu)
  SELECT COUNT(DISTINCT faction_id) INTO v_active_count
  FROM places
  WHERE faction_id IS NOT NULL AND claimed_at IS NOT NULL;

  IF v_active_count < 2 THEN
    RETURN NULL;
  END IF;

  -- Faction avec le score le plus bas
  SELECT f.id INTO v_faction_id
  FROM factions f
  INNER JOIN places p ON p.faction_id = f.id AND p.claimed_at IS NOT NULL
  GROUP BY f.id
  ORDER BY COALESCE(SUM(
    FLOOR(EXTRACT(EPOCH FROM (NOW() - p.claimed_at)) / 3600)
    * (1 + p.fortification_level * 0.5)
  ), 0) ASC
  LIMIT 1;

  RETURN v_faction_id;
END;
$$;

-- ============================================
-- 3. get_user_energy — appliquer le bonus underdog
-- Divise les cycles de regen par le multiplicateur si le joueur
-- est dans la faction underdog.
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

  -- Verifier le bonus underdog
  IF v_user_faction IS NOT NULL THEN
    v_underdog_id := get_underdog_faction_id();
    IF v_underdog_id IS NOT NULL AND v_underdog_id = v_user_faction THEN
      v_is_underdog := true;
      SELECT COALESCE(value::NUMERIC, 2) INTO v_underdog_mult
      FROM app_settings WHERE key = 'underdog_multiplier';
      -- Diviser les cycles par le multiplicateur (regen plus rapide)
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
    'bonusEnergy', v_bonus_energy,
    'bonusConquest', v_bonus_conquest,
    'bonusConstruction', v_bonus_construction,
    'isUnderdog', v_is_underdog,
    'underdogMultiplier', v_underdog_mult
  );
END;
$$;

-- ============================================
-- 4. get_faction_notoriety — retourner underdogFactionId
-- ============================================

CREATE OR REPLACE FUNCTION public.get_faction_notoriety()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_underdog_id TEXT;
BEGIN
  v_underdog_id := get_underdog_faction_id();

  SELECT json_agg(row_data) INTO v_result
  FROM (
    SELECT
      f.id AS "factionId",
      f.title,
      f.color,
      f.pattern,
      COUNT(p.id)::INT AS "placesCount",
      COALESCE(SUM(
        FLOOR(EXTRACT(EPOCH FROM (NOW() - p.claimed_at)) / 3600)
        * (1 + p.fortification_level * 0.5)
      ), 0)::INT AS notoriety,
      COALESCE(SUM(1 + p.fortification_level * 0.5), 0)::NUMERIC(10,1) AS "hourlyRate",
      (f.id = v_underdog_id) AS "isUnderdog"
    FROM factions f
    LEFT JOIN places p ON p.faction_id = f.id AND p.claimed_at IS NOT NULL
    GROUP BY f.id, f.title, f.color, f.pattern, f."order"
    ORDER BY notoriety DESC
  ) row_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
