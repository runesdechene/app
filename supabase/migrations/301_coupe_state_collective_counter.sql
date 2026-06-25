-- 301_coupe_state_collective_counter.sql
-- WHY : compteur collectif « Ensemble contre l'Oubli » — recadre la Coupe comme reliée aux
-- actions réelles. get_coupe_state renvoie un bloc `collective` (totaux de la saison, toute la
-- communauté) : lieux ajoutés / visites GPS / énigmes percées. LECTURE SEULE, aucun changement
-- du calcul de la Coupe. Corps = baseline prod (mig 298) + 3 deltas (var + SELECT + clé JSON). ADDITIF.

CREATE OR REPLACE FUNCTION public.get_coupe_state(p_user_id text, p_season_id bigint DEFAULT NULL::bigint)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_season public.coupe_seasons%ROWTYPE; v_window_end timestamptz;
  v_factions jsonb; v_top_users jsonb; v_my_breakdown jsonb;
  v_collective jsonb;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN p_user_id := NULL; END IF;
  IF p_season_id IS NOT NULL THEN
    SELECT * INTO v_season FROM public.coupe_seasons WHERE id = p_season_id;
  ELSE
    SELECT * INTO v_season FROM public.coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;
  END IF;
  IF v_season.id IS NULL THEN RETURN json_build_object('error', 'no_season'); END IF;
  v_window_end := COALESCE(v_season.ended_at, now());

  -- Compteur collectif (toute la communauté, fenêtre de la saison). Lecture seule.
  SELECT jsonb_build_object(
    'lieuxSortisOubli', (SELECT count(*) FROM public.places
        WHERE created_at >= v_season.started_at AND created_at < v_window_end),
    'lieuxVisites', (SELECT count(*) FROM public.place_explorers
        WHERE visited_at >= v_season.started_at AND visited_at < v_window_end),
    'enigmesPercees', (SELECT count(*) FROM public.enigma_responses
        WHERE correct = TRUE AND responded_at >= v_season.started_at AND responded_at < v_window_end)
  ) INTO v_collective;

  SELECT jsonb_agg(jsonb_build_object(
    'factionId', x.faction_id, 'factionTitle', x.title, 'factionColor', x.color,
    'score', x.score, 'memberCount', x.contributors, 'rank', x.rnk
  ) ORDER BY x.rnk)
  INTO v_factions
  FROM (
    SELECT f.id AS faction_id, f.title, f.color, agg.score, agg.contributors,
           ROW_NUMBER() OVER (ORDER BY agg.score DESC)::int AS rnk
    FROM factions f
    JOIN LATERAL (
      SELECT COALESCE(SUM(pc.pts), 0)::int AS score,
             COUNT(*) FILTER (WHERE pc.pts > 0)::int AS contributors
      FROM (
        SELECT public._user_faction_coupe(m.user_id, f.id, v_season.started_at, v_window_end) AS pts
        FROM faction_members m WHERE m.faction_id = f.id
      ) pc
    ) agg ON TRUE
    WHERE f.retired = false AND agg.score > 0
  ) x;

  SELECT jsonb_agg(jsonb_build_object(
    'userId', tu.user_id, 'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
    'avatarUrl', u.avatar_url, 'factionId', u.faction_id, 'score', tu.score, 'rank', tu.rnk
  ) ORDER BY tu.rnk)
  INTO v_top_users
  FROM (
    SELECT s.user_id, s.score, ROW_NUMBER() OVER (ORDER BY s.score DESC)::int AS rnk
    FROM (
      SELECT c.user_id,
             public._user_coupe_score(c.user_id, v_season.started_at, v_window_end)::int AS score
      FROM (SELECT DISTINCT user_id FROM public.faction_banner_history) c
    ) s
    WHERE s.score > 0
    ORDER BY s.score DESC LIMIT 20
  ) tu
  JOIN public.users u ON u.id = tu.user_id
  WHERE u.faction_id IS NOT NULL;

  IF p_user_id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'userId', p_user_id,
      'lieuxDecouverts', COALESCE(my_disc.cnt, 0),
      'lieuxExplores',   COALESCE(my_visites.cnt, 0),
      'lieuxAjoutes',    COALESCE(my_places.cnt, 0),
      'carnets',         COALESCE(my_carnets.cnt, 0),
      'photos',          COALESCE(my_photos.cnt, 0),
      'plantages',       COALESCE(my_plantages.cnt, 0),
      'enigmes', jsonb_build_object('total', COALESCE(my_enigmes.cnt, 0),
        'veryEasy', COALESCE(my_enigmes.very_easy, 0), 'easy', COALESCE(my_enigmes.easy, 0),
        'medium', COALESCE(my_enigmes.medium, 0), 'hard', COALESCE(my_enigmes.hard, 0)),
      'score', public._user_coupe_score(p_user_id, v_season.started_at, v_window_end)
    )
    INTO v_my_breakdown
    FROM
      (SELECT COUNT(*)::int AS cnt FROM public.places_discovered
         WHERE user_id = p_user_id AND discovered_at >= v_season.started_at AND discovered_at < v_window_end) my_disc,
      (SELECT COUNT(DISTINCT place_id)::int AS cnt FROM public.place_explorers
         WHERE user_id = p_user_id AND visited_at >= v_season.started_at AND visited_at < v_window_end) my_visites,
      (SELECT COUNT(*)::int AS cnt FROM public.places
         WHERE author_id = p_user_id AND created_at >= v_season.started_at AND created_at < v_window_end) my_places,
      (SELECT COUNT(*)::int AS cnt FROM public.place_contributions
         WHERE user_id = p_user_id AND type = 'carnet' AND created_at >= v_season.started_at AND created_at < v_window_end) my_carnets,
      (SELECT COUNT(*)::int AS cnt FROM public.place_contributions
         WHERE user_id = p_user_id AND type = 'photo' AND created_at >= v_season.started_at AND created_at < v_window_end) my_photos,
      (SELECT COUNT(*)::int AS cnt FROM public.veille_history
         WHERE user_id = p_user_id AND planted_at >= v_season.started_at AND planted_at < v_window_end) my_plantages,
      (SELECT COUNT(*)::int AS cnt,
         COUNT(*) FILTER (WHERE e.difficulty='very_easy')::int AS very_easy,
         COUNT(*) FILTER (WHERE e.difficulty='easy')::int      AS easy,
         COUNT(*) FILTER (WHERE e.difficulty='medium')::int    AS medium,
         COUNT(*) FILTER (WHERE e.difficulty='hard')::int      AS hard
       FROM public.enigma_responses er JOIN public.enigmas e ON e.id = er.enigma_id
       WHERE er.user_id = p_user_id AND er.correct = TRUE
         AND er.responded_at >= v_season.started_at AND er.responded_at < v_window_end) my_enigmes;
  END IF;

  RETURN json_build_object(
    'season', json_build_object('id', v_season.id, 'name', v_season.name,
      'startedAt', v_season.started_at, 'endedAt', v_season.ended_at, 'isActive', v_season.ended_at IS NULL),
    'factions', COALESCE(v_factions, '[]'::jsonb),
    'topUsers', COALESCE(v_top_users, '[]'::jsonb),
    'collective', v_collective,
    'myBreakdown', v_my_breakdown
  );
END;
$function$;
