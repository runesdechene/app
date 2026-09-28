-- 364 — La fiche d'un lieu (lecture) et « Envie d'y aller »
--
-- WHY : spec 2026-09-28-v2-fiche-lieu-design.md §2-3, §7. Une lecture unique rend tout ce que
-- la fiche affiche, avec l'état de celui qui regarde (visité quand, envie) ; la même visibilité
-- que carte_lieux (363). « Envie d'y aller » écrit places_bookmarked, que le profil lit déjà.
-- Toutes lisent auth.uid() ; aucune ne prend d'identifiant de joueur.
--
-- SCHEMA CHECKED (28/09/2026) : places(id, title, text, address, latitude, longitude, author_id,
--   private, masked, images jsonb [{id,url,thumb}], era_id, year_exact, best_season,
--   accessibility, bivouac, nature, created_at) ; place_tags(place_id, tag_id, is_primary) ;
--   tags(id, title, icon, color) ; eras(id, name) ; place_explorers(place_id, user_id,
--   visited_at NOT NULL défaut now(), unique(place_id,user_id)) ; place_veille(place_id pk,
--   expedition_id, veilleur_user_id, planted_at) ; expeditions(id, title, created_at) ;
--   expedition_members(expedition_id, user_id) ; places_bookmarked(id varchar sans défaut,
--   created_at, updated_at, user_id, place_id) ; place_description_revisions(place_id,
--   edited_by, created_at) ; users(id, display_name, first_name, avatar_url) ;
--   user_public_name(p_user_id text, p_display_name text, p_first_name text).

CREATE OR REPLACE FUNCTION public._lieu_visible(p_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM places p
    WHERE p.id = p_id
      AND ((p.masked IS NOT TRUE AND p.private IS NOT TRUE) OR p.author_id = (auth.uid())::text));
$$;
REVOKE ALL ON FUNCTION public._lieu_visible(text) FROM PUBLIC, anon, authenticated;

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
      'envie', EXISTS (SELECT 1 FROM places_bookmarked b WHERE b.place_id = l.id AND b.user_id = moi.id)))
  FROM places l CROSS JOIN moi
  WHERE l.id = p_id AND public._lieu_visible(p_id);
$$;
REVOKE ALL ON FUNCTION public.fiche_lieu(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fiche_lieu(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.explorateurs_du_lieu(p_id text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(json_build_object(
      'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name),
      'avatar', u.avatar_url, 'visiteLe', e.visited_at) ORDER BY e.visited_at DESC), '[]'::json)
  FROM place_explorers e JOIN users u ON u.id = e.user_id
  WHERE e.place_id = p_id AND public._lieu_visible(p_id);
$$;
REVOKE ALL ON FUNCTION public.explorateurs_du_lieu(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.explorateurs_du_lieu(text) TO authenticated;

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
  DELETE FROM places_bookmarked WHERE user_id = v_moi AND place_id = p_id;
  IF FOUND THEN
    RETURN false;
  END IF;
  INSERT INTO places_bookmarked (id, created_at, updated_at, user_id, place_id)
  VALUES (gen_random_uuid()::text, now(), now(), v_moi, p_id);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.basculer_envie(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.basculer_envie(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mes_noms_d_expedition()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(n.titre ORDER BY n.recent DESC), '{}')
  FROM (
    SELECT btrim(x.title) AS titre, max(x.created_at) AS recent
    FROM expedition_members m JOIN expeditions x ON x.id = m.expedition_id
    WHERE m.user_id = (auth.uid())::text AND NULLIF(btrim(x.title), '') IS NOT NULL
    GROUP BY btrim(x.title)
    ORDER BY recent DESC
    LIMIT 8) n;
$$;
REVOKE ALL ON FUNCTION public.mes_noms_d_expedition() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mes_noms_d_expedition() TO authenticated;
