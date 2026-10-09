-- WHY: les titres gagnés avec les énigmes ne sont pas des titres (Uriel, 07/10) : ils ne se
--      portent plus, quittent « Tous les titres » et deviennent des gélules « Connaissances » sur le
--      profil (Figma 500:897) ; la progression vers le titre suivant passe dans « Les énigmes ».
--      Les deux joueurs qui en portaient un le retirent de leurs titres affichés.
-- BASE: définitions en ligne de get_user_titles, get_mes_titres, get_profil_explorateur et
--      mes_enigmes_culture (pg_get_functiondef, 07/10), copiées entières. set_my_displayed_titles
--      n'a pas à changer : il ne laisse porter que ce que get_user_titles débloque.
-- COMPAT: get_mes_titres garde ses clés `cultures` (vide) et `polymathe` (NULL) pour la V2 en ligne.
-- SCHEMA CHECKED (07/10) : titles.condition jsonb (stat, theme, palier) ; titres_connaissance(user_id,
--      title_id) ; users.displayed_title_ids_v3 integer[], .title_gender ; enigma_themes.label, .color,
--      .icon, .active, .sort_order.

CREATE OR REPLACE FUNCTION public.get_user_titles(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_genre text;
  v_faction_id TEXT;
  v_xp_total INT;
  v_level INT;
  v_displayed_ids INT[];
  v_discoveries INT;
  v_places_visited INT;
  v_places_added INT;
  v_places_enriched INT;
  v_carnets INT;
  v_plantages INT;
  v_enigma_score INT;
  v_mecenat_total INT;
  v_mecenat_top1_count INT;
  v_general JSON;
  v_faction2 JSON;
  v_general_arr JSON[] := '{}';
  v_player_rank INT;
  v_player_coupe_score INT;
  v_season_start timestamptz;
  v_season_end   timestamptz;
BEGIN
  -- Compteurs joueur (V0.7)
  SELECT COUNT(*) INTO v_discoveries FROM places_discovered WHERE user_id = p_user_id;
  SELECT COUNT(DISTINCT place_id) INTO v_places_visited FROM public.place_explorers WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_places_added FROM places WHERE author_id = p_user_id;
  -- 430 : lieux des autres enrichis, une fois chacun
  SELECT COUNT(DISTINCT v.place_id) INTO v_places_enriched
  FROM public.versions_lieu v JOIN public.places p ON p.id = v.place_id
  WHERE v.auteur = p_user_id AND p.author_id IS DISTINCT FROM p_user_id;
  SELECT COUNT(*) INTO v_carnets FROM public.place_contributions WHERE user_id = p_user_id AND type = 'carnet';
  SELECT COUNT(*) INTO v_plantages FROM public.veille_history WHERE user_id = p_user_id;
  v_enigma_score := public._enigma_score_weighted(p_user_id);

  -- V082 : compteurs Mécénat
  SELECT COALESCE(SUM(amount), 0)::INT INTO v_mecenat_total
  FROM public.place_court_action
  WHERE user_id = p_user_id;

  -- Nombre de lieux où le user est #1 mécène (cumulatif à vie)
  WITH per_place AS (
    SELECT place_id, user_id, SUM(amount) AS total
    FROM public.place_court_action
    GROUP BY place_id, user_id
  ),
  ranked AS (
    SELECT place_id, user_id, total,
           ROW_NUMBER() OVER (PARTITION BY place_id ORDER BY total DESC, user_id) AS rk
    FROM per_place
  )
  SELECT COUNT(*)::INT INTO v_mecenat_top1_count
  FROM ranked WHERE rk = 1 AND user_id = p_user_id;

  -- xp_total + niveau dérivé
  SELECT COALESCE(xp_total, 0), faction_id, COALESCE(displayed_general_title_ids, '{}'), COALESCE(title_gender, 'm')
    INTO v_xp_total, v_faction_id, v_displayed_ids, v_genre
    FROM users WHERE id = p_user_id;
  v_level := public._level_from_xp(v_xp_total);

  -- Évaluation des titres généraux (threshold sur les compteurs étendus)
  -- V082 : ajout 2 nouvelles stats (mecenat_total, mecenat_top1_count)
  FOR v_general IN
    SELECT json_build_object(
      'id', t.id, 'name', public._nom_titre(t, v_genre), 'icon', t.icon, 'unlocks', t.unlocks, 'order', t."order", 'type', 'general',
      'unlocked', CASE
        WHEN t.condition IS NULL THEN false
        WHEN t.condition->>'stat' = 'level'              THEN v_level >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'discoveries'        THEN v_discoveries >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'places_visited'     THEN v_places_visited >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'enigma_score'       THEN v_enigma_score >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'plantages'          THEN v_plantages >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'places_added'       THEN v_places_added >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'carnets'            THEN v_carnets >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'mecenat_total'      THEN v_mecenat_total >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'mecenat_top1_count' THEN v_mecenat_top1_count >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'places_enriched'    THEN v_places_enriched >= (t.condition->>'min')::INT
        ELSE false
      END
    )
    -- 452 : les titres de connaissance ne sont pas des titres qu'on porte (des gélules du profil).
    FROM titles t WHERE t.type = 'general' AND COALESCE(t.condition->>'stat', '') NOT IN ('connaissance', 'polymathe')
    ORDER BY t."order"
  LOOP
    v_general_arr := array_append(v_general_arr, v_general);
  END LOOP;

  -- Titre faction (verbatim mig 068)
  v_faction2 := NULL;
  IF v_faction_id IS NOT NULL THEN
    SELECT started_at, COALESCE(ended_at, now())
    INTO v_season_start, v_season_end
    FROM public.coupe_seasons
    ORDER BY (ended_at IS NULL) DESC, started_at DESC
    LIMIT 1;
    IF v_season_start IS NULL THEN
      v_season_start := 'epoch'::timestamptz;
      v_season_end   := now();
    END IF;

    SELECT s.faction_rank, s.coupe_score
    INTO v_player_rank, v_player_coupe_score
    FROM public._faction_member_scores(v_faction_id, v_season_start, v_season_end) s
    WHERE s.user_id = p_user_id;

    IF v_player_coupe_score IS NULL OR v_player_coupe_score <= 0 THEN
      v_faction2 := NULL;
    ELSE
      SELECT json_build_object('id', t.id, 'name', t.name, 'icon', t.icon, 'unlocks', t.unlocks, 'type', 'faction')
      INTO v_faction2
      FROM titles t
      WHERE t.type = 'faction' AND t.faction_id = v_faction_id
        AND t.condition IS NOT NULL AND (t.condition->>'rank') IS NOT NULL
        AND v_player_rank <= (t.condition->>'rank')::INT
      ORDER BY (t.condition->>'rank')::INT ASC
      LIMIT 1;
    END IF;
  END IF;

  -- V082 : ajout mecenat_total et mecenat_top1_count dans stats
  RETURN json_build_object(
    'unlockedGeneralTitles', COALESCE((SELECT json_agg(elem) FROM unnest(v_general_arr) AS elem WHERE (elem->>'unlocked')::boolean = true), '[]'::json),
    'displayedGeneralTitleIds', v_displayed_ids,
    'factionTitle', v_faction2,
    'stats', json_build_object(
      'level', v_level,
      'xpTotal', v_xp_total,
      'discoveries', v_discoveries,
      'places_visited', v_places_visited,
      'places_added', v_places_added,
      'carnets', v_carnets,
      'plantages', v_plantages,
      'enigma_score', v_enigma_score,
      'mecenat_total', v_mecenat_total,
      'mecenat_top1_count', v_mecenat_top1_count,
      'places_enriched', v_places_enriched
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_mes_titres()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi     text := auth.uid()::text;
  v_vivants text[] := ARRAY['level', 'places_visited', 'places_added', 'places_enriched'];
  v_titres  json;
  v_obtenus int[];
  v_portes  int[];
  v_genre   text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'non connecté';
  END IF;
  v_titres := public.get_user_titles(v_moi);
  SELECT COALESCE(array_agg((e->>'id')::int), '{}') INTO v_obtenus
    FROM json_array_elements(v_titres->'unlockedGeneralTitles') e;
  SELECT COALESCE(displayed_title_ids_v3, '{}'), COALESCE(title_gender, 'm') INTO v_portes, v_genre FROM users WHERE id = v_moi;

  RETURN json_build_object(
    'obtenus', cardinality(v_obtenus),
    'total', (SELECT count(*) FROM titles t
               WHERE t.type = 'general' AND t.condition->>'stat' = ANY (v_vivants)),
    'chemins', (SELECT json_agg(json_build_object(
        'stat', c.stat,
        'compteur', COALESCE((v_titres->'stats'->>c.stat)::int, 0),
        'titres', (SELECT COALESCE(json_agg(json_build_object(
                      'id', t.id, 'nom', public._nom_titre(t, v_genre), 'min', (t.condition->>'min')::int,
                      'obtenu', t.id = ANY (v_obtenus), 'porte', t.id = ANY (v_portes))
                    ORDER BY (t.condition->>'min')::int), '[]'::json)
                   FROM titles t WHERE t.type = 'general' AND t.condition->>'stat' = c.stat))
      ORDER BY c.ordre)
      FROM unnest(v_vivants) WITH ORDINALITY AS c(stat, ordre)),
    -- 452 : les connaissances quittent « Tous les titres » (gélules du profil). Les deux clés restent,
    -- vides, tant que la V2 en ligne les lit (purge-back.md).
    'cultures', '[]'::json,
    'polymathe', NULL
  );
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

CREATE OR REPLACE FUNCTION public.mes_enigmes_culture(p_theme text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := auth.uid()::text;
  t enigma_themes;
  v_genre text := (SELECT COALESCE(title_gender, 'm') FROM users WHERE id = auth.uid()::text);
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'non connecté' USING ERRCODE = '42501'; END IF;
  SELECT * INTO t FROM enigma_themes WHERE id = p_theme AND active;
  IF t.id IS NULL THEN RAISE EXCEPTION 'culture introuvable' USING ERRCODE = 'P0002'; END IF;
  RETURN json_build_object(
    'culture', json_build_object('id', t.id, 'nom', t.label, 'icone', t.icon, 'couleur', t.color, 'zone', t.zone,
                               'presentation', t.presentation), -- 450
    'resolues', (SELECT count(*) FROM public._enigmes_resolues(v_moi, t.id)),
    'total', (SELECT count(*) FROM public._enigmes_du_jeu(t.id)),
    -- 452 : où j'en suis dans cette culture (mon plus haut titre, son rang) et ce qui manque pour le suivant.
    'grade', (SELECT json_build_object('titre', public._nom_titre(s, v_genre), 'rang', (s.condition->>'palier')::int)
                FROM titres_connaissance k JOIN titles s ON s.id = k.title_id
               WHERE k.user_id = v_moi AND s.condition->>'stat' = 'connaissance' AND s.condition->>'theme' = t.id
               ORDER BY (s.condition->>'palier')::int DESC LIMIT 1),
    'prochain', (SELECT json_build_object('titre', public._nom_titre(s, v_genre), 'rang', (s.condition->>'palier')::int,
                        'manque', greatest(public._seuil_connaissance(t.id, (s.condition->>'palier')::int)
                                           - public._points_connaissance(v_moi, t.id), 1))
                   FROM titles s
                  WHERE s.condition->>'stat' = 'connaissance' AND s.condition->>'theme' = t.id
                    AND NOT EXISTS (SELECT 1 FROM titres_connaissance k WHERE k.user_id = v_moi AND k.title_id = s.id)
                  ORDER BY (s.condition->>'palier')::int LIMIT 1),
    -- Le premier cercle : « Les chercher sur la carte » y emmène.
    'centre', CASE WHEN jsonb_array_length(t.cercles) > 0
                   THEN json_build_object('lat', (t.cercles->0->>'lat')::float8, 'lng', (t.cercles->0->>'lng')::float8) END,
    'enigmes', (SELECT COALESCE(json_agg(json_build_object('numero', e.id, -- 448
                                                            'reponse', e.answer, 'question', e.question,
                                                            'explication', e.explanation, 'le', r.le)
                                         ORDER BY r.le DESC), '[]'::json)
                  FROM public._enigmes_resolues(v_moi, t.id) r JOIN enigmas e ON e.id = r.enigma_id));
END $function$;

-- Ceux qui en portaient un le retirent (deux joueurs le 07/10).
UPDATE users u SET displayed_title_ids_v3 = ARRAY(
    SELECT x FROM unnest(u.displayed_title_ids_v3) WITH ORDINALITY AS d(x, ord)
     WHERE x NOT IN (SELECT id FROM titles WHERE condition->>'stat' IN ('connaissance', 'polymathe'))
     ORDER BY ord)
 WHERE u.displayed_title_ids_v3 && ARRAY(SELECT id FROM titles WHERE condition->>'stat' IN ('connaissance', 'polymathe'));
