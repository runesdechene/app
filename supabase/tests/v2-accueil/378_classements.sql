-- 378 : les classements (visités / ajoutés, ce mois-ci / depuis toujours). Annulé.
BEGIN;
\ir ../../migrations/378_classements.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  vm json; vt json; am json; at json; defaut json; debut timestamptz;
  juste_vt int; juste_at int; inconnu text; ancienne int; anonyme text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  debut := date_trunc('month', now() AT TIME ZONE 'Europe/Paris') AT TIME ZONE 'Europe/Paris';
  vm := public.grands_explorateurs('visites', 'mois');
  vt := public.grands_explorateurs('visites', 'toujours');
  am := public.grands_explorateurs('ajouts', 'mois');
  at := public.grands_explorateurs('ajouts', 'toujours');
  defaut := public.grands_explorateurs();

  SELECT count(*) INTO juste_vt FROM json_array_elements(vt->'tete') t
   WHERE (t->>'lieux')::int = (SELECT count(*) FROM place_explorers e JOIN places p ON p.id = e.place_id
                               WHERE e.user_id = t->>'id' AND p.masked IS NOT TRUE AND p.private IS NOT TRUE);
  SELECT count(*) INTO juste_at FROM json_array_elements(at->'tete') t
   WHERE (t->>'lieux')::int = (SELECT count(*) FROM places p WHERE p.author_id = t->>'id' AND p.nature = 'lieu'
                               AND p.masked IS NOT TRUE AND p.private IS NOT TRUE);

  BEGIN PERFORM public.grands_explorateurs('couronnes', 'mois'); inconnu := 'accepté';
  EXCEPTION WHEN others THEN inconnu := SQLERRM; END;
  SELECT count(*) INTO ancienne FROM pg_proc WHERE proname = 'grands_explorateurs' AND pronargs = 0;

  PERFORM set_config('role', 'anon', true);
  BEGIN PERFORM public.grands_explorateurs(); anonyme := 'accepté';
  EXCEPTION WHEN others THEN anonyme := 'refusé'; END;

  RAISE EXCEPTION 'BILAN vm=%/% vt=%/% am=%/% at=%/% juste_vt=% juste_at=% defaut_egal_vm=% moi_vt=% moi_am=% inconnu=% ancienne=% anon=%',
    json_array_length(vm->'tete'), vm->'tete'->0->>'lieux',
    json_array_length(vt->'tete'), vt->'tete'->0->>'lieux',
    json_array_length(am->'tete'), am->'tete'->0->>'lieux',
    json_array_length(at->'tete'), at->'tete'->0->>'lieux',
    juste_vt, juste_at, defaut::text = vm::text,
    vt->'moi', am->'moi', inconnu, ancienne, anonyme;
END $test$;
ROLLBACK;
