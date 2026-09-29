-- 386 : les Notifications de la V2. Annulé.
BEGIN;
\ir ../../migrations/386_notifications_v2.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  b text := '10e4c7d5-7f09-4bdf-8a47-c44db83a196f';
  lieu text;
  avant int; apres int; saluts int; mentions int; lues int; liste json; reste int;
  refus text := '';
BEGIN
  SELECT id INTO lieu FROM places WHERE masked IS NOT TRUE LIMIT 1;
  DELETE FROM saluts WHERE evenement = 'arrivee:' || a AND user_id = b;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  avant := public.notifications_non_lues();

  -- b salue l'arrivée de a trois fois, puis le mentionne.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  PERFORM public.saluer('arrivee:' || a);
  PERFORM public.saluer('arrivee:' || a);
  PERFORM public.saluer('arrivee:' || a);
  PERFORM public.ecrire_au_registre('general', '@Uriel tu passes samedi ?', ARRAY[a]);
  SELECT count(*) INTO saluts FROM notifications WHERE recipient_id = a AND type = 'salut' AND data->>'actorId' = b;
  SELECT count(*) INTO mentions FROM notifications WHERE recipient_id = a AND type = 'mention' AND data->>'actorId' = b;

  -- Une photo sur un lieu (retenue) et l'énigme du jour (laissée de côté).
  PERFORM notify(a, 'new_photo', jsonb_build_object('actorId', b, 'placeId', lieu));
  PERFORM notify(a, 'daily_enigma_ready', '{}'::jsonb);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  apres := public.notifications_non_lues();
  liste := public.mes_notifications();
  lues := public.marquer_notifications_lues();
  reste := public.notifications_non_lues();

  PERFORM set_config('role', 'anon', true);
  BEGIN PERFORM public.mes_notifications(); refus := 'anon-ACCEPTE';
    EXCEPTION WHEN others THEN refus := 'anon refusé'; END;

  RAISE EXCEPTION 'BILAN saluts=% mentions=% non_lues=+% premiere=% deuxieme=% lues=% reste=% %',
    saluts, mentions, apres - avant, (liste->0)::text, (liste->1->>'type'), lues, reste, refus;
END $test$;
ROLLBACK;
