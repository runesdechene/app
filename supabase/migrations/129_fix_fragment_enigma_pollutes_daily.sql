-- 129_fix_fragment_enigma_pollutes_daily.sql
-- WHY : bug remonté par Uriel le 8/05 — résoudre les énigmes de fragments
-- marque les énigmes du jour comme déjà faites alors qu'elles ne l'étaient pas.
--
-- Cause racine : get_fragment_enigma() tire ses énigmes du pool type='daily'
-- (collection lié au heritage), et _answer_fragment_enigma_internal insère la
-- réponse dans enigma_responses sans marqueur. Puis get_daily_enigma filtre
-- enigma_responses ⨯ enigmas WHERE type='daily' → compte ces réponses comme
-- réponses daily du jour, et au bout de 3 considère le quota daily atteint.
--
-- Fix structurel :
--   1) ALTER enigma_responses ADD fragment_id INT (NULL = vraie daily).
--   2) Backfill historique : pour les enigma_responses qui ont une trace
--      activity_log type='fragment_enigma' correspondante (même user, même
--      enigma_id, même jour), on remplit fragment_id depuis al.data.fragmentId.
--   3) _answer_fragment_enigma_internal : INSERT avec fragment_id = p_fragment_id.
--   4) get_daily_enigma : filtre er.fragment_id IS NULL (= vraies daily seulement).
--   5) get_fragment_enigma : check already_today via fragment_id (déjà via
--      activity_log mais on aligne aussi sur enigma_responses pour cohérence).
--
-- Pas de breaking change côté front (signatures inchangées). Compatible avec
-- les anciens clients en cache.

BEGIN;

-- ============================================================
-- 1) Schéma : nouvelle colonne fragment_id
-- ============================================================
ALTER TABLE public.enigma_responses
  ADD COLUMN IF NOT EXISTS fragment_id integer;

CREATE INDEX IF NOT EXISTS idx_enigma_responses_user_fragment
  ON public.enigma_responses (user_id, fragment_id)
  WHERE fragment_id IS NOT NULL;

-- ============================================================
-- 2) Backfill historique depuis activity_log
-- ============================================================
-- Pour chaque enigma_response sans fragment_id, si une entrée activity_log
-- type='fragment_enigma' existe pour le même (user, enigma, jour), on
-- remonte le fragmentId. Match sur date pour gérer les retries / replays.
UPDATE public.enigma_responses er
SET fragment_id = (al.data->>'fragmentId')::integer
FROM public.activity_log al
WHERE al.type = 'fragment_enigma'
  AND (al.data->>'enigmaId')::integer = er.enigma_id
  AND al.actor_id = er.user_id
  AND (al.created_at AT TIME ZONE 'Europe/Paris')::date
      = (er.responded_at AT TIME ZONE 'Europe/Paris')::date
  AND er.fragment_id IS NULL;

-- ============================================================
-- 3) _answer_fragment_enigma_internal : reprend mig 080 verbatim, seul
--    change : INSERT enigma_responses inclut fragment_id.
-- ============================================================
CREATE OR REPLACE FUNCTION public._answer_fragment_enigma_internal(
  p_user_id     text,
  p_enigma_id   integer,
  p_answer      text,
  p_fragment_id integer
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_enigma RECORD;
  v_correct BOOLEAN;
  v_influence_gain INT := 0;
  v_erudition_gain INT := 0;
  v_diff_key TEXT;
  v_actor_name TEXT;
  v_fragment_name TEXT;
  v_fragment_icon TEXT;
  v_fragment_icon_url TEXT;
  v_crowns_gain INT := 0;
  v_new_crowns_balance INT;
BEGIN
  SELECT * INTO v_enigma FROM enigmas WHERE id = p_enigma_id;
  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'enigma_not_found');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM user_fragments WHERE user_id = p_user_id AND fragment_id = p_fragment_id) THEN
    RETURN json_build_object('error', 'fragment_not_owned');
  END IF;

  v_correct := public._enigma_answer_matches(p_answer, v_enigma.answer);
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

  -- Couronnes : 1/1/2/3 si correct, 0 sinon. Cap silencieux 500.
  IF v_correct THEN
    v_crowns_gain := CASE v_diff_key
      WHEN 'very_easy' THEN 1
      WHEN 'easy'      THEN 1
      WHEN 'medium'    THEN 2
      WHEN 'hard'      THEN 3
      ELSE 1
    END;
  END IF;

  -- V129 : marque la réponse comme "via fragment" pour ne plus polluer le
  -- compteur daily. fragment_id IS NOT NULL = réponse fragment.
  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained, fragment_id)
  VALUES (p_enigma_id, p_user_id, p_answer, v_correct, v_influence_gain, v_erudition_gain, p_fragment_id);

  -- V080 : retiré `influence_stock = ...` (colonne droppée mig 077)
  UPDATE users SET
    erudition_points = erudition_points + v_erudition_gain
  WHERE id = p_user_id;

  -- V080 : crédit Couronnes avec cap silencieux 500
  IF v_crowns_gain > 0 THEN
    INSERT INTO public.user_crowns (user_id, balance, updated_at)
    VALUES (p_user_id, LEAST(500, v_crowns_gain), now())
    ON CONFLICT (user_id) DO UPDATE SET
      balance    = LEAST(500, public.user_crowns.balance + v_crowns_gain),
      updated_at = now()
    RETURNING balance INTO v_new_crowns_balance;
  ELSE
    SELECT COALESCE(balance, 0) INTO v_new_crowns_balance
    FROM public.user_crowns WHERE user_id = p_user_id;
    v_new_crowns_balance := COALESCE(v_new_crowns_balance, 0);
  END IF;

  -- Tracking interne fragment_enigma (verbatim mig 070 + crownsGain)
  INSERT INTO activity_log (type, actor_id, data)
  VALUES ('fragment_enigma', p_user_id, jsonb_build_object(
    'fragmentId',    p_fragment_id,
    'enigmaId',      p_enigma_id,
    'correct',       v_correct,
    'influenceGain', v_influence_gain,
    'eruditionGain', v_erudition_gain,
    'crownsGain',    v_crowns_gain
  ));

  -- Toast enigma_success (verbatim mig 070 + crownsGain)
  IF v_correct THEN
    SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
    FROM users WHERE id = p_user_id;

    SELECT name, icon, icon_url
    INTO v_fragment_name, v_fragment_icon, v_fragment_icon_url
    FROM public.title_fragments
    WHERE id = p_fragment_id;

    INSERT INTO activity_log (type, actor_id, data)
    VALUES ('enigma_success', p_user_id,
      jsonb_build_object(
        'actorName',        v_actor_name,
        'enigmaType',       'fragment',
        'difficulty',       v_enigma.difficulty,
        'influenceGain',    v_influence_gain,
        'eruditionGain',    v_erudition_gain,
        'crownsGain',       v_crowns_gain,
        'fragmentId',       p_fragment_id,
        'fragmentName',     v_fragment_name,
        'fragmentIcon',     v_fragment_icon,
        'fragmentIconUrl',  v_fragment_icon_url
      ));
  END IF;

  RETURN json_build_object(
    'correct',           v_correct,
    'answer',            v_enigma.answer,
    'explanation',       v_enigma.explanation,
    'influenceGain',     v_influence_gain,
    'eruditionGain',     v_erudition_gain,
    'crownsGain',        v_crowns_gain,
    'newCrownsBalance',  v_new_crowns_balance,
    'newErudition',      (SELECT erudition_points FROM users WHERE id = p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._answer_fragment_enigma_internal(text, integer, text, integer)
  TO anon, authenticated, service_role;

-- ============================================================
-- 4) get_daily_enigma : reprend baseline, ajoute filtre fragment_id IS NULL
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_daily_enigma(p_user_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
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

  -- V129 : filtre er.fragment_id IS NULL pour ne compter que les vraies
  -- réponses daily (pas les réponses passées par le flow fragment).
  SELECT COALESCE(ARRAY_AGG(DISTINCT e.difficulty), '{}'), COUNT(*)
  INTO v_answered_difficulties, v_answered_count
  FROM enigma_responses er
  JOIN enigmas e ON e.id = er.enigma_id
  WHERE er.user_id = p_user_id
    AND e.type = 'daily'
    AND er.fragment_id IS NULL
    AND (er.responded_at AT TIME ZONE 'Europe/Paris')::DATE = v_today;

  IF v_answered_count >= 3 OR ARRAY['very_easy', 'easy', 'medium'] <@ v_answered_difficulties THEN
    RETURN json_build_object('all_answered', true);
  END IF;

  FOREACH v_diff IN ARRAY ARRAY['very_easy', 'easy', 'medium']
  LOOP
    IF v_diff = ANY(v_answered_difficulties) THEN
      CONTINUE;
    END IF;

    -- Pool prioritaire : énigmes jamais répondues par cet user (lifetime, peu
    -- importe le canal — fragment ou daily, on ne re-sert pas la même).
    SELECT ARRAY_AGG(id ORDER BY id) INTO v_candidates
    FROM enigmas
    WHERE type = 'daily' AND active = TRUE AND difficulty = v_diff
      AND id NOT IN (SELECT enigma_id FROM enigma_responses WHERE user_id = p_user_id);

    IF v_candidates IS NULL OR array_length(v_candidates, 1) = 0 THEN
      SELECT ARRAY_AGG(id ORDER BY id) INTO v_candidates
      FROM enigmas
      WHERE type = 'daily' AND active = TRUE AND difficulty = v_diff;
    END IF;

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

GRANT EXECUTE ON FUNCTION public.get_daily_enigma(text) TO anon, authenticated, service_role;

COMMIT;
