-- 057_enigma_erudition_wrong_and_rewards.sql
-- 1. answer_enigma : 1 pt érudition sur mauvaise réponse + retourne les gains potentiels
-- 2. answer_fragment_enigma : idem + érudition par difficulté
-- 3. get_daily_enigma : retourne les récompenses par difficulté

-- ============================================================
-- 1. answer_enigma — érudition sur mauvaise réponse
-- ============================================================
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
BEGIN
  SELECT * INTO v_enigma FROM enigmas WHERE id = p_enigma_id;
  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'enigma_not_found');
  END IF;

  v_correct := LOWER(TRIM(p_answer)) = LOWER(TRIM(v_enigma.answer));
  v_diff_key := v_enigma.difficulty;

  IF v_enigma.type = 'daily' THEN
    IF v_correct THEN
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_influence_' || v_diff_key), 3) INTO v_influence_gain;
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_erudition_' || v_diff_key), 1) INTO v_erudition_gain;
    ELSE
      -- Mauvaise réponse : 1 pt érudition (on apprend en se trompant)
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_erudition_wrong'), 1) INTO v_erudition_gain;
    END IF;
  ELSIF v_enigma.type = 'place' THEN
    IF v_correct THEN
      v_influence_gain := COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_influence_base'), 2)
        + COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_influence_per_diff'), 1)
          * (CASE v_enigma.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 END);
      v_erudition_gain := COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_erudition_base'), 2)
        + COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_erudition_per_diff'), 1)
          * (CASE v_enigma.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 END);
    ELSE
      v_erudition_gain := 1;
    END IF;
  END IF;

  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained)
  VALUES (p_enigma_id, p_user_id, p_answer, v_correct, v_influence_gain, v_erudition_gain);

  -- Toujours donner l'érudition (même sur mauvaise réponse)
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
    'newInfluenceStock', (SELECT influence_stock FROM users WHERE id = p_user_id),
    'newErudition', (SELECT erudition_points FROM users WHERE id = p_user_id),
    'newGlory', (SELECT exploration_points + erudition_points FROM users WHERE id = p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.answer_enigma(TEXT, INT, TEXT) TO authenticated;

-- ============================================================
-- 2. answer_fragment_enigma — érudition par difficulté + mauvaise réponse
-- ============================================================
CREATE OR REPLACE FUNCTION public.answer_fragment_enigma(
  p_user_id TEXT,
  p_enigma_id INT,
  p_answer TEXT,
  p_fragment_id INT
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
BEGIN
  SELECT * INTO v_enigma FROM enigmas WHERE id = p_enigma_id;
  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'enigma_not_found');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM user_fragments WHERE user_id = p_user_id AND fragment_id = p_fragment_id) THEN
    RETURN json_build_object('error', 'fragment_not_owned');
  END IF;

  v_correct := LOWER(TRIM(p_answer)) = LOWER(TRIM(v_enigma.answer));
  v_diff_key := v_enigma.difficulty;

  IF v_correct THEN
    SELECT COALESCE(
      (SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_influence_' || v_diff_key),
      COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_influence'), 5)
    ) INTO v_influence_gain;
    SELECT COALESCE(
      (SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_erudition_' || v_diff_key),
      COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_erudition'), 2)
    ) INTO v_erudition_gain;
  ELSE
    v_erudition_gain := 1;
  END IF;

  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained)
  VALUES (p_enigma_id, p_user_id, p_answer, v_correct, v_influence_gain, v_erudition_gain);

  UPDATE users SET
    influence_stock = influence_stock + v_influence_gain,
    erudition_points = erudition_points + v_erudition_gain
  WHERE id = p_user_id;

  INSERT INTO activity_log (type, actor_id, data)
  VALUES ('fragment_enigma', p_user_id, jsonb_build_object(
    'fragmentId', p_fragment_id,
    'enigmaId', p_enigma_id,
    'correct', v_correct,
    'influenceGain', v_influence_gain,
    'eruditionGain', v_erudition_gain
  ));

  RETURN json_build_object(
    'correct', v_correct,
    'answer', v_enigma.answer,
    'explanation', v_enigma.explanation,
    'influenceGain', v_influence_gain,
    'eruditionGain', v_erudition_gain,
    'newInfluenceStock', (SELECT influence_stock FROM users WHERE id = p_user_id),
    'newErudition', (SELECT erudition_points FROM users WHERE id = p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.answer_fragment_enigma(TEXT, INT, TEXT, INT) TO authenticated;

-- ============================================================
-- 3. get_daily_enigma — retourner les récompenses potentielles
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_daily_enigma(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE;
  v_day_seed INT;
  v_answered_difficulties TEXT[];
  v_diff TEXT;
  v_enigma RECORD;
  v_result JSON[] := '{}';
  v_candidates INT[];
  v_pick_idx INT;
  v_reward_influence INT;
  v_reward_erudition INT;
BEGIN
  v_today := (NOW() AT TIME ZONE 'Europe/Paris')::DATE;
  v_day_seed := (EXTRACT(EPOCH FROM v_today)::INT / 86400);

  SELECT ARRAY_AGG(DISTINCT e.difficulty) INTO v_answered_difficulties
  FROM enigma_responses er
  JOIN enigmas e ON e.id = er.enigma_id
  WHERE er.user_id = p_user_id
    AND e.type = 'daily'
    AND (er.responded_at AT TIME ZONE 'Europe/Paris')::DATE = v_today;

  v_answered_difficulties := COALESCE(v_answered_difficulties, '{}');

  IF ARRAY['very_easy', 'easy', 'medium'] <@ v_answered_difficulties THEN
    RETURN json_build_object('all_answered', true);
  END IF;

  FOREACH v_diff IN ARRAY ARRAY['very_easy', 'easy', 'medium']
  LOOP
    IF v_diff = ANY(v_answered_difficulties) THEN
      CONTINUE;
    END IF;

    SELECT ARRAY_AGG(id ORDER BY id) INTO v_candidates
    FROM enigmas
    WHERE type = 'daily' AND active = TRUE AND difficulty = v_diff;

    IF v_candidates IS NULL OR array_length(v_candidates, 1) = 0 THEN
      CONTINUE;
    END IF;

    v_pick_idx := (v_day_seed % array_length(v_candidates, 1)) + 1;
    SELECT * INTO v_enigma FROM enigmas WHERE id = v_candidates[v_pick_idx];

    -- Récompenses potentielles
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_influence_' || v_diff), 3) INTO v_reward_influence;
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_erudition_' || v_diff), 1) INTO v_reward_erudition;

    IF v_enigma.id IS NOT NULL THEN
      v_result := array_append(v_result, json_build_object(
        'id', v_enigma.id,
        'difficulty', v_enigma.difficulty,
        'loreText', v_enigma.lore_text,
        'question', v_enigma.question,
        'format', v_enigma.format,
        'choices', v_enigma.choices,
        'heritageId', v_enigma.heritage_id,
        'rewardInfluence', v_reward_influence,
        'rewardErudition', v_reward_erudition
      ));
    END IF;
  END LOOP;

  IF array_length(v_result, 1) IS NULL OR array_length(v_result, 1) = 0 THEN
    RETURN json_build_object('error', 'no_enigma_available');
  END IF;

  RETURN json_build_object(
    'enigmas', (SELECT json_agg(elem) FROM unnest(v_result) AS elem),
    'answeredToday', v_answered_difficulties
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_enigma(TEXT) TO authenticated;
