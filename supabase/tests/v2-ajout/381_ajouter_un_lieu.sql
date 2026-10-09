-- 381 + 382 + 383 : ajouter un lieu, sur place seulement. Annulé.
BEGIN;
-- 381 et 382 sont en prod ; la 383 s'essaie par-dessus.
\ir ../../migrations/383_ajouter_sur_place_seulement.sql
\ir ../../migrations/383_ajouter_sur_place_seulement.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  photo jsonb;
  images_gardees jsonb;
  distant json; sur_place json; natures json; epoques json; voisins json;
  tags_ok int; principal text; revision int; explorateur int; decouverte text;
  refus text[] := '{}';
  msg text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  photo := jsonb_build_array(jsonb_build_object(
    'id', 'p1',
    'url', 'https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/place-images/places/' || a || '/p1.webp',
    'thumb', 'https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/place-images/places/' || a || '/p1_thumb.webp'));
  -- Les fichiers existent dans le stockage (sinon la base refuse la photo).
  INSERT INTO storage.objects (bucket_id, name) VALUES
    ('place-images', 'places/' || a || '/p1.webp'), ('place-images', 'places/' || a || '/p1_thumb.webp');
  -- Une clé en trop dans la photo : elle ne doit pas entrer dans la fiche.
  photo := jsonb_set(photo, '{0,piege}', '"x"');
  natures := public.natures_de_lieu();
  epoques := public.epoques();

  -- Sur place (à ~7 m) : le lieu, deux natures (la première principale), la visite.
  distant := public.ajouter_lieu('  Tour de Test  ', 44.0, 7.2, ARRAY['3fQyu5KCU', 'DwlWijqgg'],
    'Une tour carrée.', 'Colomars', photo, p_epoque => 'late-middle-ages', p_annee => 1142,
    p_ma_latitude => 44.00005, p_ma_longitude => 7.20005);
  SELECT count(*) INTO tags_ok FROM place_tags WHERE place_id = distant->>'id';
  SELECT tag_id INTO principal FROM place_tags WHERE place_id = distant->>'id' AND is_primary;
  SELECT count(*) INTO revision FROM place_description_revisions WHERE place_id = distant->>'id';
  SELECT method INTO decouverte FROM places_discovered WHERE place_id = distant->>'id' AND user_id = a;
  SELECT images INTO images_gardees FROM places WHERE id = distant->>'id';

  -- Sur place (à ~10 m) : la visite compte, +3 d'expérience de plus.
  sur_place := public.ajouter_lieu('Chapelle de Test', 44.001, 7.201, ARRAY['_cjvj91BX'],
    'Une chapelle.', '', photo, p_ma_latitude => 44.00108, p_ma_longitude => 7.20105);
  SELECT count(*) INTO explorateur FROM place_explorers WHERE place_id = sur_place->>'id' AND user_id = a;
  voisins := public.lieux_voisins(44.0001, 7.2001);

  -- Ce qui doit être refusé. D'abord : à distance, ou sans position (383).
  BEGIN PERFORM public.ajouter_lieu('Loin', 44, 7, ARRAY['3fQyu5KCU'], 'R', '', photo,
    p_ma_latitude => 48.0, p_ma_longitude => 2.0);
    refus := refus || 'distance-ACCEPTEE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ajouter_lieu('Sans position', 44, 7, ARRAY['3fQyu5KCU'], 'R', '', photo);
    refus := refus || 'sans-position-ACCEPTEE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ajouter_lieu('X', 44, 7, ARRAY['3fQyu5KCU'], 'R', '',
    jsonb_build_array(jsonb_build_object('url', 'https://ailleurs.com/a.webp', 'thumb', 'https://ailleurs.com/a.webp')));
    refus := refus || 'photo-exterieure-ACCEPTEE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  -- Le même chemin, sur un autre site : refusé (revue de sécurité du 29/09).
  BEGIN PERFORM public.ajouter_lieu('X', 44, 7, ARRAY['3fQyu5KCU'], 'R', '',
    jsonb_build_array(jsonb_build_object(
      'url', 'https://ailleurs.com/storage/v1/object/public/place-images/places/' || a || '/p1.webp',
      'thumb', 'https://ailleurs.com/storage/v1/object/public/place-images/places/' || a || '/p1_thumb.webp')));
    refus := refus || 'meme-chemin-autre-site-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ajouter_lieu('X', 44, 7, ARRAY['3fQyu5KCU','DwlWijqgg','_cjvj91BX','musees'], 'R', '', photo);
    refus := refus || 'quatre-natures-ACCEPTEES'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ajouter_lieu('   ', 44, 7, ARRAY['3fQyu5KCU'], 'R', '', photo);
    refus := refus || 'nom-vide-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ajouter_lieu('X', 44, 7, ARRAY['nimporte'], 'R', '', photo);
    refus := refus || 'nature-inconnue-ACCEPTEE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ajouter_lieu('X', 44, 7, ARRAY['3fQyu5KCU'], '', '', photo);
    refus := refus || 'recit-vide-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ajouter_lieu('X', 44, 7, ARRAY['3fQyu5KCU'], 'R', '', '[]'::jsonb);
    refus := refus || 'sans-photo-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ajouter_lieu('X', NULL, 7, ARRAY['3fQyu5KCU'], 'R', '', photo);
    refus := refus || 'latitude-nulle-ACCEPTEE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ajouter_lieu('X', 44, 7, ARRAY['3fQyu5KCU'], 'R', '', NULL);
    refus := refus || 'photos-nulles-ACCEPTEES'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ajouter_lieu('X', 44, 7, ARRAY['3fQyu5KCU'], 'R', '',
    jsonb_build_array(jsonb_build_object(
      'url', 'https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/place-images/places/' || a || '/absente.webp',
      'thumb', 'https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/place-images/places/' || a || '/absente_thumb.webp')));
    refus := refus || 'photo-absente-ACCEPTEE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  PERFORM set_config('role', 'anon', true);
  BEGIN PERFORM public.ajouter_lieu('X', 44, 7, ARRAY['3fQyu5KCU'], 'R', '', photo);
    refus := refus || 'anon-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || 'anon refusé'::text; END;

  RAISE EXCEPTION 'BILAN images=% natures=% epoques=% distant=% nom=% tags=%/% principal=% revision=% decouverte=% sur_place=% explorateur=% voisins=% refus=%',
    images_gardees::text, json_array_length(natures), json_array_length(epoques),
    distant::text, (SELECT title FROM places WHERE id = distant->>'id'), tags_ok, 2, principal, revision, decouverte,
    sur_place::text, explorateur, json_array_length(voisins), array_to_string(refus, ' | ');
END $test$;
ROLLBACK;
