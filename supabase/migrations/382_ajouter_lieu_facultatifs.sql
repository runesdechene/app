-- WHY: ajouter_lieu (381) prenait l'époque et l'année au milieu de ses paramètres, sans valeur par
--      défaut : les types générés (gen:types) les exigent alors non nulles, alors que « je ne sais
--      pas » est un choix valable. On les range à la fin, avec NULL par défaut : l'app les omet
--      simplement quand ils manquent. Le corps est la définition live de la 381, copiée entière ;
--      seule la signature change. Appelée par la seule V2 (Ajouter un lieu), par paramètres nommés.
-- SCHEMA CHECKED (30/09/2026) : définition live via pg_get_functiondef, identique à la 381.

-- DROP vérifié à la main le 30/09 : la fonction a été créée par la 381 le même jour, rien d'autre
-- que la V2 ne l'appelle (Graphify, grep du dépôt et du thème Shopify).
DROP FUNCTION public.ajouter_lieu(text, double precision, double precision, text[], text, integer, text, text, jsonb, double precision, double precision);

CREATE FUNCTION public.ajouter_lieu(
  p_nom text,
  p_latitude double precision,
  p_longitude double precision,
  p_natures text[],
  p_recit text,
  p_adresse text,
  p_images jsonb,
  p_epoque text DEFAULT NULL,
  p_annee integer DEFAULT NULL,
  p_ma_latitude double precision DEFAULT NULL,
  p_ma_longitude double precision DEFAULT NULL
)
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
  IF v_sur_place THEN
    INSERT INTO place_explorers (place_id, user_id, visited_at) VALUES (v_id, v_moi, now())
    ON CONFLICT (place_id, user_id) DO NOTHING;
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

REVOKE ALL ON FUNCTION public.ajouter_lieu(text, double precision, double precision, text[], text, text, jsonb, text, integer, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajouter_lieu(text, double precision, double precision, text[], text, text, jsonb, text, integer, double precision, double precision) TO authenticated;
