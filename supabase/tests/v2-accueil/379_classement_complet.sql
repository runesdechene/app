-- 379 : la tête compte jusqu'à cinquante Explorateurs. Annulé.
BEGIN;
\ir ../../migrations/379_classement_complet.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  vt json; dixieme_ok boolean;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  vt := public.grands_explorateurs('visites', 'toujours');
  dixieme_ok := (vt->>'dixieme')::int = (vt->'tete'->9->>'lieux')::int;
  RAISE EXCEPTION 'BILAN tete=% dernier_rang=% dixieme_ok=% moi=%',
    json_array_length(vt->'tete'), vt->'tete'->-1->>'rang', dixieme_ok, vt->'moi'->>'rang';
END $test$;
ROLLBACK;
