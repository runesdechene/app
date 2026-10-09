-- 448 : l'énigme ouverte et les énigmes résolues portent leur numéro fixe. Annulé.
BEGIN;
\ir ../../migrations/448_numero_des_enigmes.sql
DO $test$
DECLARE
  v_moi text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  v_eveil bigint; o json; c json;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_moi, 'role', 'authenticated')::text, true);
  c := public.mes_enigmes_culture('celtique');
  ASSERT (c->'enigmes'->0->>'numero') IS NOT NULL, 'une énigme résolue porte son numéro';
  ASSERT (SELECT bool_and((x->>'numero')::int = e.id) FROM json_array_elements(c->'enigmes') x
           JOIN enigmas e ON e.question = x->>'question'), 'ce numéro est l''id de l''énigme';
  -- Un éveil encore en attente pour moi : sa feuille porte le même numéro que l'énigme.
  SELECT w.id INTO v_eveil FROM enigmes_eveillees w
   WHERE w.effacee_le IS NULL AND NOT EXISTS (SELECT 1 FROM enigma_responses r WHERE r.eveil_id = w.id OR (r.enigma_id = w.enigma_id AND r.user_id = v_moi AND r.correct)) LIMIT 1;
  o := public.ouvrir_enigme(v_eveil);
  ASSERT (o->>'numero')::int = (SELECT enigma_id FROM enigmes_eveillees WHERE id = v_eveil), 'la feuille porte le numéro';
  ASSERT o::text !~* '"(reponse|answer)"', 'toujours sans la réponse';
  RAISE EXCEPTION 'BILAN tout passe';
END $test$;
ROLLBACK;
