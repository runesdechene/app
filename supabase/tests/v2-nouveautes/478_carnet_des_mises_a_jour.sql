-- 478 : le carnet et les cœurs des mises à jour. Annulé.
BEGIN;
\ir ../../migrations/478_carnet_des_mises_a_jour.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';   -- admin (équipe), auteur de la note
  b text := '10e4c7d5-7f09-4bdf-8a47-c44db83a196f';   -- un Explorateur sans rôle
  dossier text := 'https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/place-images/places/';
  note bigint; m1 bigint; r1 bigint; r2 bigint; parent_r2 bigint;
  carnet json; coeurs json; liste json; ma_note json;
  admins int; notif_admins_m1 int; notif_admins_r1 int; notif_a_r1 int; notif_reponse int;
  notif_coeur_mot int; notif_coeur_note int; coeur_mot json; reste int; reste_note int;
  cloche text;
  refus text[] := '{}';
BEGIN
  SELECT count(*) INTO admins FROM users WHERE role::text = 'admin';
  INSERT INTO mises_a_jour (titre, texte, par) VALUES ('Remonte le temps', 'Un texte.', a) RETURNING id INTO note;
  INSERT INTO storage.objects (bucket_id, name) VALUES ('place-images', 'places/' || b || '/m1.webp');

  -- L'admin écrit : les autres admins sont prévenus, pas lui.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  m1 := (public.ecrire_sous_mise_a_jour(note, 'Dites-nous ce que vous en pensez !')->>'id')::bigint;
  SELECT count(*) INTO notif_admins_m1 FROM notifications
   WHERE type = 'mot_mise_a_jour' AND (data->>'motId')::bigint = m1;

  -- Le joueur répond, avec une photo, puis répond à sa réponse ; il aime la note et le mot.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  r1 := (public.ecrire_sous_mise_a_jour(note, 'Génial, la frise !',
          jsonb_build_array(jsonb_build_object('url', dossier || b || '/m1.webp')), m1)->>'id')::bigint;
  r2 := (public.ecrire_sous_mise_a_jour(note, 'Et la date du jour aussi.', '[]'::jsonb, r1)->>'id')::bigint;
  SELECT parent_id INTO parent_r2 FROM mots_mise_a_jour WHERE id = r2;
  SELECT count(*) INTO notif_admins_r1 FROM notifications
   WHERE type = 'mot_mise_a_jour' AND (data->>'motId')::bigint = r1;
  SELECT count(*) INTO notif_a_r1 FROM notifications
   WHERE recipient_id = a AND (data->>'motId')::bigint = r1;
  SELECT count(*) INTO notif_reponse FROM notifications
   WHERE recipient_id = a AND type = 'reponse_mise_a_jour' AND (data->>'motId')::bigint = r1;
  PERFORM public.aimer_mise_a_jour(note); PERFORM public.aimer_mise_a_jour(note);
  coeurs := public.coeurs_de_mise_a_jour(note);
  SELECT count(*) INTO notif_coeur_note FROM notifications
   WHERE recipient_id = a AND type = 'coeur_mise_a_jour' AND data->>'actorId' = b;
  PERFORM public.basculer_coeur_mot_mise_a_jour(m1); PERFORM public.basculer_coeur_mot_mise_a_jour(m1);
  coeur_mot := public.basculer_coeur_mot_mise_a_jour(m1);
  SELECT count(*) INTO notif_coeur_mot FROM notifications
   WHERE recipient_id = a AND type = 'coeur_mot_mise_a_jour' AND data->>'actorId' = b;
  carnet := public.carnet_de_mise_a_jour(note);
  SELECT j INTO ma_note FROM json_array_elements(public.mises_a_jour_publiees()) j WHERE (j->>'id')::bigint = note;

  BEGIN PERFORM public.basculer_coeur_mot_mise_a_jour(r1); refus := refus || 'coeur-mot-a-soi-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.effacer_mot_mise_a_jour(m1); refus := refus || 'effacer-autrui-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ecrire_sous_mise_a_jour(note, '   '); refus := refus || 'vide-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ecrire_sous_mise_a_jour(note, repeat('x', 2001)); refus := refus || 'long-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ecrire_sous_mise_a_jour(note, 'X', jsonb_build_array(jsonb_build_object('url', dossier || 'autre/m1.webp')));
    refus := refus || 'photo-autrui-ACCEPTEE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;

  -- L'auteur de la note ne s'envoie pas de cœur ; l'équipe efface le mot, ses réponses partent.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  -- La cloche de l'admin : la réponse, avec le titre de la note pour extrait.
  SELECT j->>'extrait' INTO cloche FROM json_array_elements(public.mes_notifications()) j
   WHERE j->>'type' = 'reponse_mise_a_jour' LIMIT 1;
  BEGIN PERFORM public.aimer_mise_a_jour(note); refus := refus || 'coeur-sa-note-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  PERFORM public.effacer_mot_mise_a_jour(m1);
  SELECT count(*) INTO reste FROM mots_mise_a_jour WHERE id IN (m1, r1, r2);

  -- La note effacée emporte ses mots et ses cœurs.
  r1 := (public.ecrire_sous_mise_a_jour(note, 'Un dernier mot.')->>'id')::bigint;
  DELETE FROM mises_a_jour WHERE id = note;
  SELECT (SELECT count(*) FROM mots_mise_a_jour WHERE mise_a_jour_id = note)
       + (SELECT count(*) FROM coeurs_mise_a_jour WHERE mise_a_jour_id = note) INTO reste_note;

  RAISE EXCEPTION 'BILAN admins=% notif_admins_m1=% (attendu admins-1) notif_admins_r1=% (attendu admins-1) notif_a_r1=% (attendu 1) notif_reponse=% parent_r2=m1:% mots=% reponses=% photos=% venu=% coeurs=% notif_coeur_note=% coeur_mot=% notif_coeur_mot=% liste=% cloche=% (attendu Remonte le temps) reste=% reste_note=% | refus=%',
    admins, notif_admins_m1, notif_admins_r1, notif_a_r1, notif_reponse, parent_r2 = m1,
    json_array_length(carnet->'mots'), json_array_length(carnet->'mots'->0->'reponses'),
    json_array_length(carnet->'mots'->0->'reponses'->0->'photos'), carnet->'mots'->0->>'venu',
    coeurs::text, notif_coeur_note, coeur_mot::text, notif_coeur_mot,
    json_build_object('coeurs', ma_note->'coeurs', 'miens', ma_note->'miens', 'mots', ma_note->'mots', 'aMoi', ma_note->'aMoi')::text,
    cloche, reste, reste_note, array_to_string(refus, ' | ');
END $test$;
ROLLBACK;
