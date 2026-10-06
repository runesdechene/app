-- WHY: le pin GPS (spec 2026-10-06-v2-pin-gps-design.md, Uriel 06/10). Compléter un pin en gardant
--      « sur place » : visite datée du pin et revendication. Or revendiquer_lieu exige une visite de
--      moins de 30 minutes et une présence en direct près du lieu ; ajouter_lieu sur place la
--      contournait en écrivant la position du téléphone dans `presences` — ce qui, pour un pin,
--      montrerait l'auteur « présent maintenant » aux autres pendant 10 minutes.
--   1. Réglage : un pin vaut 15 jours (la V1 comprise : publish_gps_mark lit le même réglage).
--   2. _pin_frais : la règle des 15 jours, en un seul endroit.
--   3. _revendiquer : l'écriture de la revendication, extraite de revendiquer_lieu (422) telle
--      quelle ; revendiquer_lieu garde ses contrôles (visite récente, présence) et l'appelle.
--   4. ajouter_lieu (copiée de sa définition live, la 393) : + p_pin. Avec un pin, « sur place » se
--      juge sur lui (à moi, ouvert, ≤ 15 jours, lieu ≤ 200 m) ; la visite est datée du pin ; le pin
--      passe `published`. Sur place (pin ou téléphone) : _revendiquer directement, plus d'écriture
--      dans `presences`. La signature change : DROP de l'ancienne (11 paramètres) puis CREATE.
-- SCHEMA CHECKED (06/10/2026, définitions live) : ajouter_lieu = 393, revendiquer_lieu = 422 ;
--      place_drafts(id uuid, user_id text, latitude real, longitude real, accuracy_m numeric,
--      title text, images jsonb, status text, published_place_id text, created_at timestamptz,
--      published_at timestamptz) ; app_settings(key, value) avec place_draft_freshness_days = '30' ;
--      _reglage(text, numeric) (399), _distance_m (365).
-- DROP vérifié à la main le 06/10 : ajouter_lieu(text, double precision, double precision, text[],
--      text, text, jsonb, text, integer, double precision, double precision), appelée par la seule V2
--      (apps/web-v2/src/features/ajout/api/ajout.ts), recréée aussitôt avec un paramètre de plus.

UPDATE app_settings SET value = '15', updated_at = now() WHERE key = 'place_draft_freshness_days';

CREATE OR REPLACE FUNCTION public._pin_frais(p_pose_le timestamptz)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT now() - p_pose_le <= make_interval(days => public._reglage('place_draft_freshness_days', 15)::int);
$function$;
REVOKE ALL ON FUNCTION public._pin_frais(timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._revendiquer(p_id text, p_moi text, p_valides text[], p_nom text, p_pour text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_faction text;
  v_expedition uuid;
  v_bonus integer;
BEGIN
  -- Déjà tenant, seul : on rafraîchit la date, sans nouvelle expédition (comme la V1).
  IF cardinality(p_valides) = 0 AND EXISTS (
    SELECT 1 FROM place_veille v
    WHERE v.place_id = p_id
      AND (v.veilleur_user_id = p_moi
        OR EXISTS (SELECT 1 FROM expedition_members m WHERE m.expedition_id = v.expedition_id AND m.user_id = p_moi))) THEN
    UPDATE place_veille SET planted_at = now(), pour_compagnie = COALESCE(p_pour, pour_compagnie) WHERE place_id = p_id;
    UPDATE expeditions SET pour_compagnie = COALESCE(p_pour, pour_compagnie)
    WHERE id = (SELECT expedition_id FROM place_veille WHERE place_id = p_id);
    RETURN json_build_object('nom', (
      SELECT COALESCE(NULLIF(x.title, ''), user_public_name(u.id, u.display_name, u.first_name))
      FROM place_veille v LEFT JOIN expeditions x ON x.id = v.expedition_id LEFT JOIN users u ON u.id = p_moi
      WHERE v.place_id = p_id));
  END IF;

  SELECT faction_id INTO v_faction FROM users WHERE id = p_moi;
  INSERT INTO expeditions (place_id, is_neutral, faction_id, title, pour_compagnie)
  VALUES (p_id, v_faction IS NULL, v_faction, p_nom, p_pour)
  RETURNING id INTO v_expedition;
  INSERT INTO expedition_members (expedition_id, user_id, faction_id)
  SELECT v_expedition, u.id, u.faction_id FROM users u WHERE u.id = ANY (p_valides || p_moi);

  INSERT INTO place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id, veilleur_user_id)
  VALUES (p_id, v_expedition, v_faction, v_faction IS NULL, now(), false, NULL, p_moi)
  ON CONFLICT (place_id) DO UPDATE SET
    expedition_id = EXCLUDED.expedition_id, faction_id = EXCLUDED.faction_id,
    is_neutral = EXCLUDED.is_neutral, planted_at = now(), by_influence = false,
    previous_expedition_id = NULL, veilleur_user_id = p_moi, pour_compagnie = p_pour;

  -- La Cour V1 repart de zéro, avec le bonus de plantage de la V1 : on ne reprend pas à distance
  -- un lieu revendiqué sur place (Uriel, 28/09). Pas de ligne veille_history : une revendication
  -- faite dans Explore ne compte pas en V1 (ni Gloire, ni Coupe, ni titres, ni classement).
  v_bonus := COALESCE((SELECT value::integer FROM app_settings WHERE key = 'plant_flag_solo_bonus'), 50)
    + COALESCE((SELECT value::integer FROM app_settings WHERE key = 'plant_flag_per_extra_member'), 30)
      * LEAST(cardinality(p_valides), COALESCE((SELECT value::integer FROM app_settings WHERE key = 'plant_flag_max_members_for_bonus'), 10));
  DELETE FROM place_court_action WHERE place_id = p_id AND beneficiary_user_id IS DISTINCT FROM p_moi;
  INSERT INTO place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
  VALUES (p_id, p_moi, v_expedition, p_moi, 'plant_bonus', v_bonus);
  DELETE FROM place_court_score WHERE place_id = p_id;

  RETURN json_build_object('nom', COALESCE(p_nom,
    (SELECT user_public_name(u.id, u.display_name, u.first_name) FROM users u WHERE u.id = p_moi)));
END;
$function$;
REVOKE ALL ON FUNCTION public._revendiquer(text, text, text[], text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.revendiquer_lieu(p_id text, p_compagnons text[], p_nom text, p_pour_compagnie text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_valides text[];
  v_nom text := NULLIF(btrim(p_nom), '');
  v_pour text := NULLIF(btrim(COALESCE(p_pour_compagnie, '')), '');
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM places WHERE id = p_id AND nature = 'lieu' AND public._lieu_visible(p_id)) THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM place_explorers
    WHERE place_id = p_id AND user_id = v_moi AND visited_at > now() - interval '30 minutes') THEN
    RAISE EXCEPTION 'Visite trop ancienne' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public._presents_autour(p_id) a WHERE a.user_id = v_moi) THEN
    RAISE EXCEPTION 'Pas sur place' USING ERRCODE = 'P0001';
  END IF;

  -- Seuls comptent les compagnons présents maintenant : les autres sont ignorés.
  SELECT COALESCE(array_agg(a.user_id), '{}') INTO v_valides
  FROM public._presents_autour(p_id) a
  WHERE a.user_id = ANY (COALESCE(p_compagnons, '{}')) AND a.user_id <> v_moi;
  IF cardinality(v_valides) > 0 AND v_nom IS NULL THEN
    RAISE EXCEPTION 'Nom d''expédition manquant' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_valides) = 0 THEN
    v_nom := NULL; -- seul : la pilule porte son nom
  END IF;

  -- 422 : « pour » une Compagnie dont je suis membre seulement.
  IF v_pour IS NOT NULL AND public._role_compagnie(v_pour, v_moi) IS NULL THEN
    RAISE EXCEPTION 'Pas membre de cette Compagnie' USING ERRCODE = 'P0001', HINT = 'role';
  END IF;

  RETURN public._revendiquer(p_id, v_moi, v_valides, v_nom, v_pour);
END;
$function$;

DROP FUNCTION public.ajouter_lieu(text, double precision, double precision, text[], text, text, jsonb, text, integer, double precision, double precision);

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
    SELECT * INTO v_pin FROM place_drafts WHERE id = p_pin AND user_id = v_moi AND status = 'open';
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
REVOKE ALL ON FUNCTION public.ajouter_lieu(text, double precision, double precision, text[], text, text, jsonb, text, integer, double precision, double precision, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajouter_lieu(text, double precision, double precision, text[], text, text, jsonb, text, integer, double precision, double precision, uuid) TO authenticated;
