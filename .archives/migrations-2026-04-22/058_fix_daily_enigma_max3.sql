-- 058_fix_daily_enigma_max3.sql
-- Double verrou : max 3 réponses/jour ET par difficulté

CREATE OR REPLACE FUNCTION public.get_daily_enigma(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE;
  v_day_seed INT;
  v_answered_difficulties TEXT[];
  v_answered_count INT;
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

  -- Compter les réponses du jour + les difficultés
  SELECT COALESCE(ARRAY_AGG(DISTINCT e.difficulty), '{}'), COUNT(*)
  INTO v_answered_difficulties, v_answered_count
  FROM enigma_responses er
  JOIN enigmas e ON e.id = er.enigma_id
  WHERE er.user_id = p_user_id
    AND e.type = 'daily'
    AND (er.responded_at AT TIME ZONE 'Europe/Paris')::DATE = v_today;

  -- Double verrou : 3 réponses OU les 3 difficultés
  IF v_answered_count >= 3 OR ARRAY['very_easy', 'easy', 'medium'] <@ v_answered_difficulties THEN
    RETURN json_build_object('all_answered', true);
  END IF;

  -- Pour chaque difficulté non répondue
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
    RETURN json_build_object('all_answered', true);
  END IF;

  RETURN json_build_object(
    'enigmas', (SELECT json_agg(elem) FROM unnest(v_result) AS elem),
    'answeredToday', v_answered_difficulties
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_enigma(TEXT) TO authenticated;
