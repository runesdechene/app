-- 039_fix_coupe_state_myBreakdown.sql
-- WHY : la mig 038 a introduit dans get_coupe_state.myBreakdown un LATERAL
-- avec un alias `my_enigmes_score` dupliqué entre 2 sub-queries du FROM.
-- PostgreSQL plante avec ambiguous column quand p_user_id != NULL (= user
-- authentifié appelant la RPC). Symptômes : RPC throw côté client →
-- FactionBar ne charge pas, CoupeBadge à 0, profil vide.
--
-- Fix : remplacer le LATERAL par une scalar subquery inline directement
-- dans le jsonb_build_object. Plus simple et plus lisible.

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
  v_my_enigmes_score int;
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
    -- Score énigmes pondéré du user pour la fenêtre saison, calculé en
    -- variable simple pour éviter les conflits d'alias dans le FROM.
    v_my_enigmes_score := public._enigma_score_weighted(p_user_id, v_season.started_at, v_window_end);

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
        'score',    COALESCE(v_my_enigmes_score, 0)
      ),
      'score',
        COALESCE(my_visites.cnt,  0) * 1
      + COALESCE(my_places.cnt,   0) * 7
      + COALESCE(my_carnets.cnt,  0) * 3
      + COALESCE(my_photos.cnt,   0) * 1
      + COALESCE(my_plantages.cnt,0) * 5
      + COALESCE(v_my_enigmes_score, 0)
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
         AND er.responded_at >= v_season.started_at AND er.responded_at < v_window_end) my_enigmes;
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
