-- 354 : le profil public d'un Porteur, vu par un autre et par lui-même. Transaction annulée.
-- Joue 349-353 d'abord : la lecture s'appuie sur places.departement et users.show_envies.
BEGIN;
\ir ../../migrations/349_postgis_geo_reference.sql
\ir ../../migrations/350_geo_reference_donnees.sql
\ir ../../migrations/351_places_departement_pays.sql
\ir ../../migrations/352_envies_sortent_a_la_visite.sql
\ir ../../migrations/353_preferences_et_titres_v2.sql
\ir ../../migrations/354_get_porteur_profile.sql
DO $test$
DECLARE
  a text := '10e4c7d5-7f09-4bdf-8a47-c44db83a196f';
  b text := 'd22c0729-67eb-45eb-9dab-2e6c1d19b331';
  triple text; masque text;
  inconnu json; vu_par_a json; vu_par_b json;
  triple_ajoute boolean; triple_visite boolean; triple_envie boolean;
  masque_pour_a boolean; masque_pour_b boolean; cles_interdites int;
BEGIN
  -- Un lieu ajouté par B, visité puis désiré par B ; un lieu masqué visité par B.
  SELECT id INTO triple FROM places WHERE masked IS NOT TRUE AND private IS NOT TRUE ORDER BY id LIMIT 1;
  SELECT id INTO masque FROM places WHERE id <> triple ORDER BY id DESC LIMIT 1;
  UPDATE places SET author_id = b WHERE id = triple;
  UPDATE places SET masked = true WHERE id = masque;
  DELETE FROM place_explorers WHERE user_id = b AND place_id IN (triple, masque);
  DELETE FROM place_wishlist WHERE user_id = b AND place_id = triple;
  INSERT INTO place_explorers (user_id, place_id, visited_at) VALUES (b, triple, now()), (b, masque, now());
  INSERT INTO place_wishlist (user_id, place_id) VALUES (b, triple);
  UPDATE users SET show_envies = false WHERE id = b;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  inconnu := public.get_porteur_profile('inexistant');
  vu_par_a := public.get_porteur_profile(b);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  vu_par_b := public.get_porteur_profile(b);

  SELECT EXISTS (SELECT 1 FROM json_array_elements(vu_par_b->'ajoutes') x WHERE x->>'id' = triple) INTO triple_ajoute;
  SELECT EXISTS (SELECT 1 FROM json_array_elements(vu_par_b->'visites') x WHERE x->>'id' = triple) INTO triple_visite;
  SELECT EXISTS (SELECT 1 FROM json_array_elements(vu_par_b->'envies') x WHERE x->>'id' = triple) INTO triple_envie;
  SELECT EXISTS (SELECT 1 FROM json_array_elements(vu_par_a->'visites') x WHERE x->>'id' = masque) INTO masque_pour_a;
  SELECT EXISTS (SELECT 1 FROM json_array_elements(vu_par_b->'visites') x WHERE x->>'id' = masque) INTO masque_pour_b;
  SELECT count(*) INTO cles_interdites FROM json_object_keys(vu_par_a) k
   WHERE k IN ('email', 'email_address', 'latitude', 'longitude', 'position');

  RAISE EXCEPTION 'BILAN inconnu=% envies_vues_par_a=% envies_vues_par_b_tableau=% triple(ajoute,visite,envie)=%,%,% masque(a,b)=%,% cles_interdites=% estMoi(a,b)=%,% attache=% niveau=% verifie=%',
    inconnu, vu_par_a->'envies', json_typeof(vu_par_b->'envies'), triple_ajoute, triple_visite, triple_envie,
    masque_pour_a, masque_pour_b, cles_interdites, vu_par_a->>'estMoi', vu_par_b->>'estMoi',
    vu_par_a->>'attache', vu_par_a->>'niveau', vu_par_a->>'porteurVerifie';
END $test$;
ROLLBACK;
