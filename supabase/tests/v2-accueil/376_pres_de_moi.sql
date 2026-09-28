-- 376 : Près de toi. Annulé.
BEGIN;
\ir ../../migrations/376_pres_de_moi.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  lat double precision; lng double precision;
  proches json; apres_visite json; ocean json; hors_carte json;
  premier text; trie boolean; loin int; visites int; anonyme text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  -- Se placer sur un lieu que l'on n'a pas visité : il doit sortir en premier, à 0 m.
  SELECT p.latitude, p.longitude, p.id INTO lat, lng, premier FROM places p
    WHERE p.nature = 'lieu' AND p.masked IS NOT TRUE AND p.private IS NOT TRUE AND p.latitude IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM place_explorers e WHERE e.place_id = p.id AND e.user_id = a)
      AND NOT EXISTS (SELECT 1 FROM places_discovered d WHERE d.place_id = p.id AND d.user_id = a AND d.method = 'gps')
    LIMIT 1;
  proches := public.pres_de_moi(lat, lng);
  SELECT COALESCE(bool_and(x.m <= y.m), true) INTO trie FROM
    (SELECT (v->>'metres')::numeric m, i FROM json_array_elements(proches) WITH ORDINALITY e(v, i)) x
    JOIN (SELECT (v->>'metres')::numeric m, i FROM json_array_elements(proches) WITH ORDINALITY e(v, i)) y
      ON y.i = x.i + 1;
  SELECT count(*) INTO loin FROM json_array_elements(proches) e WHERE (e->>'metres')::numeric > 100000;

  -- Une visite GPS le fait disparaître.
  INSERT INTO place_explorers (place_id, user_id, visited_at) VALUES (premier, a, now());
  apres_visite := public.pres_de_moi(lat, lng);
  SELECT count(*) INTO visites FROM json_array_elements(apres_visite) e WHERE e->>'id' = premier;

  -- Au milieu de l'Atlantique, rien ; une position absurde, rien.
  ocean := public.pres_de_moi(40.0, -40.0);
  hors_carte := public.pres_de_moi(500, 500);

  -- Sans compte : refusé.
  PERFORM set_config('role', 'anon', true);
  BEGIN PERFORM public.pres_de_moi(lat, lng); anonyme := 'accepté';
  EXCEPTION WHEN others THEN anonyme := 'refusé'; END;

  RAISE EXCEPTION 'BILAN nb=% premier_ok=% metres0=% trie=% loin=% apres_visite=% ocean=% hors_carte=% anon=% exemple=%',
    json_array_length(proches), proches->0->>'id' = premier, proches->0->>'metres', trie, loin,
    visites, ocean, hors_carte, anonyme, proches->0;
END $test$;
ROLLBACK;
