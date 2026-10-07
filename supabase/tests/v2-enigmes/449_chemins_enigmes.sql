-- 449 : une énigme percée apparaît sur les chemins, avec sa culture, jamais sa réponse. Annulé.
BEGIN;
\ir ../../migrations/449_chemins_enigmes.sql
DO $test$
DECLARE
  v_moi text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  v_autre text := (SELECT id FROM users u WHERE u.id ~ '^[0-9a-f-]{36}$' AND u.id <> 'cb16ff47-1ead-4adf-8eff-04d117551541' LIMIT 1);
  v_e1 int; v_e2 int; v_theme text; f json; l json;
BEGIN
  -- Deux énigmes d'une même culture active que le compte n'a jamais tentées.
  SELECT e.id, e.theme INTO v_e1, v_theme FROM enigmas e JOIN enigma_themes t ON t.id = e.theme AND t.active
   WHERE NOT EXISTS (SELECT 1 FROM enigma_responses r WHERE r.enigma_id = e.id AND r.user_id = v_moi) ORDER BY e.id LIMIT 1;
  SELECT e.id INTO v_e2 FROM enigmas e
   WHERE e.theme = v_theme AND e.id <> v_e1 AND NOT EXISTS (SELECT 1 FROM enigma_responses r WHERE r.enigma_id = e.id AND r.user_id = v_moi) ORDER BY e.id LIMIT 1;
  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, responded_at) VALUES (v_e1, v_moi, 'x', true, now());
  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, responded_at) VALUES (v_e2, v_moi, 'y', true, now());
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_autre, 'role', 'authenticated')::text, true);
  f := public.sur_les_chemins(50);
  SELECT x INTO l FROM json_array_elements(f) x WHERE x->>'type' = 'enigme' AND x->'qui'->>'id' = v_moi LIMIT 1;
  ASSERT l IS NOT NULL, 'mon énigme percée est sur les chemins';
  ASSERT l->>'id' = 'enigme:' || v_moi || ':' || now()::date, 'son id est celui du jour';
  ASSERT l->'culture'->>'id' = v_theme, 'avec sa culture';
  ASSERT (l->>'nombre')::int >= 2, 'et le nombre du jour';
  ASSERT l::text !~* '"(question|reponse|answer)"', 'ni question ni réponse';
  ASSERT (SELECT count(*) FROM json_array_elements(f) x WHERE x->>'type' = 'enigme' AND x->'qui'->>'id' = v_moi) = 1, 'une ligne par jour';
  ASSERT (l->>'moi')::boolean IS FALSE, 'vue par un autre';
  ASSERT EXISTS (SELECT 1 FROM json_array_elements(f) x WHERE x->>'type' <> 'enigme'), 'les autres chemins restent';
  RAISE EXCEPTION 'BILAN tout passe';
END $test$;
ROLLBACK;
