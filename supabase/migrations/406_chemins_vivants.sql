-- WHY: « Sur les chemins » donne plus de vie (Uriel, 01/10/2026) : trois sortes en plus —
--      « vient de se connecter » (une seule ligne par personne, la dernière connexion chasse la
--      précédente), « vient de revendiquer X », « a enrichi X » ; et sur le profil, « Noble
--      représentante » pour qui a choisi le féminin.
--   1. sur_les_chemins (copiée de sa définition live) : les trois sortes.
--   2. _auteur_du_chemin (copiée du live) : saluer ces lignes trouve leur auteur.
--   3. get_profil_explorateur (copiée du live) : l'accord au féminin.
-- SCHEMA CHECKED (01/10/2026, information_schema et définitions live) : users(last_login_at — posé
--      par touch_last_login à chaque entrée V1 et V2, created_at, title_gender 'm'|'f') ;
--      veille_history(place_id, user_id, planted_at) ; place_description_revisions(place_id,
--      content, edited_by, created_at) ; places(masked, private, author_id, created_at) ;
--      sur_les_chemins(int), _auteur_du_chemin(text), get_profil_explorateur(text) copiées du live.

CREATE OR REPLACE FUNCTION public.sur_les_chemins(p_limite integer DEFAULT 20)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id),
  evenements AS (
    (SELECT 'visite:' || e.place_id || ':' || e.user_id AS id, 'visite' AS type, e.visited_at AS quand,
            e.user_id AS qui, e.place_id AS lieu
     FROM place_explorers e JOIN places p ON p.id = e.place_id
     WHERE p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY e.visited_at DESC LIMIT 200)
    UNION ALL
    (SELECT 'ajout:' || p.id, 'ajout', p.created_at, p.author_id, p.id
     FROM places p
     WHERE p.author_id IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY p.created_at DESC LIMIT 200)
    UNION ALL
    (SELECT 'arrivee:' || u.id, 'arrivee', u.created_at, u.id, NULL
     FROM users u ORDER BY u.created_at DESC LIMIT 100)
    UNION ALL
    -- 406 : la dernière connexion de chacun — une seule ligne par personne, la nouvelle chasse
    -- l'ancienne. Pas pour qui vient de s'inscrire (sa ligne « a rejoint » suffit).
    (SELECT 'connexion:' || u.id || ':' || floor(extract(epoch FROM u.last_login_at))::bigint,
            'connexion', u.last_login_at, u.id, NULL
     FROM users u
     WHERE u.last_login_at IS NOT NULL AND u.last_login_at > u.created_at + interval '10 minutes'
     ORDER BY u.last_login_at DESC LIMIT 100)
    UNION ALL
    -- 406 : les revendications (V1 et V2 écrivent veille_history).
    (SELECT 'revendication:' || h.place_id || ':' || h.user_id || ':'
              || floor(extract(epoch FROM h.planted_at))::bigint,
            'revendication', h.planted_at, h.user_id, h.place_id
     FROM veille_history h JOIN places p ON p.id = h.place_id
     WHERE h.user_id IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
     ORDER BY h.planted_at DESC LIMIT 200)
    UNION ALL
    -- 406 : le récit enrichi (V1 et V2 écrivent place_description_revisions), sauf le récit de
    -- départ, posé par l'auteur à l'ajout.
    (SELECT 'enrichi:' || d.place_id || ':' || d.edited_by || ':'
              || floor(extract(epoch FROM d.created_at))::bigint,
            'enrichi', d.created_at, d.edited_by, d.place_id
     FROM place_description_revisions d JOIN places p ON p.id = d.place_id
     WHERE d.edited_by IS NOT NULL AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
       AND NOT (d.edited_by = p.author_id AND d.created_at < p.created_at + interval '10 minutes')
     ORDER BY d.created_at DESC LIMIT 200)
  ),
  -- Une ligne au plus par personne, par type et par jour : la plus récente.
  -- (La connexion n'a déjà qu'une ligne par personne : la dernière.)
  une_par_jour AS (
    SELECT DISTINCT ON (type, qui, quand::date) *
    FROM evenements ORDER BY type, qui, quand::date, quand DESC
  ),
  retenus AS (
    SELECT * FROM une_par_jour ORDER BY quand DESC LIMIT least(greatest(p_limite, 1), 50)
  )
  SELECT COALESCE(json_agg(json_build_object(
      'id', r.id,
      'type', r.type,
      'quand', r.quand,
      'qui', json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url),
      'lieu', CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object(
                'id', p.id, 'nom', p.title, 'region', COALESCE(p.departement, p.pays),
                'type', (SELECT json_build_object('icone', t.icon, 'couleur', t.color)
                         FROM place_tags pt JOIN tags t ON t.id = pt.tag_id
                         WHERE pt.place_id = p.id AND pt.is_primary AND t.icon IS NOT NULL
                         LIMIT 1)) END,
      'moi', r.qui = moi.id, -- ma propre ligne : on ne se salue pas soi-même
      'saluts', (SELECT COALESCE(sum(s.nombre), 0) FROM saluts s WHERE s.evenement = r.id),
      'salue', EXISTS (SELECT 1 FROM saluts s WHERE s.evenement = r.id AND s.user_id = moi.id))
    ORDER BY r.quand DESC), '[]'::json)
  FROM retenus r
  CROSS JOIN moi
  JOIN users u ON u.id = r.qui
  LEFT JOIN places p ON p.id = r.lieu;
$function$;

CREATE OR REPLACE FUNCTION public._auteur_du_chemin(p_evenement text)
 RETURNS character varying
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

  SELECT CASE split_part(p_evenement, ':', 1)

    WHEN 'visite' THEN (

      SELECT e.user_id FROM place_explorers e JOIN places p ON p.id = e.place_id

      WHERE e.place_id = split_part(p_evenement, ':', 2) AND e.user_id = split_part(p_evenement, ':', 3)

        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1)

    WHEN 'ajout' THEN (

      SELECT p.author_id FROM places p

      WHERE p.id = split_part(p_evenement, ':', 2) AND p.masked IS NOT TRUE AND p.private IS NOT TRUE)

    WHEN 'arrivee' THEN (SELECT u.id FROM users u WHERE u.id = split_part(p_evenement, ':', 2))
    WHEN 'connexion' THEN (SELECT u.id FROM users u WHERE u.id = split_part(p_evenement, ':', 2))
    WHEN 'revendication' THEN (
      SELECT h.user_id FROM veille_history h JOIN places p ON p.id = h.place_id
      WHERE h.place_id = split_part(p_evenement, ':', 2) AND h.user_id = split_part(p_evenement, ':', 3)
        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1)
    WHEN 'enrichi' THEN (
      SELECT d.edited_by FROM place_description_revisions d JOIN places p ON p.id = d.place_id
      WHERE d.place_id = split_part(p_evenement, ':', 2) AND d.edited_by = split_part(p_evenement, ':', 3)
        AND p.masked IS NOT TRUE AND p.private IS NOT TRUE LIMIT 1)

  END;

$function$;

CREATE OR REPLACE FUNCTION public.get_profil_explorateur(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- 406 : « représentante » pour qui a choisi le féminin (title_gender = 'f').
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
      SELECT json_build_object('texte', 'Noble ' || CASE WHEN u.title_gender = 'f'
                                 THEN 'représentante ' ELSE 'représentant ' END || d.de_nom,
                               'silhouette', public._silhouette(d.geom))
        INTO v_attache
        FROM public.geo_departements d WHERE d.nom = v_departement;
    ELSIF v_pays IS NOT NULL THEN
      v_attache := json_build_object(
        'texte', 'Noble ' || CASE WHEN u.title_gender = 'f' THEN 'représentante' ELSE 'représentant' END
                 || ' · ' || v_pays,
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
$function$;
