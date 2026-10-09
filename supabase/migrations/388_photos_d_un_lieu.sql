-- WHY: « je ne vois pas où on rajoute de nouvelles photos » (Uriel, 30/09) — et en cherchant, un
--      oubli : les photos ajoutées à un lieu après coup (V1 : add_place_photos, rangées dans
--      place_contributions type 'photo' — 263 photos sur 245 lieux) n'apparaissaient pas sur la
--      fiche de la V2, qui ne lisait que places.images.
--   1. _photos_du_lieu(p_id) : les photos d'un lieu — celles de sa pose, dans leur ordre, puis
--      celles ajoutées ensuite, de la plus ancienne à la plus récente. Une seule lecture, pour la
--      fiche et pour l'écran « Modifier ». Une photo ajoutée n'a pas de vignette : l'image sert.
--   2. fiche_lieu : copiée de la définition live ; seules ses photos passent par _photos_du_lieu.
--   3. lieu_a_modifier : copiée de la définition live (387) ; rend toutes les photos.
--   4. ajouter_photos_lieu(p_id, p_images) : mêmes droits que modifier_lieu (qui l'a découvert,
--      l'auteur, le staff) ; mêmes contrôles que l'ajout d'un lieu (381 : le dossier du compte,
--      le fichier existe) ; rangées comme en V1 (place_contributions 'photo', des adresses) : la
--      V1 les voit aussi. Une à dix à la fois, trente par lieu au plus, trente par jour ; l'auteur
--      est prévenu (« new_photo »), le fil d'activité aussi.
-- SCHEMA CHECKED (30/09/2026, définitions live) : places(images jsonb [{id,url,thumb}]) ;
--      place_contributions(place_id, user_id, type, images jsonb [adresses], created_at,
--      updated_at) ; activity_log(type, actor_id, place_id, data) ; storage.objects(bucket_id,
--      name) ; fiche_lieu(text) et lieu_a_modifier(text) copiées de leur définition live.

CREATE OR REPLACE FUNCTION public._photos_du_lieu(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(json_agg(json_build_object('url', ph.url, 'vignette', ph.vignette)
                           ORDER BY ph.rang, ph.quand, ph.ordre), '[]'::json)
  FROM (
    SELECT i->>'url' AS url, COALESCE(i->>'thumb', i->>'url') AS vignette,
           0 AS rang, NULL::timestamptz AS quand, x.o AS ordre
    FROM places p, jsonb_array_elements(COALESCE(p.images, '[]'::jsonb)) WITH ORDINALITY AS x(i, o)
    WHERE p.id = p_id AND i->>'url' IS NOT NULL
    UNION ALL
    SELECT COALESCE(i->>'url', i #>> '{}'), COALESCE(i->>'thumb', i->>'url', i #>> '{}'),
           1, c.created_at, x.o
    FROM place_contributions c,
         jsonb_array_elements(CASE WHEN jsonb_typeof(c.images) = 'array' THEN c.images ELSE '[]'::jsonb END)
           WITH ORDINALITY AS x(i, o)
    WHERE c.place_id = p_id AND c.type = 'photo'
  ) ph
  WHERE ph.url IS NOT NULL;
$function$;
REVOKE ALL ON FUNCTION public._photos_du_lieu(text) FROM PUBLIC, anon, authenticated;

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

CREATE OR REPLACE FUNCTION public.lieu_a_modifier(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN NOT public._lieu_visible(p_id) THEN NULL ELSE (
    SELECT json_build_object('nom', e.nom, 'natures', e.natures, 'epoque', e.epoque,
      'annee', e.annee, 'recit', e.recit,
      'photos', public._photos_du_lieu(p_id))
    FROM public._etat_du_lieu(p_id) e) END;
$function$;

CREATE OR REPLACE FUNCTION public.ajouter_photos_lieu(p_id text, p_images jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_auteur text;
  v_titre text;
  v_dossier text;
  v_fichier text;
  v_nom_fichier text;
  v_image jsonb;
  v_adresses jsonb := '[]'::jsonb;
  v_nom text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT public._lieu_visible(p_id) THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  SELECT author_id, title INTO v_auteur, v_titre FROM places WHERE id = p_id;
  IF v_auteur IS DISTINCT FROM v_moi AND NOT public._is_staff()
     AND NOT EXISTS (SELECT 1 FROM places_discovered WHERE place_id = p_id AND user_id = v_moi) THEN
    RAISE EXCEPTION 'Découvre ce lieu avant d’y ajouter des photos' USING ERRCODE = 'P0001', HINT = 'decouvrir';
  END IF;
  IF p_images IS NULL OR jsonb_typeof(p_images) <> 'array' OR jsonb_array_length(p_images) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'De une à dix photos' USING ERRCODE = '22023';
  END IF;
  IF json_array_length(public._photos_du_lieu(p_id)) + jsonb_array_length(p_images) > 30 THEN
    RAISE EXCEPTION 'Trente photos par lieu au plus' USING ERRCODE = 'P0001', HINT = 'plein';
  END IF;
  IF (SELECT COALESCE(sum(jsonb_array_length(images)), 0) FROM place_contributions
      WHERE user_id = v_moi AND type = 'photo' AND created_at > now() - interval '1 day') >= 30 THEN
    RAISE EXCEPTION 'Trente photos aujourd’hui : reviens demain' USING ERRCODE = 'P0001', HINT = 'limite';
  END IF;

  -- Les mêmes contrôles qu'à l'ajout d'un lieu (381) : le dossier du compte, le fichier existe.
  v_dossier := 'https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/place-images/places/'
               || v_moi || '/';
  FOR v_image IN SELECT * FROM jsonb_array_elements(p_images) LOOP
    v_fichier := substr(coalesce(v_image->>'url', ''), length(v_dossier) + 1);
    IF left(coalesce(v_image->>'url', ''), length(v_dossier)) <> v_dossier
       OR v_fichier !~ '^[A-Za-z0-9-]+\.webp$' THEN
      RAISE EXCEPTION 'Photo hors de ton dossier' USING ERRCODE = '22023';
    END IF;
    v_nom_fichier := 'places/' || v_moi || '/' || v_fichier;
    IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'place-images' AND o.name = v_nom_fichier) THEN
      RAISE EXCEPTION 'Photo introuvable' USING ERRCODE = '22023';
    END IF;
    v_adresses := v_adresses || to_jsonb(v_dossier || v_fichier);
  END LOOP;

  -- Rangées comme en V1 : la V1 les voit aussi.
  INSERT INTO place_contributions (place_id, user_id, type, images, created_at, updated_at)
  VALUES (p_id, v_moi, 'photo', v_adresses, now(), now());

  SELECT user_public_name(u.id, u.display_name, u.first_name) INTO v_nom FROM users u WHERE u.id = v_moi;
  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES ('contribute', v_moi, p_id, jsonb_build_object(
    'contributionType', 'photo', 'placeTitle', v_titre, 'actorName', v_nom, 'fromV2', true));

  IF v_auteur IS NOT NULL AND v_auteur <> v_moi THEN
    BEGIN
      PERFORM notify(v_auteur, 'new_photo', jsonb_build_object(
        'actorName', v_nom, 'actorId', v_moi, 'placeTitle', v_titre, 'placeId', p_id));
    EXCEPTION WHEN others THEN
      RAISE WARNING 'ajouter_photos_lieu : notification en échec (%)', SQLERRM;
    END;
  END IF;

  RETURN json_build_object('photos', jsonb_array_length(v_adresses));
END;
$function$;
REVOKE ALL ON FUNCTION public.ajouter_photos_lieu(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajouter_photos_lieu(text, jsonb) TO authenticated;
