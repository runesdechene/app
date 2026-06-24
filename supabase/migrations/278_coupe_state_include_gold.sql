-- 278_coupe_state_include_gold.sql
-- WHY : le scoreboard de carte (get_coupe_state) agrégeait la Coupe des Compagnies
-- uniquement à partir des membres ayant des points d'ACTION (user_with_meta, HAVING
-- SUM>0). Une Compagnie dont les seuls points viennent de l'OR conquis (mig 277)
-- n'apparaissait pas. On combine action + or par Compagnie via FULL OUTER JOIN sur
-- _faction_gold_coupe. Le reste (topUsers, myBreakdown personnels) est inchangé :
-- l'or crédite la COMPAGNIE, pas le rang personnel. Copie de la baseline + bloc
-- faction restructuré uniquement.

CREATE OR REPLACE FUNCTION public.get_coupe_state(p_user_id text, p_season_id bigint DEFAULT NULL::bigint)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_season       public.coupe_seasons%ROWTYPE;
  v_window_end   timestamptz;
  v_factions     jsonb;
  v_top_users    jsonb;
  v_my_breakdown jsonb;
  v_c_discover   int := _barem('coupe.discover_remote', 0);
  v_c_visit      int := _barem('coupe.visit_gps',       3);
  v_c_plant      int := _barem('coupe.plant_flag',      2);
  v_c_add        int := _barem('coupe.add_place',       7);
  v_c_carnet     int := _barem('coupe.carnet',          3);
  v_c_photo      int := _barem('coupe.photo',           1);
  v_c_e_ve       int := _barem('coupe.enigma_very_easy', 1);
  v_c_e_e        int := _barem('coupe.enigma_easy',      1);
  v_c_e_m        int := _barem('coupe.enigma_medium',    1);
  v_c_e_h        int := _barem('coupe.enigma_hard',      1);
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
    SELECT pd.user_id, COUNT(*)::int * v_c_discover AS score
    FROM public.places_discovered pd
    WHERE pd.discovered_at >= v_season.started_at AND pd.discovered_at < v_window_end
    GROUP BY pd.user_id
    UNION ALL
    SELECT pe.user_id, COUNT(DISTINCT pe.place_id)::int * v_c_visit
    FROM public.place_explorers pe
    WHERE pe.visited_at >= v_season.started_at AND pe.visited_at < v_window_end
    GROUP BY pe.user_id
    UNION ALL
    SELECT p.author_id, COUNT(*)::int * v_c_add
    FROM public.places p
    WHERE p.created_at >= v_season.started_at AND p.created_at < v_window_end
      AND p.author_id IS NOT NULL
    GROUP BY p.author_id
    UNION ALL
    SELECT pc.user_id, COUNT(*)::int * v_c_carnet
    FROM public.place_contributions pc
    WHERE pc.type = 'carnet'
      AND pc.created_at >= v_season.started_at AND pc.created_at < v_window_end
    GROUP BY pc.user_id
    UNION ALL
    SELECT pc.user_id, COUNT(*)::int * v_c_photo
    FROM public.place_contributions pc
    WHERE pc.type = 'photo'
      AND pc.created_at >= v_season.started_at AND pc.created_at < v_window_end
    GROUP BY pc.user_id
    UNION ALL
    SELECT vh.user_id, COUNT(*)::int * v_c_plant
    FROM public.veille_history vh
    WHERE vh.planted_at >= v_season.started_at AND vh.planted_at < v_window_end
    GROUP BY vh.user_id
    UNION ALL
    SELECT er.user_id,
      ( COUNT(*) FILTER (WHERE e.difficulty = 'very_easy')::int * v_c_e_ve
      + COUNT(*) FILTER (WHERE e.difficulty = 'easy')::int      * v_c_e_e
      + COUNT(*) FILTER (WHERE e.difficulty = 'medium')::int    * v_c_e_m
      + COUNT(*) FILTER (WHERE e.difficulty = 'hard')::int      * v_c_e_h
      )
    FROM public.enigma_responses er
    JOIN public.enigmas e ON e.id = er.enigma_id
    WHERE er.correct = TRUE
      AND er.responded_at >= v_season.started_at AND er.responded_at < v_window_end
    GROUP BY er.user_id
  ),
  user_totals AS (
    SELECT us.user_id, SUM(us.score)::int AS total_score
    FROM user_scores us
    GROUP BY us.user_id
    HAVING SUM(us.score) > 0
  ),
  user_with_meta AS (
    SELECT
      ut.user_id, ut.total_score, u.faction_id,
      COALESCE(u.display_name, u.first_name, 'Quelqu''un') AS display_name,
      u.avatar_url
    FROM user_totals ut JOIN public.users u ON u.id = ut.user_id
  ),
  faction_action AS (
    SELECT uwm.faction_id,
           SUM(uwm.total_score)::int AS action_score,
           COUNT(*)::int             AS contributor_count
    FROM user_with_meta uwm
    WHERE uwm.faction_id IS NOT NULL
    GROUP BY uwm.faction_id
  ),
  faction_gold AS (
    SELECT f.id AS faction_id,
           public._faction_gold_coupe(f.id, v_season.started_at, v_window_end) AS gold_score
    FROM public.factions f
    WHERE COALESCE(f.retired, false) = false
  ),
  faction_combined AS (
    SELECT COALESCE(fa.faction_id, fg.faction_id) AS faction_id,
           (COALESCE(fa.action_score, 0) + COALESCE(fg.gold_score, 0))::int AS faction_score,
           COALESCE(fa.contributor_count, 0)::int AS contributor_count
    FROM faction_action fa
    FULL OUTER JOIN faction_gold fg ON fg.faction_id = fa.faction_id
    WHERE (COALESCE(fa.action_score, 0) + COALESCE(fg.gold_score, 0)) > 0
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
    SELECT fc.faction_id, fc.faction_score, fc.contributor_count,
           ROW_NUMBER() OVER (ORDER BY fc.faction_score DESC)::int AS rnk
    FROM faction_combined fc
  ) fact
  JOIN public.factions f ON f.id = fact.faction_id;

  WITH user_scores AS (
    SELECT pd.user_id, COUNT(*)::int * v_c_discover AS score
    FROM public.places_discovered pd
    WHERE pd.discovered_at >= v_season.started_at AND pd.discovered_at < v_window_end
    GROUP BY pd.user_id
    UNION ALL
    SELECT pe.user_id, COUNT(DISTINCT pe.place_id)::int * v_c_visit
    FROM public.place_explorers pe
    WHERE pe.visited_at >= v_season.started_at AND pe.visited_at < v_window_end
    GROUP BY pe.user_id
    UNION ALL
    SELECT p.author_id, COUNT(*)::int * v_c_add
    FROM public.places p
    WHERE p.created_at >= v_season.started_at AND p.created_at < v_window_end
      AND p.author_id IS NOT NULL
    GROUP BY p.author_id
    UNION ALL
    SELECT pc.user_id, COUNT(*)::int * v_c_carnet
    FROM public.place_contributions pc
    WHERE pc.type = 'carnet' AND pc.created_at >= v_season.started_at AND pc.created_at < v_window_end
    GROUP BY pc.user_id
    UNION ALL
    SELECT pc.user_id, COUNT(*)::int * v_c_photo
    FROM public.place_contributions pc
    WHERE pc.type = 'photo' AND pc.created_at >= v_season.started_at AND pc.created_at < v_window_end
    GROUP BY pc.user_id
    UNION ALL
    SELECT vh.user_id, COUNT(*)::int * v_c_plant
    FROM public.veille_history vh
    WHERE vh.planted_at >= v_season.started_at AND vh.planted_at < v_window_end
    GROUP BY vh.user_id
    UNION ALL
    SELECT er.user_id,
      ( COUNT(*) FILTER (WHERE e.difficulty = 'very_easy')::int * v_c_e_ve
      + COUNT(*) FILTER (WHERE e.difficulty = 'easy')::int      * v_c_e_e
      + COUNT(*) FILTER (WHERE e.difficulty = 'medium')::int    * v_c_e_m
      + COUNT(*) FILTER (WHERE e.difficulty = 'hard')::int      * v_c_e_h
      )
    FROM public.enigma_responses er
    JOIN public.enigmas e ON e.id = er.enigma_id
    WHERE er.correct = TRUE AND er.responded_at >= v_season.started_at AND er.responded_at < v_window_end
    GROUP BY er.user_id
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
    SELECT us.user_id, SUM(us.score)::int AS total_score,
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
      'userId',          p_user_id,
      'lieuxDecouverts', COALESCE(my_disc.cnt, 0),
      'lieuxExplores',   COALESCE(my_visites.cnt, 0),
      'lieuxAjoutes',    COALESCE(my_places.cnt, 0),
      'carnets',         COALESCE(my_carnets.cnt, 0),
      'photos',          COALESCE(my_photos.cnt, 0),
      'plantages',       COALESCE(my_plantages.cnt, 0),
      'enigmes', jsonb_build_object(
        'total',    COALESCE(my_enigmes.cnt, 0),
        'veryEasy', COALESCE(my_enigmes.very_easy, 0),
        'easy',     COALESCE(my_enigmes.easy, 0),
        'medium',   COALESCE(my_enigmes.medium, 0),
        'hard',     COALESCE(my_enigmes.hard, 0)
      ),
      'score', public._user_coupe_score(p_user_id, v_season.started_at, v_window_end)
    )
    INTO v_my_breakdown
    FROM
      (SELECT COUNT(*)::int AS cnt FROM public.places_discovered
         WHERE user_id = p_user_id
           AND discovered_at >= v_season.started_at AND discovered_at < v_window_end) my_disc,
      (SELECT COUNT(DISTINCT place_id)::int AS cnt FROM public.place_explorers
         WHERE user_id = p_user_id
           AND visited_at >= v_season.started_at AND visited_at < v_window_end) my_visites,
      (SELECT COUNT(*)::int AS cnt FROM public.places
         WHERE author_id = p_user_id
           AND created_at >= v_season.started_at AND created_at < v_window_end) my_places,
      (SELECT COUNT(*)::int AS cnt FROM public.place_contributions
         WHERE user_id = p_user_id AND type = 'carnet'
           AND created_at >= v_season.started_at AND created_at < v_window_end) my_carnets,
      (SELECT COUNT(*)::int AS cnt FROM public.place_contributions
         WHERE user_id = p_user_id AND type = 'photo'
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
$function$;