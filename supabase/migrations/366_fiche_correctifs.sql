-- 366 — Fiche d'un lieu : les correctifs de la revue finale
--
-- WHY : revue du 28/09 et décisions d'Uriel.
--   1. « Envie d'y aller » écrivait dans places_bookmarked, que plus rien ne lit : le profil V2
--      (get_profil_explorateur) et la V1 lisent place_wishlist. fiche_lieu et basculer_envie y
--      passent (l'erreur venait de la spec, corrigée).
--   2. Une revendication faite dans Explore ne compte pas en V1 (Uriel) : plus de ligne
--      veille_history (dont le trigger donnait +2 de Gloire, et qui nourrit Coupe, titres et
--      classement). Déjà tenant, revendiquer rafraîchit la date sans créer d'expédition.
--   3. La Cour V1 du lieu est remise à zéro et reçoit le bonus de plantage, comme plant_flag :
--      sinon un joueur V1 reprend le lieu à distance pour une Couronne (Uriel : protéger, en
--      acceptant que le bonus s'ajoute aux Couronnes conquises de la Compagnie).
--   4. Qui est autour : réservé à qui a visité le lieu en GPS dans les 30 minutes et y est encore ;
--      la distance est arrondie à 50 m. Revendiquer exige aussi d'être encore sur place.
--   Chaque fonction part de sa définition live (364-365), copiée entière.
--
-- SCHEMA CHECKED (28/09/2026) : place_wishlist(id serial, place_id, user_id, created_at défaut
--   now(), unique(place_id,user_id)) ; place_court_action(id, place_id, user_id NOT NULL,
--   expedition_id NOT NULL, side, amount, created_at, beneficiary_user_id NOT NULL) ;
--   place_court_score(place_id, expedition_id, …) ; app_settings(key, value) :
--   plant_flag_solo_bonus, plant_flag_per_extra_member, plant_flag_max_members_for_bonus.

CREATE OR REPLACE FUNCTION public.fiche_lieu(p_id text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH moi AS (SELECT (auth.uid())::text AS id)
  SELECT json_build_object(
    'id', l.id,
    'nom', l.title,
    'recit', COALESCE(l.text, ''),
    'adresse', NULLIF(btrim(l.address), ''),
    'lat', l.latitude,
    'lng', l.longitude,
    'nature', l.nature,
    'photos', COALESCE((
      SELECT json_agg(json_build_object('url', i->>'url', 'vignette', COALESCE(i->>'thumb', i->>'url')))
      FROM jsonb_array_elements(COALESCE(l.images, '[]'::jsonb)) i
      WHERE i->>'url' IS NOT NULL), '[]'::json),
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
      'envie', EXISTS (SELECT 1 FROM place_wishlist w WHERE w.place_id = l.id AND w.user_id = moi.id)))
  FROM places l CROSS JOIN moi
  WHERE l.id = p_id AND public._lieu_visible(p_id);
$$;
REVOKE ALL ON FUNCTION public.fiche_lieu(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fiche_lieu(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.basculer_envie(p_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_moi text := (auth.uid())::text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF NOT public._lieu_visible(p_id) THEN
    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM place_wishlist WHERE user_id = v_moi AND place_id = p_id;
  IF FOUND THEN
    RETURN false;
  END IF;
  INSERT INTO place_wishlist (place_id, user_id) VALUES (p_id, v_moi);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.basculer_envie(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.basculer_envie(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.compagnons_possibles(p_id text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(json_build_object(
      'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
      'avatar', u.avatar_url, 'distance', greatest(50, round(a.distance / 50) * 50)) ORDER BY a.distance), '[]'::json)
  FROM public._presents_autour(p_id) a JOIN users u ON u.id = a.user_id
  WHERE a.user_id <> (auth.uid())::text
    AND public._lieu_visible(p_id)
    AND EXISTS (SELECT 1 FROM public._presents_autour(p_id) m WHERE m.user_id = (auth.uid())::text)
    -- Seul qui a vraiment visité le lieu (visite GPS de moins de 30 min) voit qui est autour.
    AND EXISTS (SELECT 1 FROM place_explorers e
                WHERE e.place_id = p_id AND e.user_id = (auth.uid())::text
                  AND e.visited_at > now() - interval '30 minutes');
$$;
REVOKE ALL ON FUNCTION public.compagnons_possibles(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compagnons_possibles(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.revendiquer_lieu(p_id text, p_compagnons text[], p_nom text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_moi text := (auth.uid())::text;
  v_valides text[];
  v_nom text := NULLIF(btrim(p_nom), '');
  v_faction text;
  v_expedition uuid;
  v_bonus integer;
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

  -- Déjà tenant, seul : on rafraîchit la date, sans nouvelle expédition (comme la V1).
  IF cardinality(v_valides) = 0 AND EXISTS (
    SELECT 1 FROM place_veille v
    WHERE v.place_id = p_id
      AND (v.veilleur_user_id = v_moi
        OR EXISTS (SELECT 1 FROM expedition_members m WHERE m.expedition_id = v.expedition_id AND m.user_id = v_moi))) THEN
    UPDATE place_veille SET planted_at = now() WHERE place_id = p_id;
    RETURN json_build_object('nom', (
      SELECT COALESCE(NULLIF(x.title, ''), user_public_name(u.id, u.display_name, u.first_name))
      FROM place_veille v LEFT JOIN expeditions x ON x.id = v.expedition_id LEFT JOIN users u ON u.id = v_moi
      WHERE v.place_id = p_id));
  END IF;

  SELECT faction_id INTO v_faction FROM users WHERE id = v_moi;
  INSERT INTO expeditions (place_id, is_neutral, faction_id, title)
  VALUES (p_id, v_faction IS NULL, v_faction, v_nom)
  RETURNING id INTO v_expedition;
  INSERT INTO expedition_members (expedition_id, user_id, faction_id)
  SELECT v_expedition, u.id, u.faction_id FROM users u WHERE u.id = ANY (v_valides || v_moi);

  INSERT INTO place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at, by_influence, previous_expedition_id, veilleur_user_id)
  VALUES (p_id, v_expedition, v_faction, v_faction IS NULL, now(), false, NULL, v_moi)
  ON CONFLICT (place_id) DO UPDATE SET
    expedition_id = EXCLUDED.expedition_id, faction_id = EXCLUDED.faction_id,
    is_neutral = EXCLUDED.is_neutral, planted_at = now(), by_influence = false,
    previous_expedition_id = NULL, veilleur_user_id = v_moi;

  -- La Cour V1 repart de zéro, avec le bonus de plantage de la V1 : on ne reprend pas à distance
  -- un lieu revendiqué sur place (Uriel, 28/09). Pas de ligne veille_history : une revendication
  -- faite dans Explore ne compte pas en V1 (ni Gloire, ni Coupe, ni titres, ni classement).
  v_bonus := COALESCE((SELECT value::integer FROM app_settings WHERE key = 'plant_flag_solo_bonus'), 50)
    + COALESCE((SELECT value::integer FROM app_settings WHERE key = 'plant_flag_per_extra_member'), 30)
      * LEAST(cardinality(v_valides), COALESCE((SELECT value::integer FROM app_settings WHERE key = 'plant_flag_max_members_for_bonus'), 10));
  DELETE FROM place_court_action WHERE place_id = p_id AND beneficiary_user_id IS DISTINCT FROM v_moi;
  INSERT INTO place_court_action (place_id, user_id, expedition_id, beneficiary_user_id, side, amount)
  VALUES (p_id, v_moi, v_expedition, v_moi, 'plant_bonus', v_bonus);
  DELETE FROM place_court_score WHERE place_id = p_id;

  RETURN json_build_object('nom', COALESCE(v_nom,
    (SELECT user_public_name(u.id, u.display_name, u.first_name) FROM users u WHERE u.id = v_moi)));
END;
$$;
REVOKE ALL ON FUNCTION public.revendiquer_lieu(text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revendiquer_lieu(text, text[], text) TO authenticated;
