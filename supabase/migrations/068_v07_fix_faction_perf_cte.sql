-- 068_v07_fix_faction_perf_cte.sql
-- WHY: la mig 067 a sacrifié la perf de get_faction_members et get_user_titles
-- en remplaçant la CTE union all par N appels au helper _user_*_score (chaque
-- appel = 7 sub-queries). Pour une faction de 30 membres, get_faction_members
-- faisait 30 × 14 = 420 sub-queries. PIRE : get_faction_members appelait aussi
-- get_user_titles(u.id) PAR MEMBRE (juste pour récupérer factionTitle), et
-- get_user_titles refait elle-même la CTE de ranking sur la faction → O(N²).
-- En prod, la modale de faction mettait "un temps fou à charger" (Uriel 03/05).
--
-- APRÈS : nouveau helper public._faction_member_scores(faction, from, to)
-- → TABLE(user_id, glory, coupe_score, faction_rank). Une seule CTE union all
-- qui agrège glory ET coupe pour TOUS les membres de la faction. Lecture des
-- 21 barèmes en variables au début (pas de _barem() dans le hot loop).
--
--   Get_faction_members : utilise le helper + LEFT JOIN LATERAL sur titles
--   pour le titre faction de chaque membre (plus d'appel get_user_titles).
--   Get_user_titles : utilise le helper pour récupérer son propre rank dans
--   la faction (au lieu d'une CTE locale qui rappelait _user_coupe_score N
--   fois).
--
-- Les helpers _user_glory_score et _user_coupe_score restent valides pour les
-- RPCs single-user (get_my_glory, get_player_profile, get_coupe_state.myBreakdown)
-- où le coût est négligeable.

-- ============================================================
-- 1. Helper _faction_member_scores — CTE union all batch
-- ============================================================

CREATE OR REPLACE FUNCTION public._faction_member_scores(
  p_faction_id   text,
  p_season_from  timestamptz,
  p_season_to    timestamptz
) RETURNS TABLE(
  user_id      text,
  glory        int,
  coupe_score  int,
  faction_rank int
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  -- Barèmes lus une seule fois, plus de _barem() dans la CTE
  v_g_discover int := _barem('glory.discover_remote',  1);
  v_g_visit    int := _barem('glory.visit_gps',        3);
  v_g_plant    int := _barem('glory.plant_flag',       2);
  v_g_add      int := _barem('glory.add_place',        7);
  v_g_carnet   int := _barem('glory.carnet',           3);
  v_g_photo    int := _barem('glory.photo',            1);
  v_g_e_ve     int := _barem('glory.enigma_very_easy', 1);
  v_g_e_e      int := _barem('glory.enigma_easy',      2);
  v_g_e_m      int := _barem('glory.enigma_medium',    3);
  v_g_e_h      int := _barem('glory.enigma_hard',      5);
  v_c_discover int := _barem('coupe.discover_remote',  0);
  v_c_visit    int := _barem('coupe.visit_gps',        3);
  v_c_plant    int := _barem('coupe.plant_flag',       2);
  v_c_add      int := _barem('coupe.add_place',        7);
  v_c_carnet   int := _barem('coupe.carnet',           3);
  v_c_photo    int := _barem('coupe.photo',            1);
  v_c_e_ve     int := _barem('coupe.enigma_very_easy', 1);
  v_c_e_e      int := _barem('coupe.enigma_easy',      1);
  v_c_e_m      int := _barem('coupe.enigma_medium',    1);
  v_c_e_h      int := _barem('coupe.enigma_hard',      1);
BEGIN
  RETURN QUERY
  WITH faction_members AS (
    SELECT u.id FROM public.users u WHERE u.faction_id = p_faction_id
  ),
  -- Glory (lifetime, pas de filtre saison)
  glory_scores AS (
    SELECT pd.user_id, COUNT(*)::int * v_g_discover AS s
    FROM public.places_discovered pd
    JOIN faction_members fm ON fm.id = pd.user_id
    GROUP BY pd.user_id
    UNION ALL
    SELECT pe.user_id, COUNT(DISTINCT pe.place_id)::int * v_g_visit
    FROM public.place_explorers pe
    JOIN faction_members fm ON fm.id = pe.user_id
    GROUP BY pe.user_id
    UNION ALL
    SELECT p.author_id, COUNT(*)::int * v_g_add
    FROM public.places p
    JOIN faction_members fm ON fm.id = p.author_id
    WHERE p.author_id IS NOT NULL
    GROUP BY p.author_id
    UNION ALL
    SELECT pc.user_id, COUNT(*)::int * v_g_carnet
    FROM public.place_contributions pc
    JOIN faction_members fm ON fm.id = pc.user_id
    WHERE pc.type = 'carnet'
    GROUP BY pc.user_id
    UNION ALL
    SELECT pc.user_id, COUNT(*)::int * v_g_photo
    FROM public.place_contributions pc
    JOIN faction_members fm ON fm.id = pc.user_id
    WHERE pc.type = 'photo'
    GROUP BY pc.user_id
    UNION ALL
    SELECT vh.user_id, COUNT(*)::int * v_g_plant
    FROM public.veille_history vh
    JOIN faction_members fm ON fm.id = vh.user_id
    GROUP BY vh.user_id
    UNION ALL
    SELECT er.user_id,
      ( COUNT(*) FILTER (WHERE e.difficulty = 'very_easy')::int * v_g_e_ve
      + COUNT(*) FILTER (WHERE e.difficulty = 'easy')::int      * v_g_e_e
      + COUNT(*) FILTER (WHERE e.difficulty = 'medium')::int    * v_g_e_m
      + COUNT(*) FILTER (WHERE e.difficulty = 'hard')::int      * v_g_e_h )
    FROM public.enigma_responses er
    JOIN public.enigmas e ON e.id = er.enigma_id
    JOIN faction_members fm ON fm.id = er.user_id
    WHERE er.correct = TRUE
    GROUP BY er.user_id
  ),
  glory_totals AS (
    SELECT gs.user_id, SUM(gs.s)::int AS g FROM glory_scores gs GROUP BY gs.user_id
  ),
  -- Coupe (fenêtre saison)
  coupe_scores AS (
    SELECT pd.user_id, COUNT(*)::int * v_c_discover AS s
    FROM public.places_discovered pd
    JOIN faction_members fm ON fm.id = pd.user_id
    WHERE pd.discovered_at >= p_season_from AND pd.discovered_at < p_season_to
    GROUP BY pd.user_id
    UNION ALL
    SELECT pe.user_id, COUNT(DISTINCT pe.place_id)::int * v_c_visit
    FROM public.place_explorers pe
    JOIN faction_members fm ON fm.id = pe.user_id
    WHERE pe.visited_at >= p_season_from AND pe.visited_at < p_season_to
    GROUP BY pe.user_id
    UNION ALL
    SELECT p.author_id, COUNT(*)::int * v_c_add
    FROM public.places p
    JOIN faction_members fm ON fm.id = p.author_id
    WHERE p.author_id IS NOT NULL
      AND p.created_at >= p_season_from AND p.created_at < p_season_to
    GROUP BY p.author_id
    UNION ALL
    SELECT pc.user_id, COUNT(*)::int * v_c_carnet
    FROM public.place_contributions pc
    JOIN faction_members fm ON fm.id = pc.user_id
    WHERE pc.type = 'carnet'
      AND pc.created_at >= p_season_from AND pc.created_at < p_season_to
    GROUP BY pc.user_id
    UNION ALL
    SELECT pc.user_id, COUNT(*)::int * v_c_photo
    FROM public.place_contributions pc
    JOIN faction_members fm ON fm.id = pc.user_id
    WHERE pc.type = 'photo'
      AND pc.created_at >= p_season_from AND pc.created_at < p_season_to
    GROUP BY pc.user_id
    UNION ALL
    SELECT vh.user_id, COUNT(*)::int * v_c_plant
    FROM public.veille_history vh
    JOIN faction_members fm ON fm.id = vh.user_id
    WHERE vh.planted_at >= p_season_from AND vh.planted_at < p_season_to
    GROUP BY vh.user_id
    UNION ALL
    SELECT er.user_id,
      ( COUNT(*) FILTER (WHERE e.difficulty = 'very_easy')::int * v_c_e_ve
      + COUNT(*) FILTER (WHERE e.difficulty = 'easy')::int      * v_c_e_e
      + COUNT(*) FILTER (WHERE e.difficulty = 'medium')::int    * v_c_e_m
      + COUNT(*) FILTER (WHERE e.difficulty = 'hard')::int      * v_c_e_h )
    FROM public.enigma_responses er
    JOIN public.enigmas e ON e.id = er.enigma_id
    JOIN faction_members fm ON fm.id = er.user_id
    WHERE er.correct = TRUE
      AND er.responded_at >= p_season_from AND er.responded_at < p_season_to
    GROUP BY er.user_id
  ),
  coupe_totals AS (
    SELECT cs.user_id, SUM(cs.s)::int AS c FROM coupe_scores cs GROUP BY cs.user_id
  )
  SELECT
    fm.id::text                                                                         AS user_id,
    COALESCE(gt.g, 0)::int                                                              AS glory,
    COALESCE(ct.c, 0)::int                                                              AS coupe_score,
    ROW_NUMBER() OVER (ORDER BY COALESCE(ct.c, 0) DESC, fm.id)::int                     AS faction_rank
  FROM faction_members fm
  LEFT JOIN glory_totals gt ON gt.user_id = fm.id
  LEFT JOIN coupe_totals ct ON ct.user_id = fm.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public._faction_member_scores(text, timestamptz, timestamptz)
  TO authenticated, anon, service_role;

-- ============================================================
-- 2. get_faction_members — utilise le helper + LATERAL sur titles
--    PLUS d'appel get_user_titles(u.id) dans la boucle.
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

  SELECT COALESCE(json_agg(member ORDER BY coupe_score DESC, glory DESC, user_id), '[]'::json)
  INTO v_result
  FROM (
    SELECT
      json_build_object(
        'userId',        u.id,
        'name',          COALESCE(u.display_name, u.first_name, u.email_address),
        'profileImage',  u.avatar_url,
        'glory',         s.glory,
        'coupeScore',    s.coupe_score,
        'factionTitle2', t.title_obj
      ) AS member,
      s.glory       AS glory,
      s.coupe_score AS coupe_score,
      u.id          AS user_id
    FROM public._faction_member_scores(p_faction_id, v_season_start, v_season_end) s
    JOIN public.users u ON u.id = s.user_id
    LEFT JOIN LATERAL (
      SELECT json_build_object(
        'id',      tt.id,
        'name',    tt.name,
        'icon',    tt.icon,
        'unlocks', tt.unlocks,
        'type',    'faction'
      ) AS title_obj
      FROM public.titles tt
      WHERE tt.type = 'faction'
        AND tt.faction_id = p_faction_id
        AND tt.condition IS NOT NULL
        AND (tt.condition->>'rank') IS NOT NULL
        AND s.coupe_score > 0
        AND s.faction_rank <= (tt.condition->>'rank')::int
      ORDER BY (tt.condition->>'rank')::int ASC
      LIMIT 1
    ) t ON TRUE
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_faction_members(text) TO authenticated, anon, service_role;

-- ============================================================
-- 3. get_user_titles — reprend mig 067 EXACTEMENT, change UNIQUEMENT
--    le calcul du rank faction (CTE locale + helper N appels → 1 appel
--    au _faction_member_scores qui agrège tout en une CTE batch).
-- ============================================================

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

  -- Titre faction = rank du user dans sa faction par coupe_score (V068).
  -- Avant V067 : grosse CTE locale avec valeurs hardcodées.
  -- V067 : CTE locale qui appelait _user_coupe_score N fois (lent).
  -- V068 : un seul appel à _faction_member_scores qui agrège tout en CTE batch.
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
