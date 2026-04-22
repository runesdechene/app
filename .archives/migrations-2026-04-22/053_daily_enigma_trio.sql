-- 053_daily_enigma_trio.sql
-- Trio d'énigmes quotidiennes : une facile, une moyenne, une difficile
-- get_daily_enigma retourne les 3 (ou celles pas encore répondues)

CREATE OR REPLACE FUNCTION public.get_daily_enigma(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE;
  v_answered_difficulties TEXT[];
  v_enigmas JSON;
  v_diff TEXT;
  v_enigma RECORD;
  v_result JSON[] := '{}';
BEGIN
  v_today := (NOW() AT TIME ZONE 'Europe/Paris')::DATE;

  -- Quelles difficultés ont déjà été répondues aujourd'hui ?
  SELECT ARRAY_AGG(DISTINCT e.difficulty) INTO v_answered_difficulties
  FROM enigma_responses er
  JOIN enigmas e ON e.id = er.enigma_id
  WHERE er.user_id = p_user_id
    AND e.type = 'daily'
    AND (er.responded_at AT TIME ZONE 'Europe/Paris')::DATE = v_today;

  v_answered_difficulties := COALESCE(v_answered_difficulties, '{}');

  -- Si les 3 sont répondues
  IF ARRAY['easy', 'medium', 'hard'] <@ v_answered_difficulties THEN
    RETURN json_build_object('all_answered', true);
  END IF;

  -- Pour chaque difficulté non répondue, choisir une énigme
  FOREACH v_diff IN ARRAY ARRAY['easy', 'medium', 'hard']
  LOOP
    IF v_diff = ANY(v_answered_difficulties) THEN
      CONTINUE;
    END IF;

    -- Choisir une énigme non vue de cette difficulté
    SELECT e.* INTO v_enigma
    FROM enigmas e
    WHERE e.type = 'daily'
      AND e.active = TRUE
      AND e.difficulty = v_diff
      AND e.id NOT IN (SELECT enigma_id FROM enigma_responses WHERE user_id = p_user_id)
    ORDER BY RANDOM()
    LIMIT 1;

    -- Fallback : n'importe quelle énigme de cette difficulté
    IF v_enigma.id IS NULL THEN
      SELECT e.* INTO v_enigma
      FROM enigmas e
      WHERE e.type = 'daily' AND e.active = TRUE AND e.difficulty = v_diff
      ORDER BY RANDOM()
      LIMIT 1;
    END IF;

    IF v_enigma.id IS NOT NULL THEN
      v_result := array_append(v_result, json_build_object(
        'id', v_enigma.id,
        'difficulty', v_enigma.difficulty,
        'loreText', v_enigma.lore_text,
        'question', v_enigma.question,
        'format', v_enigma.format,
        'choices', v_enigma.choices,
        'heritageId', v_enigma.heritage_id
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
