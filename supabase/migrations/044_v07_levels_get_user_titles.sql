-- 044_v07_levels_get_user_titles.sql
-- WHY : refonte de get_user_titles pour évaluer les titres généraux sur les
-- nouveaux compteurs (level, places_visited, enigma_score, plantages, carnets).
-- Reprise EXACTE de mig 038 + ajout des nouveaux CASE + suppression des stats mortes.

CREATE OR REPLACE FUNCTION public.get_user_titles(p_user_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_xp_total INT;
  v_level INT;
  v_displayed_ids INT[];
  v_discoveries INT;
  v_places_visited INT;
  v_places_added INT;
  v_carnets INT;
  v_plantages INT;
  v_enigma_score INT;
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
  SELECT COUNT(*) INTO v_carnets FROM public.place_contributions WHERE user_id = p_user_id AND type = 'carnet';
  SELECT COUNT(*) INTO v_plantages FROM public.veille_history WHERE user_id = p_user_id;
  v_enigma_score := public._enigma_score_weighted(p_user_id);

  -- xp_total + niveau dérivé
  SELECT COALESCE(xp_total, 0), faction_id, COALESCE(displayed_general_title_ids, '{}')
    INTO v_xp_total, v_faction_id, v_displayed_ids
    FROM users WHERE id = p_user_id;
  v_level := public._level_from_xp(v_xp_total);

  -- Évaluation des titres généraux (threshold sur les compteurs étendus)
  FOR v_general IN
    SELECT json_build_object(
      'id', t.id, 'name', t.name, 'icon', t.icon, 'unlocks', t.unlocks, 'order', t."order", 'type', 'general',
      'unlocked', CASE
        WHEN t.condition IS NULL THEN false
        WHEN t.condition->>'stat' = 'level'           THEN v_level >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'discoveries'     THEN v_discoveries >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'places_visited'  THEN v_places_visited >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'enigma_score'    THEN v_enigma_score >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'plantages'       THEN v_plantages >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'places_added'    THEN v_places_added >= (t.condition->>'min')::INT
        WHEN t.condition->>'stat' = 'carnets'         THEN v_carnets >= (t.condition->>'min')::INT
        ELSE false
      END
    )
    FROM titles t WHERE t.type = 'general' ORDER BY t."order"
  LOOP
    v_general_arr := array_append(v_general_arr, v_general);
  END LOOP;

  -- Titres faction (inchangés vs mig 038 — toujours basés sur Coupe saison)
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
    'stats', json_build_object(
      'level', v_level,
      'xpTotal', v_xp_total,
      'discoveries', v_discoveries,
      'places_visited', v_places_visited,
      'places_added', v_places_added,
      'carnets', v_carnets,
      'plantages', v_plantages,
      'enigma_score', v_enigma_score
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_titles(text) TO authenticated, anon, service_role;
