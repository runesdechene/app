-- 033_get_faction_members_v07.sql
-- WHY : refonte de la fenêtre faction (FactionMembersModal) cohérente avec V0.7.
--
-- Avant :
--   - glory = exploration_points + erudition_points (ancienne formule V0.5)
--   - influencePlaced = somme V0.5 (gelée)
--   - influenceContent = carnets × influence_add_carnet + ... (gelé)
--   - tri par exploration+erudition
--
-- Après :
--   - glory = nouvelle formule à la volée (cohérent get_my_glory / leaderboard)
--   - coupeScore = score de la saison courante
--   - tri par glory desc
--   - on retire influencePlaced + influenceContent (V0.5 gelé)

CREATE OR REPLACE FUNCTION public.get_faction_members(p_faction_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_season_start timestamptz;
  v_season_end   timestamptz;
  v_result json;
BEGIN
  -- Saison courante (ou la plus récente si aucune active)
  SELECT started_at, COALESCE(ended_at, now())
  INTO v_season_start, v_season_end
  FROM public.coupe_seasons
  ORDER BY (ended_at IS NULL) DESC, started_at DESC
  LIMIT 1;

  -- Fallback : si pas de saison du tout, on retourne quand même les membres
  -- avec coupeScore = 0 (window vide).
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
  SELECT COALESCE(json_agg(member ORDER BY glory DESC), '[]'::json) INTO v_result
  FROM (
    SELECT json_build_object(
      'userId',                u.id,
      'name',                  COALESCE(u.display_name, u.first_name, u.email_address),
      'profileImage',          u.avatar_url,
      'glory',                 ug.glory,
      'coupeScore',            ug.coupe_score,
      'factionTitle2',         (SELECT get_user_titles(u.id)->'factionTitle')
    ) AS member,
    ug.glory
    FROM user_glory ug
    JOIN public.users u ON u.id = ug.user_id
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_faction_members(text) TO authenticated, anon, service_role;
