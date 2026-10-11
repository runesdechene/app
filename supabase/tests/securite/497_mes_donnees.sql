-- 497 : chacun télécharge ses données, et seulement les siennes. Annulé.
BEGIN;
\ir ../../migrations/497_mes_donnees.sql
DO $test$
DECLARE moi text := 'cb16ff47-1ead-4adf-8eff-04d117551541'; d json; autre int; r text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', moi, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  d := public.mes_donnees();
  RESET ROLE;
  SELECT count(*) INTO autre FROM json_array_elements(d->'place_explorers') e WHERE e->>'user_id' <> moi;
  r := ' nom=' || (d->'compte'->>'first_name') || ' mot_de_passe_present=' || ((d->'compte')::jsonb ? 'password')
    || ' lieux=' || json_array_length(d->'lieux_ajoutes') || ' visites=' || json_array_length(d->'place_explorers')
    || ' visites_d_autrui=' || autre || ' taille_ko=' || (length(d::text) / 1024);
  BEGIN SET LOCAL ROLE anon; PERFORM public.mes_donnees(); r := r || ' anon=PASSE'; EXCEPTION WHEN insufficient_privilege THEN r := r || ' anon=refus'; END;
  RESET ROLE;
  RAISE EXCEPTION 'BILAN%', r;
END $test$;
ROLLBACK;
