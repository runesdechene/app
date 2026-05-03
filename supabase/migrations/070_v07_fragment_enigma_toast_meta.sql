-- 070_v07_fragment_enigma_toast_meta.sql
-- WHY: Uriel veut que le toast d'énigme de fragment affiche le nom du
-- fragment (ex: "Énigme du fragment Avalon résolue") et soit cliquable
-- pour ouvrir la modale FragmentEnigma → effet "pub" vers le fragment.
--
-- Pour ça, on enrichit le data du log enigma_success (fragments uniquement)
-- avec fragmentId / fragmentName / fragmentIcon / fragmentIconUrl tirés
-- de title_fragments. Le frontend les utilise pour formuler le message
-- et pour rendre un highlight cliquable.

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
  v_fragment_name TEXT;
  v_fragment_icon TEXT;
  v_fragment_icon_url TEXT;
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

  -- V070 : log toast "enigma_success" avec metadata fragment (name + icon)
  -- pour pub cliquable côté frontend.
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
        'fragmentId',       p_fragment_id,
        'fragmentName',     v_fragment_name,
        'fragmentIcon',     v_fragment_icon,
        'fragmentIconUrl',  v_fragment_icon_url
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
