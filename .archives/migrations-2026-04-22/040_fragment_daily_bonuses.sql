-- 040_fragment_daily_bonuses.sql
-- Fragments : bonus quotidien d'influence ciblée par tag + collection + énigmes par fragment

-- ============================================================
-- 1. Table affinités fragment → tag
-- ============================================================
CREATE TABLE IF NOT EXISTS fragment_tag_affinities (
  fragment_id INT NOT NULL REFERENCES title_fragments(id) ON DELETE CASCADE,
  tag_id VARCHAR(255) NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  bonus_points INT NOT NULL DEFAULT 3,
  PRIMARY KEY (fragment_id, tag_id)
);

ALTER TABLE fragment_tag_affinities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fragment_tag_affinities_select" ON fragment_tag_affinities FOR SELECT USING (true);

-- ============================================================
-- 2. Ajouter fragment_id sur les énigmes (type 'fragment')
-- ============================================================
ALTER TABLE enigmas DROP CONSTRAINT IF EXISTS enigmas_type_check;
ALTER TABLE enigmas ADD CONSTRAINT enigmas_type_check CHECK (type IN ('daily', 'place', 'fragment'));
ALTER TABLE enigmas ADD COLUMN IF NOT EXISTS fragment_id INT REFERENCES title_fragments(id);
CREATE INDEX IF NOT EXISTS idx_enigmas_fragment ON enigmas(fragment_id) WHERE type = 'fragment' AND active = TRUE;

-- ============================================================
-- 3. Settings pour les paliers de collection
-- ============================================================
INSERT INTO app_settings (key, value) VALUES
  ('fragment_affinity_bonus_default', '3'),
  ('fragment_collection_1', '1'),
  ('fragment_collection_2', '3'),
  ('fragment_collection_3', '5'),
  ('fragment_collection_4', '8'),
  ('fragment_enigma_influence', '5'),
  ('fragment_enigma_erudition', '2')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 4. RPC : réclamer les bonus quotidiens de fragments
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_daily_fragment_bonus(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already_claimed BOOLEAN;
  v_affinity_total INT := 0;
  v_collection_total INT := 0;
  v_detail JSONB := '[]'::JSONB;
  v_collection_detail JSONB := '[]'::JSONB;
  r RECORD;
  v_bonus INT;
BEGIN
  -- Déjà réclamé aujourd'hui ?
  SELECT EXISTS(
    SELECT 1 FROM activity_log
    WHERE actor_id = p_user_id
      AND type = 'fragment_daily_bonus'
      AND created_at::DATE = CURRENT_DATE
  ) INTO v_already_claimed;

  IF v_already_claimed THEN
    RETURN json_build_object('error', 'already_claimed');
  END IF;

  -- Bonus d'affinité : par fragment possédé × tags
  FOR r IN
    SELECT tf.id AS fragment_id, tf.name AS fragment_name, fta.tag_id, t.title AS tag_title, fta.bonus_points
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    JOIN fragment_tag_affinities fta ON fta.fragment_id = tf.id
    JOIN tags t ON t.id = fta.tag_id
    WHERE uf.user_id = p_user_id
  LOOP
    v_affinity_total := v_affinity_total + r.bonus_points;
    v_detail := v_detail || jsonb_build_object(
      'fragment', r.fragment_name,
      'tag', r.tag_title,
      'points', r.bonus_points
    );
  END LOOP;

  -- Bonus de collection : par famille (collection) de fragments
  FOR r IN
    SELECT tf.collection, COUNT(*) AS cnt
    FROM user_fragments uf
    JOIN title_fragments tf ON tf.id = uf.fragment_id
    WHERE uf.user_id = p_user_id
      AND tf.collection IS NOT NULL
    GROUP BY tf.collection
  LOOP
    v_bonus := CASE
      WHEN r.cnt >= 4 THEN COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_collection_4'), 8)
      WHEN r.cnt = 3 THEN COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_collection_3'), 5)
      WHEN r.cnt = 2 THEN COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_collection_2'), 3)
      ELSE COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_collection_1'), 1)
    END;

    v_collection_total := v_collection_total + v_bonus;
    v_collection_detail := v_collection_detail || jsonb_build_object(
      'collection', r.collection,
      'count', r.cnt,
      'points', v_bonus
    );
  END LOOP;

  -- Rien à donner ?
  IF v_affinity_total + v_collection_total = 0 THEN
    RETURN json_build_object('error', 'no_fragments');
  END IF;

  -- Créditer le stock d'influence
  UPDATE users SET influence_stock = influence_stock + v_affinity_total + v_collection_total
  WHERE id = p_user_id;

  -- Logger
  INSERT INTO activity_log (type, actor_id, data)
  VALUES ('fragment_daily_bonus', p_user_id, jsonb_build_object(
    'affinityTotal', v_affinity_total,
    'collectionTotal', v_collection_total,
    'affinities', v_detail,
    'collections', v_collection_detail
  ));

  RETURN json_build_object(
    'success', true,
    'affinityTotal', v_affinity_total,
    'collectionTotal', v_collection_total,
    'total', v_affinity_total + v_collection_total,
    'affinities', v_detail,
    'collections', v_collection_detail,
    'newInfluenceStock', (SELECT influence_stock FROM users WHERE id = p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_daily_fragment_bonus(TEXT) TO authenticated;

-- ============================================================
-- 5. RPC : obtenir une énigme de fragment
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_fragment_enigma(
  p_user_id TEXT,
  p_fragment_id INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enigma RECORD;
  v_already_today BOOLEAN;
BEGIN
  -- Vérifier que le joueur possède ce fragment
  IF NOT EXISTS(SELECT 1 FROM user_fragments WHERE user_id = p_user_id AND fragment_id = p_fragment_id) THEN
    RETURN json_build_object('error', 'fragment_not_owned');
  END IF;

  -- Déjà répondu aujourd'hui pour ce fragment ?
  SELECT EXISTS(
    SELECT 1 FROM enigma_responses er
    JOIN enigmas e ON e.id = er.enigma_id
    WHERE er.user_id = p_user_id
      AND e.type = 'fragment'
      AND e.fragment_id = p_fragment_id
      AND (er.responded_at AT TIME ZONE 'Europe/Paris')::DATE = (NOW() AT TIME ZONE 'Europe/Paris')::DATE
  ) INTO v_already_today;

  IF v_already_today THEN
    RETURN json_build_object('already_answered', true);
  END IF;

  -- Choisir une énigme non vue
  SELECT e.* INTO v_enigma
  FROM enigmas e
  WHERE e.type = 'fragment'
    AND e.fragment_id = p_fragment_id
    AND e.active = TRUE
    AND e.id NOT IN (SELECT enigma_id FROM enigma_responses WHERE user_id = p_user_id)
  ORDER BY RANDOM()
  LIMIT 1;

  -- Fallback : n'importe quelle énigme de ce fragment
  IF v_enigma.id IS NULL THEN
    SELECT e.* INTO v_enigma
    FROM enigmas e
    WHERE e.type = 'fragment'
      AND e.fragment_id = p_fragment_id
      AND e.active = TRUE
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
    'fragmentId', p_fragment_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_fragment_enigma(TEXT, INT) TO authenticated;

-- ============================================================
-- 6. RPC : répondre à une énigme de fragment
-- ============================================================
CREATE OR REPLACE FUNCTION public.answer_fragment_enigma(
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
BEGIN
  SELECT * INTO v_enigma FROM enigmas WHERE id = p_enigma_id AND type = 'fragment';
  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'enigma_not_found');
  END IF;

  -- Vérifier que le joueur possède le fragment
  IF NOT EXISTS(SELECT 1 FROM user_fragments WHERE user_id = p_user_id AND fragment_id = v_enigma.fragment_id) THEN
    RETURN json_build_object('error', 'fragment_not_owned');
  END IF;

  v_correct := LOWER(TRIM(p_answer)) = LOWER(TRIM(v_enigma.answer));

  IF v_correct THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_influence'), 5) INTO v_influence_gain;
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_erudition'), 2) INTO v_erudition_gain;
  END IF;

  -- Enregistrer la réponse
  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained)
  VALUES (p_enigma_id, p_user_id, p_answer, v_correct, v_influence_gain, v_erudition_gain);

  -- Donner les récompenses
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
    'newErudition', (SELECT erudition_points FROM users WHERE id = p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.answer_fragment_enigma(TEXT, INT, TEXT) TO authenticated;

-- ============================================================
-- 7. RPC : lister les fragments du joueur avec statut énigme du jour
-- ============================================================
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
      'hasEnigma', EXISTS(
        SELECT 1 FROM enigmas e WHERE e.type = 'fragment' AND e.fragment_id = tf.id AND e.active = TRUE
      ),
      'enigmaAnsweredToday', EXISTS(
        SELECT 1 FROM enigma_responses er
        JOIN enigmas e ON e.id = er.enigma_id
        WHERE er.user_id = p_user_id
          AND e.type = 'fragment'
          AND e.fragment_id = tf.id
          AND (er.responded_at AT TIME ZONE 'Europe/Paris')::DATE = v_today
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
