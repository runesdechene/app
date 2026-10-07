-- 451 : deux cultures percées le même jour font deux lignes, chacune avec son nombre. Annulé.
BEGIN;
\ir ../../migrations/451_chemins_une_ligne_par_culture.sql
DO $test$
DECLARE
  v_moi text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  v_autre text := (SELECT id FROM users u WHERE u.id ~ '^[0-9a-f-]{36}$' AND u.id <> 'cb16ff47-1ead-4adf-8eff-04d117551541' LIMIT 1);
  v_a text; v_b text; f json;
BEGIN
  -- Deux cultures actives où le compte a encore des énigmes jamais tentées.
  SELECT t.id INTO v_a FROM enigma_themes t WHERE t.active AND EXISTS (SELECT 1 FROM enigmas e WHERE e.theme = t.id
    AND NOT EXISTS (SELECT 1 FROM enigma_responses r WHERE r.enigma_id = e.id AND r.user_id = v_moi)) ORDER BY t.id LIMIT 1;
  SELECT t.id INTO v_b FROM enigma_themes t WHERE t.active AND t.id <> v_a AND EXISTS (SELECT 1 FROM enigmas e WHERE e.theme = t.id
    AND NOT EXISTS (SELECT 1 FROM enigma_responses r WHERE r.enigma_id = e.id AND r.user_id = v_moi)) ORDER BY t.id LIMIT 1;
  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, responded_at)
  SELECT e.id, v_moi, 'x', true, now() FROM enigmas e WHERE e.theme = v_a
     AND NOT EXISTS (SELECT 1 FROM enigma_responses r WHERE r.enigma_id = e.id AND r.user_id = v_moi) ORDER BY e.id LIMIT 2;
  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, responded_at)
  SELECT e.id, v_moi, 'x', true, now() FROM enigmas e WHERE e.theme = v_b
     AND NOT EXISTS (SELECT 1 FROM enigma_responses r WHERE r.enigma_id = e.id AND r.user_id = v_moi) ORDER BY e.id LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_autre, 'role', 'authenticated')::text, true);
  f := public.sur_les_chemins(50);
  ASSERT EXISTS (SELECT 1 FROM json_array_elements(f) x WHERE x->>'id' = 'enigme:' || v_moi || ':' || v_a || ':' || now()::date
                   AND x->'culture'->>'id' = v_a AND (x->>'nombre')::int >= 2), 'une ligne pour la première culture, avec son nombre';
  ASSERT EXISTS (SELECT 1 FROM json_array_elements(f) x WHERE x->>'id' = 'enigme:' || v_moi || ':' || v_b || ':' || now()::date
                   AND x->'culture'->>'id' = v_b), 'une autre pour la seconde';
  ASSERT EXISTS (SELECT 1 FROM json_array_elements(f) x WHERE x->>'type' <> 'enigme'), 'les autres chemins restent';
  RAISE EXCEPTION 'BILAN tout passe';
END $test$;
ROLLBACK;
