-- Migration 003 — Fuzzy matching pour les réponses libres aux énigmes
--
-- Avant : la validation `LOWER(TRIM(p_answer)) = LOWER(TRIM(v_enigma.answer))`
-- rejetait des réponses légitimes à cause d'accents, articles, pluriels,
-- ponctuation et petites typos. Exemples remontés par les joueurs :
--   "pompei" / "Pompéi", "louves" / "Louve", "le bosphore" / "Bosphore",
--   "vae victis" / "Vae_Victis", "hippocrte" / "Hippocrate".
--
-- Cascade indulgente (option B — décidée le 2026-04-24) :
--   1. Normalisation : lower, trim, unaccent, ponctuation→espace,
--      compactage espaces, suppression article français initial.
--   2. Match exact normalisé → correct.
--   3. Singulier/pluriel : le plus long finit par 's' ou 'x' et
--      correspond au plus court privé de cette lettre.
--   4. Levenshtein sur la forme normalisée, seuil par longueur :
--      - < 5 caractères : pas de fuzzy (trop risqué sur noms propres courts)
--      - 5–7 caractères : distance ≤ 1
--      - ≥ 8 caractères : distance ≤ 2
--
-- Trade-off accepté : "Pompée" (6) sera accepté pour "Pompéi" (6) — distance 1.
-- Considéré comme une réponse "tu sais ce que tu veux dire" plutôt qu'une faute.
--
-- Aucun changement côté React. Rollback = nouvelle migration restaurant
-- la ligne `LOWER(TRIM)` dans les deux RPCs internes.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Helper de normalisation
CREATE OR REPLACE FUNCTION public._enigma_normalize(p_input text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT regexp_replace(
    btrim(
      regexp_replace(
        regexp_replace(
          unaccent(lower(coalesce(p_input, ''))),
          '[-.,;:!?_'']', ' ', 'g'
        ),
        '\s+', ' ', 'g'
      )
    ),
    '^(le |la |les |l |un |une |des |du |de |d )', '', ''
  )
$$;

-- Helper de matching (cascade exact → pluriel → Levenshtein)
CREATE OR REPLACE FUNCTION public._enigma_answer_matches(p_user text, p_correct text)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_user TEXT := public._enigma_normalize(p_user);
  v_correct TEXT := public._enigma_normalize(p_correct);
  v_len_correct INT;
  v_dist INT;
BEGIN
  IF v_user = '' OR v_correct = '' THEN
    RETURN false;
  END IF;

  -- 1. Exact normalisé
  IF v_user = v_correct THEN
    RETURN true;
  END IF;

  -- 2. Singulier / pluriel (s ou x final)
  IF length(v_user) = length(v_correct) + 1
     AND right(v_user, 1) IN ('s', 'x')
     AND substr(v_user, 1, length(v_user) - 1) = v_correct THEN
    RETURN true;
  END IF;
  IF length(v_correct) = length(v_user) + 1
     AND right(v_correct, 1) IN ('s', 'x')
     AND substr(v_correct, 1, length(v_correct) - 1) = v_user THEN
    RETURN true;
  END IF;

  -- 3. Levenshtein, plafonné par la longueur de la bonne réponse
  v_len_correct := length(v_correct);
  IF v_len_correct < 5 THEN
    RETURN false;
  END IF;

  v_dist := levenshtein(v_user, v_correct);
  IF v_len_correct <= 7 THEN
    RETURN v_dist <= 1;
  ELSE
    RETURN v_dist <= 2;
  END IF;
END;
$$;

-- Self-tests : la migration échoue si le moindre cas se comporte mal
DO $$
DECLARE
  r RECORD;
  v_actual BOOLEAN;
  v_failures TEXT := '';
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- Doivent matcher
      ('Pompéi',          'Pompéi',          true,  'exact'),
      ('pompei',          'Pompéi',          true,  'sans accent'),
      ('  POMPEI  ',      'Pompéi',          true,  'casse + espaces'),
      ('louves',          'Louve',           true,  'pluriel s'),
      ('Louve',           'louves',          true,  'pluriel s inverse'),
      ('Le Bosphore',     'Bosphore',        true,  'article LE'),
      ('Bosphore',        'Le Bosphore',     true,  'article LE inverse'),
      ('vae victis',      'Vae_Victis',      true,  'underscore'),
      ('Le Feu Gregeois', 'Le Feu Grégeois', true,  'multi-mots accent'),
      ('hippocrte',       'Hippocrate',      true,  'typo lev=1'),
      ('jormungand',      'Jörmungand',      true,  'umlaut'),
      ('valkyrie',        'Valkyries',       true,  'pluriel + casse'),
      ('alexandr',        'Alexandre',       true,  'lev=1 long'),
      ('vercingetorix',   'Vercingétorix',   true,  'long sans accent'),
      ('La garde varegue','La garde varègue',true,  'multi-mots typo'),
      -- Doivent échouer
      ('aigle',           'Louve',           false, 'mots différents'),
      ('rome',            'Romulus',         false, 'court partiel'),
      ('',                'Aigle',           false, 'vide'),
      ('xyz',             'Aigle',           false, 'court n''importe quoi'),
      ('chien',           'Aigle',           false, 'court ≠ court (5 lettres mais lev=4)'),
      ('456',             '476',             false, 'chiffres trop courts'),
      ('Athene',          'Sparte',          false, 'longs différents')
    ) AS t(user_ans, correct_ans, expected, label)
  LOOP
    v_actual := public._enigma_answer_matches(r.user_ans, r.correct_ans);
    IF v_actual <> r.expected THEN
      v_failures := v_failures || E'\n  - [' || r.label || '] user="' || r.user_ans
        || '" correct="' || r.correct_ans || '" expected=' || r.expected
        || ' got=' || v_actual;
    END IF;
  END LOOP;

  IF v_failures <> '' THEN
    RAISE EXCEPTION 'enigma fuzzy match self-tests failed:%', v_failures;
  END IF;
END $$;

-- Réécriture _answer_enigma_internal : seule la ligne v_correct change
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

-- Réécriture _answer_fragment_enigma_internal : idem, seule la ligne v_correct change
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

ALTER FUNCTION public._answer_enigma_internal(text, integer, text) OWNER TO postgres;
ALTER FUNCTION public._answer_fragment_enigma_internal(text, integer, text, integer) OWNER TO postgres;
ALTER FUNCTION public._enigma_normalize(text) OWNER TO postgres;
ALTER FUNCTION public._enigma_answer_matches(text, text) OWNER TO postgres;
