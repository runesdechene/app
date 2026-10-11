-- 488 : les deux colonnes de nom disent la même chose ; Moony s'affiche Moony. Annulé.
BEGIN;
\ir ../../migrations/488_un_seul_nom.sql
DO $test$
DECLARE
  differents int; moony text; vides int;
BEGIN
  SELECT count(*) FILTER (WHERE display_name IS DISTINCT FROM first_name),
         count(*) FILTER (WHERE first_name IS NULL AND display_name IS NULL)
    INTO differents, vides FROM users;
  SELECT COALESCE(display_name, first_name) INTO moony FROM users WHERE first_name = 'Moony';
  RAISE EXCEPTION 'BILAN differents=% (attendu 0) sans_aucun_nom=% moony_affiche=% (attendu Moony)',
    differents, vides, moony;
END $test$;
ROLLBACK;
