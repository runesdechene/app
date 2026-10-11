-- 484 : des lieux tirés au sort pour la vitrine — publics, avec photo et fiche, plafonnés. Annulé.
BEGIN;
\ir ../../migrations/484_lieux_au_hasard.sql
DO $test$
DECLARE
  huit json; trop json; cache text; vus int := 0; masques int;
BEGIN
  -- Un lieu masqué avec photo : il ne doit jamais sortir. On masque tous les lieux publics sauf
  -- douze, puis on tire : seuls ces douze peuvent sortir.
  CREATE TEMP TABLE gardes ON COMMIT DROP AS
    SELECT id FROM places WHERE masked IS NOT TRUE AND private IS NOT TRUE AND slug IS NOT NULL
      AND jsonb_array_length(COALESCE(images, '[]'::jsonb)) > 0 LIMIT 12;
  UPDATE places SET masked = true WHERE id NOT IN (SELECT id FROM gardes);
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  huit := public.lieux_au_hasard();
  trop := public.lieux_au_hasard(500);
  SELECT count(*) INTO masques FROM json_array_elements(trop) e WHERE e->>'id' NOT IN (SELECT id FROM gardes);
  SELECT count(*) INTO vus FROM json_array_elements(huit) e
   WHERE e->>'photo' IS NOT NULL AND e->>'slug' IS NOT NULL AND e->'nature' IS NOT NULL;
  RAISE EXCEPTION 'BILAN defaut=% (attendu 8) complets=% (attendu 8) plafond=% (attendu 12) masques_sortis=% (attendu 0) exemple=%',
    json_array_length(huit), vus, json_array_length(trop), masques, (huit->0)::text;
END $test$;
ROLLBACK;
