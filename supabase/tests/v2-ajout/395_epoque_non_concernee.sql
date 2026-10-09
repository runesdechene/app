-- 395 : l'époque « Non concerné ». Annulé.
BEGIN;
\ir ../../migrations/395_epoque_non_concernee.sql
DO $test$
DECLARE
  passes int; gardees int; hors int; source text; chateau_avant text; chateau_apres text;
  fiche_source json; natures json; epoques json;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'cb16ff47-1ead-4adf-8eff-04d117551541', 'role', 'authenticated')::text, true);
  SELECT count(*) INTO passes FROM places WHERE era_id = 'not-applicable';
  -- Une époque déjà renseignée sur une nature sans époque : gardée.
  SELECT count(*) INTO gardees FROM places p JOIN place_tags pt ON pt.place_id = p.id AND pt.is_primary
    JOIN tags t ON t.id = pt.tag_id WHERE t.hors_epoque AND p.era_id NOT IN ('not-applicable', 'unknown');
  SELECT count(*) INTO hors FROM tags WHERE hors_epoque;
  SELECT p.id INTO source FROM places p WHERE p.era_id = 'not-applicable' AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1;
  fiche_source := public.fiche_lieu(source);
  natures := public.natures_de_lieu();
  epoques := public.epoques();
  RAISE EXCEPTION 'BILAN passes=% gardees=% natures_hors=% | fiche epoque=% | natures horsEpoque vrais=% | epoques: derniere=%',
    passes, gardees, hors, coalesce(fiche_source->'faits'->>'epoque', 'RIEN (tu)'),
    (SELECT count(*) FROM json_array_elements(natures) n WHERE (n->>'horsEpoque')::boolean),
    epoques->(json_array_length(epoques) - 1)->>'nom';
END $test$;
ROLLBACK;
