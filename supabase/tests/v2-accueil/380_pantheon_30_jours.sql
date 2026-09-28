-- 380 : le Panthéon sur 30 jours glissants. Annulé.
BEGIN;
\ir ../../migrations/379_classement_complet.sql
\ir ../../migrations/380_pantheon_30_jours.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  j30 json; defaut json; juste int; ancien text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  j30 := public.grands_explorateurs('visites', '30jours');
  defaut := public.grands_explorateurs();
  SELECT count(*) INTO juste FROM json_array_elements(j30->'tete') t
   WHERE (t->>'lieux')::int = (SELECT count(*) FROM place_explorers e JOIN places p ON p.id = e.place_id
                               WHERE e.user_id = t->>'id' AND e.visited_at >= now() - interval '30 days'
                                 AND p.masked IS NOT TRUE AND p.private IS NOT TRUE);
  BEGIN PERFORM public.grands_explorateurs('visites', 'mois'); ancien := 'accepté';
  EXCEPTION WHEN others THEN ancien := SQLERRM; END;
  RAISE EXCEPTION 'BILAN tete=% premier=% juste=%/% defaut_egal=% mois=%',
    json_array_length(j30->'tete'), j30->'tete'->0->>'lieux', juste, json_array_length(j30->'tete'),
    defaut::text = j30::text, ancien;
END $test$;
ROLLBACK;
