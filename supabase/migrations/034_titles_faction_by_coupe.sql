-- 034_titles_faction_by_coupe.sql
-- WHY :
--   1. FactionMembersModal trie désormais par score Coupe (saison) — la
--      Gloire à vie n'a plus de pertinence dans la fenêtre faction où on
--      veut voir qui contribue activement cette saison.
--   2. Les titres FACTION (type='faction') sont attribués selon le rang
--      dans la Coupe au sein de la faction, pas selon la Gloire à vie.
--      Cohérent avec la promesse Uriel : le meilleur titre va à celui
--      qui a le plus participé pendant la saison courante.
--
-- Hors scope (intentionnellement) : les titres GÉNÉRAUX (type='general')
-- gardent leurs conditions actuelles sur exploration_points + erudition_points.
-- Refondre tout ça toucherait des `unlocks` critiques (cf gotchas.md
-- "unlocks toujours dans get_user_titles, cassé 3 fois") — à brainstormer
-- séparément si tu veux harmoniser plus tard.

-- ============================================================
-- get_faction_members — tri par coupe_score desc (au lieu de glory)
-- ============================================================
-- Reprise EXACTE de la mig 033, seul le ORDER BY change.

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

  WITH user_glory AS (
    SELECT
      u.id AS user_id,
      (
          COALESCE((SELECT COUNT(DISTINCT place_id) FROM public.place_explorers WHERE user_id = u.id), 0) * 1
        + COALESCE((SELECT COUNT(*)             FROM public.places              WHERE author_id = u.id), 0) * 7
        + COALESCE((SELECT COUNT(*)             FROM public.place_contributions WHERE user_id = u.id AND type = 'carnet'), 0) * 3
        + COALESCE((SELECT SUM(
              COALESCE(jsonb_array_length(images), 0)
              + CASE
                  WHEN (images IS NULL OR jsonb_array_length(images) = 0)
                   AND image_url IS NOT NULL AND image_url != ''
                  THEN 1 ELSE 0
                END
            )::int FROM public.place_contributions WHERE user_id = u.id), 0) * 1
        + COALESCE((SELECT COUNT(*)             FROM public.veille_history     WHERE user_id = u.id), 0) * 5
        + COALESCE((SELECT COUNT(*)             FROM public.enigma_responses   WHERE user_id = u.id AND correct = TRUE), 0) * 1
      )::int AS glory,
      (
          COALESCE((SELECT COUNT(DISTINCT place_id) FROM public.place_explorers WHERE user_id = u.id AND visited_at >= v_season_start AND visited_at < v_season_end), 0) * 1
        + COALESCE((SELECT COUNT(*)             FROM public.places              WHERE author_id = u.id AND created_at >= v_season_start AND created_at < v_season_end), 0) * 7
        + COALESCE((SELECT COUNT(*)             FROM public.place_contributions WHERE user_id = u.id AND type = 'carnet' AND created_at >= v_season_start AND created_at < v_season_end), 0) * 3
        + COALESCE((SELECT SUM(
              COALESCE(jsonb_array_length(images), 0)
              + CASE
                  WHEN (images IS NULL OR jsonb_array_length(images) = 0)
                   AND image_url IS NOT NULL AND image_url != ''
                  THEN 1 ELSE 0
                END
            )::int FROM public.place_contributions WHERE user_id = u.id AND created_at >= v_season_start AND created_at < v_season_end), 0) * 1
        + COALESCE((SELECT COUNT(*)             FROM public.veille_history     WHERE user_id = u.id AND planted_at >= v_season_start AND planted_at < v_season_end), 0) * 5
        + COALESCE((SELECT COUNT(*)             FROM public.enigma_responses   WHERE user_id = u.id AND correct = TRUE AND responded_at >= v_season_start AND responded_at < v_season_end), 0) * 1
      )::int AS coupe_score
    FROM public.users u
    WHERE u.faction_id = p_faction_id
  )
  SELECT COALESCE(json_agg(member ORDER BY coupe_score DESC, glory DESC), '[]'::json) INTO v_result
  FROM (
    SELECT json_build_object(
      'userId',                u.id,
      'name',                  COALESCE(u.display_name, u.first_name, u.email_address),
      'profileImage',          u.avatar_url,
      'glory',                 ug.glory,
      'coupeScore',            ug.coupe_score,
      'factionTitle2',         (SELECT get_user_titles(u.id)->'factionTitle')
    ) AS member,
    ug.glory,
    ug.coupe_score
    FROM user_glory ug
    JOIN public.users u ON u.id = ug.user_id
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_faction_members(text) TO authenticated, anon, service_role;

-- ============================================================
-- get_user_titles — titre FACTION basé sur rang dans la Coupe (saison)
-- ============================================================
-- Reprise EXACTE de la version baseline (gotcha "lire avant de réécrire" :
-- ne JAMAIS oublier 'unlocks' dans json_build_object — bouton "ajouter un
-- lieu" en dépend). Seule modif : v_player_rank dans la faction est calculé
-- par coupe_score saison au lieu de glory lifetime.

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
    -- V0.7 phase 3.5 — rang dans la faction = par coupe_score (saison courante)
    -- Avant : par exploration_points + erudition_points (ancienne formule).
    SELECT started_at, COALESCE(ended_at, now())
    INTO v_season_start, v_season_end
    FROM public.coupe_seasons
    ORDER BY (ended_at IS NULL) DESC, started_at DESC
    LIMIT 1;

    IF v_season_start IS NULL THEN
      v_season_start := 'epoch'::timestamptz;
      v_season_end   := now();
    END IF;

    SELECT rk INTO v_player_rank
    FROM (
      SELECT
        u.id,
        RANK() OVER (ORDER BY (
            COALESCE((SELECT COUNT(DISTINCT place_id) FROM public.place_explorers WHERE user_id = u.id AND visited_at >= v_season_start AND visited_at < v_season_end), 0) * 1
          + COALESCE((SELECT COUNT(*) FROM public.places             WHERE author_id = u.id AND created_at >= v_season_start AND created_at < v_season_end), 0) * 7
          + COALESCE((SELECT COUNT(*) FROM public.place_contributions WHERE user_id = u.id AND type = 'carnet' AND created_at >= v_season_start AND created_at < v_season_end), 0) * 3
          + COALESCE((SELECT SUM(
                COALESCE(jsonb_array_length(images), 0)
                + CASE
                    WHEN (images IS NULL OR jsonb_array_length(images) = 0)
                     AND image_url IS NOT NULL AND image_url != ''
                    THEN 1 ELSE 0
                  END
              )::int FROM public.place_contributions WHERE user_id = u.id AND created_at >= v_season_start AND created_at < v_season_end), 0) * 1
          + COALESCE((SELECT COUNT(*) FROM public.veille_history    WHERE user_id = u.id AND planted_at >= v_season_start AND planted_at < v_season_end), 0) * 5
          + COALESCE((SELECT COUNT(*) FROM public.enigma_responses  WHERE user_id = u.id AND correct = TRUE AND responded_at >= v_season_start AND responded_at < v_season_end), 0) * 1
        ) DESC) AS rk
      FROM users u
      WHERE u.faction_id = v_faction_id
    ) ranked
    WHERE id = p_user_id;

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
