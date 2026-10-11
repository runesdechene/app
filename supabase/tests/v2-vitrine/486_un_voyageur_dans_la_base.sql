-- 486 : plus aucun « Un voyageur sans nom » dans la base ; la vitrine lit le nom tel quel. Annulé.
BEGIN;
\ir ../../migrations/486_un_voyageur_dans_la_base.sql
DO $test$
DECLARE
  restants int; renommes int; lieux json; vieux int;
BEGIN
  SELECT count(*) FILTER (WHERE display_name = 'Un voyageur sans nom' OR first_name = 'Un voyageur sans nom'),
         count(*) FILTER (WHERE display_name = 'Un Voyageur' AND first_name = 'Un Voyageur')
    INTO restants, renommes FROM users;
  lieux := public.lieux_au_hasard(12);
  SELECT count(*) FILTER (WHERE e->'auteur'->>'nom' = 'Un voyageur sans nom') INTO vieux
    FROM json_array_elements(lieux) e;
  RAISE EXCEPTION 'BILAN restants=% (attendu 0) renommes=% (attendu 2459) vitrine_sans_nom=% (attendu 0)',
    restants, renommes, vieux;
END $test$;
ROLLBACK;
