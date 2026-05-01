-- 023_v07_coupe_seasons.sql
-- WHY : V0.7 phase 3 — Coupe des Héritages.
-- Compétition saine entre factions : chaque action personnelle des membres
-- (énigmes, plantages, carnets, photos, lieux ajoutés) cumule un score pour
-- leur Héritage. La faction qui domine remporte la Coupe à la clôture de saison.
--
-- Système :
--   - 1 saison active à la fois (ended_at IS NULL), gérée manuellement par admin.
--   - Score calculé À LA VOLÉE depuis les tables sources (places, place_contributions,
--     veille_history, enigma_responses) — automatiquement modulaire : si un lieu
--     est supprimé, ses points s'évanouissent immédiatement pour user et faction.
--   - Faction prise en compte : la faction ACTUELLE du user au moment de la lecture.
--     Si tu changes de faction, tes points partent avec toi (cohérent V0.7).
--
-- Barème (1er mai 2026, validé Uriel) :
--   Énigme du jour résolue       : +1 par bonne réponse
--   Plantage de bannière          : +5 par plantage (1 ligne dans veille_history)
--   Photo ajoutée à un lieu       : +1 par photo
--   Carnet sur un lieu            : +3 par carnet
--   Lieu ajouté                   : +7 par lieu créé (action la plus complète)
--
-- Combo créateur sur place avec carnet = 7 + 5 + 3 = 15 pts. Honnête vu qu'un
-- profil érudit avec fragments peut faire 5-8 pts/jour via énigmes répétées.

-- ============================================================
-- TABLE : coupe_seasons
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coupe_seasons (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  started_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz                     -- NULL = saison active
);

CREATE INDEX IF NOT EXISTS coupe_seasons_active_idx
  ON public.coupe_seasons (started_at DESC)
  WHERE ended_at IS NULL;

GRANT SELECT ON public.coupe_seasons TO authenticated, anon, service_role;

-- Saison initiale : démarre au déploiement de cette migration.
-- Idempotent : skip si une saison existe déjà.
INSERT INTO public.coupe_seasons (name, started_at)
SELECT 'Saison 1 — Printemps-Été 2026', now()
WHERE NOT EXISTS (SELECT 1 FROM public.coupe_seasons);

-- ============================================================
-- RPC : get_coupe_state
-- Calcule à la volée : classement factions + top users + ma contribution.
-- p_season_id NULL → saison active (ended_at IS NULL, la plus récente sinon).
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
    -- Lecture publique tolérée (anon peut voir le classement) mais myBreakdown vide.
    p_user_id := NULL;
  END IF;

  -- Charge la saison cible
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

  -- Score par user (avant aggrégation faction) — calcul commun réutilisé
  WITH user_scores AS (
    -- Lieux ajoutés (+7 chacun)
    SELECT u.id AS user_id, COUNT(*)::int * 7 AS score, 'places' AS src
    FROM public.users u
    JOIN public.places p ON p.author_id = u.id
    WHERE p.created_at >= v_season.started_at
      AND p.created_at <  v_window_end
    GROUP BY u.id

    UNION ALL

    -- Carnets (+3 chacun)
    SELECT u.id, COUNT(*)::int * 3, 'carnets'
    FROM public.users u
    JOIN public.place_contributions pc ON pc.user_id = u.id
    WHERE pc.type = 'carnet'
      AND pc.created_at >= v_season.started_at
      AND pc.created_at <  v_window_end
    GROUP BY u.id

    UNION ALL

    -- Photos (+1 chacune)
    SELECT u.id, COUNT(*)::int * 1, 'photos'
    FROM public.users u
    JOIN public.place_contributions pc ON pc.user_id = u.id
    WHERE pc.type = 'photo'
      AND pc.created_at >= v_season.started_at
      AND pc.created_at <  v_window_end
    GROUP BY u.id

    UNION ALL

    -- Plantages (+5 chacun) — 1 ligne dans veille_history par membre par plantage
    SELECT u.id, COUNT(*)::int * 5, 'plantages'
    FROM public.users u
    JOIN public.veille_history vh ON vh.user_id = u.id
    WHERE vh.planted_at >= v_season.started_at
      AND vh.planted_at <  v_window_end
    GROUP BY u.id

    UNION ALL

    -- Énigmes correctement résolues (+1 chacune)
    SELECT u.id, COUNT(*)::int * 1, 'enigmes'
    FROM public.users u
    JOIN public.enigma_responses er ON er.user_id = u.id
    WHERE er.correct = TRUE
      AND er.responded_at >= v_season.started_at
      AND er.responded_at <  v_window_end
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
  -- Aggrégation par faction (filtre user.faction_id NOT NULL)
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

  -- Top users (top 20 toutes factions confondues, faction_id non NULL)
  WITH user_scores AS (
    SELECT u.id AS user_id, COUNT(*)::int * 7 AS score
    FROM public.users u JOIN public.places p ON p.author_id = u.id
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

  -- Ma contribution détaillée (NULL si p_user_id NULL)
  IF p_user_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'userId',        p_user_id,
      'lieuxAjoutes',  COALESCE(my_places.cnt,    0),
      'carnets',       COALESCE(my_carnets.cnt,   0),
      'photos',        COALESCE(my_photos.cnt,    0),
      'plantages',     COALESCE(my_plantages.cnt, 0),
      'enigmes',       COALESCE(my_enigmes.cnt,   0),
      'score',
        COALESCE(my_places.cnt, 0) * 7
      + COALESCE(my_carnets.cnt, 0) * 3
      + COALESCE(my_photos.cnt, 0) * 1
      + COALESCE(my_plantages.cnt, 0) * 5
      + COALESCE(my_enigmes.cnt, 0) * 1
    )
    INTO v_my_breakdown
    FROM
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
      (SELECT COUNT(*)::int AS cnt FROM public.enigma_responses
         WHERE user_id = p_user_id AND correct = TRUE
           AND responded_at >= v_season.started_at AND responded_at < v_window_end) my_enigmes;
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
