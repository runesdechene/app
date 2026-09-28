-- WHY: « Ajouter un lieu » en V2 (maquette validée par Uriel le 29/09, Figma « Ajouter un lieu —
--      proposition ») : la fiche se construit étape par étape, puis se pose sur la carte.
--   1. natures_de_lieu() et epoques() : les choix des étapes (les types et les époques en base).
--   2. lieux_voisins(lat, lng) : un lieu déjà là, à 50 m au plus — signalé dès l'étape « Où ».
--   3. ajouter_lieu(...) : crée le lieu pour l'appelant (auth.uid(), jamais un identifiant
--      fourni). Garde la règle de la V1 : trois découvertes avant d'ajouter. Rien de la V1 qui
--      soit abandonné en V2 (veille de Compagnie, Gloire, mécénat) : _create_place_internal
--      n'est pas repris. L'expérience vient des déclencheurs existants (+7 le lieu, +1 la
--      découverte, +3 la visite si l'on est sur place — à 200 m au plus, le rayon de
--      visiter_lieu). Les photos doivent venir du dossier du compte dans place-images : un lieu
--      ne pointe jamais vers une image extérieure. Rend le rang et l'expérience, comme
--      decouvrir_lieu (367), pour la fête de la fin.
-- SCHEMA CHECKED (29/09/2026, information_schema et définitions live) : places(id varchar,
--      created_at, updated_at, author_id, place_type_id, title varchar, text NOT NULL, address
--      varchar NOT NULL, latitude real, longitude real, private, masked, images jsonb, era_id,
--      year_exact int, nature défaut 'lieu') ; place_tags(place_id, tag_id, is_primary) ;
--      tags(id, title, icon, color, "order") ; eras(id, name, sort_order) ;
--      places_discovered(user_id, place_id, method, discovered_at) ; place_explorers(place_id,
--      user_id, visited_at) ; place_description_revisions(place_id, content, edited_by,
--      created_at) ; place_contributions(place_id, user_id, faction_id, type, content,
--      created_at, updated_at) ; activity_log(type, actor_id, place_id, data) ;
--      _require_min_discoveries(text, int) ; _distance_m(float8×4) ; _lieu_visible(text) ;
--      _level_from_xp(int) ; _xp_for_level(int) ; user_public_name(text, text, text).

-- Les natures (types) d'un lieu, dans l'ordre du Hub.
CREATE OR REPLACE FUNCTION public.natures_de_lieu()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(json_build_object('id', t.id, 'nom', t.title, 'icone', t.icon, 'couleur', t.color)
    ORDER BY t."order", t.title), '[]'::json)
  FROM tags t;
$$;
REVOKE ALL ON FUNCTION public.natures_de_lieu() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.natures_de_lieu() TO authenticated;

-- Les époques, dans l'ordre du temps ; « unknown » (Indéfinie) n'en est pas une : c'est « je ne
-- sais pas », que l'écran propose lui-même.
CREATE OR REPLACE FUNCTION public.epoques()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(json_build_object('id', e.id, 'nom', e.name) ORDER BY e.sort_order), '[]'::json)
  FROM eras e WHERE e.id <> 'unknown';
$$;
REVOKE ALL ON FUNCTION public.epoques() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.epoques() TO authenticated;

-- Les lieux déjà là, à 50 m au plus du point choisi : « c'est le même ? ».
CREATE OR REPLACE FUNCTION public.lieux_voisins(p_latitude double precision, p_longitude double precision)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(json_build_object(
      'id', v.id, 'nom', v.title, 'metres', round(v.metres),
      'type', (SELECT json_build_object('icone', t.icon, 'couleur', t.color)
               FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
               WHERE pt.place_id = v.id AND pt.is_primary AND t.icon IS NOT NULL LIMIT 1))
    ORDER BY v.metres), '[]'::json)
  FROM (
    SELECT p.id, p.title, public._distance_m(p_latitude, p_longitude, p.latitude, p.longitude) AS metres
    FROM places p
    WHERE p.masked IS NOT TRUE AND p.private IS NOT TRUE AND p.latitude IS NOT NULL
      -- Un premier tri grossier (≈ 1 km) avant le calcul exact.
      AND p.latitude BETWEEN p_latitude - 0.01 AND p_latitude + 0.01
      AND p.longitude BETWEEN p_longitude - 0.015 AND p_longitude + 0.015
  ) v
  WHERE v.metres <= 50;
$$;
REVOKE ALL ON FUNCTION public.lieux_voisins(double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lieux_voisins(double precision, double precision) TO authenticated;

-- Créer le lieu.
CREATE OR REPLACE FUNCTION public.ajouter_lieu(
  p_nom text,
  p_latitude double precision,
  p_longitude double precision,
  p_natures text[],
  p_epoque text,
  p_annee integer,
  p_recit text,
  p_adresse text,
  p_images jsonb,
  p_ma_latitude double precision DEFAULT NULL,
  p_ma_longitude double precision DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_moi text := (auth.uid())::text;
  v_id text := gen_random_uuid()::text;
  v_nom text := btrim(p_nom);
  v_recit text := btrim(p_recit);
  v_dossier text;
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
  IF v_nom IS NULL OR char_length(v_nom) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Un nom, de 1 à 120 signes' USING ERRCODE = '22023';
  END IF;
  IF v_recit IS NULL OR char_length(v_recit) NOT BETWEEN 1 AND 5000 THEN
    RAISE EXCEPTION 'Un récit, de 1 à 5000 signes' USING ERRCODE = '22023';
  END IF;
  IF p_latitude NOT BETWEEN -90 AND 90 OR p_longitude NOT BETWEEN -180 AND 180 THEN
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
  -- Les photos : une à dix, toutes dans le dossier du compte (place-images/places/<moi>/).
  IF jsonb_typeof(p_images) <> 'array' OR jsonb_array_length(p_images) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'De une à dix photos' USING ERRCODE = '22023';
  END IF;
  v_dossier := '/storage/v1/object/public/place-images/places/' || v_moi || '/';
  FOR v_image IN SELECT * FROM jsonb_array_elements(p_images) LOOP
    IF position(v_dossier IN coalesce(v_image->>'url', '')) = 0
       OR position(v_dossier IN coalesce(v_image->>'thumb', '')) = 0 THEN
      RAISE EXCEPTION 'Photo hors de ton dossier' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF p_ma_latitude IS NOT NULL AND p_ma_longitude IS NOT NULL THEN
    v_sur_place := public._distance_m(p_ma_latitude, p_ma_longitude, p_latitude, p_longitude) <= 200;
  END IF;

  SELECT COALESCE(xp_total, 0) INTO v_xp_avant FROM users WHERE id = v_moi;

  INSERT INTO places (id, created_at, updated_at, author_id, place_type_id, title, text, address,
                      latitude, longitude, images, private, masked, era_id, year_exact)
  VALUES (v_id, now(), now(), v_moi, 'lieu', v_nom, v_recit, coalesce(btrim(p_adresse), ''),
          p_latitude, p_longitude, p_images, false, false, p_epoque, p_annee);

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
$$;
REVOKE ALL ON FUNCTION public.ajouter_lieu(text, double precision, double precision, text[], text, integer, text, text, jsonb, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajouter_lieu(text, double precision, double precision, text[], text, integer, text, text, jsonb, double precision, double precision) TO authenticated;
