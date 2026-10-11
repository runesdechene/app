-- 485 : un compte sans nom choisi signe « Un Voyageur », jamais « Un voyageur sans nom ». Annulé.
BEGIN;
\ir ../../migrations/485_un_voyageur.sql
DO $test$
DECLARE
  lieux json; anonymes int; vieux int; espaces int;
BEGIN
  -- Une vingtaine de tirages : assez de comptes sans nom et de noms à espace pour juger.
  lieux := public.lieux_au_hasard(12);
  FOR i IN 1..20 LOOP lieux := (SELECT json_agg(e) FROM (
    SELECT e FROM json_array_elements(lieux) e UNION ALL
    SELECT e FROM json_array_elements(public.lieux_au_hasard(12)) e) x); END LOOP;
  SELECT count(*) FILTER (WHERE e->'auteur'->>'nom' = 'Un Voyageur'),
         count(*) FILTER (WHERE e->'auteur'->>'nom' = 'Un voyageur sans nom'),
         count(*) FILTER (WHERE e->'auteur'->>'nom' <> btrim(e->'auteur'->>'nom'))
    INTO anonymes, vieux, espaces FROM json_array_elements(lieux) e;
  RAISE EXCEPTION 'BILAN tires=% un_voyageur=% (attendu > 0) sans_nom=% (attendu 0) espaces=% (attendu 0)',
    json_array_length(lieux), anonymes, vieux, espaces;
END $test$;
ROLLBACK;
