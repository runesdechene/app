-- 367 : le geste « Découvrir ». Annulé.
BEGIN;
\ir ../../migrations/366_fiche_correctifs.sql
\ir ../../migrations/367_decouvrir.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  lieu text;
  avant_fiche text; apres_fiche text;
  r1 json; r2 json;
  xp_avant int; xp_apres int; rang_attendu int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  SELECT p.id INTO lieu FROM places p
   WHERE p.masked IS NOT TRUE AND p.private IS NOT TRUE AND p.nature = 'lieu'
     AND p.author_id IS DISTINCT FROM a
     AND NOT EXISTS (SELECT 1 FROM places_discovered d WHERE d.place_id = p.id AND d.user_id = a)
     AND NOT EXISTS (SELECT 1 FROM place_explorers e WHERE e.place_id = p.id AND e.user_id = a)
   LIMIT 1;
  avant_fiche := public.fiche_lieu(lieu)->'moi'->>'decouvert';
  SELECT xp_total INTO xp_avant FROM users WHERE id = a;
  SELECT count(*) + 1 INTO rang_attendu FROM places_discovered WHERE user_id = a;
  r1 := public.decouvrir_lieu(lieu);
  SELECT xp_total INTO xp_apres FROM users WHERE id = a;
  apres_fiche := public.fiche_lieu(lieu)->'moi'->>'decouvert';
  -- Une deuxième fois : rien ne change.
  r2 := public.decouvrir_lieu(lieu);
  RAISE EXCEPTION 'BILAN decouvert=%->% xp=%->% rang_attendu=% r1=% r2=% carte=%',
    avant_fiche, apres_fiche, xp_avant, xp_apres, rang_attendu, r1, r2,
    (SELECT x->>'etat' FROM json_array_elements(public.carte_lieux()) x WHERE x->>'id' = lieu);
END $test$;
ROLLBACK;
