-- 027_fix_leaderboard_glory_and_enigma_erudition.sql
-- 1. Leaderboard "Gloire" utilise exploration_points + erudition_points (pas notoriety_points)
-- 2. Ajoute les onglets exploration et erudition au leaderboard
-- 3. get_faction_members trie par gloire (exploration + érudition) au lieu de notoriety_points
-- 4. Mauvaise réponse énigme = 0 érudition (pas de points de consolation)

-- ============================================================
-- 1. Fix get_leaderboard — gloire = exploration + érudition
-- ============================================================
DROP FUNCTION IF EXISTS get_leaderboard(TEXT, INT);
CREATE OR REPLACE FUNCTION get_leaderboard(p_type TEXT, p_limit INT DEFAULT 50)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'notoriety' THEN
    -- Gloire = exploration_points + erudition_points
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY (COALESCE(u.exploration_points, 0) + COALESCE(u.erudition_points, 0)) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value', COALESCE(u.exploration_points, 0) + COALESCE(u.erudition_points, 0)
      ) AS row_data
      FROM users u
      LEFT JOIN factions f ON f.id = u.faction_id
      WHERE (COALESCE(u.exploration_points, 0) + COALESCE(u.erudition_points, 0)) > 0
      ORDER BY (COALESCE(u.exploration_points, 0) + COALESCE(u.erudition_points, 0)) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'exploration' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COALESCE(u.exploration_points, 0) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value', COALESCE(u.exploration_points, 0)
      ) AS row_data
      FROM users u
      LEFT JOIN factions f ON f.id = u.faction_id
      WHERE COALESCE(u.exploration_points, 0) > 0
      ORDER BY COALESCE(u.exploration_points, 0) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'erudition' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COALESCE(u.erudition_points, 0) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value', COALESCE(u.erudition_points, 0)
      ) AS row_data
      FROM users u
      LEFT JOIN factions f ON f.id = u.faction_id
      WHERE COALESCE(u.erudition_points, 0) > 0
      ORDER BY COALESCE(u.erudition_points, 0) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'authored' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value', COUNT(*)::INT
      ) AS row_data
      FROM users u
      JOIN places p ON p.author_id = u.id
      LEFT JOIN factions f ON f.id = u.faction_id
      GROUP BY u.id, u.first_name, u.email_address, u.avatar_url, f.color
      ORDER BY COUNT(*) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'explored' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value', COUNT(*)::INT
      ) AS row_data
      FROM users u
      JOIN places_explored pe ON pe.user_id = u.id
      LEFT JOIN factions f ON f.id = u.faction_id
      GROUP BY u.id, u.first_name, u.email_address, u.avatar_url, f.color
      ORDER BY COUNT(*) DESC
      LIMIT p_limit
    ) sub;

  ELSE
    v_result := '[]'::json;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard TO anon;

-- ============================================================
-- 2. Fix get_faction_members — gloire = exploration + érudition
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_faction_members(p_faction_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT COALESCE(json_agg(member), '[]'::json) INTO v_result
  FROM (
    SELECT json_build_object(
      'userId', u.id,
      'name', COALESCE(u.first_name, u.email_address),
      'profileImage', u.avatar_url,
      'glory', COALESCE(u.exploration_points, 0) + COALESCE(u.erudition_points, 0),
      'displayedGeneralTitles', (
        SELECT COALESCE(json_agg(
          json_build_object('id', t.id, 'name', t.name, 'icon', t.icon)
        ), '[]'::json)
        FROM titles t
        WHERE t.id = ANY(COALESCE(u.displayed_general_title_ids, '{}'))
          AND t.type = 'general'
      ),
      'factionTitle2', (SELECT get_user_titles(u.id)->'factionTitle')
    ) AS member
    FROM users u
    WHERE u.faction_id = p_faction_id
    ORDER BY (COALESCE(u.exploration_points, 0) + COALESCE(u.erudition_points, 0)) DESC NULLS LAST
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_faction_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_faction_members TO anon;

-- ============================================================
-- 3. Mauvaise réponse énigme = 0 érudition
-- ============================================================
-- Mettre à jour le setting (pour référence)
UPDATE app_settings SET value = '0' WHERE key = 'erudition_enigma_wrong';

-- Recréer answer_enigma avec 0 érudition sur mauvaise réponse
CREATE OR REPLACE FUNCTION public.answer_enigma(
  p_user_id TEXT,
  p_enigma_id INT,
  p_answer TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enigma RECORD;
  v_correct BOOLEAN;
  v_influence_gain INT := 0;
  v_erudition_gain INT := 0;
  v_diff_key TEXT;
  v_energy_cost INT := 0;
  v_user_energy INT;
  v_answered_today INT;
  v_today DATE;
BEGIN
  SELECT * INTO v_enigma FROM enigmas WHERE id = p_enigma_id;
  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'enigma_not_found');
  END IF;

  -- Check if this is a bonus enigma (not the first today)
  IF v_enigma.type = 'daily' THEN
    v_today := (NOW() AT TIME ZONE 'Europe/Paris')::DATE;
    SELECT COUNT(*) INTO v_answered_today
    FROM enigma_responses er
    JOIN enigmas e ON e.id = er.enigma_id
    WHERE er.user_id = p_user_id
      AND e.type = 'daily'
      AND (er.responded_at AT TIME ZONE 'Europe/Paris')::DATE = v_today;

    IF v_answered_today > 0 THEN
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_bonus_energy_cost'), 5)
      INTO v_energy_cost;

      SELECT energy_points INTO v_user_energy FROM users WHERE id = p_user_id;
      IF v_user_energy < v_energy_cost THEN
        RETURN json_build_object('error', 'not_enough_energy', 'energyCost', v_energy_cost, 'energy', v_user_energy);
      END IF;

      -- Deduct energy
      UPDATE users SET energy_points = GREATEST(0, energy_points - v_energy_cost) WHERE id = p_user_id;
    END IF;
  END IF;

  -- Check answer
  v_correct := LOWER(TRIM(p_answer)) = LOWER(TRIM(v_enigma.answer));

  -- Calculate gains
  IF v_enigma.type = 'daily' THEN
    v_diff_key := v_enigma.difficulty;
    IF v_correct THEN
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_influence_' || v_diff_key), 3) INTO v_influence_gain;
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_erudition_' || v_diff_key), 1) INTO v_erudition_gain;
    END IF;
    -- Mauvaise réponse = 0 érudition, 0 influence
  ELSIF v_enigma.type = 'place' THEN
    IF v_correct THEN
      v_influence_gain := COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_influence_base'), 2)
        + COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_influence_per_diff'), 1)
          * (CASE v_enigma.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 END);
      v_erudition_gain := COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_erudition_base'), 2)
        + COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_erudition_per_diff'), 1)
          * (CASE v_enigma.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 END);
    END IF;
    -- Mauvaise réponse = 0 érudition, 0 influence
  END IF;

  -- Record response
  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained)
  VALUES (p_enigma_id, p_user_id, p_answer, v_correct, v_influence_gain, v_erudition_gain);

  -- Give rewards
  UPDATE users SET
    influence_stock = influence_stock + v_influence_gain,
    erudition_points = erudition_points + v_erudition_gain
  WHERE id = p_user_id;

  RETURN json_build_object(
    'correct', v_correct,
    'answer', v_enigma.answer,
    'explanation', v_enigma.explanation,
    'influenceGain', v_influence_gain,
    'eruditionGain', v_erudition_gain,
    'energyCost', v_energy_cost,
    'newInfluenceStock', (SELECT influence_stock FROM users WHERE id = p_user_id),
    'newErudition', (SELECT erudition_points FROM users WHERE id = p_user_id),
    'newEnergy', (SELECT energy_points FROM users WHERE id = p_user_id),
    'newGlory', (SELECT exploration_points + erudition_points FROM users WHERE id = p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.answer_enigma(TEXT, INT, TEXT) TO authenticated;
