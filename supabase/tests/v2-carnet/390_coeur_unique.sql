-- 390 : un cœur par personne sur un mot du Carnet. Annulé.
BEGIN;
\ir ../../migrations/390_coeur_de_mot_unique.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  b text := '10e4c7d5-7f09-4bdf-8a47-c44db83a196f';
  lieu text := '_3PgKU39l';
  m int; un json; deux json; trois json; notifs int; max_nombre int;
  refus text := '';
BEGIN
  SELECT max(nombre) INTO max_nombre FROM coeurs_mot;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  m := (public.ecrire_au_carnet(lieu, 'Un mot pour tester.')->>'id')::int;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  un := public.basculer_coeur_mot(m);
  deux := public.basculer_coeur_mot(m);
  trois := public.basculer_coeur_mot(m);
  SELECT count(*) INTO notifs FROM notifications WHERE recipient_id = a AND type = 'coeur_mot' AND data->>'contributionId' = m::text;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  BEGIN PERFORM public.basculer_coeur_mot(m); refus := 'a-soi-ACCEPTE'; EXCEPTION WHEN others THEN refus := SQLERRM; END;
  RAISE EXCEPTION 'BILAN max_nombre=% un=% deux=% trois=% notifs=% refus=%', max_nombre, un::text, deux::text, trois::text, notifs, refus;
END $test$;
ROLLBACK;
