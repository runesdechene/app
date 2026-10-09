-- 374 : les saluts à volonté. Annulé.
BEGIN;
\ir ../../migrations/374_saluts_a_volonte.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  autre json; s1 json; s2 json; s3 json; ligne json; lignes int; soi text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SELECT c INTO autre FROM json_array_elements(public.sur_les_chemins(20)) c
    WHERE c->'qui'->>'id' <> a LIMIT 1;

  -- Trois touchers : trois cœurs de plus, jamais de retrait ; une seule ligne en table.
  s1 := public.saluer(autre->>'id');
  s2 := public.saluer(autre->>'id');
  s3 := public.saluer(autre->>'id');
  SELECT count(*) INTO lignes FROM saluts WHERE evenement = autre->>'id' AND user_id = a;
  SELECT c INTO ligne FROM json_array_elements(public.sur_les_chemins(20)) c
    WHERE c->>'id' = autre->>'id';

  BEGIN PERFORM public.saluer('arrivee:' || a); soi := 'accepté';
  EXCEPTION WHEN others THEN soi := SQLERRM; END;

  RAISE EXCEPTION 'BILAN avant=% s1=% s2=% s3=% lignes=% fil=%/% soi=%',
    autre->>'saluts', s1, s2, s3, lignes, ligne->>'saluts', ligne->>'salue', soi;
END $test$;
ROLLBACK;
