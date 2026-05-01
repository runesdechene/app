-- 038_enigma_weighted_score.sql
-- WHY : pondération douce des énigmes par difficulté (validée Uriel 2 mai
-- 2026). Avant : +1 fixe quelle que soit la difficulté. Après : 1/1/2/3
-- pour very_easy/easy/medium/hard, identique pour Gloire et Coupe.
--
-- Logique : l'effort intellectuel d'une hard mérite plus que celui d'une
-- very_easy, et le ratio max 3 reste raisonnable contre la triche
-- compétitive en saison. Le compteur brut "énigmes validées" reste à +1
-- (volume informatif, non pondéré).
--
-- Pour éviter de dupliquer le CASE difficulty dans 6 RPCs, on factorise
-- en helper IMMUTABLE `_enigma_score_weighted` qui prend les 4 colonnes
-- (user_id, fenêtre temporelle optionnelle) et retourne la somme pondérée.
--
-- Touche : get_my_glory, get_coupe_state, get_player_profile, get_leaderboard,
-- get_faction_members, get_user_titles. Toutes reprises EXACTES de leur
-- dernière version, avec juste le calcul énigmes remplacé.

-- ============================================================
-- Helper IMMUTABLE qui retourne le score énigmes pondéré pour un user
-- sur une fenêtre temporelle [from, to]. NULL pour from/to = pas de filtre.
-- ============================================================

CREATE OR REPLACE FUNCTION public._enigma_score_weighted(
  p_user_id text,
  p_from    timestamptz DEFAULT NULL,
  p_to      timestamptz DEFAULT NULL
) RETURNS integer
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(SUM(
    CASE e.difficulty
      WHEN 'very_easy' THEN 1
      WHEN 'easy'      THEN 1
      WHEN 'medium'    THEN 2
      WHEN 'hard'      THEN 3
      ELSE 1
    END
  ), 0)::int
  FROM public.enigma_responses er
  JOIN public.enigmas e ON e.id = er.enigma_id
  WHERE er.user_id = p_user_id
    AND er.correct = TRUE
    AND (p_from IS NULL OR er.responded_at >= p_from)
    AND (p_to   IS NULL OR er.responded_at <  p_to);
$$;

GRANT EXECUTE ON FUNCTION public._enigma_score_weighted(text, timestamptz, timestamptz) TO authenticated, anon, service_role;

-- ============================================================
-- get_my_glory — utilise _enigma_score_weighted
-- Reprise de mig 031 (avec correction visites + photos + lieux veillés mig 032).
-- Seul le calcul énigmes change.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_glory(p_user_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_lieux_explores  integer;
  v_lieux_ajoutes   integer;
  v_carnets         integer;
  v_photos          integer;
  v_plantages       integer;
  v_enigmes_total   integer;
  v_enigmes_score   integer;
  v_enigmes_very_easy integer;
  v_enigmes_easy    integer;
  v_enigmes_medium  integer;
  v_enigmes_hard    integer;
  v_glory           integer;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT COUNT(DISTINCT place_id) INTO v_lieux_explores
  FROM public.place_explorers WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_lieux_ajoutes
  FROM public.places WHERE author_id = p_user_id;

  SELECT COUNT(*) INTO v_carnets
  FROM public.place_contributions
  WHERE user_id = p_user_id AND type = 'carnet';

  SELECT COALESCE(SUM(
    COALESCE(jsonb_array_length(images), 0)
    + CASE
        WHEN (images IS NULL OR jsonb_array_length(images) = 0)
         AND image_url IS NOT NULL AND image_url != ''
        THEN 1 ELSE 0
      END
  ), 0)::int
  INTO v_photos
  FROM public.place_contributions
  WHERE user_id = p_user_id;

  SELECT COUNT(*) INTO v_plantages
  FROM public.veille_history WHERE user_id = p_user_id;

  -- Compteur brut (volume) — non pondéré, peu importe la difficulté
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE e.difficulty = 'very_easy'),
    COUNT(*) FILTER (WHERE e.difficulty = 'easy'),
    COUNT(*) FILTER (WHERE e.difficulty = 'medium'),
    COUNT(*) FILTER (WHERE e.difficulty = 'hard')
  INTO
    v_enigmes_total, v_enigmes_very_easy, v_enigmes_easy, v_enigmes_medium, v_enigmes_hard
  FROM public.enigma_responses er
  JOIN public.enigmas e ON e.id = er.enigma_id
  WHERE er.user_id = p_user_id AND er.correct = TRUE;

  -- Score Gloire (pondéré par difficulté)
  v_enigmes_score := public._enigma_score_weighted(p_user_id);

  v_glory :=
      COALESCE(v_lieux_explores, 0) * 1
    + COALESCE(v_lieux_ajoutes,  0) * 7
    + COALESCE(v_carnets,        0) * 3
    + COALESCE(v_photos,         0) * 1
    + COALESCE(v_plantages,      0) * 5
    + COALESCE(v_enigmes_score,  0);

  RETURN json_build_object(
    'glory',           v_glory,
    'lieuxExplores',   COALESCE(v_lieux_explores, 0),
    'lieuxAjoutes',    COALESCE(v_lieux_ajoutes, 0),
    'carnets',         COALESCE(v_carnets, 0),
    'photos',          COALESCE(v_photos, 0),
    'plantages',       COALESCE(v_plantages, 0),
    'enigmes', json_build_object(
      'total',     COALESCE(v_enigmes_total, 0),
      'veryEasy',  COALESCE(v_enigmes_very_easy, 0),
      'easy',      COALESCE(v_enigmes_easy, 0),
      'medium',    COALESCE(v_enigmes_medium, 0),
      'hard',      COALESCE(v_enigmes_hard, 0),
      'score',     COALESCE(v_enigmes_score, 0)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_glory(text) TO authenticated, service_role;

-- ============================================================
-- get_coupe_state — pondération énigmes dans factions agg + top users + myBreakdown
-- Reprise mig 025 + 030, énigmes désormais pondérées.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_coupe_state(
  p_user_id   text,
  p_season_id bigint DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_season       public.coupe_seasons%ROWTYPE;
  v_window_end   timestamptz;
  v_factions     jsonb;
  v_top_users    jsonb;
  v_my_breakdown jsonb;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    p_user_id := NULL;
  END IF;

  IF p_season_id IS NOT NULL THEN
    SELECT * INTO v_season FROM public.coupe_seasons WHERE id = p_season_id;
  ELSE
    SELECT * INTO v_season FROM public.coupe_seasons
    ORDER BY (ended_at IS NULL) DESC, started_at DESC
    LIMIT 1;
  END IF;

  IF v_season.id IS NULL THEN
    RETURN json_build_object('error', 'no_season');
  END IF;

  v_window_end := COALESCE(v_season.ended_at, now());

  WITH user_scores AS (
    SELECT u.id AS user_id, COUNT(DISTINCT pe.place_id)::int * 1 AS score
    FROM public.users u
    JOIN public.place_explorers pe ON pe.user_id = u.id
    WHERE pe.visited_at >= v_season.started_at AND pe.visited_at < v_window_end
    GROUP BY u.id
    UNION ALL
    SELECT u.id, COUNT(*)::int * 7 FROM public.users u
    JOIN public.places p ON p.author_id = u.id
    WHERE p.created_at >= v_season.started_at AND p.created_at < v_window_end
    GROUP BY u.id
    UNION ALL
    SELECT u.id, COUNT(*)::int * 3 FROM public.users u
    JOIN public.place_contributions pc ON pc.user_id = u.id
    WHERE pc.type = 'carnet'
      AND pc.created_at >= v_season.started_at AND pc.created_at < v_window_end
    GROUP BY u.id
    UNION ALL
    SELECT u.id, COALESCE(SUM(
      COALESCE(jsonb_array_length(pc.images), 0)
      + CASE
          WHEN (pc.images IS NULL OR jsonb_array_length(pc.images) = 0)
           AND pc.image_url IS NOT NULL AND pc.image_url != ''
          THEN 1 ELSE 0
        END
    ), 0)::int * 1
    FROM public.users u
    JOIN public.place_contributions pc ON pc.user_id = u.id
    WHERE pc.created_at >= v_season.started_at AND pc.created_at < v_window_end
    GROUP BY u.id
    UNION ALL
    SELECT u.id, COUNT(*)::int * 5 FROM public.users u
    JOIN public.veille_history vh ON vh.user_id = u.id
    WHERE vh.planted_at >= v_season.started_at AND vh.planted_at < v_window_end
    GROUP BY u.id
    UNION ALL
    -- Énigmes pondérées (1/1/2/3) pour la fenêtre saison
    SELECT u.id, public._enigma_score_weighted(u.id, v_season.started_at, v_window_end)
    FROM public.users u
    WHERE EXISTS (
      SELECT 1 FROM public.enigma_responses er
      WHERE er.user_id = u.id AND er.correct = TRUE
        AND er.responded_at >= v_season.started_at AND er.responded_at < v_window_end
    )
  ),
  user_totals AS (
    SELECT us.user_id, SUM(us.score)::int AS total_score
    FROM user_scores us
    GROUP BY us.user_id
    HAVING SUM(us.score) > 0
  ),
  user_with_meta AS (
    SELECT
      ut.user_id,
      ut.total_score,
      u.faction_id,
      COALESCE(u.display_name, u.first_name, 'Quelqu''un') AS display_name,
      u.avatar_url
    FROM user_totals ut
    JOIN public.users u ON u.id = ut.user_id
  )
  SELECT jsonb_agg(jsonb_build_object(
    'factionId',    fact.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'score',        fact.faction_score,
    'memberCount',  fact.contributor_count,
    'rank',         fact.rnk
  ) ORDER BY fact.rnk)
  INTO v_factions
  FROM (
    SELECT
      uwm.faction_id,
      SUM(uwm.total_score)::int    AS faction_score,
      COUNT(*)::int                AS contributor_count,
      ROW_NUMBER() OVER (ORDER BY SUM(uwm.total_score) DESC)::int AS rnk
    FROM user_with_meta uwm
    WHERE uwm.faction_id IS NOT NULL
    GROUP BY uwm.faction_id
  ) fact
  JOIN public.factions f ON f.id = fact.faction_id;

  -- Top 20 users (recalcul, mêmes sources)
  WITH user_scores AS (
    SELECT u.id AS user_id, COUNT(DISTINCT pe.place_id)::int * 1 AS score
    FROM public.users u
    JOIN public.place_explorers pe ON pe.user_id = u.id
    WHERE pe.visited_at >= v_season.started_at AND pe.visited_at < v_window_end
    GROUP BY u.id
    UNION ALL
    SELECT u.id, COUNT(*)::int * 7 FROM public.users u
    JOIN public.places p ON p.author_id = u.id
    WHERE p.created_at >= v_season.started_at AND p.created_at < v_window_end
    GROUP BY u.id
    UNION ALL
    SELECT u.id, COUNT(*)::int * 3 FROM public.users u
    JOIN public.place_contributions pc ON pc.user_id = u.id
    WHERE pc.type = 'carnet' AND pc.created_at >= v_season.started_at AND pc.created_at < v_window_end
    GROUP BY u.id
    UNION ALL
    SELECT u.id, COALESCE(SUM(
      COALESCE(jsonb_array_length(pc.images), 0)
      + CASE
          WHEN (pc.images IS NULL OR jsonb_array_length(pc.images) = 0)
           AND pc.image_url IS NOT NULL AND pc.image_url != ''
          THEN 1 ELSE 0
        END
    ), 0)::int * 1
    FROM public.users u
    JOIN public.place_contributions pc ON pc.user_id = u.id
    WHERE pc.created_at >= v_season.started_at AND pc.created_at < v_window_end
    GROUP BY u.id
    UNION ALL
    SELECT u.id, COUNT(*)::int * 5 FROM public.users u
    JOIN public.veille_history vh ON vh.user_id = u.id
    WHERE vh.planted_at >= v_season.started_at AND vh.planted_at < v_window_end
    GROUP BY u.id
    UNION ALL
    SELECT u.id, public._enigma_score_weighted(u.id, v_season.started_at, v_window_end)
    FROM public.users u
    WHERE EXISTS (
      SELECT 1 FROM public.enigma_responses er
      WHERE er.user_id = u.id AND er.correct = TRUE
        AND er.responded_at >= v_season.started_at AND er.responded_at < v_window_end
    )
  )
  SELECT jsonb_agg(jsonb_build_object(
    'userId',      tu.user_id,
    'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
    'avatarUrl',   u.avatar_url,
    'factionId',   u.faction_id,
    'score',       tu.total_score,
    'rank',        tu.rnk
  ) ORDER BY tu.rnk)
  INTO v_top_users
  FROM (
    SELECT
      us.user_id,
      SUM(us.score)::int AS total_score,
      ROW_NUMBER() OVER (ORDER BY SUM(us.score) DESC)::int AS rnk
    FROM user_scores us
    GROUP BY us.user_id
    HAVING SUM(us.score) > 0
    ORDER BY total_score DESC
    LIMIT 20
  ) tu
  JOIN public.users u ON u.id = tu.user_id
  WHERE u.faction_id IS NOT NULL;

  IF p_user_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'userId',         p_user_id,
      'lieuxExplores',  COALESCE(my_visites.cnt, 0),
      'lieuxAjoutes',   COALESCE(my_places.cnt, 0),
      'carnets',        COALESCE(my_carnets.cnt, 0),
      'photos',         COALESCE(my_photos.cnt, 0),
      'plantages',      COALESCE(my_plantages.cnt, 0),
      'enigmes', jsonb_build_object(
        'total',    COALESCE(my_enigmes.cnt, 0),
        'veryEasy', COALESCE(my_enigmes.very_easy, 0),
        'easy',     COALESCE(my_enigmes.easy, 0),
        'medium',   COALESCE(my_enigmes.medium, 0),
        'hard',     COALESCE(my_enigmes.hard, 0),
        'score',    COALESCE(my_enigmes_score, 0)
      ),
      'score',
        COALESCE(my_visites.cnt,  0) * 1
      + COALESCE(my_places.cnt,   0) * 7
      + COALESCE(my_carnets.cnt,  0) * 3
      + COALESCE(my_photos.cnt,   0) * 1
      + COALESCE(my_plantages.cnt,0) * 5
      + COALESCE(my_enigmes_score, 0)
    )
    INTO v_my_breakdown
    FROM
      (SELECT COUNT(DISTINCT place_id)::int AS cnt FROM public.place_explorers
         WHERE user_id = p_user_id
           AND visited_at >= v_season.started_at AND visited_at < v_window_end) my_visites,
      (SELECT COUNT(*)::int AS cnt FROM public.places
         WHERE author_id = p_user_id
           AND created_at >= v_season.started_at AND created_at < v_window_end) my_places,
      (SELECT COUNT(*)::int AS cnt FROM public.place_contributions
         WHERE user_id = p_user_id AND type = 'carnet'
           AND created_at >= v_season.started_at AND created_at < v_window_end) my_carnets,
      (SELECT COALESCE(SUM(
         COALESCE(jsonb_array_length(images), 0)
         + CASE
             WHEN (images IS NULL OR jsonb_array_length(images) = 0)
              AND image_url IS NOT NULL AND image_url != ''
             THEN 1 ELSE 0
           END
       ), 0)::int AS cnt
       FROM public.place_contributions
       WHERE user_id = p_user_id
         AND created_at >= v_season.started_at AND created_at < v_window_end) my_photos,
      (SELECT COUNT(*)::int AS cnt FROM public.veille_history
         WHERE user_id = p_user_id
           AND planted_at >= v_season.started_at AND planted_at < v_window_end) my_plantages,
      (SELECT
         COUNT(*)::int AS cnt,
         COUNT(*) FILTER (WHERE e.difficulty = 'very_easy')::int AS very_easy,
         COUNT(*) FILTER (WHERE e.difficulty = 'easy')::int      AS easy,
         COUNT(*) FILTER (WHERE e.difficulty = 'medium')::int    AS medium,
         COUNT(*) FILTER (WHERE e.difficulty = 'hard')::int      AS hard
       FROM public.enigma_responses er
       JOIN public.enigmas e ON e.id = er.enigma_id
       WHERE er.user_id = p_user_id AND er.correct = TRUE
         AND er.responded_at >= v_season.started_at AND er.responded_at < v_window_end) my_enigmes,
      (SELECT public._enigma_score_weighted(p_user_id, v_season.started_at, v_window_end) AS my_enigmes_score) my_enigmes_score_t,
      LATERAL (SELECT my_enigmes_score_t.my_enigmes_score AS my_enigmes_score) my_enigmes_score_alias;
  END IF;

  RETURN json_build_object(
    'season', json_build_object(
      'id',        v_season.id,
      'name',      v_season.name,
      'startedAt', v_season.started_at,
      'endedAt',   v_season.ended_at,
      'isActive',  v_season.ended_at IS NULL
    ),
    'factions',    COALESCE(v_factions, '[]'::jsonb),
    'topUsers',    COALESCE(v_top_users, '[]'::jsonb),
    'myBreakdown', v_my_breakdown
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_coupe_state(text, bigint) TO authenticated, anon, service_role;

-- ============================================================
-- get_player_profile — glory pondéré
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_titles_data JSON;
  v_displayed_v3 INT[];
  v_displayed_general JSON;
  v_faction_title JSON;
  v_authored_places JSON;
  v_discovered_places JSON;
  v_favorite_places JSON;
  v_veilled_places JSON;
  v_unlocked_ids INT[];
  v_faction_title_id INT;
  v_influence_placed INT;
  v_glory INT;
  v_lieux_explores INT;
  v_lieux_veilles INT;
  v_enigmas_solved INT;
BEGIN
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  IF v_faction_title IS NOT NULL THEN
    v_faction_title_id := (v_faction_title->>'id')::INT;
  END IF;

  SELECT array_agg((elem->>'id')::INT) INTO v_unlocked_ids
  FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem;
  v_unlocked_ids := COALESCE(v_unlocked_ids, '{}');

  IF v_faction_title_id IS NOT NULL THEN
    v_unlocked_ids := v_unlocked_ids || v_faction_title_id;
  END IF;

  SELECT COALESCE(displayed_title_ids_v3, '{}') INTO v_displayed_v3 FROM users WHERE id = p_user_id;

  IF array_length(v_displayed_v3, 1) > 0 THEN
    SELECT json_agg(row_data ORDER BY pos) INTO v_displayed_general
    FROM (
      SELECT t.id, t.name, t.icon, NULL::TEXT AS icon_url, array_position(v_displayed_v3, t.id) AS pos
      FROM titles t WHERE t.id = ANY(v_displayed_v3) AND t.id > 0 AND t.id = ANY(v_unlocked_ids)
      UNION ALL
      SELECT fw.id * -1 AS id, fw.word AS name, tf.icon, tf.icon_url, array_position(v_displayed_v3, fw.id * -1) AS pos
      FROM fragment_words fw JOIN title_fragments tf ON tf.id = fw.fragment_id
      WHERE (fw.id * -1) = ANY(v_displayed_v3)
        AND EXISTS (SELECT 1 FROM user_fragments uf WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id)
    ) row_data;

    UPDATE users
    SET displayed_title_ids_v3 = (
      SELECT COALESCE(array_agg(tid), '{}')
      FROM unnest(v_displayed_v3) AS tid
      WHERE tid = ANY(v_unlocked_ids)
        OR (tid < 0 AND EXISTS (
          SELECT 1 FROM user_fragments uf
          JOIN fragment_words fw ON fw.fragment_id = uf.fragment_id
          WHERE uf.user_id = p_user_id AND fw.id * -1 = tid
        ))
    )
    WHERE id = p_user_id
      AND displayed_title_ids_v3 IS DISTINCT FROM (
        SELECT COALESCE(array_agg(tid), '{}')
        FROM unnest(v_displayed_v3) AS tid
        WHERE tid = ANY(v_unlocked_ids)
          OR (tid < 0 AND EXISTS (
            SELECT 1 FROM user_fragments uf
            JOIN fragment_words fw ON fw.fragment_id = uf.fragment_id
            WHERE uf.user_id = p_user_id AND fw.id * -1 = tid
          ))
      );
  END IF;

  IF v_displayed_general IS NULL THEN
    SELECT json_agg(elem) INTO v_displayed_general
    FROM (SELECT elem FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem LIMIT 1) sub;
  END IF;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_authored_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''), 'createdAt', p.created_at,
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE p.author_id = p_user_id ORDER BY p.created_at DESC LIMIT 500) sub;

  SELECT COALESCE(json_agg(place_data ORDER BY last_visited_at DESC), '[]'::json) INTO v_discovered_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'visitsCount', stats.visits_count,
      'lastVisitedAt', stats.last_visited_at
    ) AS place_data,
    stats.last_visited_at
    FROM (
      SELECT pe.place_id, COUNT(*) AS visits_count, MAX(pe.visited_at) AS last_visited_at
      FROM public.place_explorers pe
      WHERE pe.user_id = p_user_id
      GROUP BY pe.place_id
    ) stats
    JOIN places p ON p.id = stats.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    ORDER BY stats.last_visited_at DESC
    LIMIT 500
  ) sub;

  SELECT COALESCE(json_agg(place_data ORDER BY total_points DESC), '[]'::json) INTO v_favorite_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'totalPoints', stats.total_points, 'lastActionAt', stats.last_action_at
    ) AS place_data, stats.total_points
    FROM (
      SELECT al.place_id, SUM((al.data->>'points')::INT) AS total_points, MAX(al.created_at) AS last_action_at
      FROM activity_log al
      WHERE al.actor_id = p_user_id AND al.type = 'place_influence' AND al.place_id IS NOT NULL
      GROUP BY al.place_id ORDER BY total_points DESC LIMIT 50
    ) stats
    JOIN places p ON p.id = stats.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
  ) sub;

  SELECT COALESCE(json_agg(place_data ORDER BY planted_at DESC), '[]'::json) INTO v_veilled_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'plantedAt', pv.planted_at,
      'memberCount', (SELECT count(*)::int FROM public.expedition_members em2 WHERE em2.expedition_id = pv.expedition_id)
    ) AS place_data, pv.planted_at
    FROM public.place_veille pv
    JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id AND em.user_id = p_user_id
    JOIN public.places p ON p.id = pv.place_id
    LEFT JOIN public.place_types pt ON pt.id = p.place_type_id
    ORDER BY pv.planted_at DESC LIMIT 500
  ) sub;

  SELECT COALESCE(SUM((al.data->>'points')::INT), 0) INTO v_influence_placed
  FROM activity_log al
  WHERE al.actor_id = p_user_id AND al.type = 'place_influence';

  SELECT COUNT(DISTINCT place_id) INTO v_lieux_explores
  FROM public.place_explorers WHERE user_id = p_user_id;

  SELECT COUNT(DISTINCT pv.place_id) INTO v_lieux_veilles
  FROM public.place_veille pv
  JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id
  WHERE em.user_id = p_user_id;

  SELECT COUNT(*) INTO v_enigmas_solved
  FROM public.enigma_responses
  WHERE user_id = p_user_id AND correct = TRUE;

  v_glory :=
      COALESCE(v_lieux_explores, 0) * 1
    + COALESCE((SELECT COUNT(*) FROM public.places              WHERE author_id = p_user_id), 0) * 7
    + COALESCE((SELECT COUNT(*) FROM public.place_contributions WHERE user_id = p_user_id AND type = 'carnet'), 0) * 3
    + COALESCE((SELECT SUM(
          COALESCE(jsonb_array_length(images), 0)
          + CASE WHEN (images IS NULL OR jsonb_array_length(images) = 0) AND image_url IS NOT NULL AND image_url != '' THEN 1 ELSE 0 END
        )::int FROM public.place_contributions WHERE user_id = p_user_id), 0) * 1
    + COALESCE((SELECT COUNT(*) FROM public.veille_history WHERE user_id = p_user_id), 0) * 5
    + public._enigma_score_weighted(p_user_id);

  SELECT json_build_object(
    'userId', u.id, 'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id, 'factionTitle', f.title, 'factionColor', f.color, 'factionPattern', f.pattern,
    'profileImage', u.avatar_url,
    'explorationPoints', COALESCE(u.exploration_points, 0),
    'eruditionPoints', COALESCE(u.erudition_points, 0),
    'influenceStock', COALESCE(u.influence_stock, 0),
    'influencePlaced', v_influence_placed,
    'glory', v_glory,
    'lieuxExplores', COALESCE(v_lieux_explores, 0),
    'lieuxVeilles',  COALESCE(v_lieux_veilles, 0),
    'enigmasSolved', COALESCE(v_enigmas_solved, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places,
    'discoveredPlaces', v_discovered_places,
    'favoritePlaces', v_favorite_places,
    'veilledPlaces', v_veilled_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  ) INTO v_result FROM users u LEFT JOIN factions f ON f.id = u.faction_id WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile(text) TO authenticated, anon, service_role;

-- ============================================================
-- get_leaderboard — type 'notoriety' utilise _enigma_score_weighted
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_type text, p_limit integer DEFAULT 50)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_result json;
BEGIN
  IF p_type = 'notoriety' THEN
    SELECT COALESCE(json_agg(row_data ORDER BY (row_data->>'rank')::int), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank',         ROW_NUMBER() OVER (ORDER BY scored.glory DESC),
        'userId',       u.id,
        'name',         COALESCE(u.display_name, u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value',        scored.glory
      ) AS row_data
      FROM (
        SELECT
          uid,
          (
            COALESCE((SELECT COUNT(DISTINCT place_id) FROM public.place_explorers WHERE user_id = uid), 0) * 1
          + COALESCE((SELECT COUNT(*)            FROM public.places              WHERE author_id = uid), 0) * 7
          + COALESCE((SELECT COUNT(*)            FROM public.place_contributions WHERE user_id = uid AND type = 'carnet'), 0) * 3
          + COALESCE((SELECT SUM(
                COALESCE(jsonb_array_length(images), 0)
                + CASE WHEN (images IS NULL OR jsonb_array_length(images) = 0) AND image_url IS NOT NULL AND image_url != '' THEN 1 ELSE 0 END
              )::int FROM public.place_contributions WHERE user_id = uid), 0) * 1
          + COALESCE((SELECT COUNT(*)            FROM public.veille_history     WHERE user_id = uid), 0) * 5
          + public._enigma_score_weighted(uid)
          )::int AS glory
        FROM (SELECT id AS uid FROM public.users) base
      ) scored
      JOIN public.users u ON u.id = scored.uid
      LEFT JOIN public.factions f ON f.id = u.faction_id
      WHERE scored.glory > 0
      ORDER BY scored.glory DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'authored' THEN
    SELECT COALESCE(json_agg(row_data ORDER BY (row_data->>'rank')::int), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank',         ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC),
        'userId',       u.id,
        'name',         COALESCE(u.display_name, u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value',        COUNT(*)::int
      ) AS row_data
      FROM public.users u
      JOIN public.places p ON p.author_id = u.id
      LEFT JOIN public.factions f ON f.id = u.faction_id
      GROUP BY u.id, u.display_name, u.first_name, u.email_address, u.avatar_url, f.color
      ORDER BY COUNT(*) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'veilled' THEN
    SELECT COALESCE(json_agg(row_data ORDER BY (row_data->>'rank')::int), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank',         ROW_NUMBER() OVER (ORDER BY COUNT(DISTINCT pv.place_id) DESC),
        'userId',       u.id,
        'name',         COALESCE(u.display_name, u.first_name, u.email_address),
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value',        COUNT(DISTINCT pv.place_id)::int
      ) AS row_data
      FROM public.users u
      JOIN public.expedition_members em ON em.user_id = u.id
      JOIN public.place_veille pv ON pv.expedition_id = em.expedition_id
      LEFT JOIN public.factions f ON f.id = u.faction_id
      GROUP BY u.id, u.display_name, u.first_name, u.email_address, u.avatar_url, f.color
      ORDER BY COUNT(DISTINCT pv.place_id) DESC
      LIMIT p_limit
    ) sub;

  ELSE
    v_result := '[]'::json;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(text, integer) TO authenticated, anon, service_role;

-- ============================================================
-- get_faction_members — pondération énigmes via helper
-- Reprise mig 035 (CTEs aggregées), seul user_scores.s_enigmes change.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_faction_members(p_faction_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_season_start timestamptz;
  v_season_end   timestamptz;
  v_result json;
BEGIN
  SELECT started_at, COALESCE(ended_at, now())
  INTO v_season_start, v_season_end
  FROM public.coupe_seasons
  ORDER BY (ended_at IS NULL) DESC, started_at DESC
  LIMIT 1;

  IF v_season_start IS NULL THEN
    v_season_start := 'epoch'::timestamptz;
    v_season_end   := now();
  END IF;

  WITH faction_users AS (SELECT id FROM public.users WHERE faction_id = p_faction_id),
  v_visites   AS (SELECT user_id, COUNT(DISTINCT place_id)::int AS cnt FROM public.place_explorers   WHERE user_id   IN (SELECT id FROM faction_users) GROUP BY user_id),
  v_places    AS (SELECT author_id AS user_id, COUNT(*)::int AS cnt   FROM public.places              WHERE author_id IN (SELECT id FROM faction_users) GROUP BY author_id),
  v_carnets   AS (SELECT user_id, COUNT(*)::int AS cnt                FROM public.place_contributions WHERE user_id   IN (SELECT id FROM faction_users) AND type = 'carnet' GROUP BY user_id),
  v_photos    AS (
    SELECT user_id, COALESCE(SUM(
      COALESCE(jsonb_array_length(images), 0)
      + CASE WHEN (images IS NULL OR jsonb_array_length(images) = 0) AND image_url IS NOT NULL AND image_url != '' THEN 1 ELSE 0 END
    ), 0)::int AS cnt
    FROM public.place_contributions WHERE user_id IN (SELECT id FROM faction_users) GROUP BY user_id
  ),
  v_plantages AS (SELECT user_id, COUNT(*)::int AS cnt FROM public.veille_history WHERE user_id IN (SELECT id FROM faction_users) GROUP BY user_id),
  v_enigmes   AS (SELECT fu.id AS user_id, public._enigma_score_weighted(fu.id) AS cnt FROM faction_users fu),
  s_visites   AS (SELECT user_id, COUNT(DISTINCT place_id)::int AS cnt FROM public.place_explorers WHERE user_id IN (SELECT id FROM faction_users) AND visited_at >= v_season_start AND visited_at < v_season_end GROUP BY user_id),
  s_places    AS (SELECT author_id AS user_id, COUNT(*)::int AS cnt FROM public.places WHERE author_id IN (SELECT id FROM faction_users) AND created_at >= v_season_start AND created_at < v_season_end GROUP BY author_id),
  s_carnets   AS (SELECT user_id, COUNT(*)::int AS cnt FROM public.place_contributions WHERE user_id IN (SELECT id FROM faction_users) AND type = 'carnet' AND created_at >= v_season_start AND created_at < v_season_end GROUP BY user_id),
  s_photos    AS (
    SELECT user_id, COALESCE(SUM(
      COALESCE(jsonb_array_length(images), 0)
      + CASE WHEN (images IS NULL OR jsonb_array_length(images) = 0) AND image_url IS NOT NULL AND image_url != '' THEN 1 ELSE 0 END
    ), 0)::int AS cnt
    FROM public.place_contributions WHERE user_id IN (SELECT id FROM faction_users) AND created_at >= v_season_start AND created_at < v_season_end GROUP BY user_id
  ),
  s_plantages AS (SELECT user_id, COUNT(*)::int AS cnt FROM public.veille_history WHERE user_id IN (SELECT id FROM faction_users) AND planted_at >= v_season_start AND planted_at < v_season_end GROUP BY user_id),
  s_enigmes   AS (SELECT fu.id AS user_id, public._enigma_score_weighted(fu.id, v_season_start, v_season_end) AS cnt FROM faction_users fu),
  user_scores AS (
    SELECT
      fu.id AS user_id,
      (COALESCE(vv.cnt,0)*1 + COALESCE(vp.cnt,0)*7 + COALESCE(vc.cnt,0)*3 + COALESCE(vph.cnt,0)*1 + COALESCE(vpl.cnt,0)*5 + COALESCE(ve.cnt,0))::int AS glory,
      (COALESCE(sv.cnt,0)*1 + COALESCE(sp.cnt,0)*7 + COALESCE(sc.cnt,0)*3 + COALESCE(sph.cnt,0)*1 + COALESCE(spl.cnt,0)*5 + COALESCE(se.cnt,0))::int AS coupe_score
    FROM faction_users fu
    LEFT JOIN v_visites vv ON vv.user_id = fu.id
    LEFT JOIN v_places vp ON vp.user_id = fu.id
    LEFT JOIN v_carnets vc ON vc.user_id = fu.id
    LEFT JOIN v_photos vph ON vph.user_id = fu.id
    LEFT JOIN v_plantages vpl ON vpl.user_id = fu.id
    LEFT JOIN v_enigmes ve ON ve.user_id = fu.id
    LEFT JOIN s_visites sv ON sv.user_id = fu.id
    LEFT JOIN s_places sp ON sp.user_id = fu.id
    LEFT JOIN s_carnets sc ON sc.user_id = fu.id
    LEFT JOIN s_photos sph ON sph.user_id = fu.id
    LEFT JOIN s_plantages spl ON spl.user_id = fu.id
    LEFT JOIN s_enigmes se ON se.user_id = fu.id
  )
  SELECT COALESCE(json_agg(member ORDER BY coupe_score DESC, glory DESC, user_id), '[]'::json) INTO v_result
  FROM (
    SELECT json_build_object(
      'userId', u.id, 'name', COALESCE(u.display_name, u.first_name, u.email_address),
      'profileImage', u.avatar_url, 'glory', us.glory, 'coupeScore', us.coupe_score,
      'factionTitle2', (SELECT get_user_titles(u.id)->'factionTitle')
    ) AS member, us.glory, us.coupe_score, u.id AS user_id
    FROM user_scores us JOIN public.users u ON u.id = us.user_id
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_faction_members(text) TO authenticated, anon, service_role;

-- ============================================================
-- get_user_titles — rang faction par coupe_score pondéré
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_titles(p_user_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_glory INT;
  v_displayed_ids INT[];
  v_discoveries INT;
  v_claims INT;
  v_likes INT;
  v_fortifications INT;
  v_places_added INT;
  v_general JSON;
  v_faction2 JSON;
  v_general_arr JSON[] := '{}';
  v_player_rank INT;
  v_player_coupe_score INT;
  v_glory_rank INT;
  v_season_start timestamptz;
  v_season_end   timestamptz;
BEGIN
  SELECT COUNT(*) INTO v_discoveries FROM places_discovered WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_claims FROM places WHERE claimed_by = p_user_id;
  SELECT COALESCE(exploration_points, 0) + COALESCE(erudition_points, 0), faction_id, COALESCE(displayed_general_title_ids, '{}')
    INTO v_glory, v_faction_id, v_displayed_ids
    FROM users WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_likes FROM places_liked WHERE user_id = p_user_id;
  SELECT COALESCE(SUM(fortification_level), 0) INTO v_fortifications
    FROM places WHERE claimed_by = p_user_id AND fortification_level > 0;
  SELECT COUNT(*) INTO v_places_added FROM places WHERE author_id = p_user_id;

  SELECT rk INTO v_glory_rank
  FROM (SELECT id, RANK() OVER (ORDER BY (COALESCE(exploration_points, 0) + COALESCE(erudition_points, 0)) DESC) AS rk FROM users) ranked
  WHERE id = p_user_id;

  FOR v_general IN
    SELECT json_build_object(
      'id', t.id, 'name', t.name, 'icon', t.icon, 'unlocks', t.unlocks, 'order', t."order", 'type', 'general',
      'unlocked', CASE
        WHEN t.condition IS NULL THEN false
        WHEN (t.condition->>'rank') IS NOT NULL AND t.condition->>'stat' IN ('notoriety', 'glory')
          THEN v_glory_rank <= (t.condition->>'rank')::INT
        WHEN t.condition->>'stat' = 'discoveries' THEN v_discoveries >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'claims' THEN v_claims >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' IN ('notoriety', 'glory') THEN v_glory >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'likes' THEN v_likes >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'fortifications' THEN v_fortifications >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'places_added' THEN v_places_added >= (t.condition->>'min')::INT
        ELSE false
      END
    )
    FROM titles t WHERE t.type = 'general' ORDER BY t."order"
  LOOP
    v_general_arr := array_append(v_general_arr, v_general);
  END LOOP;

  v_faction2 := NULL;
  IF v_faction_id IS NOT NULL THEN
    SELECT started_at, COALESCE(ended_at, now())
    INTO v_season_start, v_season_end
    FROM public.coupe_seasons
    ORDER BY (ended_at IS NULL) DESC, started_at DESC
    LIMIT 1;
    IF v_season_start IS NULL THEN v_season_start := 'epoch'::timestamptz; v_season_end := now(); END IF;

    WITH faction_users AS (SELECT id FROM users WHERE faction_id = v_faction_id),
    s_visites   AS (SELECT user_id, COUNT(DISTINCT place_id)::int AS cnt FROM public.place_explorers WHERE user_id IN (SELECT id FROM faction_users) AND visited_at >= v_season_start AND visited_at < v_season_end GROUP BY user_id),
    s_places    AS (SELECT author_id AS user_id, COUNT(*)::int AS cnt FROM public.places WHERE author_id IN (SELECT id FROM faction_users) AND created_at >= v_season_start AND created_at < v_season_end GROUP BY author_id),
    s_carnets   AS (SELECT user_id, COUNT(*)::int AS cnt FROM public.place_contributions WHERE user_id IN (SELECT id FROM faction_users) AND type = 'carnet' AND created_at >= v_season_start AND created_at < v_season_end GROUP BY user_id),
    s_photos    AS (
      SELECT user_id, COALESCE(SUM(
        COALESCE(jsonb_array_length(images), 0)
        + CASE WHEN (images IS NULL OR jsonb_array_length(images) = 0) AND image_url IS NOT NULL AND image_url != '' THEN 1 ELSE 0 END
      ), 0)::int AS cnt
      FROM public.place_contributions WHERE user_id IN (SELECT id FROM faction_users) AND created_at >= v_season_start AND created_at < v_season_end GROUP BY user_id
    ),
    s_plantages AS (SELECT user_id, COUNT(*)::int AS cnt FROM public.veille_history WHERE user_id IN (SELECT id FROM faction_users) AND planted_at >= v_season_start AND planted_at < v_season_end GROUP BY user_id),
    s_enigmes   AS (SELECT fu.id AS user_id, public._enigma_score_weighted(fu.id, v_season_start, v_season_end) AS cnt FROM faction_users fu),
    user_coupe AS (
      SELECT fu.id, (COALESCE(sv.cnt,0)*1 + COALESCE(sp.cnt,0)*7 + COALESCE(sc.cnt,0)*3 + COALESCE(sph.cnt,0)*1 + COALESCE(spl.cnt,0)*5 + COALESCE(se.cnt,0))::int AS coupe_score
      FROM faction_users fu
      LEFT JOIN s_visites sv ON sv.user_id = fu.id
      LEFT JOIN s_places sp ON sp.user_id = fu.id
      LEFT JOIN s_carnets sc ON sc.user_id = fu.id
      LEFT JOIN s_photos sph ON sph.user_id = fu.id
      LEFT JOIN s_plantages spl ON spl.user_id = fu.id
      LEFT JOIN s_enigmes se ON se.user_id = fu.id
    ),
    ranked AS (SELECT id, coupe_score, ROW_NUMBER() OVER (ORDER BY coupe_score DESC, id)::int AS rk FROM user_coupe)
    SELECT rk, coupe_score INTO v_player_rank, v_player_coupe_score FROM ranked WHERE id = p_user_id;

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

  RETURN json_build_object(
    'unlockedGeneralTitles', COALESCE((SELECT json_agg(elem) FROM unnest(v_general_arr) AS elem WHERE (elem->>'unlocked')::boolean = true), '[]'::json),
    'displayedGeneralTitleIds', v_displayed_ids,
    'factionTitle', v_faction2,
    'stats', json_build_object('discoveries', v_discoveries, 'claims', v_claims, 'glory', v_glory, 'likes', v_likes, 'fortifications', v_fortifications, 'places_added', v_places_added)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_titles(text) TO authenticated, anon, service_role;
