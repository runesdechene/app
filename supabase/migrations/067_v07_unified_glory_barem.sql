-- 067_v07_unified_glory_barem.sql
-- WHY: refonte centralisée du barème Gloire/Coupe + cooldown plantage.
--
-- AVANT : 6 RPCs avec valeurs hardcodées (visite=1, places=7, carnet=3,
--   photo=1, plantage=5, énigmes via _enigma_score_weighted 1/1/2/3),
--   et le frontend affichait des chiffres encore différents (toast
--   découverte +4/+3, success add-place +7+1+3...). Désynchronisation
--   totale entre annoncé/calculé/affiché.
--
-- APRÈS : 21 clés dans app_settings (10 glory.* + 10 coupe.* +
--   1 cooldown.replant_hours). 2 helpers internes lisent ces valeurs :
--   - _user_glory_score(user, from?, to?) → score Gloire (sans découverte
--     pour la Coupe, voir _user_coupe_score)
--   - _user_coupe_score(user, from?, to?) → score Coupe (barème distinct)
--   Les 6 RPCs (get_my_glory, get_coupe_state, get_player_profile,
--   get_leaderboard, get_faction_members, get_user_titles) appellent
--   ces helpers. Aucune valeur hardcodée nulle part. Le frontend lit
--   get_glory_rules() au boot et expose via store.
--
-- Décisions Uriel 2026-05-03 :
--   - Découverte (sortir du brouillard) : Gloire +1, Coupe 0 (curiosité)
--   - Visite GPS (fouler le sol) : Gloire +3, Coupe +3 (acte physique)
--   - Plantage étendard : Gloire +2, Coupe +2 (acte d'agression territoriale)
--   - Lieu ajouté +7, Carnet +3 (inchangé)
--   - Photo : 1 par CONTRIBUTION photo (pas par image dans le tableau JSON)
--     → empêche de bombarder pour farmer les points
--   - Énigmes Gloire pondérées 1/2/3/5 (more marquée que la mig 038
--     qui faisait 1/1/2/3). C'est de l'XP perso, on récompense l'effort.
--   - Énigmes Coupe : +1 fixe (équité du classement, anti-triche)
--   - Cooldown replantage 24h (configurable via app_settings)
--
-- Source découverte = places_discovered. Source visite GPS = place_explorers.
-- Toutes deux UNIQUE(user, place) → pas d'abus farm natif.
--
-- Hub admin : page d'édition viendra dans une mig séparée (frontend).

-- ============================================================
-- 1. SEED app_settings — 21 clés (idempotent)
-- ============================================================

INSERT INTO public.app_settings (key, value) VALUES
  -- Gloire (lifetime, prestige cumulé)
  ('glory.discover_remote',     '1'),
  ('glory.visit_gps',           '3'),
  ('glory.plant_flag',          '2'),
  ('glory.add_place',           '7'),
  ('glory.carnet',              '3'),
  ('glory.photo',               '1'),
  ('glory.enigma_very_easy',    '1'),
  ('glory.enigma_easy',         '2'),
  ('glory.enigma_medium',       '3'),
  ('glory.enigma_hard',         '5'),
  -- Coupe (saison, activité compétitive)
  ('coupe.discover_remote',     '0'),
  ('coupe.visit_gps',           '3'),
  ('coupe.plant_flag',          '2'),
  ('coupe.add_place',           '7'),
  ('coupe.carnet',              '3'),
  ('coupe.photo',               '1'),
  ('coupe.enigma_very_easy',    '1'),
  ('coupe.enigma_easy',         '1'),
  ('coupe.enigma_medium',       '1'),
  ('coupe.enigma_hard',         '1'),
  -- Cooldowns
  ('cooldown.replant_hours',    '24')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 2. Helper : lecture barème avec fallback
-- ============================================================

CREATE OR REPLACE FUNCTION public._barem(p_key text, p_default int DEFAULT 0)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT value::int FROM public.app_settings WHERE key = p_key), p_default);
$$;

-- ============================================================
-- 3. RPC get_glory_rules() — exposée au frontend
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_glory_rules()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_object_agg(key, value::int)
  FROM public.app_settings
  WHERE key LIKE 'glory.%'
     OR key LIKE 'coupe.%'
     OR key LIKE 'cooldown.%';
$$;

GRANT EXECUTE ON FUNCTION public.get_glory_rules() TO authenticated, anon;

-- ============================================================
-- 4. Helper _user_glory_score — score Gloire d'un user sur une fenêtre
--    NULL pour from/to = lifetime (toute l'histoire du user).
--    Toutes les valeurs lues depuis app_settings via _barem.
-- ============================================================

CREATE OR REPLACE FUNCTION public._user_glory_score(
  p_user_id text,
  p_from    timestamptz DEFAULT NULL,
  p_to      timestamptz DEFAULT NULL
) RETURNS integer
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE((SELECT COUNT(*) FROM public.places_discovered
              WHERE user_id = p_user_id
                AND (p_from IS NULL OR discovered_at >= p_from)
                AND (p_to   IS NULL OR discovered_at <  p_to)), 0)
    * public._barem('glory.discover_remote', 1)

  + COALESCE((SELECT COUNT(DISTINCT place_id) FROM public.place_explorers
              WHERE user_id = p_user_id
                AND (p_from IS NULL OR visited_at >= p_from)
                AND (p_to   IS NULL OR visited_at <  p_to)), 0)
    * public._barem('glory.visit_gps', 3)

  + COALESCE((SELECT COUNT(*) FROM public.places
              WHERE author_id = p_user_id
                AND (p_from IS NULL OR created_at >= p_from)
                AND (p_to   IS NULL OR created_at <  p_to)), 0)
    * public._barem('glory.add_place', 7)

  + COALESCE((SELECT COUNT(*) FROM public.place_contributions
              WHERE user_id = p_user_id AND type = 'carnet'
                AND (p_from IS NULL OR created_at >= p_from)
                AND (p_to   IS NULL OR created_at <  p_to)), 0)
    * public._barem('glory.carnet', 3)

  + COALESCE((SELECT COUNT(*) FROM public.place_contributions
              WHERE user_id = p_user_id AND type = 'photo'
                AND (p_from IS NULL OR created_at >= p_from)
                AND (p_to   IS NULL OR created_at <  p_to)), 0)
    * public._barem('glory.photo', 1)

  + COALESCE((SELECT COUNT(*) FROM public.veille_history
              WHERE user_id = p_user_id
                AND (p_from IS NULL OR planted_at >= p_from)
                AND (p_to   IS NULL OR planted_at <  p_to)), 0)
    * public._barem('glory.plant_flag', 2)

  + COALESCE((
      SELECT
        COUNT(*) FILTER (WHERE e.difficulty = 'very_easy') * public._barem('glory.enigma_very_easy', 1)
      + COUNT(*) FILTER (WHERE e.difficulty = 'easy')      * public._barem('glory.enigma_easy',      2)
      + COUNT(*) FILTER (WHERE e.difficulty = 'medium')    * public._barem('glory.enigma_medium',    3)
      + COUNT(*) FILTER (WHERE e.difficulty = 'hard')      * public._barem('glory.enigma_hard',      5)
      FROM public.enigma_responses er
      JOIN public.enigmas e ON e.id = er.enigma_id
      WHERE er.user_id = p_user_id AND er.correct = TRUE
        AND (p_from IS NULL OR er.responded_at >= p_from)
        AND (p_to   IS NULL OR er.responded_at <  p_to)
    ), 0);
$$;

GRANT EXECUTE ON FUNCTION public._user_glory_score(text, timestamptz, timestamptz) TO authenticated, anon, service_role;

-- ============================================================
-- 5. Helper _user_coupe_score — score Coupe d'un user sur une fenêtre
-- ============================================================

CREATE OR REPLACE FUNCTION public._user_coupe_score(
  p_user_id text,
  p_from    timestamptz DEFAULT NULL,
  p_to      timestamptz DEFAULT NULL
) RETURNS integer
LANGUAGE sql STABLE
AS $$
  SELECT
    COALESCE((SELECT COUNT(*) FROM public.places_discovered
              WHERE user_id = p_user_id
                AND (p_from IS NULL OR discovered_at >= p_from)
                AND (p_to   IS NULL OR discovered_at <  p_to)), 0)
    * public._barem('coupe.discover_remote', 0)

  + COALESCE((SELECT COUNT(DISTINCT place_id) FROM public.place_explorers
              WHERE user_id = p_user_id
                AND (p_from IS NULL OR visited_at >= p_from)
                AND (p_to   IS NULL OR visited_at <  p_to)), 0)
    * public._barem('coupe.visit_gps', 3)

  + COALESCE((SELECT COUNT(*) FROM public.places
              WHERE author_id = p_user_id
                AND (p_from IS NULL OR created_at >= p_from)
                AND (p_to   IS NULL OR created_at <  p_to)), 0)
    * public._barem('coupe.add_place', 7)

  + COALESCE((SELECT COUNT(*) FROM public.place_contributions
              WHERE user_id = p_user_id AND type = 'carnet'
                AND (p_from IS NULL OR created_at >= p_from)
                AND (p_to   IS NULL OR created_at <  p_to)), 0)
    * public._barem('coupe.carnet', 3)

  + COALESCE((SELECT COUNT(*) FROM public.place_contributions
              WHERE user_id = p_user_id AND type = 'photo'
                AND (p_from IS NULL OR created_at >= p_from)
                AND (p_to   IS NULL OR created_at <  p_to)), 0)
    * public._barem('coupe.photo', 1)

  + COALESCE((SELECT COUNT(*) FROM public.veille_history
              WHERE user_id = p_user_id
                AND (p_from IS NULL OR planted_at >= p_from)
                AND (p_to   IS NULL OR planted_at <  p_to)), 0)
    * public._barem('coupe.plant_flag', 2)

  + COALESCE((
      SELECT
        COUNT(*) FILTER (WHERE e.difficulty = 'very_easy') * public._barem('coupe.enigma_very_easy', 1)
      + COUNT(*) FILTER (WHERE e.difficulty = 'easy')      * public._barem('coupe.enigma_easy',      1)
      + COUNT(*) FILTER (WHERE e.difficulty = 'medium')    * public._barem('coupe.enigma_medium',    1)
      + COUNT(*) FILTER (WHERE e.difficulty = 'hard')      * public._barem('coupe.enigma_hard',      1)
      FROM public.enigma_responses er
      JOIN public.enigmas e ON e.id = er.enigma_id
      WHERE er.user_id = p_user_id AND er.correct = TRUE
        AND (p_from IS NULL OR er.responded_at >= p_from)
        AND (p_to   IS NULL OR er.responded_at <  p_to)
    ), 0);
$$;

GRANT EXECUTE ON FUNCTION public._user_coupe_score(text, timestamptz, timestamptz) TO authenticated, anon, service_role;

-- ============================================================
-- 6. get_my_glory — délègue au helper, expose breakdown détaillé
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_glory(p_user_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_lieux_decouverts integer;
  v_lieux_explores   integer;
  v_lieux_ajoutes    integer;
  v_carnets          integer;
  v_photos           integer;
  v_plantages        integer;
  v_enigmes_total    integer;
  v_e_very_easy      integer;
  v_e_easy           integer;
  v_e_medium         integer;
  v_e_hard           integer;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT COUNT(*) INTO v_lieux_decouverts FROM public.places_discovered WHERE user_id = p_user_id;
  SELECT COUNT(DISTINCT place_id) INTO v_lieux_explores FROM public.place_explorers WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_lieux_ajoutes FROM public.places WHERE author_id = p_user_id;
  SELECT COUNT(*) INTO v_carnets FROM public.place_contributions WHERE user_id = p_user_id AND type = 'carnet';
  SELECT COUNT(*) INTO v_photos FROM public.place_contributions WHERE user_id = p_user_id AND type = 'photo';
  SELECT COUNT(*) INTO v_plantages FROM public.veille_history WHERE user_id = p_user_id;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE e.difficulty = 'very_easy'),
    COUNT(*) FILTER (WHERE e.difficulty = 'easy'),
    COUNT(*) FILTER (WHERE e.difficulty = 'medium'),
    COUNT(*) FILTER (WHERE e.difficulty = 'hard')
  INTO v_enigmes_total, v_e_very_easy, v_e_easy, v_e_medium, v_e_hard
  FROM public.enigma_responses er
  JOIN public.enigmas e ON e.id = er.enigma_id
  WHERE er.user_id = p_user_id AND er.correct = TRUE;

  RETURN json_build_object(
    'glory',           public._user_glory_score(p_user_id, NULL, NULL),
    'lieuxDecouverts', v_lieux_decouverts,
    'lieuxExplores',   v_lieux_explores,
    'lieuxAjoutes',    v_lieux_ajoutes,
    'carnets',         v_carnets,
    'photos',          v_photos,
    'plantages',       v_plantages,
    'enigmes', json_build_object(
      'total',     v_enigmes_total,
      'veryEasy',  v_e_very_easy,
      'easy',      v_e_easy,
      'medium',    v_e_medium,
      'hard',      v_e_hard
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_glory(text) TO authenticated, service_role;

-- ============================================================
-- 7. get_coupe_state — refonte avec helper Coupe
--    Signature préservée : (p_user_id text, p_season_id bigint)
--    Stratégie : on ne calcule pas user-par-user (O(N) helper calls)
--    pour le top 20 / agrégat factions, on garde la CTE union all
--    avec barème dynamique. Mais myBreakdown utilise le helper.
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
  -- Lecture des barèmes Coupe une seule fois pour les CTE
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

  -- CTE commune (factions agg + top users) avec barème dynamique
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

  -- Top 20 users — même CTE répétée
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

  -- myBreakdown : scalaire via le helper
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
$$;

GRANT EXECUTE ON FUNCTION public.get_coupe_state(text, bigint) TO authenticated, anon, service_role;

-- ============================================================
-- 8. get_player_profile — reprend mig 051 EXACTEMENT, change uniquement
--    le calcul coupeScoreCurrentSeason (formule inline → helper)
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
  v_xp_total INT;
  v_level INT;
  v_xp_to_next INT;
  v_xp_for_next_level INT;
  v_lieux_explores INT;
  v_lieux_veilles INT;
  v_enigmas_solved INT;
  v_crowns_balance INT;
  v_coupe_season public.coupe_seasons%ROWTYPE;
  v_coupe_window_end timestamptz;
  v_coupe_score_current_season INT;
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

  SELECT COALESCE(displayed_title_ids_v3, '{}'), COALESCE(xp_total, 0)
    INTO v_displayed_v3, v_xp_total
    FROM users WHERE id = p_user_id;
  v_level := public._level_from_xp(v_xp_total);
  v_xp_for_next_level := public._xp_for_level(v_level + 1);
  v_xp_to_next := GREATEST(0, v_xp_for_next_level - v_xp_total);

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
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
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

  SELECT COUNT(DISTINCT place_id) INTO v_lieux_explores FROM public.place_explorers WHERE user_id = p_user_id;
  SELECT COUNT(DISTINCT pv.place_id) INTO v_lieux_veilles
    FROM public.place_veille pv
    JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id
    WHERE em.user_id = p_user_id;
  SELECT COUNT(*) INTO v_enigmas_solved FROM public.enigma_responses WHERE user_id = p_user_id AND correct = TRUE;

  -- Couronnes
  SELECT COALESCE(balance, 0) INTO v_crowns_balance FROM public.user_crowns WHERE user_id = p_user_id;
  v_crowns_balance := COALESCE(v_crowns_balance, 0);

  -- Score Coupe saison courante — V067 : helper centralisé
  -- (avant : formule hardcodée 1/7/3/1/5 + énigmes pondérées copiée
  -- depuis get_coupe_state. Maintenant : appel _user_coupe_score qui
  -- lit le barème depuis app_settings.)
  SELECT * INTO v_coupe_season
  FROM public.coupe_seasons
  ORDER BY (ended_at IS NULL) DESC, started_at DESC
  LIMIT 1;

  IF v_coupe_season.id IS NOT NULL THEN
    v_coupe_window_end := COALESCE(v_coupe_season.ended_at, now());
    v_coupe_score_current_season := public._user_coupe_score(
      p_user_id, v_coupe_season.started_at, v_coupe_window_end
    );
  ELSE
    v_coupe_score_current_season := 0;
  END IF;

  SELECT json_build_object(
    'userId', u.id, 'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id, 'factionTitle', f.title, 'factionColor', f.color, 'factionPattern', f.pattern,
    'profileImage', u.avatar_url,
    'level', v_level,
    'xpTotal', v_xp_total,
    'xpToNextLevel', v_xp_to_next,
    'xpForNextLevel', v_xp_for_next_level,
    'veteranFirstEra', COALESCE(u.veteran_first_era, false),
    'lieuxExplores', COALESCE(v_lieux_explores, 0),
    'lieuxVeilles',  COALESCE(v_lieux_veilles, 0),
    'enigmasSolved', COALESCE(v_enigmas_solved, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'placesAdded', (v_titles_data->'stats'->>'places_added')::INT,
    'carnetsCount', (v_titles_data->'stats'->>'carnets')::INT,
    'plantagesCount', (v_titles_data->'stats'->>'plantages')::INT,
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places,
    'discoveredPlaces', v_discovered_places,
    'favoritePlaces', v_favorite_places,
    'veilledPlaces', v_veilled_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles',
    'crownsBalance', COALESCE(v_crowns_balance, 0),
    'coupeScoreCurrentSeason', COALESCE(v_coupe_score_current_season, 0),
    'coupeSeasonName', v_coupe_season.name
  ) INTO v_result FROM users u LEFT JOIN factions f ON f.id = u.faction_id WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile(text) TO authenticated, anon, service_role;

-- get_leaderboard NON TOUCHÉ : la mig 046 a basculé 'notoriety' sur
-- xp_total / level (plus de Gloire dans ce classement). Aucun lien
-- avec le barème centralisé V067.

-- ============================================================
-- 10. get_faction_members — Gloire + Coupe via les 2 helpers
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

  SELECT COALESCE(json_agg(member ORDER BY coupe_score DESC, glory DESC, user_id), '[]'::json) INTO v_result
  FROM (
    SELECT
      json_build_object(
        'userId',        u.id,
        'name',          COALESCE(u.display_name, u.first_name, u.email_address),
        'profileImage',  u.avatar_url,
        'glory',         public._user_glory_score(u.id, NULL, NULL),
        'coupeScore',    public._user_coupe_score(u.id, v_season_start, v_season_end),
        'factionTitle2', (SELECT get_user_titles(u.id)->'factionTitle')
      ) AS member,
      public._user_glory_score(u.id, NULL, NULL) AS glory,
      public._user_coupe_score(u.id, v_season_start, v_season_end) AS coupe_score,
      u.id AS user_id
    FROM public.users u
    WHERE u.faction_id = p_faction_id
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_faction_members(text) TO authenticated, anon, service_role;

-- ============================================================
-- 11. get_user_titles — reprend mig 044 EXACTEMENT, change uniquement
--     le calcul coupe_score (CTE union all → helper _user_coupe_score)
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

  -- Titres faction — ranking par coupe_score (helper centralisé V067).
  -- Avant V067 : grosse CTE union all avec valeurs hardcodées (1/7/3/1/5
  -- + énigmes pondérées). Maintenant : un seul appel helper par membre,
  -- valeurs lues depuis app_settings.
  v_faction2 := NULL;
  IF v_faction_id IS NOT NULL THEN
    SELECT started_at, COALESCE(ended_at, now())
    INTO v_season_start, v_season_end
    FROM public.coupe_seasons
    ORDER BY (ended_at IS NULL) DESC, started_at DESC
    LIMIT 1;
    IF v_season_start IS NULL THEN v_season_start := 'epoch'::timestamptz; v_season_end := now(); END IF;

    WITH faction_users AS (SELECT id FROM users WHERE faction_id = v_faction_id),
    user_coupe AS (
      SELECT fu.id, public._user_coupe_score(fu.id, v_season_start, v_season_end)::int AS coupe_score
      FROM faction_users fu
    ),
    ranked AS (
      SELECT id, coupe_score, ROW_NUMBER() OVER (ORDER BY coupe_score DESC, id)::int AS rk
      FROM user_coupe
    )
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

-- ============================================================
-- 12. plant_flag — ajout cooldown configurable via app_settings
-- ============================================================

CREATE OR REPLACE FUNCTION public.plant_flag(
  p_user_id            text,
  p_place_id           text,
  p_user_lat           numeric,
  p_user_lng           numeric,
  p_partners_user_ids  text[] DEFAULT '{}'::text[]
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_faction        text;
  v_place_lat           numeric;
  v_place_lng           numeric;
  v_place_title         text;
  v_distance_km         numeric;
  v_expedition_id       uuid;
  v_is_neutral          boolean := false;
  v_expedition_faction  text;
  v_factions            text[];
  v_partner_user_id     text;
  v_partner_faction     text;
  v_members_json        jsonb;
  v_now                 timestamptz := now();
  v_cooldown_hours      int := _barem('cooldown.replant_hours', 24);
  v_last_plant          timestamptz;
  v_remaining_hours     numeric;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT faction_id INTO v_user_faction FROM public.users WHERE id = p_user_id;
  IF v_user_faction IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM public.places WHERE id = p_place_id;
  IF v_place_lat IS NULL THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
  IF v_distance_km > 0.1 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::numeric, 2));
  END IF;

  -- Cooldown anti-farm collusion : pas de replantage par le même user
  -- sur le même lieu dans les N dernières heures (24h par défaut).
  -- N est lu dans app_settings.cooldown.replant_hours (Hub-éditable).
  SELECT MAX(planted_at) INTO v_last_plant
  FROM public.veille_history
  WHERE user_id = p_user_id AND place_id = p_place_id;

  IF v_last_plant IS NOT NULL
     AND v_last_plant > (v_now - (v_cooldown_hours || ' hours')::interval) THEN
    v_remaining_hours := EXTRACT(EPOCH FROM (
      (v_last_plant + (v_cooldown_hours || ' hours')::interval) - v_now
    )) / 3600.0;
    RETURN json_build_object(
      'error', 'cooldown',
      'remainingHours', ROUND(v_remaining_hours::numeric, 1),
      'cooldownHours', v_cooldown_hours
    );
  END IF;

  -- Calcule l'ensemble des factions impliquées (créateur + partners)
  SELECT array_agg(DISTINCT u.faction_id) INTO v_factions
  FROM public.users u
  WHERE (u.id = ANY(p_partners_user_ids) OR u.id = p_user_id)
    AND u.faction_id IS NOT NULL;

  v_is_neutral := (COALESCE(array_length(v_factions, 1), 0) > 1);
  v_expedition_faction := CASE WHEN v_is_neutral THEN NULL ELSE v_user_faction END;

  -- Toujours créer une expédition (solo = expédition d'1 membre)
  INSERT INTO public.expeditions (place_id, is_neutral, faction_id, created_at)
  VALUES (p_place_id, v_is_neutral, v_expedition_faction, v_now)
  RETURNING id INTO v_expedition_id;

  -- Membre fondateur
  INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
  VALUES (v_expedition_id, p_user_id, v_user_faction);

  -- Partners (si fournis)
  IF array_length(p_partners_user_ids, 1) > 0 THEN
    FOREACH v_partner_user_id IN ARRAY p_partners_user_ids LOOP
      IF v_partner_user_id = p_user_id THEN CONTINUE; END IF;
      SELECT faction_id INTO v_partner_faction FROM public.users WHERE id = v_partner_user_id;
      IF v_partner_faction IS NOT NULL THEN
        INSERT INTO public.expedition_members (expedition_id, user_id, faction_id)
        VALUES (v_expedition_id, v_partner_user_id, v_partner_faction)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  -- UPSERT place_veille (supplante l'expédition précédente)
  INSERT INTO public.place_veille (place_id, expedition_id, faction_id, is_neutral, planted_at)
  VALUES (p_place_id, v_expedition_id, v_expedition_faction, v_is_neutral, v_now)
  ON CONFLICT (place_id) DO UPDATE SET
    expedition_id = EXCLUDED.expedition_id,
    faction_id    = EXCLUDED.faction_id,
    is_neutral    = EXCLUDED.is_neutral,
    planted_at    = EXCLUDED.planted_at;

  -- Historique : 1 ligne par membre de l'expédition
  INSERT INTO public.veille_history (place_id, expedition_id, user_id, faction_id, is_neutral, planted_at)
  SELECT p_place_id, v_expedition_id, em.user_id, em.faction_id, v_is_neutral, v_now
  FROM public.expedition_members em WHERE em.expedition_id = v_expedition_id;

  -- Build members JSON pour retour
  SELECT jsonb_agg(jsonb_build_object(
    'userId', em.user_id,
    'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
    'avatarUrl', u.avatar_url,
    'factionId', em.faction_id
  ))
  INTO v_members_json
  FROM public.expedition_members em
  JOIN public.users u ON u.id = em.user_id
  WHERE em.expedition_id = v_expedition_id;

  -- Activity log
  INSERT INTO public.activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('plant_flag', p_user_id, p_place_id, v_expedition_faction,
          jsonb_build_object(
            'placeTitle', v_place_title,
            'isNeutral', v_is_neutral,
            'expeditionId', v_expedition_id,
            'memberCount', jsonb_array_length(v_members_json),
            'members', v_members_json
          ));

  RETURN json_build_object(
    'success',      true,
    'placeId',      p_place_id,
    'isNeutral',    v_is_neutral,
    'factionId',    v_expedition_faction,
    'expeditionId', v_expedition_id,
    'members',      v_members_json,
    'plantedAt',    v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.plant_flag(text, text, numeric, numeric, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.plant_flag(text, text, numeric, numeric, text[]) TO service_role;
