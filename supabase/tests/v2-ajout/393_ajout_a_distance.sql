-- 393 : l'ajout à distance rouvert ; sur place, visite et revendication ; la mention sur la fiche. Annulé.
BEGIN;
\ir ../../migrations/393_ajout_a_distance.sql
DO $test$
DECLARE
  a text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  photo jsonb;
  loin json; ici json; fiche_loin json; fiche_ici json; ancienne json;
  visite_loin int; visite_ici int; veille_loin int; veilleur_ici text; decouverte_loin text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  photo := jsonb_build_array(jsonb_build_object(
    'url', 'https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/place-images/places/' || a || '/p1.webp',
    'thumb', 'https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/place-images/places/' || a || '/p1_thumb.webp'));
  INSERT INTO storage.objects (bucket_id, name) VALUES
    ('place-images', 'places/' || a || '/p1.webp'), ('place-images', 'places/' || a || '/p1_thumb.webp');

  -- À distance (le téléphone à Paris, le lieu dans les Alpes) : accepté, sans visite ni revendication.
  loin := public.ajouter_lieu('Tour lointaine', 44.0, 7.2, ARRAY['3fQyu5KCU'], 'Une tour.', '', photo,
    p_ma_latitude => 48.85, p_ma_longitude => 2.35);
  SELECT count(*) INTO visite_loin FROM place_explorers WHERE place_id = loin->>'id';
  SELECT count(*) INTO veille_loin FROM place_veille WHERE place_id = loin->>'id';
  SELECT method INTO decouverte_loin FROM places_discovered WHERE place_id = loin->>'id' AND user_id = a;
  fiche_loin := public.fiche_lieu(loin->>'id');

  -- Sur place (à ~10 m) : la visite, et le lieu à son nom.
  ici := public.ajouter_lieu('Chapelle proche', 44.001, 7.201, ARRAY['_cjvj91BX'], 'Une chapelle.', '', photo,
    p_ma_latitude => 44.00108, p_ma_longitude => 7.20105);
  SELECT count(*) INTO visite_ici FROM place_explorers WHERE place_id = ici->>'id' AND user_id = a;
  SELECT veilleur_user_id INTO veilleur_ici FROM place_veille WHERE place_id = ici->>'id';
  fiche_ici := public.fiche_lieu(ici->>'id');

  -- Un lieu d'avant le journal (sans ligne new_place) : on ne dit rien.
  ancienne := public.fiche_lieu((SELECT id FROM places WHERE created_at < '2026-02-01' AND masked IS NOT TRUE LIMIT 1));

  RAISE EXCEPTION 'BILAN loin: surPlace=% visites=% veille=% decouverte=% mention=% | ici: surPlace=% visite=% veilleur_est_moi=% mention=% pilule=% | ancien lieu: mention=%',
    loin->>'surPlace', visite_loin, veille_loin, decouverte_loin, fiche_loin->>'ajoutADistance',
    ici->>'surPlace', visite_ici, veilleur_ici = a, fiche_ici->>'ajoutADistance', fiche_ici->'revendication'->>'nom',
    ancienne->>'ajoutADistance';
END $test$;
ROLLBACK;
