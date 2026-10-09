-- 384 : les cœurs des lieux. Annulé.
BEGIN;
\ir ../../migrations/384_coeurs_des_lieux.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  lieu text; mon_lieu text; auteur text;
  repris int; un json; deux json; liste json; notifs_avant int; notifs_apres int;
  refus text[] := '{}';
BEGIN
  SELECT count(*) INTO repris FROM coeurs_lieu;
  -- Un lieu visible d'un autre auteur, et un lieu à moi.
  SELECT id, author_id INTO lieu, auteur FROM places
    WHERE author_id IS NOT NULL AND author_id <> a AND masked IS NOT TRUE AND private IS NOT TRUE LIMIT 1;
  SELECT id INTO mon_lieu FROM places WHERE author_id = a LIMIT 1;
  DELETE FROM coeurs_lieu WHERE place_id = lieu AND user_id = a;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO notifs_avant FROM notifications WHERE type = 'like_contribution' AND data->>'placeId' = lieu;
  un := public.aimer_lieu(lieu);
  deux := public.aimer_lieu(lieu);
  PERFORM public.aimer_lieu(lieu);
  SELECT count(*) INTO notifs_apres FROM notifications WHERE type = 'like_contribution' AND data->>'placeId' = lieu;
  liste := public.coeurs_du_lieu(lieu);

  BEGIN PERFORM public.aimer_lieu(mon_lieu);
    refus := refus || 'mon-lieu-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.aimer_lieu('nimporte');
    refus := refus || 'inconnu-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  PERFORM set_config('role', 'anon', true);
  BEGIN PERFORM public.aimer_lieu(lieu);
    refus := refus || 'anon-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || 'anon refusé'::text; END;

  RAISE EXCEPTION 'BILAN repris=% un=% deux=% notifs=+% miens=% total=% premier=% refus=%',
    repris, un::text, deux::text, notifs_apres - notifs_avant, liste->>'miens', liste->>'total',
    (liste->'gens'->0)::text, array_to_string(refus, ' | ');
END $test$;
ROLLBACK;
