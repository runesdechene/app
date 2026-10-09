-- WHY: le pin GPS en V2 (spec 2026-10-06-v2-pin-gps-design.md, Uriel 06/10) : poser sa position en
--      deux appuis, même sans réseau (le pin naît dans le téléphone : son id et sa date en viennent —
--      risque accepté), le retrouver, le compléter. Même table que la V1 (place_drafts) : ses pins
--      ouverts passent tels quels.
--   poser_pin : rejouable (même id → rien de plus) ; refuse une précision > 200 m et une date dans
--      le futur (5 min de tolérance d'horloge). mes_pins : mes pins ouverts. lieux_pres_du_pin : les
--      lieux à 200 m d'un pin (« C'est l'un de ceux-là ? »). visiter_depuis_pin : « C'est lui » —
--      visite datée du pin s'il a 15 jours ou moins, sans revendication ; le pin se ferme.
--   visiter_depuis_pin et ajouter_lieu (copiée de sa définition live, la 427) : le pin est verrouillé
--      (FOR UPDATE) — deux envois du même pin ne créent jamais deux lieux.
-- SCHEMA CHECKED (06/10/2026) : place_drafts (264, voir 427) ; places(id, nature, latitude,
--      longitude) ; place_explorers(place_id, user_id, visited_at, unique(place_id,user_id)) ;
--      places_discovered(user_id, place_id, method, discovered_at, pk(user_id,place_id)) ;
--      _lieu_visible(text) (364), _carte_lieu(text) (358), _distance_m (365), _pin_frais (427).
--      place_drafts : DELETE déjà accordé à authenticated (has_table_privilege = t), RLS drafts_delete_own.

CREATE FUNCTION public.poser_pin(p_id uuid, p_latitude double precision, p_longitude double precision,
                                 p_precision double precision, p_pose_le timestamptz, p_lieu_dit text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF p_id IS NULL OR p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Position impossible' USING ERRCODE = '22023';
  END IF;
  IF p_precision IS NULL OR p_precision > 200 THEN
    RAISE EXCEPTION 'GPS trop imprécis' USING ERRCODE = 'P0001', HINT = 'precision';
  END IF;
  IF p_pose_le IS NULL OR p_pose_le > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Date de pose impossible' USING ERRCODE = '22023', HINT = 'date';
  END IF;
  INSERT INTO place_drafts (id, user_id, latitude, longitude, accuracy_m, title, created_at)
  VALUES (p_id, v_moi, p_latitude, p_longitude, round(p_precision::numeric),
          left(NULLIF(btrim(coalesce(p_lieu_dit, '')), ''), 120), p_pose_le)
  ON CONFLICT (id) DO NOTHING;
END;
$function$;
REVOKE ALL ON FUNCTION public.poser_pin(uuid, double precision, double precision, double precision, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.poser_pin(uuid, double precision, double precision, double precision, timestamptz, text) TO authenticated;

CREATE FUNCTION public.mes_pins()
 RETURNS json
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'validiteJours', public._reglage('place_draft_freshness_days', 15)::int,
    'pins', COALESCE((
      SELECT json_agg(json_build_object(
          'id', d.id, 'latitude', d.latitude, 'longitude', d.longitude,
          'lieuDit', d.title, 'poseLe', d.created_at)
        ORDER BY d.created_at DESC)
      FROM place_drafts d
      WHERE d.user_id = (auth.uid())::text AND d.status = 'open'), '[]'::json));
$function$;
REVOKE ALL ON FUNCTION public.mes_pins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mes_pins() TO authenticated;

CREATE FUNCTION public.lieux_pres_du_pin(p_pin uuid)
 RETURNS json
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object('lieu', public._carte_lieu(v.id), 'metres', round(v.metres))
                           ORDER BY v.metres), '[]'::json)
  FROM (
    SELECT p.id, public._distance_m(d.latitude, d.longitude, p.latitude, p.longitude) AS metres
    FROM place_drafts d
    JOIN places p ON p.nature = 'lieu' AND p.latitude IS NOT NULL
      AND p.latitude BETWEEN d.latitude - 0.01 AND d.latitude + 0.01
      AND p.longitude BETWEEN d.longitude - 0.015 AND d.longitude + 0.015
    WHERE d.id = p_pin AND d.user_id = (auth.uid())::text AND public._lieu_visible(p.id)
    ORDER BY 2
    LIMIT 5
  ) v
  WHERE v.metres <= 200;
$function$;
REVOKE ALL ON FUNCTION public.lieux_pres_du_pin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lieux_pres_du_pin(uuid) TO authenticated;

CREATE FUNCTION public.visiter_depuis_pin(p_pin uuid, p_lieu text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_pin place_drafts%ROWTYPE;
  v_lieu record;
  v_visite boolean;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_pin FROM place_drafts WHERE id = p_pin AND user_id = v_moi AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pin introuvable' USING ERRCODE = 'P0002';
  END IF;
  SELECT id, latitude, longitude INTO v_lieu FROM places
  WHERE id = p_lieu AND nature = 'lieu' AND public._lieu_visible(p_lieu);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF public._distance_m(v_pin.latitude, v_pin.longitude, v_lieu.latitude, v_lieu.longitude) > 200 THEN
    RAISE EXCEPTION 'Trop loin de ton pin' USING ERRCODE = 'P0001', HINT = 'loin';
  END IF;
  v_visite := public._pin_frais(v_pin.created_at);
  IF v_visite THEN
    -- La visite la plus récente fait foi (comme visiter_lieu, 365).
    INSERT INTO place_explorers (place_id, user_id, visited_at) VALUES (p_lieu, v_moi, v_pin.created_at)
    ON CONFLICT (place_id, user_id) DO UPDATE
      SET visited_at = GREATEST(place_explorers.visited_at, EXCLUDED.visited_at);
    INSERT INTO places_discovered (user_id, place_id, method, discovered_at) VALUES (v_moi, p_lieu, 'gps', now())
    ON CONFLICT (user_id, place_id) DO UPDATE SET method = 'gps';
  END IF;
  UPDATE place_drafts SET status = 'published', published_place_id = p_lieu, published_at = now()
  WHERE id = p_pin;
  RETURN json_build_object('visite', v_visite);
END;
$function$;
REVOKE ALL ON FUNCTION public.visiter_depuis_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.visiter_depuis_pin(uuid, text) TO authenticated;

-- ajouter_lieu : définition live (427) copiée telle quelle ; seul delta, le pin est lu FOR UPDATE.
CREATE OR REPLACE FUNCTION public.ajouter_lieu(p_nom text, p_latitude double precision, p_longitude double precision, p_natures text[], p_recit text, p_adresse text, p_images jsonb, p_epoque text DEFAULT NULL::text, p_annee integer DEFAULT NULL::integer, p_ma_latitude double precision DEFAULT NULL::double precision, p_ma_longitude double precision DEFAULT NULL::double precision, p_pin uuid DEFAULT NULL::uuid)
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
  v_pin place_drafts%ROWTYPE;
  v_visite_le timestamptz := now();
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

  -- 427 : avec un pin, « sur place » se juge sur lui ; la visite prend sa date.
  IF p_pin IS NOT NULL THEN
    SELECT * INTO v_pin FROM place_drafts WHERE id = p_pin AND user_id = v_moi AND status = 'open' FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Pin introuvable' USING ERRCODE = 'P0002';
    END IF;
    v_sur_place := public._pin_frais(v_pin.created_at)
      AND public._distance_m(v_pin.latitude, v_pin.longitude, p_latitude, p_longitude) <= 200;
    v_visite_le := v_pin.created_at;
  ELSIF p_ma_latitude IS NOT NULL AND p_ma_longitude IS NOT NULL THEN
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
    INSERT INTO place_explorers (place_id, user_id, visited_at) VALUES (v_id, v_moi, v_visite_le)
    ON CONFLICT (place_id, user_id) DO NOTHING;
    -- 427 : la revendication s'écrit directement (pin ou téléphone, déjà jugés à 200 m).
    PERFORM public._revendiquer(v_id, v_moi, '{}'::text[], NULL, NULL);
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

  IF p_pin IS NOT NULL THEN
    UPDATE place_drafts SET status = 'published', published_place_id = v_id, published_at = now()
    WHERE id = p_pin;
  END IF;

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
