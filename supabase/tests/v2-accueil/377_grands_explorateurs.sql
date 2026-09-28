-- 377 : les Grands Explorateurs du mois. Annulé.
BEGIN;
\ir ../../migrations/377_grands_explorateurs.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  avant json; apres json; debut timestamptz;
  trie boolean; rangs_suivis boolean; compte_juste int; lieu_neuf text; anonyme text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  debut := date_trunc('month', now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris';
  avant := public.grands_explorateurs();

  -- Trié par lieux, rangs 1, 2, 3… sans trou.
  SELECT COALESCE(bool_and((x.v->>'lieux')::int >= (y.v->>'lieux')::int), true),
         COALESCE(bool_and((y.v->>'rang')::int = (x.v->>'rang')::int + 1), true)
    INTO trie, rangs_suivis
    FROM json_array_elements(avant->'tete') WITH ORDINALITY x(v, i)
    JOIN json_array_elements(avant->'tete') WITH ORDINALITY y(v, i) ON y.i = x.i + 1;

  -- Chaque compte de la tête est juste.
  SELECT count(*) INTO compte_juste FROM json_array_elements(avant->'tete') t
   WHERE (t->>'lieux')::int = (SELECT count(*) FROM place_explorers e JOIN places p ON p.id = e.place_id
                               WHERE e.user_id = t->>'id' AND e.visited_at >= debut
                                 AND p.masked IS NOT TRUE AND p.private IS NOT TRUE);

  -- Une visite GPS de plus ce mois-ci : un lieu de plus pour moi.
  SELECT p.id INTO lieu_neuf FROM places p
   WHERE p.masked IS NOT TRUE AND p.private IS NOT TRUE
     AND NOT EXISTS (SELECT 1 FROM place_explorers e WHERE e.place_id = p.id AND e.user_id = a)
   LIMIT 1;
  INSERT INTO place_explorers (place_id, user_id, visited_at) VALUES (lieu_neuf, a, now());
  apres := public.grands_explorateurs();

  PERFORM set_config('role', 'anon', true);
  BEGIN PERFORM public.grands_explorateurs(); anonyme := 'accepté';
  EXCEPTION WHEN others THEN anonyme := 'refusé'; END;

  RAISE EXCEPTION 'BILAN tete=% trie=% rangs=% comptes_justes=% moi_avant=% moi_apres=% dixieme=% anon=% premier=%',
    json_array_length(avant->'tete'), trie, rangs_suivis, compte_juste,
    avant->'moi', apres->'moi', avant->'dixieme', anonyme, avant->'tete'->0;
END $test$;
ROLLBACK;
