-- 487 : plus aucun nom à espace de bord ; « Moony » garde son nom affiché ; un prénom saisi avec
--       des espaces s'enregistre sans. Annulé.
BEGIN;
\ir ../../migrations/487_noms_sans_espaces.sql
DO $test$
DECLARE
  restants int; moony text; saisi text; quelqu_un text;
BEGIN
  SELECT count(*) INTO restants FROM users WHERE first_name <> btrim(first_name) OR display_name <> btrim(display_name);
  SELECT display_name INTO moony FROM users WHERE first_name = 'Moony';
  SELECT id INTO quelqu_un FROM users WHERE first_name = 'Un Voyageur' LIMIT 1;
  UPDATE users SET first_name = '  Nouveau nom ' WHERE id = quelqu_un;
  SELECT '[' || first_name || '|' || display_name || ']' INTO saisi FROM users WHERE id = quelqu_un;
  RAISE EXCEPTION 'BILAN restants=% (attendu 0) moony=% (attendu son nom affiché, sans espace) saisi=% (attendu [Nouveau nom|Nouveau nom])',
    restants, moony, saisi;
END $test$;
ROLLBACK;
