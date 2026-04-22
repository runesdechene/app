-- 041_fragment_enigma_use_heritage.sql
-- Les énigmes de fragments piochent dans les énigmes daily de l'héritage du fragment.
-- Plus besoin du type 'fragment' ni de fragment_id.

-- Réécrire get_fragment_enigma : pioche dans les daily de l'héritage du fragment
CREATE OR REPLACE FUNCTION public.get_fragment_enigma(
  p_user_id TEXT,
  p_fragment_id INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_collection TEXT;
  v_enigma RECORD;
  v_already_today BOOLEAN;
  v_today DATE;
BEGIN
  -- Vérifier que le joueur possède ce fragment
  IF NOT EXISTS(SELECT 1 FROM user_fragments WHERE user_id = p_user_id AND fragment_id = p_fragment_id) THEN
    RETURN json_build_object('error', 'fragment_not_owned');
  END IF;

  -- Récupérer la collection (= faction) du fragment
  SELECT collection INTO v_collection FROM title_fragments WHERE id = p_fragment_id;
  IF v_collection IS NULL THEN
    RETURN json_build_object('error', 'no_collection');
  END IF;

  v_today := (NOW() AT TIME ZONE 'Europe/Paris')::DATE;

  -- Déjà répondu aujourd'hui pour ce fragment ?
  SELECT EXISTS(
    SELECT 1 FROM enigma_responses er
    WHERE er.user_id = p_user_id
      AND er.enigma_id IN (
        SELECT e.id FROM enigmas e
        WHERE e.type = 'daily' AND e.heritage_id = v_collection AND e.active = TRUE
      )
      AND (er.responded_at AT TIME ZONE 'Europe/Paris')::DATE = v_today
      -- On utilise un tag dans data pour identifier les réponses fragment
      AND er.erudition_gained = -1 * p_fragment_id -- hack temporaire, voir ci-dessous
  ) INTO v_already_today;

  -- Tracker via activity_log avec cooldown configurable (défaut 48h)
  SELECT EXISTS(
    SELECT 1 FROM activity_log
    WHERE actor_id = p_user_id
      AND type = 'fragment_enigma'
      AND (data->>'fragmentId')::INT = p_fragment_id
      AND created_at > NOW() - (COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_cooldown_hours'), 48) || ' hours')::INTERVAL
  ) INTO v_already_today;

  IF v_already_today THEN
    RETURN json_build_object('already_answered', true);
  END IF;

  -- Choisir une énigme de l'héritage du fragment, pas encore vue
  SELECT e.* INTO v_enigma
  FROM enigmas e
  WHERE e.type = 'daily'
    AND e.heritage_id = v_collection
    AND e.active = TRUE
    AND e.id NOT IN (SELECT enigma_id FROM enigma_responses WHERE user_id = p_user_id)
  ORDER BY RANDOM()
  LIMIT 1;

  -- Fallback : n'importe quelle énigme de cet héritage
  IF v_enigma.id IS NULL THEN
    SELECT e.* INTO v_enigma
    FROM enigmas e
    WHERE e.type = 'daily'
      AND e.heritage_id = v_collection
      AND e.active = TRUE
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;

  -- Fallback ultime : n'importe quelle énigme daily
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
    'heritageId', v_enigma.heritage_id,
    'fragmentId', p_fragment_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_fragment_enigma(TEXT, INT) TO authenticated;

-- Réécrire answer_fragment_enigma : log dans activity_log pour le tracking quotidien
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
BEGIN
  SELECT * INTO v_enigma FROM enigmas WHERE id = p_enigma_id;
  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'enigma_not_found');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM user_fragments WHERE user_id = p_user_id AND fragment_id = p_fragment_id) THEN
    RETURN json_build_object('error', 'fragment_not_owned');
  END IF;

  v_correct := LOWER(TRIM(p_answer)) = LOWER(TRIM(v_enigma.answer));

  IF v_correct THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_influence'), 5) INTO v_influence_gain;
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_erudition'), 2) INTO v_erudition_gain;
  END IF;

  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained)
  VALUES (p_enigma_id, p_user_id, p_answer, v_correct, v_influence_gain, v_erudition_gain);

  IF v_correct THEN
    UPDATE users SET
      influence_stock = influence_stock + v_influence_gain,
      erudition_points = erudition_points + v_erudition_gain
    WHERE id = p_user_id;
  END IF;

  -- Logger pour le tracking quotidien par fragment
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

-- Drop l'ancienne signature (3 params) et garder la nouvelle (4 params)
DROP FUNCTION IF EXISTS public.answer_fragment_enigma(TEXT, INT, TEXT);
GRANT EXECUTE ON FUNCTION public.answer_fragment_enigma(TEXT, INT, TEXT, INT) TO authenticated;

-- Mettre à jour get_my_fragment_status : tracker via activity_log
CREATE OR REPLACE FUNCTION public.get_my_fragment_status(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE;
BEGIN
  v_today := (NOW() AT TIME ZONE 'Europe/Paris')::DATE;

  RETURN COALESCE((
    SELECT json_agg(json_build_object(
      'fragmentId', tf.id,
      'name', tf.name,
      'icon', tf.icon,
      'iconUrl', tf.icon_url,
      'imageUrl', tf.image_url,
      'collection', tf.collection,
      'hasEnigma', tf.collection IS NOT NULL AND EXISTS(
        SELECT 1 FROM enigmas e WHERE e.type = 'daily' AND e.heritage_id = tf.collection AND e.active = TRUE
      ),
      'enigmaCooldown', EXISTS(
        SELECT 1 FROM activity_log al
        WHERE al.actor_id = p_user_id
          AND al.type = 'fragment_enigma'
          AND (al.data->>'fragmentId')::INT = tf.id
          AND al.created_at > NOW() - (COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_cooldown_hours'), 48) || ' hours')::INTERVAL
      ),
      'enigmaNextAt', (
        SELECT al.created_at + (COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_cooldown_hours'), 48) || ' hours')::INTERVAL
        FROM activity_log al
        WHERE al.actor_id = p_user_id
          AND al.type = 'fragment_enigma'
          AND (al.data->>'fragmentId')::INT = tf.id
        ORDER BY al.created_at DESC LIMIT 1
      ),
      'affinities', (
        SELECT COALESCE(json_agg(json_build_object(
          'tagId', fta.tag_id,
          'tagTitle', t.title,
          'bonusPoints', fta.bonus_points
        )), '[]'::json)
        FROM fragment_tag_affinities fta
        JOIN tags t ON t.id = fta.tag_id
        WHERE fta.fragment_id = tf.id
      )
    ) ORDER BY tf.name)
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    WHERE uf.user_id = p_user_id
  ), '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_fragment_status(TEXT) TO authenticated;
