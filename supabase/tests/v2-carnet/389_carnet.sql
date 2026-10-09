-- 389 : le Carnet de passage. Annulé.
BEGIN;
\ir ../../migrations/389_carnet_de_passage.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';   -- admin (équipe)
  b text := '10e4c7d5-7f09-4bdf-8a47-c44db83a196f';   -- un Explorateur sans rôle
  lieu text := '_3PgKU39l';
  inconnu text := 'fb93a952-c2f8-45c6-8c65-728b52335674';
  dossier text := 'https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/place-images/places/';
  repris int; m1 int; r1 int; r2 int; parent_r2 int; carnet json; reponses int; notif_reponse int; notif_coeur int;
  coeur json; photos int; reste int;
  refus text[] := '{}';
BEGIN
  SELECT count(*) INTO repris FROM coeurs_mot;
  INSERT INTO storage.objects (bucket_id, name) VALUES ('place-images', 'places/' || b || '/c1.webp');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  m1 := (public.ecrire_au_carnet(lieu, 'Le chemin est glissant après la pluie.')->>'id')::int;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  r1 := (public.ecrire_au_carnet(lieu, 'Merci !', jsonb_build_array(jsonb_build_object('url', dossier || b || '/c1.webp')), m1)->>'id')::int;
  r2 := (public.ecrire_au_carnet(lieu, 'Et la vue vaut le détour.', '[]'::jsonb, r1)->>'id')::int;
  SELECT parent_id INTO parent_r2 FROM place_contributions WHERE id = r2;
  PERFORM public.aimer_mot(m1); PERFORM public.aimer_mot(m1); coeur := public.aimer_mot(m1);
  SELECT count(*) INTO notif_reponse FROM notifications WHERE recipient_id = a AND type = 'comment_reply' AND data->>'actorId' = b AND data->>'placeId' = lieu;
  SELECT count(*) INTO notif_coeur FROM notifications WHERE recipient_id = a AND type = 'coeur_mot' AND data->>'actorId' = b;
  carnet := public.carnet_du_lieu(lieu, 3);
  reponses := json_array_length(carnet->'mots'->0->'reponses');
  photos := json_array_length(carnet->'mots'->0->'reponses'->0->'photos');

  BEGIN PERFORM public.aimer_mot(r1); refus := refus || 'coeur-a-soi-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.effacer_mot(m1); refus := refus || 'effacer-autrui-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ecrire_au_carnet(inconnu, 'Coucou'); refus := refus || 'inconnu-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ecrire_au_carnet(lieu, 'X', jsonb_build_array(jsonb_build_object('url', dossier || 'autre/c1.webp')));
    refus := refus || 'photo-autrui-ACCEPTEE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ecrire_au_carnet(lieu, '   '); refus := refus || 'vide-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  PERFORM set_config('storage.allow_delete_query', 'true', true);
  PERFORM public.effacer_mot(m1);
  SELECT count(*) INTO reste FROM place_contributions WHERE id IN (m1, r1, r2);

  RAISE EXCEPTION 'BILAN repris=% parent_r2=m1:% reponses=% photos=% coeur=% notif_reponse=% notif_coeur=% venu_m1=% reste=% | refus=%',
    repris, parent_r2 = m1, reponses, photos, coeur::text, notif_reponse, notif_coeur,
    carnet->'mots'->0->>'venu', reste, array_to_string(refus, ' | ');
END $test$;
ROLLBACK;
