-- 024_v07_glory_refonte.sql
-- WHY : Refonte du système de Gloire (V0.7 phase 3.5).
--
-- Avant : Gloire = exploration_points + erudition_points cumulés en DB,
-- formule abstraite et opaque pour les users qui se plaignaient.
--
-- Après : 2 stats avec MÊME FORMULE que la Coupe, fenêtres temporelles différentes :
--   - Coupe (saison) : score d'actions sur la saison courante
--   - Gloire (lifetime) : score d'actions cumulé depuis la création du compte
-- Plus 1 économie inchangée : Couronnes.
--
-- Barème unifié (validé Uriel 2 mai 2026, anti-triche) :
--   Visite GPS d'un nouveau lieu  : +1 (DISTINCT place_id)
--   Énigme résolue (toute diff.)  : +1 (pas pondérée — éviter incitation à tricher)
--   Photo ajoutée                  : +1
--   Carnet écrit                   : +3
--   Plantage de bannière           : +5
--   Lieu ajouté                    : +7
--
-- Affichage profil :
--   - Gloire / Coupe / Couronnes en lignes principales
--   - Compteurs bruts en détail : lieux explorés, énigmes (avec breakdown
--     difficulté pour le récit — la difficulté ne pèse plus dans le score
--     mais reste informatif), carnets, photos, lieux ajoutés
--
-- Effet : exploration_points / erudition_points toujours stockés en DB pour
-- ne rien casser, mais plus utilisés pour calculer la Gloire affichée.
-- Drop possible plus tard quand on aura confirmé que rien n'en dépend ailleurs.

-- ============================================================
-- RPC get_my_glory — score lifetime + compteurs bruts
-- Même formule que get_coupe_state mais SANS filtre de fenêtre temporelle.
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
  v_enigmes_very_easy integer;
  v_enigmes_easy    integer;
  v_enigmes_medium  integer;
  v_enigmes_hard    integer;
  v_glory           integer;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  -- Lieux distincts visités en GPS (place_explorers, DISTINCT place_id)
  SELECT COUNT(DISTINCT place_id) INTO v_lieux_explores
  FROM public.place_explorers WHERE user_id = p_user_id;

  -- Lieux ajoutés
  SELECT COUNT(*) INTO v_lieux_ajoutes
  FROM public.places WHERE author_id = p_user_id;

  -- Carnets
  SELECT COUNT(*) INTO v_carnets
  FROM public.place_contributions
  WHERE user_id = p_user_id AND type = 'carnet';

  -- Photos
  SELECT COUNT(*) INTO v_photos
  FROM public.place_contributions
  WHERE user_id = p_user_id AND type = 'photo';

  -- Plantages (1 ligne dans veille_history par membre par plantage)
  SELECT COUNT(*) INTO v_plantages
  FROM public.veille_history WHERE user_id = p_user_id;

  -- Énigmes correctement résolues + breakdown par difficulté
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE e.difficulty = 'very_easy'),
    COUNT(*) FILTER (WHERE e.difficulty = 'easy'),
    COUNT(*) FILTER (WHERE e.difficulty = 'medium'),
    COUNT(*) FILTER (WHERE e.difficulty = 'hard')
  INTO
    v_enigmes_total,
    v_enigmes_very_easy,
    v_enigmes_easy,
    v_enigmes_medium,
    v_enigmes_hard
  FROM public.enigma_responses er
  JOIN public.enigmas e ON e.id = er.enigma_id
  WHERE er.user_id = p_user_id AND er.correct = TRUE;

  -- Score Gloire pondéré par catégorie (énigmes : +1 fixe quelle que soit difficulté)
  v_glory :=
      COALESCE(v_lieux_explores,  0) * 1
    + COALESCE(v_lieux_ajoutes,   0) * 7
    + COALESCE(v_carnets,         0) * 3
    + COALESCE(v_photos,          0) * 1
    + COALESCE(v_plantages,       0) * 5
    + COALESCE(v_enigmes_total,   0) * 1;

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
      'hard',      COALESCE(v_enigmes_hard, 0)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_glory(text) TO authenticated, service_role;

-- ============================================================
-- get_coupe_state — version 2 :
--   - intègre +1 par visite GPS d'un nouveau lieu (DISTINCT place_id, fenêtre saison)
--   - myBreakdown enrichi : lieuxExplores + breakdown difficulté énigmes
--
-- Reprise EXACTE de la signature mig 023 pour ne pas créer d'overload :
-- (p_user_id text, p_season_id bigint DEFAULT NULL) RETURNS json
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

  -- Score par user (CTE commune réutilisée pour factions agg + top users)
  WITH user_scores AS (
    -- Lieux distincts visités GPS (+1)
    SELECT u.id AS user_id, COUNT(DISTINCT pe.place_id)::int * 1 AS score
    FROM public.users u
    JOIN public.place_explorers pe ON pe.user_id = u.id
    WHERE pe.visited_at >= v_season.started_at AND pe.visited_at < v_window_end
    GROUP BY u.id

    UNION ALL

    -- Lieux ajoutés (+7)
    SELECT u.id, COUNT(*)::int * 7
    FROM public.users u
    JOIN public.places p ON p.author_id = u.id
    WHERE p.created_at >= v_season.started_at AND p.created_at < v_window_end
    GROUP BY u.id

    UNION ALL

    -- Carnets (+3)
    SELECT u.id, COUNT(*)::int * 3
    FROM public.users u
    JOIN public.place_contributions pc ON pc.user_id = u.id
    WHERE pc.type = 'carnet'
      AND pc.created_at >= v_season.started_at AND pc.created_at < v_window_end
    GROUP BY u.id

    UNION ALL

    -- Photos (+1)
    SELECT u.id, COUNT(*)::int * 1
    FROM public.users u
    JOIN public.place_contributions pc ON pc.user_id = u.id
    WHERE pc.type = 'photo'
      AND pc.created_at >= v_season.started_at AND pc.created_at < v_window_end
    GROUP BY u.id

    UNION ALL

    -- Plantages (+5)
    SELECT u.id, COUNT(*)::int * 5
    FROM public.users u
    JOIN public.veille_history vh ON vh.user_id = u.id
    WHERE vh.planted_at >= v_season.started_at AND vh.planted_at < v_window_end
    GROUP BY u.id

    UNION ALL

    -- Énigmes correctes (+1 fixe, pas pondéré pour éviter incitation à tricher)
    SELECT u.id, COUNT(*)::int * 1
    FROM public.users u
    JOIN public.enigma_responses er ON er.user_id = u.id
    WHERE er.correct = TRUE
      AND er.responded_at >= v_season.started_at AND er.responded_at < v_window_end
    GROUP BY u.id
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

  -- Top 20 users
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
    SELECT u.id, COUNT(*)::int * 1 FROM public.users u
    JOIN public.place_contributions pc ON pc.user_id = u.id
    WHERE pc.type = 'photo' AND pc.created_at >= v_season.started_at AND pc.created_at < v_window_end
    GROUP BY u.id
    UNION ALL
    SELECT u.id, COUNT(*)::int * 5 FROM public.users u
    JOIN public.veille_history vh ON vh.user_id = u.id
    WHERE vh.planted_at >= v_season.started_at AND vh.planted_at < v_window_end
    GROUP BY u.id
    UNION ALL
    SELECT u.id, COUNT(*)::int * 1 FROM public.users u
    JOIN public.enigma_responses er ON er.user_id = u.id
    WHERE er.correct = TRUE AND er.responded_at >= v_season.started_at AND er.responded_at < v_window_end
    GROUP BY u.id
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

  -- Ma contribution détaillée + breakdown énigmes par difficulté + lieuxExplores
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
        'hard',     COALESCE(my_enigmes.hard, 0)
      ),
      'score',
        COALESCE(my_visites.cnt,  0) * 1
      + COALESCE(my_places.cnt,   0) * 7
      + COALESCE(my_carnets.cnt,  0) * 3
      + COALESCE(my_photos.cnt,   0) * 1
      + COALESCE(my_plantages.cnt,0) * 5
      + COALESCE(my_enigmes.cnt,  0) * 1
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
