-- WHY: « Noble représentant des Alpes-Maritimes » était fabriqué dans la base (355, accordé en
--      406) : une phrase d'écran n'a rien à faire là, on ne pouvait pas changer un mot sans
--      migration. La base renvoie maintenant des données — le département avec son article
--      officiel (`departement`, « des Alpes-Maritimes ») ou le pays (`pays`), et le genre choisi
--      (`genre`) — et l'appli écrit « Noble Explorateur / Exploratrice » (Uriel, 19/10/2026).
--      Le calcul ne change pas : le département où il a visité le plus de lieux.
--      `texte` reste en attendant que les appareils quittent la version d'avant (elle lit
--      `texte` et rejette le profil entier sans lui) ; une migration suivante le retire.
-- SCHEMA CHECKED (19/10/2026, live) : copié de pg_get_functiondef('public.get_profil_explorateur(text)') ;
--   seul le bloc de l'attache et le champ `genre` changent. geo_departements.de_nom, users.title_gender
--   lus par la définition live. schema_migrations s'arrête à 529 : le numéro 530 est libre.

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

  -- Le département (ou le pays) le plus visité, et sa silhouette. 530 : la base renvoie le nom
  -- avec son article (« des Alpes-Maritimes ») ; la phrase et son accord vivent dans l'appli.
  -- `texte` reste le temps que les appareils quittent la version d'avant (à retirer ensuite).
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
                               'departement', d.de_nom,
                               'silhouette', public._silhouette(d.geom))
        INTO v_attache
        FROM public.geo_departements d WHERE d.nom = v_departement;
    ELSIF v_pays IS NOT NULL THEN
      v_attache := json_build_object(
        'texte', 'Noble ' || CASE WHEN u.title_gender = 'f' THEN 'représentante' ELSE 'représentant' END
                 || ' · ' || v_pays,
        'pays', v_pays,
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
       WHERE e.user_id = p_user_id
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
      -- 530 : pour accorder ses mots dans l'appli (« Noble Exploratrice », « Exploratrice depuis »).
      'genre', CASE WHEN u.title_gender = 'f' THEN 'f' ELSE 'm' END,
      'niveau', public._level_from_xp(COALESCE(u.xp_total, 0)),
      'titres', COALESCE((
        SELECT json_agg(json_build_object('id', g.id, 'nom', g.nom, 'condition', g.condition) ORDER BY g.ord)
          FROM (SELECT t.id, public._nom_titre(t, u.title_gender) AS nom, t.condition, x.ord
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
      -- 431 : le chiffre « Lieux visités » ; la liste part dans le passeport (get_passeport).
      'nbVisites', (SELECT count(*) FROM visites),
      'envies', CASE WHEN u.show_envies OR v_moi THEN
                  COALESCE((SELECT json_agg(public._carte_lieu(id) ORDER BY created_at DESC) FROM envies), '[]'::json)
                END,
      -- 422 : ses Compagnies (une privée : pour lui-même, ou pour un autre membre).
      'compagnies', COALESCE((SELECT json_agg(json_build_object('id', f.id, 'nom', f.title, 'couleur', f.color) ORDER BY f.title)
        FROM faction_members m JOIN factions f ON f.id = m.faction_id
        WHERE m.user_id = p_user_id AND NOT f.retired
          AND (NOT f.privee OR v_moi OR public._role_compagnie(f.id, (auth.uid())::text) IS NOT NULL)), '[]'::json),
      -- 452 : ses connaissances, des gélules (une par culture : son plus haut titre, son rang de 1 à 7,
      -- ses énigmes résolues), et Polymathe à part. Jamais des titres qu'on porte.
      'connaissances', COALESCE((
        SELECT json_agg(json_build_object(
                 'culture', json_build_object('id', c.id, 'nom', c.label, 'couleur', c.color, 'icone', c.icon),
                 'titre', public._nom_titre(h.titre, u.title_gender),
                 'rang', ((h.titre).condition->>'palier')::int,
                 'enigmes', (SELECT count(*) FROM public._enigmes_resolues(p_user_id, c.id)))
               ORDER BY ((h.titre).condition->>'palier')::int DESC, c.sort_order, c.id)
          FROM enigma_themes c
          JOIN LATERAL (SELECT s AS titre FROM public.titres_connaissance k JOIN public.titles s ON s.id = k.title_id
                         WHERE k.user_id = p_user_id AND s.condition->>'stat' = 'connaissance'
                           AND s.condition->>'theme' = c.id
                         ORDER BY (s.condition->>'palier')::int DESC LIMIT 1) h ON true
         WHERE c.active), '[]'::json),
      'polymathe', (SELECT public._nom_titre(s, u.title_gender)
                      FROM public.titres_connaissance k JOIN public.titles s ON s.id = k.title_id
                     WHERE k.user_id = p_user_id AND s.condition->>'stat' = 'polymathe' LIMIT 1),
      'estMoi', v_moi
    )
  );
END;
$function$;
