-- 069_v07_fix_enigma_toast_log.sql
-- WHY: depuis le baseline du 22 avril 2026, plus aucune RPC d'énigme
-- n'insère un event 'enigma_success' dans activity_log → le subscribe
-- frontend (usePlayer.ts ligne 391) ne reçoit RIEN → aucun toast n'apparaît
-- (ni pour soi, ni pour les autres). Bug signalé Uriel le 03/05/2026.
--
-- ROOT CAUSE : la mig 043 archivée ajoutait justement ces logs dans
-- answer_enigma + answer_fragment_enigma. Lors du rebuild baseline du 22/04,
-- la mig 003 a réécrit _answer_enigma_internal SANS reprendre le INSERT
-- activity_log. Régression silencieuse.
--
-- FIX : reprendre verbatim la dernière version connue de _answer_enigma_internal
-- (mig 003) et _answer_fragment_enigma_internal (mig 003), et ajouter en fin
-- un INSERT activity_log type='enigma_success' (uniquement si correct).
--
-- Shape data alignée avec usePlayer.ts (subscribe + loadRecentActivity) :
--   { actorName, difficulty, enigmaType, correct }
-- Pas de placeId/placeTitle car enigmas n'a pas de FK vers places (lien
-- via place_tag uniquement). Le toast affichera "sur un lieu" par défaut,
-- ce qui reste lisible.

-- ============================================================
-- 1. _answer_enigma_internal — verbatim mig 003 + INSERT toast en fin
-- ============================================================

CREATE OR REPLACE FUNCTION public._answer_enigma_internal(p_user_id text, p_enigma_id integer, p_answer text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_enigma RECORD;
  v_correct BOOLEAN;
  v_influence_gain INT := 0;
  v_erudition_gain INT := 0;
  v_diff_key TEXT;
  v_actor_name TEXT;
BEGIN
  SELECT * INTO v_enigma FROM enigmas WHERE id = p_enigma_id;
  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'enigma_not_found');
  END IF;

  v_correct := public._enigma_answer_matches(p_answer, v_enigma.answer);
  v_diff_key := v_enigma.difficulty;

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

  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained)
  VALUES (p_enigma_id, p_user_id, p_answer, v_correct, v_influence_gain, v_erudition_gain);

  UPDATE users SET
    influence_stock = influence_stock + v_influence_gain,
    erudition_points = erudition_points + v_erudition_gain
  WHERE id = p_user_id;

  -- V069 : log toast "enigma_success" uniquement si correct.
  -- Le frontend (usePlayer.ts) écoute ce type pour afficher un toast au
  -- joueur (et aux autres). enigmas n'a pas de FK vers places, donc on
  -- passe juste difficulty + enigmaType (le frontend formule le message).
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
        'eruditionGain', v_erudition_gain
      ));
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

ALTER FUNCTION public._answer_enigma_internal(text, integer, text) OWNER TO postgres;

-- ============================================================
-- 2. _answer_fragment_enigma_internal — verbatim mig 003 + INSERT toast
--    (le INSERT 'fragment_enigma' existant est conservé pour le tracking
--    interne — le frontend l'ignore explicitement. On AJOUTE en plus un
--    log 'enigma_success' qui déclenche le toast.)
-- ============================================================

CREATE OR REPLACE FUNCTION public._answer_fragment_enigma_internal(p_user_id text, p_enigma_id integer, p_answer text, p_fragment_id integer)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_enigma RECORD;
  v_correct BOOLEAN;
  v_influence_gain INT := 0;
  v_erudition_gain INT := 0;
  v_diff_key TEXT;
  v_actor_name TEXT;
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

  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained)
  VALUES (p_enigma_id, p_user_id, p_answer, v_correct, v_influence_gain, v_erudition_gain);

  UPDATE users SET
    influence_stock = influence_stock + v_influence_gain,
    erudition_points = erudition_points + v_erudition_gain
  WHERE id = p_user_id;

  -- Tracking interne (cooldown fragment, etc.) — conservé tel quel
  INSERT INTO activity_log (type, actor_id, data)
  VALUES ('fragment_enigma', p_user_id, jsonb_build_object(
    'fragmentId', p_fragment_id,
    'enigmaId', p_enigma_id,
    'correct', v_correct,
    'influenceGain', v_influence_gain,
    'eruditionGain', v_erudition_gain
  ));

  -- V069 : log toast "enigma_success" si correct (séparé du tracking
  -- interne 'fragment_enigma' que le frontend ignore explicitement).
  IF v_correct THEN
    SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
    FROM users WHERE id = p_user_id;

    INSERT INTO activity_log (type, actor_id, data)
    VALUES ('enigma_success', p_user_id,
      jsonb_build_object(
        'actorName',     v_actor_name,
        'enigmaType',    'fragment',
        'difficulty',    v_enigma.difficulty,
        'influenceGain', v_influence_gain,
        'eruditionGain', v_erudition_gain
      ));
  END IF;

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

ALTER FUNCTION public._answer_fragment_enigma_internal(text, integer, text, integer) OWNER TO postgres;
