-- 388 : les photos d'un lieu. Annulé.
BEGIN;
\ir ../../migrations/388_photos_d_un_lieu.sql
DO $test$
DECLARE
  b text := '10e4c7d5-7f09-4bdf-8a47-c44db83a196f';
  avec_ajouts text := '_9lNzWtTW';
  lieu text := '_3PgKU39l';                              -- découvert par b
  inconnu text := 'fb93a952-c2f8-45c6-8c65-728b52335674'; -- pas découvert par b
  dossier text := 'https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/place-images/places/';
  de_la_pose int; ajoutees int; sur_la_fiche int; avant int; apres int; sur_modifier int;
  refus text[] := '{}';
BEGIN
  SELECT jsonb_array_length(COALESCE(images, '[]')) INTO de_la_pose FROM places WHERE id = avec_ajouts;
  SELECT COALESCE(sum(jsonb_array_length(images)), 0) INTO ajoutees FROM place_contributions WHERE place_id = avec_ajouts AND type = 'photo';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  sur_la_fiche := json_array_length(public.fiche_lieu(avec_ajouts)->'photos');

  INSERT INTO storage.objects (bucket_id, name) VALUES ('place-images', 'places/' || b || '/n1.webp');
  avant := json_array_length(public._photos_du_lieu(lieu));
  PERFORM public.ajouter_photos_lieu(lieu, jsonb_build_array(jsonb_build_object('url', dossier || b || '/n1.webp')));
  apres := json_array_length(public._photos_du_lieu(lieu));
  sur_modifier := json_array_length(public.lieu_a_modifier(lieu)->'photos');

  BEGIN PERFORM public.ajouter_photos_lieu(lieu, jsonb_build_array(jsonb_build_object('url', dossier || 'autre/n1.webp')));
    refus := refus || 'autre-dossier-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ajouter_photos_lieu(lieu, jsonb_build_array(jsonb_build_object('url', dossier || b || '/absente.webp')));
    refus := refus || 'absente-ACCEPTEE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ajouter_photos_lieu(inconnu, jsonb_build_array(jsonb_build_object('url', dossier || b || '/n1.webp')));
    refus := refus || 'inconnu-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;

  RAISE EXCEPTION 'BILAN pose=% ajoutees=% fiche=% | avant=% apres=% modifier=% | refus=%',
    de_la_pose, ajoutees, sur_la_fiche, avant, apres, sur_modifier, array_to_string(refus, ' | ');
END $test$;
ROLLBACK;
