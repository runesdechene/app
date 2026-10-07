-- WHY: les titres de connaissance (énigmes, spec 2026-10-07-v2-enigmes-design.md) se gagnent, se
--      lisent dans « Tous les titres » (une famille par culture, Polymathe) et se portent, accordés au
--      genre choisi (users.title_gender, titles.name_f).
-- BASE: get_user_titles(text), get_mes_titres(), get_profil_explorateur(text), actifs_carte(),
--       compagnie(text) — définitions live copiées entières (pg_get_functiondef, 2026-10-07).
-- SCHEMA CHECKED (2026-10-07) : titles(name_f), titres_connaissance(user_id, title_id),
--   users(title_gender, displayed_title_ids_v3), enigma_themes(label, icon, color, active, sort_order).

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
        WHEN t.condition->>'stat' IN ('connaissance', 'polymathe') THEN EXISTS (
          SELECT 1 FROM public.titres_connaissance c WHERE c.user_id = p_user_id AND c.title_id = t.id)
        ELSE false
      END
    )
    FROM titles t WHERE t.type = 'general' ORDER BY t."order"
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
               WHERE t.type = 'general' AND t.condition->>'stat' = ANY (v_vivants))
           + (SELECT count(*) FROM titles t JOIN enigma_themes c ON c.id = t.condition->>'theme' AND c.active
               WHERE t.condition->>'stat' = 'connaissance')
           + (SELECT count(*) FROM titles t WHERE t.condition->>'stat' = 'polymathe'),
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
    'cultures', (SELECT COALESCE(json_agg(json_build_object(
        'id', c.id, 'nom', c.label, 'icone', c.icon, 'couleur', c.color,
        'points', public._points_connaissance(v_moi, c.id),
        'total', public._total_connaissance(c.id),
        'titres', (SELECT COALESCE(json_agg(json_build_object(
                      'id', t.id, 'nom', public._nom_titre(t, v_genre),
                      'min', public._seuil_connaissance(c.id, (t.condition->>'palier')::int),
                      'obtenu', t.id = ANY (v_obtenus), 'porte', t.id = ANY (v_portes))
                    ORDER BY (t.condition->>'palier')::int), '[]'::json)
                   FROM titles t WHERE t.condition->>'stat' = 'connaissance' AND t.condition->>'theme' = c.id))
      ORDER BY c.sort_order, c.id), '[]'::json)
      FROM enigma_themes c WHERE c.active),
    'polymathe', (SELECT json_build_object(
        'id', t.id, 'nom', public._nom_titre(t, v_genre),
        'compteur', (SELECT count(*) FROM titres_connaissance k JOIN titles s ON s.id = k.title_id
                      WHERE k.user_id = v_moi AND s.condition->>'stat' = 'connaissance'
                        AND (s.condition->>'palier')::int = 6),
        'obtenu', t.id = ANY (v_obtenus), 'porte', t.id = ANY (v_portes))
      FROM titles t WHERE t.condition->>'stat' = 'polymathe' LIMIT 1)
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
      'estMoi', v_moi
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.actifs_carte()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  RETURN (
    WITH a AS (
      SELECT p.user_id, p.vu_a, u.brouiller_pistes AS brouille,
             CASE WHEN u.brouiller_pistes
                  THEN floor((p.latitude - g.olat) / 0.2) * 0.2 + g.olat + 0.1
                  ELSE p.latitude END AS lat,
             CASE WHEN u.brouiller_pistes
                  THEN floor((p.longitude - g.olng) / 0.3) * 0.3 + g.olng + 0.15
                  ELSE p.longitude END AS lng
      FROM presences p JOIN users u ON u.id = p.user_id CROSS JOIN grille_brouillage g
      WHERE p.vu_a > now() - interval '1 hour' AND p.user_id <> v_moi)
    SELECT COALESCE(json_agg(json_build_object(
      'id', u.id,
      'nom', user_public_name(u.id, u.display_name, u.first_name),
      'avatar', u.avatar_url,
      'niveau', public._level_from_xp(COALESCE(u.xp_total, 0)),
      'titre', (SELECT public._nom_titre(t, u.title_gender)
                FROM unnest(u.displayed_title_ids_v3) WITH ORDINALITY AS x(tid, ord)
                JOIN titles t ON t.id = x.tid AND t.type = 'general'
                ORDER BY x.ord LIMIT 1),
      'signe', (SELECT json_build_object('nom', tf.name, 'imageUrl', COALESCE(tf.image_url, tf.icon_url))
                FROM title_fragments tf
                WHERE tf.id = u.signe_fragment_id AND tf.visible
                  AND COALESCE(tf.image_url, tf.icon_url) IS NOT NULL
                  AND EXISTS (SELECT 1 FROM user_fragments uf
                              WHERE uf.user_id = u.id AND uf.fragment_id = tf.id)),
      'lat', a.lat,
      'lng', a.lng,
      'brouille', a.brouille,
      'vuA', a.vu_a,
      'enLigne', a.vu_a > now() - interval '10 minutes')
      ORDER BY a.vu_a DESC), '[]'::json)
    FROM a JOIN users u ON u.id = a.user_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.compagnie(p_id text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH moi AS (SELECT (auth.uid())::text AS id),
  r AS (SELECT public._role_compagnie(p_id, moi.id) AS role FROM moi)
  SELECT json_build_object(
    'id', f.id, 'nom', f.title, 'devise', f.devise, 'mission', f.description, 'couleur', f.color,
    'avatar', f.image_url, 'privee', f.privee, 'fondeeLe', f.created_at,
    'roles', json_build_object('chefM', f.chef_m, 'chefF', f.chef_f, 'officierM', f.officier_m, 'officierF', f.officier_f),
    'monRole', r.role,
    'demandee', EXISTS (SELECT 1 FROM demandes_compagnie d WHERE d.faction_id = f.id AND d.user_id = moi.id),
    'nbMembres', (SELECT count(*) FROM faction_members m WHERE m.faction_id = f.id),
    'membres', CASE WHEN NOT f.privee OR r.role IS NOT NULL THEN COALESCE((SELECT json_agg(json_build_object('id', u.id,
        'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url, 'role', m.role,
        'genre', CASE WHEN u.title_gender = 'f' THEN 'f' ELSE 'm' END,
        'niveau', public._level_from_xp(COALESCE(u.xp_total, 0)),
        'titre', (SELECT public._nom_titre(t, u.title_gender)
                    FROM unnest(u.displayed_title_ids_v3) WITH ORDINALITY AS x(tid, ord)
                    JOIN public.titles t ON t.id = x.tid AND t.type = 'general'
                   ORDER BY x.ord
                   LIMIT 1))
        ORDER BY CASE m.role WHEN 'chef' THEN 0 WHEN 'officier' THEN 1 ELSE 2 END, m.joined_at DESC)
      FROM faction_members m JOIN users u ON u.id = m.user_id WHERE m.faction_id = f.id), '[]'::json) ELSE '[]'::json END,
    'lieux', COALESCE((SELECT json_agg(public._carte_lieu(l.id)::jsonb || jsonb_build_object(
        'par', l.par, 'quand', l.quand,
        'auteur', CASE WHEN l.par IS NULL THEN NULL ELSE jsonb_build_object('nom', l.par, 'avatarUrl', l.avatar) END)
        ORDER BY l.quand DESC)
      FROM (SELECT DISTINCT ON (x.place_id) p.id, p.title, x.created_at AS quand,
              COALESCE(NULLIF(x.title, ''), (SELECT user_public_name(u.id, u.display_name, u.first_name)
                FROM expedition_members em JOIN users u ON u.id = em.user_id WHERE em.expedition_id = x.id LIMIT 1)) AS par,
              -- 438 : l'avatar de qui a revendiqué ; une expédition nommée n'en a pas.
              CASE WHEN NULLIF(x.title, '') IS NULL THEN (SELECT u.avatar_url
                FROM expedition_members em JOIN users u ON u.id = em.user_id WHERE em.expedition_id = x.id LIMIT 1) END AS avatar
            FROM expeditions x JOIN places p ON p.id = x.place_id
            WHERE x.pour_compagnie = f.id AND p.masked IS NOT TRUE AND p.private IS NOT TRUE
            ORDER BY x.place_id, x.created_at DESC) l), '[]'::json),
    'demandes', CASE WHEN r.role IN ('chef', 'officier') THEN COALESCE((SELECT json_agg(json_build_object(
        'id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name), 'avatar', u.avatar_url,
        'mot', d.mot, 'quand', d.cree_le) ORDER BY d.cree_le)
      FROM demandes_compagnie d JOIN users u ON u.id = d.user_id WHERE d.faction_id = f.id), '[]'::json) ELSE '[]'::json END)
  FROM factions f, moi, r
  WHERE f.id = p_id AND NOT f.retired AND moi.id IS NOT NULL;
$function$;
