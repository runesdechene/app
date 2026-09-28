-- 381 : ajouter un lieu. Annulé.
BEGIN;
\ir ../../migrations/381_ajouter_un_lieu.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  photo jsonb;
  distant json; sur_place json; natures json; epoques json; voisins json;
  tags_ok int; principal text; revision int; explorateur int; decouverte text;
  refus text[] := '{}';
  msg text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  photo := jsonb_build_array(jsonb_build_object(
    'id', 'p1',
    'url', 'https://x.supabase.co/storage/v1/object/public/place-images/places/' || a || '/p1.webp',
    'thumb', 'https://x.supabase.co/storage/v1/object/public/place-images/places/' || a || '/p1_thumb.webp'));
  natures := public.natures_de_lieu();
  epoques := public.epoques();

  -- À distance : le lieu, deux natures (la première principale), la découverte « author ».
  distant := public.ajouter_lieu('  Tour de Test  ', 44.0, 7.2, ARRAY['3fQyu5KCU', 'DwlWijqgg'],
    'late-middle-ages', 1142, 'Une tour carrée.', 'Colomars', photo, 48.0, 2.0);
  SELECT count(*) INTO tags_ok FROM place_tags WHERE place_id = distant->>'id';
  SELECT tag_id INTO principal FROM place_tags WHERE place_id = distant->>'id' AND is_primary;
  SELECT count(*) INTO revision FROM place_description_revisions WHERE place_id = distant->>'id';
  SELECT method INTO decouverte FROM places_discovered WHERE place_id = distant->>'id' AND user_id = a;

  -- Sur place (à ~10 m) : la visite compte, +3 d'expérience de plus.
  sur_place := public.ajouter_lieu('Chapelle de Test', 44.001, 7.201, ARRAY['_cjvj91BX'],
    NULL, NULL, 'Une chapelle.', '', photo, 44.00108, 7.20105);
  SELECT count(*) INTO explorateur FROM place_explorers WHERE place_id = sur_place->>'id' AND user_id = a;
  voisins := public.lieux_voisins(44.0001, 7.2001);

  -- Ce qui doit être refusé.
  BEGIN PERFORM public.ajouter_lieu('X', 44, 7, ARRAY['3fQyu5KCU'], NULL, NULL, 'R', '',
    jsonb_build_array(jsonb_build_object('url', 'https://ailleurs.com/a.webp', 'thumb', 'https://ailleurs.com/a.webp')));
    refus := refus || 'photo-exterieure-ACCEPTEE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ajouter_lieu('X', 44, 7, ARRAY['3fQyu5KCU','DwlWijqgg','_cjvj91BX','musees'], NULL, NULL, 'R', '', photo);
    refus := refus || 'quatre-natures-ACCEPTEES'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ajouter_lieu('   ', 44, 7, ARRAY['3fQyu5KCU'], NULL, NULL, 'R', '', photo);
    refus := refus || 'nom-vide-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ajouter_lieu('X', 44, 7, ARRAY['nimporte'], NULL, NULL, 'R', '', photo);
    refus := refus || 'nature-inconnue-ACCEPTEE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ajouter_lieu('X', 44, 7, ARRAY['3fQyu5KCU'], NULL, NULL, '', '', photo);
    refus := refus || 'recit-vide-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  BEGIN PERFORM public.ajouter_lieu('X', 44, 7, ARRAY['3fQyu5KCU'], NULL, NULL, 'R', '', '[]'::jsonb);
    refus := refus || 'sans-photo-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || SQLERRM; END;
  PERFORM set_config('role', 'anon', true);
  BEGIN PERFORM public.ajouter_lieu('X', 44, 7, ARRAY['3fQyu5KCU'], NULL, NULL, 'R', '', photo);
    refus := refus || 'anon-ACCEPTE'::text; EXCEPTION WHEN others THEN refus := refus || 'anon refusé'::text; END;

  RAISE EXCEPTION 'BILAN natures=% epoques=% distant=% nom=% tags=%/% principal=% revision=% decouverte=% sur_place=% explorateur=% voisins=% refus=%',
    json_array_length(natures), json_array_length(epoques),
    distant::text, (SELECT title FROM places WHERE id = distant->>'id'), tags_ok, 2, principal, revision, decouverte,
    sur_place::text, explorateur, json_array_length(voisins), array_to_string(refus, ' | ');
END $test$;
ROLLBACK;
