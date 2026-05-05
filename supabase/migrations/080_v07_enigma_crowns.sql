-- 080_v07_enigma_crowns.sql
-- WHY : Phase 5 — les énigmes rapportent des Couronnes (1/1/2/3 selon difficulté
-- very_easy/easy/medium/hard, miroir Gloire/Coupe). Cap silencieux : si stock plein
-- (500), gain=0 sans erreur, ligne "(stock plein)" côté frontend.
--
-- Aussi obligatoire car la mig 077 a droppé la colonne users.influence_stock
-- que ces deux RPCs mettaient à jour. Sans cette mig, les RPCs énigmes plantent.
--
-- Reécriture verbatim mig 069 (_answer_enigma_internal) et mig 070
-- (_answer_fragment_enigma_internal), avec :
--   - DROP des lignes influence_stock (UPDATE + RETURN)
--   - ADD du crédit Couronnes (CASE difficulty + UPSERT user_crowns avec cap 500)
--   - JSON return : remplace newInfluenceStock par crownsGain/newCrownsBalance
--   - Toast enigma_success enrichi avec crownsGain (si pertinent)

BEGIN;

-- ============================================================
-- _answer_enigma_internal — verbatim mig 069 + Couronnes
-- ============================================================

CREATE OR REPLACE FUNCTION public._answer_enigma_internal(
  p_user_id text, p_enigma_id integer, p_answer text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_enigma RECORD;
  v_correct BOOLEAN;
  v_influence_gain INT := 0;  -- conservé pour compat enigma_responses, plus appliqué à users
  v_erudition_gain INT := 0;
  v_diff_key TEXT;
  v_actor_name TEXT;
  v_crowns_gain INT := 0;
  v_new_crowns_balance INT;
BEGIN
  SELECT * INTO v_enigma FROM enigmas WHERE id = p_enigma_id;
  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'enigma_not_found');
  END IF;

  v_correct := public._enigma_answer_matches(p_answer, v_enigma.answer);
  v_diff_key := v_enigma.difficulty;

  -- Calcul gains influence/erudition (logique mig 069 conservée pour enigma_responses)
  IF v_enigma.type = 'daily' THEN
    IF v_correct THEN
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_influence_' || v_diff_key), 3) INTO v_influence_gain;
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_erudition_' || v_diff_key), 1) INTO v_erudition_gain;
    ELSE
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

  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained)
  VALUES (p_enigma_id, p_user_id, p_answer, v_correct, v_influence_gain, v_erudition_gain);

  -- V080 : retiré `influence_stock = influence_stock + v_influence_gain,` (colonne droppée mig 077)
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

  -- Toast enigma_success (verbatim mig 069 + crownsGain)
  IF v_correct THEN
    SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
    FROM users WHERE id = p_user_id;

    INSERT INTO activity_log (type, actor_id, data)
    VALUES ('enigma_success', p_user_id,
      jsonb_build_object(
        'actorName',     v_actor_name,
        'enigmaType',    v_enigma.type,
        'difficulty',    v_enigma.difficulty,
        'influenceGain', v_influence_gain,
        'eruditionGain', v_erudition_gain,
        'crownsGain',    v_crowns_gain
      ));
  END IF;

  -- V080 : retiré `'newInfluenceStock', ...` du retour (colonne droppée).
  RETURN json_build_object(
    'correct',           v_correct,
    'answer',            v_enigma.answer,
    'explanation',       v_enigma.explanation,
    'influenceGain',     v_influence_gain,
    'eruditionGain',     v_erudition_gain,
    'crownsGain',        v_crowns_gain,
    'newCrownsBalance',  v_new_crowns_balance,
    'newErudition',      (SELECT erudition_points FROM users WHERE id = p_user_id),
    'newGlory',          (SELECT exploration_points + erudition_points FROM users WHERE id = p_user_id)
  );
END;
$$;

ALTER FUNCTION public._answer_enigma_internal(text, integer, text) OWNER TO postgres;

-- ============================================================
-- _answer_fragment_enigma_internal — verbatim mig 070 + Couronnes
-- ============================================================

CREATE OR REPLACE FUNCTION public._answer_fragment_enigma_internal(
  p_user_id text, p_enigma_id integer, p_answer text, p_fragment_id integer
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

  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained)
  VALUES (p_enigma_id, p_user_id, p_answer, v_correct, v_influence_gain, v_erudition_gain);

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

  -- V080 : retiré `'newInfluenceStock', ...` du retour
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

ALTER FUNCTION public._answer_fragment_enigma_internal(text, integer, text, integer) OWNER TO postgres;

COMMIT;
