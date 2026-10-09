-- 387 : modifier, l'histoire, signaler. Annulé.
BEGIN;
\ir ../../migrations/386_notifications_v2.sql
\ir ../../migrations/387_faire_vivre_un_lieu.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';   -- admin
  b text := '10e4c7d5-7f09-4bdf-8a47-c44db83a196f';   -- un Explorateur sans rôle
  lieu text := '_3PgKU39l';                            -- découvert par b, ajouté par un autre
  inconnu text := 'fb93a952-c2f8-45c6-8c65-728b52335674'; -- pas découvert par b
  auteur text; etat record; histoire json; origine bigint; nom_origine text; apres_retour text;
  versions int; notifs int; ouverts int; file json; traite json;
  refus text[] := '{}';
BEGIN
  SELECT author_id INTO auteur FROM places WHERE id = lieu;
  SELECT * INTO etat FROM public._etat_du_lieu(lieu);
  nom_origine := etat.nom;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);

  PERFORM public.modifier_lieu(lieu, etat.nom || ' (corrigé)', etat.natures, etat.recit, etat.epoque, etat.annee, 'orthographe');
  histoire := public.histoire_du_lieu(lieu);
  SELECT id INTO origine FROM versions_lieu WHERE place_id = lieu ORDER BY cree_le, id LIMIT 1;
  PERFORM public.revenir_a_version(origine);
  SELECT title INTO apres_retour FROM places WHERE id = lieu;
  SELECT count(*) INTO versions FROM versions_lieu WHERE place_id = lieu;
  SELECT count(*) INTO notifs FROM notifications WHERE recipient_id = auteur AND type = 'lieu_modifie' AND data->>'placeId' = lieu;

  BEGIN PERFORM public.modifier_lieu(lieu, nom_origine, etat.natures, etat.recit, etat.epoque, etat.annee);
    refus := refus || 'rien-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.modifier_lieu(inconnu, 'X', etat.natures, 'R');
    refus := refus || 'inconnu-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.modifier_lieu(lieu, 'X', ARRAY['nimporte'], 'R');
    refus := refus || 'nature-ACCEPTEE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;

  PERFORM public.signaler_lieu(lieu, 'doublon', 'le même que le château d’à côté');
  PERFORM public.signaler_lieu(lieu, 'n_existe_pas');
  SELECT count(*) INTO ouverts FROM signalements_lieu WHERE place_id = lieu AND user_id = b AND traite_le IS NULL;
  BEGIN PERFORM public.signaler_lieu(lieu, 'parce_que');
    refus := refus || 'raison-ACCEPTEE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.mod_signalements();
    refus := refus || 'file-ouverte-a-b'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  file := public.mod_signalements();
  traite := public.mod_traiter_signalement((SELECT id FROM signalements_lieu WHERE place_id = lieu AND user_id = b AND traite_le IS NULL));

  RAISE EXCEPTION 'BILAN a_modifier=% histoire=% retour=% (origine=%) versions=% notifs=% ouverts=% file0=% traite=% refus=%',
    left(public.lieu_a_modifier(lieu)::text, 120), histoire::text, apres_retour, nom_origine, versions, notifs, ouverts, (file->0->>'raison'), traite::text,
    array_to_string(refus, ' | ');
END $test$;
ROLLBACK;
