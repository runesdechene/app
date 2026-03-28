-- ============================================
-- MIGRATION 140 : Cycles de regen configurables
-- ============================================
-- Les cycles de base sont lus depuis app_settings au lieu d'être hardcodés

-- Insérer les valeurs par défaut
INSERT INTO app_settings (key, value) VALUES ('energy_base_cycle', '7200') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('conquest_base_cycle', '14400') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('construction_base_cycle', '14400') ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings (key, value) VALUES ('vitalite_base_cycle', '14400') ON CONFLICT (key) DO NOTHING;

-- Mettre à jour get_user_energy pour lire les cycles depuis app_settings
CREATE OR REPLACE FUNCTION public.get_user_energy(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_energy NUMERIC(6,1);
  v_max_energy NUMERIC(4,1);
  v_energy_reset TIMESTAMPTZ;
  v_conquest NUMERIC(6,1);
  v_max_conquest NUMERIC(6,1);
  v_conquest_reset TIMESTAMPTZ;
  v_construction NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_construction_reset TIMESTAMPTZ;
  v_vitalite NUMERIC(6,1);
  v_max_vitalite NUMERIC(6,1);
  v_vitalite_reset TIMESTAMPTZ;
  v_notoriety INT;
  v_faction_id TEXT;
  -- Bonus faction
  v_bonus_energy NUMERIC(4,1);
  v_bonus_conquest NUMERIC(6,1);
  v_bonus_construction NUMERIC(6,1);
  v_bonus_vitalite NUMERIC(6,1);
  v_bonus_regen_energy NUMERIC(4,1);
  v_bonus_regen_conquest NUMERIC(4,1);
  v_bonus_regen_construction NUMERIC(4,1);
  v_bonus_regen_vitalite NUMERIC(4,1);
  -- Fragment bonuses
  v_frag_max_energy NUMERIC := 0;
  v_frag_max_conquest NUMERIC := 0;
  v_frag_max_construction NUMERIC := 0;
  v_frag_max_vitalite NUMERIC := 0;
  v_frag_regen_energy NUMERIC := 0;
  v_frag_regen_conquest NUMERIC := 0;
  v_frag_regen_construction NUMERIC := 0;
  v_frag_regen_vitalite NUMERIC := 0;
  -- Base cycles (from app_settings)
  v_base_energy_cycle INT;
  v_base_conquest_cycle INT;
  v_base_construction_cycle INT;
  v_base_vitalite_cycle INT;
  -- Computed cycles
  v_energy_cycle INT;
  v_conquest_cycle INT;
  v_construction_cycle INT;
  v_vitalite_cycle INT;
  -- Regen
  v_elapsed INT;
  v_ticks INT;
  v_add NUMERIC;
  v_next_point INT;
  -- Underdog
  v_is_underdog BOOLEAN := FALSE;
  v_underdog_mult NUMERIC := 1;
BEGIN
  -- Lire les cycles de base depuis app_settings
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'energy_base_cycle'), 7200) INTO v_base_energy_cycle;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'conquest_base_cycle'), 14400) INTO v_base_conquest_cycle;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'construction_base_cycle'), 14400) INTO v_base_construction_cycle;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'vitalite_base_cycle'), 14400) INTO v_base_vitalite_cycle;

  -- Charger utilisateur
  SELECT energy_points, max_energy, energy_reset_at,
         conquest_points, max_conquest, conquest_reset_at,
         construction_points, max_construction, construction_reset_at,
         COALESCE(vitalite_points, 3), COALESCE(max_vitalite, 3), COALESCE(vitalite_reset_at, NOW()),
         COALESCE(notoriety_points, 0), faction_id
  INTO v_energy, v_max_energy, v_energy_reset,
       v_conquest, v_max_conquest, v_conquest_reset,
       v_construction, v_max_construction, v_construction_reset,
       v_vitalite, v_max_vitalite, v_vitalite_reset,
       v_notoriety, v_faction_id
  FROM users WHERE id = p_user_id;

  -- Charger bonus faction
  IF v_faction_id IS NOT NULL THEN
    SELECT COALESCE(bonus_energy, 0), COALESCE(bonus_conquest, 0),
           COALESCE(bonus_construction, 0), COALESCE(bonus_vitalite, 0),
           COALESCE(bonus_regen_energy, 0), COALESCE(bonus_regen_conquest, 0),
           COALESCE(bonus_regen_construction, 0), COALESCE(bonus_regen_vitalite, 0)
    INTO v_bonus_energy, v_bonus_conquest, v_bonus_construction, v_bonus_vitalite,
         v_bonus_regen_energy, v_bonus_regen_conquest, v_bonus_regen_construction, v_bonus_regen_vitalite
    FROM factions WHERE id = v_faction_id;
  ELSE
    v_bonus_energy := 0; v_bonus_conquest := 0; v_bonus_construction := 0; v_bonus_vitalite := 0;
    v_bonus_regen_energy := 0; v_bonus_regen_conquest := 0; v_bonus_regen_construction := 0; v_bonus_regen_vitalite := 0;
  END IF;

  -- Charger bonus fragments
  SELECT
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_energy' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_conquest' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_construction' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'max_vitalite' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_energy' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_conquest' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_construction' THEN tf.bonus_value ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN tf.bonus_type = 'regen_vitalite' THEN tf.bonus_value ELSE 0 END), 0)
  INTO v_frag_max_energy, v_frag_max_conquest, v_frag_max_construction, v_frag_max_vitalite,
       v_frag_regen_energy, v_frag_regen_conquest, v_frag_regen_construction, v_frag_regen_vitalite
  FROM user_fragments uf
  JOIN title_fragments tf ON tf.id = uf.fragment_id
  WHERE uf.user_id = p_user_id AND tf.bonus_type IS NOT NULL;

  -- Appliquer les bonus au max
  v_max_energy := GREATEST(1, v_max_energy + v_bonus_energy + v_frag_max_energy);
  v_max_conquest := GREATEST(1, v_max_conquest + v_bonus_conquest + v_frag_max_conquest);
  v_max_construction := GREATEST(1, v_max_construction + v_bonus_construction + v_frag_max_construction);
  v_max_vitalite := GREATEST(1, v_max_vitalite + v_bonus_vitalite + v_frag_max_vitalite);

  -- Calculer les cycles avec bonus (à partir des cycles de base configurables)
  v_energy_cycle := GREATEST(600, (v_base_energy_cycle * (100 - v_bonus_regen_energy - v_frag_regen_energy) / 100)::INT);
  v_conquest_cycle := GREATEST(600, (v_base_conquest_cycle * (100 - v_bonus_regen_conquest - v_frag_regen_conquest) / 100)::INT);
  v_construction_cycle := GREATEST(600, (v_base_construction_cycle * (100 - v_bonus_regen_construction - v_frag_regen_construction) / 100)::INT);
  v_vitalite_cycle := GREATEST(600, (v_base_vitalite_cycle * (100 - v_bonus_regen_vitalite - v_frag_regen_vitalite) / 100)::INT);

  -- Underdog
  SELECT id = v_faction_id INTO v_is_underdog FROM (SELECT get_underdog_faction_id() AS id) sub;
  IF v_is_underdog THEN
    SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'underdog_multiplier'), 2)
    INTO v_underdog_mult;
    v_energy_cycle := GREATEST(300, (v_energy_cycle / v_underdog_mult)::INT);
    v_conquest_cycle := GREATEST(300, (v_conquest_cycle / v_underdog_mult)::INT);
    v_construction_cycle := GREATEST(300, (v_construction_cycle / v_underdog_mult)::INT);
    v_vitalite_cycle := GREATEST(300, (v_vitalite_cycle / v_underdog_mult)::INT);
  END IF;

  -- Regen Energy
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_energy_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_energy_cycle);
  v_add := LEAST(v_ticks, v_max_energy - v_energy);
  IF v_add > 0 THEN
    v_energy := LEAST(v_energy + v_add, v_max_energy);
    v_energy_reset := v_energy_reset + (v_ticks * v_energy_cycle * INTERVAL '1 second');
    UPDATE users SET energy_points = v_energy, energy_reset_at = v_energy_reset WHERE id = p_user_id;
  END IF;
  v_next_point := v_energy_cycle - (EXTRACT(EPOCH FROM (NOW() - v_energy_reset))::INT % v_energy_cycle);

  -- Regen Conquest
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_conquest_cycle);
  v_add := LEAST(v_ticks, v_max_conquest - v_conquest);
  IF v_add > 0 THEN
    v_conquest := LEAST(v_conquest + v_add, v_max_conquest);
    v_conquest_reset := v_conquest_reset + (v_ticks * v_conquest_cycle * INTERVAL '1 second');
    UPDATE users SET conquest_points = v_conquest, conquest_reset_at = v_conquest_reset WHERE id = p_user_id;
  END IF;

  -- Regen Construction
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_construction_cycle);
  v_add := LEAST(v_ticks, v_max_construction - v_construction);
  IF v_add > 0 THEN
    v_construction := LEAST(v_construction + v_add, v_max_construction);
    v_construction_reset := v_construction_reset + (v_ticks * v_construction_cycle * INTERVAL '1 second');
    UPDATE users SET construction_points = v_construction, construction_reset_at = v_construction_reset WHERE id = p_user_id;
  END IF;

  -- Regen Vitalite
  v_elapsed := EXTRACT(EPOCH FROM (NOW() - v_vitalite_reset))::INT;
  v_ticks := FLOOR(v_elapsed::NUMERIC / v_vitalite_cycle);
  v_add := LEAST(v_ticks, v_max_vitalite - v_vitalite);
  IF v_add > 0 THEN
    v_vitalite := LEAST(v_vitalite + v_add, v_max_vitalite);
    v_vitalite_reset := v_vitalite_reset + (v_ticks * v_vitalite_cycle * INTERVAL '1 second');
    UPDATE users SET vitalite_points = v_vitalite, vitalite_reset_at = v_vitalite_reset WHERE id = p_user_id;
  END IF;

  RETURN json_build_object(
    'energy', v_energy,
    'maxEnergy', v_max_energy,
    'nextPointIn', v_next_point,
    'energyCycle', v_energy_cycle,
    'conquestPoints', v_conquest,
    'maxConquest', v_max_conquest,
    'conquestNextPointIn', v_conquest_cycle - (EXTRACT(EPOCH FROM (NOW() - v_conquest_reset))::INT % v_conquest_cycle),
    'conquestCycle', v_conquest_cycle,
    'constructionPoints', v_construction,
    'maxConstruction', v_max_construction,
    'constructionNextPointIn', v_construction_cycle - (EXTRACT(EPOCH FROM (NOW() - v_construction_reset))::INT % v_construction_cycle),
    'constructionCycle', v_construction_cycle,
    'vitalitePoints', v_vitalite,
    'maxVitalite', v_max_vitalite,
    'vitaliteNextPointIn', v_vitalite_cycle - (EXTRACT(EPOCH FROM (NOW() - v_vitalite_reset))::INT % v_vitalite_cycle),
    'vitaliteCycle', v_vitalite_cycle,
    'notorietyPoints', v_notoriety,
    'bonusEnergy', v_bonus_energy + v_frag_max_energy,
    'bonusConquest', v_bonus_conquest + v_frag_max_conquest,
    'bonusConstruction', v_bonus_construction + v_frag_max_construction,
    'bonusVitalite', v_bonus_vitalite + v_frag_max_vitalite,
    'isUnderdog', v_is_underdog,
    'underdogMultiplier', v_underdog_mult
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_energy(TEXT) TO authenticated;
