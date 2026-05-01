-- 035_titles_faction_perf_and_zero.sql
-- WHY : 3 corrections sur la mig 034.
--
-- 1. Lenteur : sub-queries corrélées exécutées N fois (une par user de la
--    faction) → O(N²). Refonte avec CTEs LEFT JOIN aggregées : chaque
--    table est scannée une fois, pas N fois.
--
-- 2. Ex aequo : RANK() donne le même rang à plusieurs users avec le même
--    score, donc plusieurs personnes pouvaient avoir le même titre faction.
--    Switch en ROW_NUMBER() qui départage déterministiquement (par user.id
--    en tiebreaker).
--
-- 3. Zero score = pas de titre : si tout le monde est à 0 coupe_score, on
--    avait quand même tous rank<=5 → tout le monde gagnait Prélat. Fix :
--    condition supplémentaire `coupe_score > 0` pour décrocher un titre faction.

-- ============================================================
-- get_faction_members — optimisé via CTEs aggregées
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

  WITH faction_users AS (
    SELECT id FROM public.users WHERE faction_id = p_faction_id
  ),
  -- Lifetime sources
  v_visites AS (
    SELECT user_id, COUNT(DISTINCT place_id)::int AS cnt
    FROM public.place_explorers
    WHERE user_id IN (SELECT id FROM faction_users)
    GROUP BY user_id
  ),
  v_places AS (
    SELECT author_id AS user_id, COUNT(*)::int AS cnt
    FROM public.places
    WHERE author_id IN (SELECT id FROM faction_users)
    GROUP BY author_id
  ),
  v_carnets AS (
    SELECT user_id, COUNT(*)::int AS cnt
    FROM public.place_contributions
    WHERE user_id IN (SELECT id FROM faction_users) AND type = 'carnet'
    GROUP BY user_id
  ),
  v_photos AS (
    SELECT user_id, COALESCE(SUM(
      COALESCE(jsonb_array_length(images), 0)
      + CASE
          WHEN (images IS NULL OR jsonb_array_length(images) = 0)
           AND image_url IS NOT NULL AND image_url != ''
          THEN 1 ELSE 0
        END
    ), 0)::int AS cnt
    FROM public.place_contributions
    WHERE user_id IN (SELECT id FROM faction_users)
    GROUP BY user_id
  ),
  v_plantages AS (
    SELECT user_id, COUNT(*)::int AS cnt
    FROM public.veille_history
    WHERE user_id IN (SELECT id FROM faction_users)
    GROUP BY user_id
  ),
  v_enigmes AS (
    SELECT user_id, COUNT(*)::int AS cnt
    FROM public.enigma_responses
    WHERE user_id IN (SELECT id FROM faction_users) AND correct = TRUE
    GROUP BY user_id
  ),
  -- Saison sources (mêmes tables, fenêtre temporelle)
  s_visites AS (
    SELECT user_id, COUNT(DISTINCT place_id)::int AS cnt
    FROM public.place_explorers
    WHERE user_id IN (SELECT id FROM faction_users)
      AND visited_at >= v_season_start AND visited_at < v_season_end
    GROUP BY user_id
  ),
  s_places AS (
    SELECT author_id AS user_id, COUNT(*)::int AS cnt
    FROM public.places
    WHERE author_id IN (SELECT id FROM faction_users)
      AND created_at >= v_season_start AND created_at < v_season_end
    GROUP BY author_id
  ),
  s_carnets AS (
    SELECT user_id, COUNT(*)::int AS cnt
    FROM public.place_contributions
    WHERE user_id IN (SELECT id FROM faction_users) AND type = 'carnet'
      AND created_at >= v_season_start AND created_at < v_season_end
    GROUP BY user_id
  ),
  s_photos AS (
    SELECT user_id, COALESCE(SUM(
      COALESCE(jsonb_array_length(images), 0)
      + CASE
          WHEN (images IS NULL OR jsonb_array_length(images) = 0)
           AND image_url IS NOT NULL AND image_url != ''
          THEN 1 ELSE 0
        END
    ), 0)::int AS cnt
    FROM public.place_contributions
    WHERE user_id IN (SELECT id FROM faction_users)
      AND created_at >= v_season_start AND created_at < v_season_end
    GROUP BY user_id
  ),
  s_plantages AS (
    SELECT user_id, COUNT(*)::int AS cnt
    FROM public.veille_history
    WHERE user_id IN (SELECT id FROM faction_users)
      AND planted_at >= v_season_start AND planted_at < v_season_end
    GROUP BY user_id
  ),
  s_enigmes AS (
    SELECT user_id, COUNT(*)::int AS cnt
    FROM public.enigma_responses
    WHERE user_id IN (SELECT id FROM faction_users) AND correct = TRUE
      AND responded_at >= v_season_start AND responded_at < v_season_end
    GROUP BY user_id
  ),
  user_scores AS (
    SELECT
      fu.id AS user_id,
      (COALESCE(vv.cnt, 0) * 1 + COALESCE(vp.cnt, 0) * 7 + COALESCE(vc.cnt, 0) * 3
       + COALESCE(vph.cnt, 0) * 1 + COALESCE(vpl.cnt, 0) * 5 + COALESCE(ve.cnt, 0) * 1)::int AS glory,
      (COALESCE(sv.cnt, 0) * 1 + COALESCE(sp.cnt, 0) * 7 + COALESCE(sc.cnt, 0) * 3
       + COALESCE(sph.cnt, 0) * 1 + COALESCE(spl.cnt, 0) * 5 + COALESCE(se.cnt, 0) * 1)::int AS coupe_score
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
      'userId',       u.id,
      'name',         COALESCE(u.display_name, u.first_name, u.email_address),
      'profileImage', u.avatar_url,
      'glory',        us.glory,
      'coupeScore',   us.coupe_score,
      'factionTitle2', (SELECT get_user_titles(u.id)->'factionTitle')
    ) AS member,
    us.glory,
    us.coupe_score,
    u.id AS user_id
    FROM user_scores us
    JOIN public.users u ON u.id = us.user_id
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_faction_members(text) TO authenticated, anon, service_role;

-- ============================================================
-- get_user_titles — rang faction par coupe_score, ROW_NUMBER + zero-guard
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
  FROM (
    SELECT id, RANK() OVER (ORDER BY (COALESCE(exploration_points, 0) + COALESCE(erudition_points, 0)) DESC) AS rk
    FROM users
  ) ranked
  WHERE id = p_user_id;

  -- ⚠️ NE PAS OUBLIER 'unlocks' ci-dessous — le bouton "ajouter un lieu" en dépend
  FOR v_general IN
    SELECT json_build_object(
      'id', t.id,
      'name', t.name,
      'icon', t.icon,
      'unlocks', t.unlocks,
      'order', t."order",
      'type', 'general',
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
    FROM titles t
    WHERE t.type = 'general'
    ORDER BY t."order"
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

    IF v_season_start IS NULL THEN
      v_season_start := 'epoch'::timestamptz;
      v_season_end   := now();
    END IF;

    -- Calcul du rang du user dans sa faction par coupe_score (saison).
    -- ROW_NUMBER (pas RANK) → départage déterministe les ex aequo via
    -- u.id, évite que 2 users aient le même titre.
    -- Sub-queries optimisées via CTEs LEFT JOIN aggregées.
    WITH faction_users AS (
      SELECT id FROM users WHERE faction_id = v_faction_id
    ),
    s_visites AS (
      SELECT user_id, COUNT(DISTINCT place_id)::int AS cnt
      FROM public.place_explorers
      WHERE user_id IN (SELECT id FROM faction_users)
        AND visited_at >= v_season_start AND visited_at < v_season_end
      GROUP BY user_id
    ),
    s_places AS (
      SELECT author_id AS user_id, COUNT(*)::int AS cnt
      FROM public.places
      WHERE author_id IN (SELECT id FROM faction_users)
        AND created_at >= v_season_start AND created_at < v_season_end
      GROUP BY author_id
    ),
    s_carnets AS (
      SELECT user_id, COUNT(*)::int AS cnt
      FROM public.place_contributions
      WHERE user_id IN (SELECT id FROM faction_users) AND type = 'carnet'
        AND created_at >= v_season_start AND created_at < v_season_end
      GROUP BY user_id
    ),
    s_photos AS (
      SELECT user_id, COALESCE(SUM(
        COALESCE(jsonb_array_length(images), 0)
        + CASE
            WHEN (images IS NULL OR jsonb_array_length(images) = 0)
             AND image_url IS NOT NULL AND image_url != ''
            THEN 1 ELSE 0
          END
      ), 0)::int AS cnt
      FROM public.place_contributions
      WHERE user_id IN (SELECT id FROM faction_users)
        AND created_at >= v_season_start AND created_at < v_season_end
      GROUP BY user_id
    ),
    s_plantages AS (
      SELECT user_id, COUNT(*)::int AS cnt
      FROM public.veille_history
      WHERE user_id IN (SELECT id FROM faction_users)
        AND planted_at >= v_season_start AND planted_at < v_season_end
      GROUP BY user_id
    ),
    s_enigmes AS (
      SELECT user_id, COUNT(*)::int AS cnt
      FROM public.enigma_responses
      WHERE user_id IN (SELECT id FROM faction_users) AND correct = TRUE
        AND responded_at >= v_season_start AND responded_at < v_season_end
      GROUP BY user_id
    ),
    user_coupe AS (
      SELECT
        fu.id,
        (COALESCE(sv.cnt, 0) * 1 + COALESCE(sp.cnt, 0) * 7 + COALESCE(sc.cnt, 0) * 3
         + COALESCE(sph.cnt, 0) * 1 + COALESCE(spl.cnt, 0) * 5 + COALESCE(se.cnt, 0) * 1)::int AS coupe_score
      FROM faction_users fu
      LEFT JOIN s_visites sv ON sv.user_id = fu.id
      LEFT JOIN s_places sp ON sp.user_id = fu.id
      LEFT JOIN s_carnets sc ON sc.user_id = fu.id
      LEFT JOIN s_photos sph ON sph.user_id = fu.id
      LEFT JOIN s_plantages spl ON spl.user_id = fu.id
      LEFT JOIN s_enigmes se ON se.user_id = fu.id
    )
    SELECT
      ROW_NUMBER() OVER (ORDER BY uc.coupe_score DESC, uc.id),
      uc.coupe_score
    INTO v_player_rank, v_player_coupe_score
    FROM user_coupe uc
    WHERE uc.id = p_user_id;

    -- Zero-guard : si le user n'a aucun point dans la saison, pas de titre
    -- faction (sinon tout le monde à 0 = tout le monde au top-N).
    IF v_player_coupe_score IS NULL OR v_player_coupe_score <= 0 THEN
      v_faction2 := NULL;
    ELSE
      SELECT json_build_object(
        'id', t.id,
        'name', t.name,
        'icon', t.icon,
        'unlocks', t.unlocks,
        'type', 'faction'
      ) INTO v_faction2
      FROM titles t
      WHERE t.type = 'faction'
        AND t.faction_id = v_faction_id
        AND t.condition IS NOT NULL
        AND (t.condition->>'rank') IS NOT NULL
        AND v_player_rank <= (t.condition->>'rank')::INT
      ORDER BY t."order" DESC
      LIMIT 1;
    END IF;
  END IF;

  RETURN json_build_object(
    'unlockedGeneralTitles', COALESCE((
      SELECT json_agg(elem)
      FROM unnest(v_general_arr) AS elem
      WHERE (elem->>'unlocked')::boolean = true
    ), '[]'::json),
    'displayedGeneralTitleIds', v_displayed_ids,
    'factionTitle', v_faction2,
    'stats', json_build_object(
      'discoveries', v_discoveries,
      'claims', v_claims,
      'glory', v_glory,
      'likes', v_likes,
      'fortifications', v_fortifications,
      'places_added', v_places_added
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_titles(text) TO authenticated, anon, service_role;
