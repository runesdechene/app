-- 375 : le fil rend le type du lieu (icône, couleur). Annulé.
BEGIN;
\ir ../../migrations/375_chemins_type_de_lieu.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  chemins json; ajout json; sans_type int; faux int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  chemins := public.sur_les_chemins(50);
  SELECT c INTO ajout FROM json_array_elements(chemins) c WHERE c->>'type' = 'ajout' LIMIT 1;
  -- Un lieu dont le type principal a une icône doit la rendre.
  SELECT count(*) INTO sans_type FROM json_array_elements(chemins) c
    WHERE c->'lieu' IS NOT NULL AND json_typeof(c->'lieu') = 'object' AND c->'lieu'->'type' IS NULL;
  SELECT count(*) INTO faux FROM json_array_elements(chemins) c
    JOIN place_tags pt ON pt.place_id = c->'lieu'->>'id' AND pt.is_primary
    JOIN tags t ON t.id = pt.tag_id
    WHERE t.icon IS NOT NULL AND (c->'lieu'->'type'->>'icone') IS DISTINCT FROM t.icon;
  RAISE EXCEPTION 'BILAN nb=% ajout=% lieux_sans_cle_type=% icone_fausse=%',
    json_array_length(chemins), ajout->'lieu', sans_type, faux;
END $test$;
ROLLBACK;
