-- 498 : un compte accepte les conditions, la version et la date restent ; anon ne peut rien. Annulé.
BEGIN;
\ir ../../migrations/498_conditions_acceptees.sql
DO $test$
DECLARE moi text := '10e4c7d5-7f09-4bdf-8a47-c44db83a196f'; avant text; apres text; quand timestamptz; r text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', moi, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  avant := public.mes_conditions();
  PERFORM public.accepter_conditions('2026-10-11');
  apres := public.mes_conditions();
  BEGIN PERFORM public.accepter_conditions('n''importe quoi'); r := ' mauvaise_version=ACCEPTEE'; EXCEPTION WHEN others THEN r := ' mauvaise_version=refus'; END;
  RESET ROLE;
  SELECT conditions_acceptees_le INTO quand FROM users WHERE id = moi;
  BEGIN SET LOCAL ROLE anon; PERFORM public.mes_conditions(); r := r || ' anon=PASSE'; EXCEPTION WHEN insufficient_privilege THEN r := r || ' anon=refus'; END;
  RESET ROLE;
  RAISE EXCEPTION 'BILAN avant=% apres=% date=% %', avant, apres, (quand IS NOT NULL), r;
END $test$;
ROLLBACK;
