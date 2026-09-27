-- 362 — « Noble représentant … » porte la silhouette de son département (ou de son pays)
--
-- WHY : Uriel (27/09) : « il manque l'image des Alpes-Maritimes ». Choix : la forme du
-- département en pochoir, tirée des contours déjà en base (migs 349-350) — elle existe pour
-- 100 % des départements et des pays, sans image à trier ni licence à vérifier. Écartés : les
-- blasons (beaucoup de départements n'en ont pas d'officiel) et ceux des provinces.
-- `attache` devient { texte, silhouette: { d, viewBox } } ; seule la V2 lit cette fonction.
-- `get_profil_explorateur` part de la 361 appliquée (live), copiée entière ; seul le bloc
-- « Noble représentant » change.
--
-- SCHEMA CHECKED (27/09/2026, migs 349 et 351) :
--   geo_departements.nom, .de_nom, .geom (MultiPolygon 4326)
--   geo_pays.nom_fr, .geom (MultiPolygon 4326)
--   places.departement (= geo_departements.nom), places.pays (= geo_pays.nom_fr)

-- La silhouette d'un contour, prête pour un <path> SVG : le plus grand morceau (la Corse sans
-- ses îlots, la France sans l'outre-mer), aplati à sa latitude pour garder ses proportions,
-- simplifié à ~150 pas de large. ST_AsSVG inverse déjà l'axe vertical ; le viewBox suit.
CREATE OR REPLACE FUNCTION public._silhouette(p_geom extensions.geometry)
RETURNS json
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'extensions'
AS $$
  WITH morceau AS (
    SELECT d.geom FROM ST_Dump(p_geom) d ORDER BY ST_Area(d.geom) DESC LIMIT 1
  ),
  a_plat AS (
    SELECT ST_Scale(geom, cos(radians(ST_Y(ST_Centroid(geom)))), 1) AS g FROM morceau
  ),
  simple AS (
    SELECT ST_SimplifyPreserveTopology(g, greatest(ST_XMax(g) - ST_XMin(g), ST_YMax(g) - ST_YMin(g)) / 150) AS g
      FROM a_plat
  )
  SELECT json_build_object(
    'd', ST_AsSVG(g, 0, 4),
    'viewBox', concat_ws(' ',
      round(ST_XMin(g)::numeric, 4), round(-ST_YMax(g)::numeric, 4),
      round((ST_XMax(g) - ST_XMin(g))::numeric, 4), round((ST_YMax(g) - ST_YMin(g))::numeric, 4)))
  FROM simple;
$$;

-- Réservée aux fonctions : personne ne l'appelle directement.
REVOKE ALL ON FUNCTION public._silhouette(extensions.geometry) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_profil_explorateur(p_user_id text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  u public.users%ROWTYPE;
  v_moi boolean;
  v_attache json;
  v_departement text;
  v_pays text;
BEGIN
  SELECT * INTO u FROM public.users WHERE id = p_user_id AND is_active IS NOT FALSE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_moi := COALESCE((auth.uid())::text = p_user_id, false);

  -- « Noble représentant … » : le département (ou le pays) le plus visité, et sa silhouette.
  IF u.show_departement OR v_moi THEN
    SELECT p.departement, p.pays
      INTO v_departement, v_pays
      FROM public.place_explorers e JOIN public.places p ON p.id = e.place_id
     WHERE e.user_id = p_user_id AND COALESCE(p.departement, p.pays) IS NOT NULL
       AND (v_moi OR (p.masked IS NOT TRUE AND p.private IS NOT TRUE))
     GROUP BY p.departement, p.pays
     ORDER BY count(*) DESC, max(e.visited_at) DESC
     LIMIT 1;

    IF v_departement IS NOT NULL THEN
      SELECT json_build_object('texte', 'Noble représentant ' || d.de_nom,
                               'silhouette', public._silhouette(d.geom))
        INTO v_attache
        FROM public.geo_departements d WHERE d.nom = v_departement;
    ELSIF v_pays IS NOT NULL THEN
      v_attache := json_build_object(
        'texte', 'Noble représentant · ' || v_pays,
        'silhouette', (SELECT public._silhouette(g.geom) FROM public.geo_pays g WHERE g.nom_fr = v_pays));
    END IF;
  END IF;

  RETURN (
    WITH lieux_montrables AS (
      SELECT id, title, images, author_id FROM public.places
       WHERE v_moi OR (masked IS NOT TRUE AND private IS NOT TRUE)
    ),
    ajoutes AS (
      SELECT l.id, l.title, l.images FROM lieux_montrables l WHERE l.author_id = p_user_id
    ),
    visites AS (
      SELECT DISTINCT ON (l.id) l.id, l.title, l.images, e.visited_at FROM public.place_explorers e
        JOIN lieux_montrables l ON l.id = e.place_id
       WHERE e.user_id = p_user_id AND l.id NOT IN (SELECT id FROM ajoutes)
       ORDER BY l.id, e.visited_at DESC
    ),
    envies AS (
      SELECT l.id, l.title, l.images, w.created_at FROM public.place_wishlist w
        JOIN lieux_montrables l ON l.id = w.place_id
       WHERE w.user_id = p_user_id
         AND l.id NOT IN (SELECT id FROM ajoutes) AND l.id NOT IN (SELECT id FROM visites)
    )
    SELECT json_build_object(
      'id', u.id,
      'nom', COALESCE(NULLIF(u.display_name, ''), NULLIF(u.first_name, ''), 'Explorateur'),
      'avatarUrl', u.avatar_url,
      'niveau', public._level_from_xp(COALESCE(u.xp_total, 0)),
      'titres', COALESCE((
        SELECT json_agg(json_build_object('id', g.id, 'nom', g.name, 'condition', g.condition) ORDER BY g.ord)
          FROM (SELECT t.id, t.name, t.condition, x.ord
                  FROM unnest(u.displayed_title_ids_v3) WITH ORDINALITY AS x(tid, ord)
                  JOIN public.titles t ON t.id = x.tid AND t.type = 'general'
                 ORDER BY x.ord
                 LIMIT 3) g), '[]'::json),
      'signe', (
        SELECT json_build_object('id', tf.id, 'nom', tf.name, 'imageUrl', COALESCE(tf.image_url, tf.icon_url))
          FROM public.title_fragments tf
         WHERE tf.id = u.signe_fragment_id AND tf.visible
           AND EXISTS (SELECT 1 FROM public.user_fragments f
                        WHERE f.user_id = p_user_id AND f.fragment_id = tf.id)),
      'bio', NULLIF(u.bio, ''),
      'instagram', NULLIF(u.instagram, ''),
      'inscritLe', u.created_at,
      'porteurVerifie', EXISTS (SELECT 1 FROM public.user_fragments f
                                  JOIN public.title_fragments tf ON tf.id = f.fragment_id AND tf.visible
                                 WHERE f.user_id = p_user_id),
      'role', CASE WHEN u.role IN ('admin', 'moderator') THEN u.role END,
      'attache', v_attache,
      'fragments', COALESCE((
        SELECT json_agg(json_build_object('id', tf.id, 'nom', tf.name, 'imageUrl', COALESCE(tf.image_url, tf.icon_url)) ORDER BY f.unlocked_at)
          FROM public.user_fragments f JOIN public.title_fragments tf ON tf.id = f.fragment_id
         WHERE f.user_id = p_user_id AND tf.visible), '[]'::json),
      -- Seulement sur son propre profil : combien de Fragments restent à découvrir. Chez les
      -- autres, rien (on n'affiche jamais ce qu'un Explorateur n'a pas acheté).
      'fragmentsADecouvrir', CASE WHEN v_moi THEN (
        SELECT count(*) FROM public.title_fragments tf
         WHERE tf.visible
           AND NOT EXISTS (SELECT 1 FROM public.user_fragments f
                            WHERE f.user_id = p_user_id AND f.fragment_id = tf.id)) END,
      'ajoutes', COALESCE((SELECT json_agg(public._carte_lieu(a.id) ORDER BY p.created_at DESC)
                             FROM ajoutes a JOIN public.places p ON p.id = a.id), '[]'::json),
      'visites', COALESCE((SELECT json_agg(public._carte_lieu(id) ORDER BY visited_at DESC) FROM visites), '[]'::json),
      'envies', CASE WHEN u.show_envies OR v_moi THEN
                  COALESCE((SELECT json_agg(public._carte_lieu(id) ORDER BY created_at DESC) FROM envies), '[]'::json)
                END,
      'estMoi', v_moi
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_profil_explorateur(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profil_explorateur(text) TO authenticated;
