-- 298_coupe_score_in_company_only.sql
-- WHY : incohérence interne de la Coupe. Le classement des COMPAGNIES (get_coupe_state.factions,
-- list_factions) attribue les points par banner-history (un point compte pour la Compagnie
-- active AU MOMENT de l'action). Mais le score INDIVIDUEL (_user_coupe_score → top contributeurs,
-- profil, myBreakdown) comptait TOUTES les actions de la saison, sans gating. Résultat observé :
-- un joueur ayant fait ses énigmes ~minutes AVANT de rejoindre une Compagnie apparaissait comme
-- « top contributeur » de cette Compagnie (3 pts) alors que la Compagnie restait à 0 → contradiction.
-- Décision (Uriel, 25/06) : « une action faite hors compagnie ne compte PAS pour la Coupe »,
-- appliqué PARTOUT. On gate _user_coupe_score sur les intervalles banner-history du joueur (toutes
-- ses Compagnies). Conséquence : profil + myBreakdown + top contributeurs deviennent cohérents avec
-- le classement des Compagnies. ADDITIF (redéfinitions backward-compatibles).

-- ── Score Coupe individuel = points gagnés EN COMPAGNIE seulement ──────────────
-- (= _user_faction_coupe mais sur TOUS les intervalles du joueur, pas une seule Compagnie.)
-- Les actions hors de tout intervalle (joueur factionless au moment de l'action) ne comptent pas.
CREATE OR REPLACE FUNCTION public._user_coupe_score(
  p_user_id text,
  p_from timestamptz DEFAULT NULL,
  p_to   timestamptz DEFAULT NULL
) RETURNS integer LANGUAGE sql STABLE AS $$
  WITH iv AS (
    SELECT started_at, COALESCE(ended_at, now()) AS ended_at
    FROM public.faction_banner_history
    WHERE user_id = p_user_id
  )
  SELECT
    COALESCE((SELECT COUNT(DISTINCT pe.place_id) FROM public.place_explorers pe
       WHERE pe.user_id = p_user_id
         AND (p_from IS NULL OR pe.visited_at >= p_from) AND (p_to IS NULL OR pe.visited_at < p_to)
         AND EXISTS (SELECT 1 FROM iv WHERE pe.visited_at >= iv.started_at AND pe.visited_at < iv.ended_at)
     ), 0) * public._barem('coupe.visit_gps', 3)
  + COALESCE((SELECT COUNT(*) FROM public.places p
       WHERE p.author_id = p_user_id
         AND (p_from IS NULL OR p.created_at >= p_from) AND (p_to IS NULL OR p.created_at < p_to)
         AND EXISTS (SELECT 1 FROM iv WHERE p.created_at >= iv.started_at AND p.created_at < iv.ended_at)
     ), 0) * public._barem('coupe.add_place', 7)
  + COALESCE((SELECT COUNT(DISTINCT pc.place_id) FROM public.place_contributions pc
       WHERE pc.user_id = p_user_id AND pc.type = 'photo'
         AND (p_from IS NULL OR pc.created_at >= p_from) AND (p_to IS NULL OR pc.created_at < p_to)
         AND EXISTS (SELECT 1 FROM iv WHERE pc.created_at >= iv.started_at AND pc.created_at < iv.ended_at)
     ), 0) * public._barem('coupe.photo', 1)
  + COALESCE((SELECT COUNT(*) FROM public.veille_history vh
       WHERE vh.user_id = p_user_id
         AND (p_from IS NULL OR vh.planted_at >= p_from) AND (p_to IS NULL OR vh.planted_at < p_to)
         AND EXISTS (SELECT 1 FROM iv WHERE vh.planted_at >= iv.started_at AND vh.planted_at < iv.ended_at)
     ), 0) * public._barem('coupe.plant_flag', 2)
  + COALESCE((SELECT
        COUNT(*) FILTER (WHERE e.difficulty='very_easy') * public._barem('coupe.enigma_very_easy',1)
      + COUNT(*) FILTER (WHERE e.difficulty='easy')      * public._barem('coupe.enigma_easy',1)
      + COUNT(*) FILTER (WHERE e.difficulty='medium')    * public._barem('coupe.enigma_medium',1)
      + COUNT(*) FILTER (WHERE e.difficulty='hard')      * public._barem('coupe.enigma_hard',1)
      FROM public.enigma_responses er JOIN public.enigmas e ON e.id = er.enigma_id
      WHERE er.user_id = p_user_id AND er.correct = TRUE
        AND (p_from IS NULL OR er.responded_at >= p_from) AND (p_to IS NULL OR er.responded_at < p_to)
        AND EXISTS (SELECT 1 FROM iv WHERE er.responded_at >= iv.started_at AND er.responded_at < iv.ended_at)
     ), 0);
$$;

-- ── Chef : classé par sa contribution À CETTE Compagnie (banner-history), pas son score global ──
-- (cohérent avec get_faction_detail qui affiche _user_faction_coupe par membre. L'allié reste exclu.)
CREATE OR REPLACE FUNCTION public._faction_chef(p_faction_id text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_from timestamptz; v_to timestamptz; v_chef text;
BEGIN
  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;
  SELECT m.user_id INTO v_chef
  FROM faction_members m JOIN users u ON u.id = m.user_id
  WHERE m.faction_id = p_faction_id
    AND u.faction_id = p_faction_id          -- principale uniquement : l'allié ne règne pas
  ORDER BY (
    public._user_faction_coupe(m.user_id, p_faction_id, v_from, v_to)
    + m.crowns_invested + m.crowns_conquered
  ) DESC, m.joined_at ASC
  LIMIT 1;
  RETURN v_chef;
END;$$;

-- ── get_coupe_state : top contributeurs rangés par score EN COMPAGNIE (cohérent factions) ──
-- factions = inchangé (banner-history). myBreakdown.score = _user_coupe_score (désormais gaté).
CREATE OR REPLACE FUNCTION public.get_coupe_state(p_user_id text, p_season_id bigint DEFAULT NULL::bigint)
 RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_season public.coupe_seasons%ROWTYPE; v_window_end timestamptz;
  v_factions jsonb; v_top_users jsonb; v_my_breakdown jsonb;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN p_user_id := NULL; END IF;
  IF p_season_id IS NOT NULL THEN
    SELECT * INTO v_season FROM public.coupe_seasons WHERE id = p_season_id;
  ELSE
    SELECT * INTO v_season FROM public.coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;
  END IF;
  IF v_season.id IS NULL THEN RETURN json_build_object('error', 'no_season'); END IF;
  v_window_end := COALESCE(v_season.ended_at, now());

  -- Compagnies : somme par membre de la Coupe attribuée par intervalle de bannière.
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

  -- Top contributeurs : score INDIVIDUEL = points gagnés en compagnie (banner-history).
  -- Candidats = joueurs ayant déjà porté une bannière ; on exclut score 0 (= que des actions
  -- hors compagnie) → ils n'apparaissent plus comme contributeurs d'une Compagnie à 0.
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
    'myBreakdown', v_my_breakdown
  );
END;
$function$;
