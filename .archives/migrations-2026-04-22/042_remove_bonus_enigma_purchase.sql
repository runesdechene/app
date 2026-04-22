-- 042_remove_bonus_enigma_purchase.sql
-- Retirer l'achat d'énigmes bonus à l'énergie.
-- L'énigme du jour est gratuite, les bonus viennent uniquement des fragments.

CREATE OR REPLACE FUNCTION public.get_daily_enigma(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE;
  v_already_answered BOOLEAN;
  v_enigma RECORD;
BEGIN
  v_today := (NOW() AT TIME ZONE 'Europe/Paris')::DATE;

  -- Déjà répondu aujourd'hui ?
  SELECT EXISTS(
    SELECT 1 FROM enigma_responses er
    JOIN enigmas e ON e.id = er.enigma_id
    WHERE er.user_id = p_user_id
      AND e.type = 'daily'
      AND (er.responded_at AT TIME ZONE 'Europe/Paris')::DATE = v_today
  ) INTO v_already_answered;

  IF v_already_answered THEN
    RETURN json_build_object('already_answered', true);
  END IF;

  -- Choisir une énigme non vue
  SELECT e.* INTO v_enigma
  FROM enigmas e
  WHERE e.type = 'daily'
    AND e.active = TRUE
    AND e.id NOT IN (SELECT enigma_id FROM enigma_responses WHERE user_id = p_user_id)
  ORDER BY RANDOM()
  LIMIT 1;

  -- Fallback
  IF v_enigma.id IS NULL THEN
    SELECT e.* INTO v_enigma
    FROM enigmas e
    WHERE e.type = 'daily' AND e.active = TRUE
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;

  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'no_enigma_available');
  END IF;

  RETURN json_build_object(
    'id', v_enigma.id,
    'difficulty', v_enigma.difficulty,
    'loreText', v_enigma.lore_text,
    'question', v_enigma.question,
    'format', v_enigma.format,
    'choices', v_enigma.choices,
    'heritageId', v_enigma.heritage_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_enigma(TEXT) TO authenticated;

-- Simplifier answer_enigma : plus de coût en énergie
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

  IF v_enigma.type = 'daily' THEN
    v_diff_key := v_enigma.difficulty;
    IF v_correct THEN
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_influence_' || v_diff_key), 3) INTO v_influence_gain;
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_erudition_' || v_diff_key), 1) INTO v_erudition_gain;
    END IF;
  ELSIF v_enigma.type = 'place' THEN
    IF v_correct THEN
      v_influence_gain := COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_influence_base'), 2)
        + COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_influence_per_diff'), 1)
          * (CASE v_enigma.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 END);
      v_erudition_gain := COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_erudition_base'), 2)
        + COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_erudition_per_diff'), 1)
          * (CASE v_enigma.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 END);
    END IF;
  END IF;

  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained)
  VALUES (p_enigma_id, p_user_id, p_answer, v_correct, v_influence_gain, v_erudition_gain);

  IF v_correct THEN
    UPDATE users SET
      influence_stock = influence_stock + v_influence_gain,
      erudition_points = erudition_points + v_erudition_gain
    WHERE id = p_user_id;
  END IF;

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

-- Setting pour le cooldown des énigmes de fragment (48h)
INSERT INTO app_settings (key, value) VALUES ('fragment_enigma_cooldown_hours', '48')
ON CONFLICT (key) DO NOTHING;
