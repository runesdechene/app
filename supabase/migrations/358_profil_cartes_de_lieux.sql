-- 358 — Les lieux du profil deviennent des cartes : photo, coordonnées, catégorie, auteur
--
-- WHY : nouvelle maquette « COMPTE — sous le signe de l'Hoplite » (Uriel, 27/09). Les
-- découvertes ne sont plus des onglets mais des sections (Lieux ajoutés, Visités, Envie d'y
-- aller) de cartes : nom, distance depuis l'Explorateur qui regarde (calculée dans le
-- navigateur, seulement s'il a donné sa position — d'où les coordonnées du LIEU, publiques),
-- pastille de la catégorie principale, et l'auteur du lieu.
-- `_carte_lieu` construit une carte ; elle n'est appelée que pour les lieux du profil.
-- `get_profil_explorateur` part de la 357 (copiée entière) ; seuls ses trois listes changent.

CREATE OR REPLACE FUNCTION public._carte_lieu(p_place_id text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'id', p.id,
    'nom', p.title,
    'imageUrl', p.images -> 0 ->> 'url',
    'latitude', p.latitude,
    'longitude', p.longitude,
    'categorie', (
      SELECT json_build_object('icone', t.icon, 'couleur', t.color)
        FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
       WHERE pt.place_id = p.id AND pt.is_primary
       LIMIT 1),
    'auteur', (
      SELECT json_build_object(
        'id', a.id,
        'nom', COALESCE(NULLIF(a.display_name, ''), NULLIF(a.first_name, ''), 'Explorateur'),
        'avatarUrl', a.avatar_url)
        FROM users a WHERE a.id = p.author_id)
  )
  FROM places p
  WHERE p.id = p_place_id;
$$;
REVOKE ALL ON FUNCTION public._carte_lieu(text) FROM PUBLIC, anon, authenticated;

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
BEGIN
  SELECT * INTO u FROM public.users WHERE id = p_user_id AND is_active IS NOT FALSE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_moi := COALESCE((auth.uid())::text = p_user_id, false);

  -- « Noble représentant … » : le département (ou le pays) le plus visité.
  IF u.show_departement OR v_moi THEN
    SELECT to_json(CASE WHEN p.departement IS NOT NULL
                        THEN 'Noble représentant ' || (SELECT d.de_nom FROM public.geo_departements d WHERE d.nom = p.departement)
                        ELSE 'Noble représentant · ' || p.pays END)
      INTO v_attache
      FROM public.place_explorers e JOIN public.places p ON p.id = e.place_id
     WHERE e.user_id = p_user_id AND COALESCE(p.departement, p.pays) IS NOT NULL
       AND (v_moi OR (p.masked IS NOT TRUE AND p.private IS NOT TRUE))
     GROUP BY p.departement, p.pays
     ORDER BY count(*) DESC, max(e.visited_at) DESC
     LIMIT 1;
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
      'ajoutes', COALESCE((SELECT json_agg(public._carte_lieu(id)) FROM ajoutes), '[]'::json),
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
