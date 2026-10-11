-- 499 : un admin change un rôle ; un joueur ne peut pas se faire admin. Annulé.
BEGIN;
\ir ../../migrations/499_changer_un_role.sql
DO $test$
DECLARE admin text := 'cb16ff47-1ead-4adf-8eff-04d117551541'; joueur text := '10e4c7d5-7f09-4bdf-8a47-c44db83a196f'; r text := ''; role_final text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', joueur, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM public.changer_role(joueur, 'admin'); r := r || ' joueur=SE_FAIT_ADMIN'; EXCEPTION WHEN others THEN r := r || ' joueur=refus'; END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM public.changer_role(joueur, 'ambassador');
  BEGIN PERFORM public.changer_role(joueur, 'roi'); r := r || ' role_inconnu=ACCEPTE'; EXCEPTION WHEN others THEN r := r || ' role_inconnu=refus'; END;
  RESET ROLE;
  SELECT role INTO role_final FROM users WHERE id = joueur;
  RAISE EXCEPTION 'BILAN% role_final=% (attendu ambassador)', r, role_final;
END $test$;
ROLLBACK;
