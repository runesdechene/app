-- WHY: Uriel, 30/09 : « Réactive l'ajout de lieu à distance. Seule une personne qui a mis le lieu
--      en GPS sera indiquée comme ayant foulé le lieu et l'ayant revendiqué par défaut. À distance,
--      la mention « ajout à distance » sur le lieu, moins forte qu'un ajout en physique. »
--      1. ajouter_lieu : le refus « sur place seulement » (383) est retiré ; sur place, le lieu est
--         aussi revendiqué par son auteur (revendiquer_lieu, 366, seul) ; la présence qu'il exige
--         est la position du téléphone, déjà vérifiée à 200 m.
--      2. fiche_lieu : 'ajoutADistance', lu dans activity_log (isGps = false), que la V1 et la V2
--         écrivent depuis le 08/04/2026 — pas de colonne à tenir à jour de deux côtés.
--      3. Un index sur activity_log pour cette lecture (150 000 lignes, aucun index).
-- SCHEMA CHECKED (30/09/2026) : définitions live via pg_get_functiondef (ajouter_lieu = 383,
--      fiche_lieu = 388) ; activity_log(type, place_id, data jsonb) ; presences(user_id pk,
--      latitude, longitude, vu_a) ; revendiquer_lieu(text, text[], text) (366) exige une visite
--      de moins de 30 min et d'être présent — les deux posés juste avant.

CREATE INDEX IF NOT EXISTS activity_log_nouveau_lieu_idx
  ON public.activity_log (place_id) WHERE type = 'new_place';

CREATE OR REPLACE FUNCTION public.ajouter_lieu(p_nom text, p_latitude double precision, p_longitude double precision, p_natures text[], p_recit text, p_adresse text, p_images jsonb, p_epoque text DEFAULT NULL::text, p_annee integer DEFAULT NULL::integer, p_ma_latitude double precision DEFAULT NULL::double precision, p_ma_longitude double precision DEFAULT NULL::double precision)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_id text := gen_random_uuid()::text;
  v_nom text := btrim(p_nom);
  v_recit text := btrim(p_recit);
  v_dossier text;
  v_fichier text;
  v_nom_fichier text;
  v_images jsonb := '[]'::jsonb;
  v_image jsonb;
  v_sur_place boolean := false;
  v_xp_avant int;
  v_xp_apres int;
  v_niveau int;
  v_seuil int;
  v_suivant int;
  v_i int;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF public._require_min_discoveries(v_moi, 3) IS NOT NULL THEN
    RAISE EXCEPTION 'Trois découvertes d’abord' USING ERRCODE = 'P0001', HINT = 'decouvertes';
  END IF;
  IF (SELECT count(*) FROM places WHERE author_id = v_moi AND created_at > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'Vingt lieux aujourd’hui : reviens demain' USING ERRCODE = 'P0001', HINT = 'limite';
  END IF;
  IF v_nom IS NULL OR char_length(v_nom) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Un nom, de 1 à 120 signes' USING ERRCODE = '22023';
  END IF;
  IF v_recit IS NULL OR char_length(v_recit) NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'Un récit, de 1 à 5000 signes' USING ERRCODE = '22023';
  END IF;
  IF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Position impossible' USING ERRCODE = '22023';
  END IF;
  IF coalesce(cardinality(p_natures), 0) NOT BETWEEN 1 AND 3
     OR (SELECT count(DISTINCT n) FROM unnest(p_natures) n) <> cardinality(p_natures)
     OR (SELECT count(*) FROM tags WHERE id = ANY (p_natures)) <> cardinality(p_natures) THEN
    RAISE EXCEPTION 'De une à trois natures, connues' USING ERRCODE = '22023';
  END IF;
  IF p_epoque IS NOT NULL AND NOT EXISTS (SELECT 1 FROM eras WHERE id = p_epoque) THEN
    RAISE EXCEPTION 'Époque inconnue' USING ERRCODE = '22023';
  END IF;
  IF p_annee IS NOT NULL AND p_annee NOT BETWEEN -10000 AND 2100 THEN
    RAISE EXCEPTION 'Année impossible' USING ERRCODE = '22023';
  END IF;
  IF char_length(coalesce(p_adresse, '')) > 300 THEN
    RAISE EXCEPTION 'Adresse trop longue' USING ERRCODE = '22023';
  END IF;
  -- Les photos : une à dix, toutes dans le dossier du compte (place-images/places/<moi>/).
  IF p_images IS NULL OR jsonb_typeof(p_images) <> 'array' OR jsonb_array_length(p_images) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'De une à dix photos' USING ERRCODE = '22023';
  END IF;
  v_dossier := 'https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/place-images/places/'
               || v_moi || '/';
  FOR v_image IN SELECT * FROM jsonb_array_elements(p_images) LOOP
    v_fichier := substr(coalesce(v_image->>'url', ''), length(v_dossier) + 1);
    IF left(coalesce(v_image->>'url', ''), length(v_dossier)) <> v_dossier
       OR v_fichier !~ '^[A-Za-z0-9-]+\.webp$'
       OR coalesce(v_image->>'thumb', '') <> v_dossier || replace(v_fichier, '.webp', '_thumb.webp') THEN
      RAISE EXCEPTION 'Photo hors de ton dossier' USING ERRCODE = '22023';
    END IF;
    -- La photo et sa vignette doivent exister : on ne pose pas un lieu sur une image rêvée.
    v_nom_fichier := 'places/' || v_moi || '/' || v_fichier;
    IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'place-images' AND o.name = v_nom_fichier)
       OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'place-images'
                        AND o.name = replace(v_nom_fichier, '.webp', '_thumb.webp')) THEN
      RAISE EXCEPTION 'Photo introuvable' USING ERRCODE = '22023';
    END IF;
    -- Seuls les champs vérifiés entrent dans la fiche ; l'identifiant est le nom du fichier.
    v_images := v_images || jsonb_build_array(jsonb_build_object(
      'id', replace(v_fichier, '.webp', ''),
      'url', v_image->>'url',
      'thumb', v_image->>'thumb'));
  END LOOP;

  IF p_ma_latitude IS NOT NULL AND p_ma_longitude IS NOT NULL THEN
    v_sur_place := public._distance_m(p_ma_latitude, p_ma_longitude, p_latitude, p_longitude) <= 200;
  END IF;

  SELECT COALESCE(xp_total, 0) INTO v_xp_avant FROM users WHERE id = v_moi;

  INSERT INTO places (id, created_at, updated_at, author_id, place_type_id, title, text, address,
                      latitude, longitude, images, private, masked, era_id, year_exact)
  VALUES (v_id, now(), now(), v_moi, 'lieu', v_nom, v_recit, coalesce(btrim(p_adresse), ''),
          p_latitude, p_longitude, v_images, false, false, p_epoque, p_annee);

  -- La première nature est la principale : elle donne sa couleur au lieu.
  FOR v_i IN 1 .. cardinality(p_natures) LOOP
    INSERT INTO place_tags (place_id, tag_id, is_primary) VALUES (v_id, p_natures[v_i], v_i = 1);
  END LOOP;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (v_moi, v_id, CASE WHEN v_sur_place THEN 'gps' ELSE 'author' END)
  ON CONFLICT (user_id, place_id) DO NOTHING;
  -- Sur place : il a foulé le lieu, et le lieu est à son nom (revendiqué seul, comme après une
  -- visite : même écriture que revendiquer_lieu, 365). À distance : ni visite ni revendication.
  IF v_sur_place THEN
    INSERT INTO place_explorers (place_id, user_id, visited_at) VALUES (v_id, v_moi, now())
    ON CONFLICT (place_id, user_id) DO NOTHING;
    -- Revendiquer exige d'être présent (366) : sa position est celle du téléphone, à 200 m au plus.
    INSERT INTO presences (user_id, latitude, longitude, vu_a)
    VALUES (v_moi, p_ma_latitude, p_ma_longitude, now())
    ON CONFLICT (user_id) DO UPDATE
      SET latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, vu_a = now();
    PERFORM public.revendiquer_lieu(v_id, '{}'::text[], NULL);
  END IF;

  -- Le récit ouvre l'historique du lieu (modifier un lieu, ouvert à tous, le prolongera).
  INSERT INTO place_description_revisions (place_id, content, edited_by, created_at)
  VALUES (v_id, v_recit, v_moi, now());
  INSERT INTO place_contributions (place_id, user_id, type, content, created_at, updated_at)
  VALUES (v_id, v_moi, 'description', v_recit, now(), now());

  -- Le fil d'activité de la V1 continue de voir les nouveaux lieux.
  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES ('new_place', v_moi, v_id, jsonb_build_object(
    'placeTitle', v_nom, 'placeLatitude', p_latitude, 'placeLongitude', p_longitude,
    'actorName', (SELECT user_public_name(u.id, u.display_name, u.first_name) FROM users u WHERE u.id = v_moi),
    'isGps', v_sur_place, 'fromV2', true));

  SELECT COALESCE(xp_total, 0) INTO v_xp_apres FROM users WHERE id = v_moi;
  v_niveau := public._level_from_xp(v_xp_apres);
  v_seuil := public._xp_for_level(v_niveau);
  v_suivant := public._xp_for_level(v_niveau + 1);
  RETURN json_build_object(
    'id', v_id,
    'rang', (SELECT count(*) FROM places p WHERE p.author_id = v_moi),
    'surPlace', v_sur_place,
    'gain', v_xp_apres - v_xp_avant,
    'niveau', v_niveau,
    'avant', CASE WHEN public._level_from_xp(v_xp_avant) < v_niveau THEN 0
                  ELSE round((v_xp_avant - v_seuil)::numeric / greatest(1, v_suivant - v_seuil), 3) END,
    'apres', round((v_xp_apres - v_seuil)::numeric / greatest(1, v_suivant - v_seuil), 3));
END;
$function$;

CREATE OR REPLACE FUNCTION public.fiche_lieu(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id)
  SELECT json_build_object(
    'id', l.id,
    'slug', l.slug, -- la page publique du lieu (/lieu/<slug>), pour le partage
    'nom', l.title,
    'recit', COALESCE(l.text, ''),
    'adresse', NULLIF(btrim(l.address), ''),
    'lat', l.latitude,
    'lng', l.longitude,
    'nature', l.nature,
    'photos', public._photos_du_lieu(l.id),
    'type', (
      SELECT json_build_object('nom', t.title, 'icone', t.icon, 'couleur', t.color)
      FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
      WHERE pt.place_id = l.id AND pt.is_primary LIMIT 1),
    'faits', json_build_object(
      'epoque', (SELECT e.name FROM eras e WHERE e.id = l.era_id),
      'annee', l.year_exact,
      'saison', NULLIF(btrim(l.best_season), ''),
      'acces', NULLIF(btrim(l.accessibility), ''),
      'bivouac', NULLIF(btrim(l.bivouac), '')),
    'explorateurs', json_build_object(
      'nombre', (SELECT count(*) FROM place_explorers e WHERE e.place_id = l.id),
      'derniers', COALESCE((
        SELECT json_agg(d.x) FROM (
          SELECT json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url) AS x
          FROM place_explorers e JOIN users u ON u.id = e.user_id
          WHERE e.place_id = l.id ORDER BY e.visited_at DESC LIMIT 3) d), '[]'::json)),
    -- La pilule : l'expédition si elle a un nom, sinon le dernier qui l'a revendiqué (comme 363).
    'revendication', (
      SELECT json_build_object(
        'nom', COALESCE(NULLIF(x.title, ''), user_public_name(u.id, u.display_name, u.first_name)),
        'moi', v.veilleur_user_id = moi.id
          OR EXISTS (SELECT 1 FROM expedition_members m WHERE m.expedition_id = v.expedition_id AND m.user_id = moi.id),
        'depuis', v.planted_at)
      FROM place_veille v
      LEFT JOIN expeditions x ON x.id = v.expedition_id
      LEFT JOIN users u ON u.id = v.veilleur_user_id
      WHERE v.place_id = l.id AND l.nature = 'lieu'),
    'auteur', (
      SELECT json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url)
      FROM users u WHERE u.id = l.author_id),
    'ajouteLe', l.created_at,
    -- Ajouté à distance (sans y être) : noté par le journal depuis le 08/04/2026, V1 comme V2.
    -- Avant, on ne sait pas : rien n'est dit.
    'ajoutADistance', EXISTS (
      SELECT 1 FROM activity_log a
      WHERE a.type = 'new_place' AND a.place_id = l.id AND a.data->>'isGps' = 'false'),
    'enrichiPar', (
      SELECT json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name))
      FROM place_description_revisions r JOIN users u ON u.id = r.edited_by
      WHERE r.place_id = l.id AND r.edited_by IS DISTINCT FROM l.author_id
      ORDER BY r.created_at DESC LIMIT 1),
    'moi', json_build_object(
      'visiteLe', (SELECT e.visited_at FROM place_explorers e WHERE e.place_id = l.id AND e.user_id = moi.id),
      'envie', EXISTS (SELECT 1 FROM place_wishlist w WHERE w.place_id = l.id AND w.user_id = moi.id),
      -- Découvert : ajouté, visité ou découvert à distance (la même règle que carte_lieux, 363).
      'decouvert', l.author_id = moi.id
        OR EXISTS (SELECT 1 FROM place_explorers e WHERE e.place_id = l.id AND e.user_id = moi.id)
        OR EXISTS (SELECT 1 FROM places_discovered d WHERE d.place_id = l.id AND d.user_id = moi.id)))
  FROM places l CROSS JOIN moi
  WHERE l.id = p_id AND public._lieu_visible(p_id);
$function$;
