-- 288_faction_banner_history.sql
-- WHY : la Coupe d'une Compagnie attribuait les actions d'un membre selon sa bannière
-- ACTIVE ACTUELLE → en changeant de bannière (ou en créant une 2e Compagnie), TOUS les
-- points de la saison « suivaient » la nouvelle Compagnie. Bug majeur. On veut : chaque
-- point compte pour la Compagnie qui était active AU MOMENT où il a été gagné.
-- Solution : un historique daté des bannières (intervalles), + attribution par intervalle.
-- ADDITIF.

-- Historique des périodes où un joueur a porté une bannière donnée.
CREATE TABLE IF NOT EXISTS public.faction_banner_history (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    text    NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  faction_id varchar NOT NULL REFERENCES public.factions(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at   timestamptz
);
CREATE INDEX IF NOT EXISTS fbh_user_idx    ON public.faction_banner_history(user_id);
CREATE INDEX IF NOT EXISTS fbh_faction_idx ON public.faction_banner_history(faction_id);

-- Trigger : à chaque changement de bannière active, on ferme l'intervalle courant et on
-- en ouvre un nouveau.
CREATE OR REPLACE FUNCTION public._track_banner_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.faction_id IS DISTINCT FROM OLD.faction_id THEN
    UPDATE public.faction_banner_history SET ended_at = now()
    WHERE user_id = NEW.id AND ended_at IS NULL;
    IF NEW.faction_id IS NOT NULL THEN
      INSERT INTO public.faction_banner_history (user_id, faction_id, started_at)
      VALUES (NEW.id, NEW.faction_id, now());
    END IF;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS users_banner_history ON public.users;
CREATE TRIGGER users_banner_history
  AFTER UPDATE OF faction_id ON public.users
  FOR EACH ROW EXECUTE FUNCTION public._track_banner_history();

-- Seed best-effort à partir des dates d'adhésion (l'historique n'existait pas avant).
-- 1) intervalle OUVERT pour la bannière active de chaque joueur (depuis qu'il l'a rejointe)
INSERT INTO public.faction_banner_history (user_id, faction_id, started_at, ended_at)
SELECT u.id, u.faction_id, COALESCE(fm.joined_at, now()), NULL
FROM public.users u
JOIN public.faction_members fm ON fm.user_id = u.id AND fm.faction_id = u.faction_id
WHERE u.faction_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.faction_banner_history h WHERE h.user_id = u.id);
-- 2) intervalles FERMÉS pour les autres adhésions non-retirées (jouées avant la bannière active)
INSERT INTO public.faction_banner_history (user_id, faction_id, started_at, ended_at)
SELECT fm.user_id, fm.faction_id, fm.joined_at, act.joined_at
FROM public.faction_members fm
JOIN public.factions f ON f.id = fm.faction_id AND f.retired = false
JOIN public.users u ON u.id = fm.user_id
JOIN public.faction_members act ON act.user_id = u.id AND act.faction_id = u.faction_id
WHERE u.faction_id IS NOT NULL
  AND fm.faction_id <> u.faction_id
  AND fm.joined_at < act.joined_at;

-- Coupe d'un joueur POUR une Compagnie = actions tombant dans ses intervalles de bannière
-- de cette Compagnie ∩ [from, to].
CREATE OR REPLACE FUNCTION public._user_faction_coupe(
  p_user_id text, p_faction_id text, p_from timestamptz DEFAULT NULL, p_to timestamptz DEFAULT NULL
) RETURNS integer LANGUAGE sql STABLE AS $$
  WITH iv AS (
    SELECT started_at, COALESCE(ended_at, now()) AS ended_at
    FROM public.faction_banner_history
    WHERE user_id = p_user_id AND faction_id = p_faction_id
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
GRANT EXECUTE ON FUNCTION public._user_faction_coupe(text,text,timestamptz,timestamptz) TO authenticated, anon, service_role;

-- list_factions : score = somme par membre de la Coupe attribuée par intervalle
CREATE OR REPLACE FUNCTION public.list_factions(p_search text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rows json; v_from timestamptz; v_to timestamptz;
BEGIN
  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_rows
  FROM (
    SELECT f.id, f.title AS name, f.color, f.image_url AS "imageUrl", f.description,
           f.tags, f.emblem_icon AS "emblemIcon", f.emblem_mono AS "emblemMono",
           (f.created_by IS NULL) AS "isOfficial",
           (SELECT count(*) FROM faction_members m WHERE m.faction_id = f.id) AS "memberCount",
           COALESCE((SELECT sum(public._user_faction_coupe(m.user_id, f.id, v_from, v_to))
                     FROM faction_members m WHERE m.faction_id = f.id), 0)::int AS "score"
    FROM factions f
    WHERE f.retired = false AND (p_search IS NULL OR f.title ILIKE '%' || p_search || '%')
    ORDER BY "score" DESC, "memberCount" DESC, f."order" ASC
    LIMIT 100
  ) t;
  RETURN v_rows;
END;$$;

-- get_faction_detail : coupe + breakdown par membre, attribués par intervalle de bannière
CREATE OR REPLACE FUNCTION public.get_faction_detail(p_faction_id text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_from timestamptz; v_to timestamptz; v_members json; v_total int; v_f public.factions%ROWTYPE;
  v_visit int := _barem('coupe.visit_gps', 3);
  v_add   int := _barem('coupe.add_place', 7);
  v_plant int := _barem('coupe.plant_flag', 2);
  v_photo int := _barem('coupe.photo', 1);
  v_e_ve  int := _barem('coupe.enigma_very_easy', 1);
  v_e_e   int := _barem('coupe.enigma_easy', 1);
  v_e_m   int := _barem('coupe.enigma_medium', 1);
  v_e_h   int := _barem('coupe.enigma_hard', 1);
BEGIN
  SELECT * INTO v_f FROM factions WHERE id = p_faction_id;
  IF v_f.id IS NULL THEN RETURN json_build_object('error','not_found'); END IF;
  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;

  WITH iv AS (
    SELECT user_id, started_at, COALESCE(ended_at, now()) AS ended_at
    FROM faction_banner_history WHERE faction_id = p_faction_id
  ),
  mem AS (
    SELECT
      m.user_id,
      COALESCE(u.display_name, u.first_name, 'Veilleur') AS name,
      u.avatar_url, m.joined_at, m.is_founder, m.crowns_invested, m.crowns_conquered,
      (SELECT count(DISTINCT pe.place_id) FROM place_explorers pe
        WHERE pe.user_id = m.user_id AND pe.visited_at >= v_from AND pe.visited_at < v_to
          AND EXISTS (SELECT 1 FROM iv WHERE iv.user_id = m.user_id AND pe.visited_at >= iv.started_at AND pe.visited_at < iv.ended_at))::int AS n_vis,
      (SELECT count(*) FROM places p
        WHERE p.author_id = m.user_id AND p.created_at >= v_from AND p.created_at < v_to
          AND EXISTS (SELECT 1 FROM iv WHERE iv.user_id = m.user_id AND p.created_at >= iv.started_at AND p.created_at < iv.ended_at))::int AS n_add,
      (SELECT count(*) FROM veille_history vh
        WHERE vh.user_id = m.user_id AND vh.planted_at >= v_from AND vh.planted_at < v_to
          AND EXISTS (SELECT 1 FROM iv WHERE iv.user_id = m.user_id AND vh.planted_at >= iv.started_at AND vh.planted_at < iv.ended_at))::int AS n_plant,
      (SELECT count(DISTINCT pc.place_id) FROM place_contributions pc
        WHERE pc.user_id = m.user_id AND pc.type = 'photo' AND pc.created_at >= v_from AND pc.created_at < v_to
          AND EXISTS (SELECT 1 FROM iv WHERE iv.user_id = m.user_id AND pc.created_at >= iv.started_at AND pc.created_at < iv.ended_at))::int AS n_photo,
      (SELECT COALESCE(
          count(*) FILTER (WHERE e.difficulty = 'very_easy') * v_e_ve
        + count(*) FILTER (WHERE e.difficulty = 'easy')      * v_e_e
        + count(*) FILTER (WHERE e.difficulty = 'medium')    * v_e_m
        + count(*) FILTER (WHERE e.difficulty = 'hard')      * v_e_h, 0)
        FROM enigma_responses er JOIN enigmas e ON e.id = er.enigma_id
        WHERE er.user_id = m.user_id AND er.correct = TRUE
          AND er.responded_at >= v_from AND er.responded_at < v_to
          AND EXISTS (SELECT 1 FROM iv WHERE iv.user_id = m.user_id AND er.responded_at >= iv.started_at AND er.responded_at < iv.ended_at))::int AS enig_pts
    FROM faction_members m JOIN users u ON u.id = m.user_id
    WHERE m.faction_id = p_faction_id
  ),
  mem_pts AS (
    SELECT *,
      n_vis * v_visit AS vis_pts, n_add * v_add AS add_pts,
      n_plant * v_plant AS plant_pts, n_photo * v_photo AS photo_pts
    FROM mem
  )
  SELECT
    COALESCE(json_agg(json_build_object(
      'userId', user_id, 'name', name, 'avatarUrl', avatar_url,
      'joinedAt', joined_at, 'isFounder', is_founder,
      'crownsInvested', crowns_invested, 'crownsConquered', crowns_conquered,
      'coupe', (vis_pts + add_pts + plant_pts + photo_pts + enig_pts),
      'breakdown', jsonb_strip_nulls(jsonb_build_object(
        'enigmes', NULLIF(enig_pts, 0),
        'visites', NULLIF(vis_pts, 0),
        'ajouts',  NULLIF(add_pts, 0),
        'veilles', NULLIF(plant_pts, 0),
        'photos',  NULLIF(photo_pts, 0)
      ))
    ) ORDER BY (vis_pts + add_pts + plant_pts + photo_pts + enig_pts + crowns_invested + crowns_conquered) DESC, joined_at ASC), '[]'::json),
    COALESCE(sum(vis_pts + add_pts + plant_pts + photo_pts + enig_pts), 0)::int
  INTO v_members, v_total
  FROM mem_pts;

  RETURN json_build_object(
    'id', v_f.id, 'name', v_f.title, 'color', v_f.color, 'imageUrl', v_f.image_url,
    'description', v_f.description,
    'tags', to_json(v_f.tags),
    'emblemIcon', v_f.emblem_icon, 'emblemMono', v_f.emblem_mono, 'publicSlug', v_f.public_slug,
    'createdBy', v_f.created_by,
    'isOfficial', (v_f.created_by IS NULL),
    'memberCount', (SELECT count(*) FROM faction_members WHERE faction_id = p_faction_id),
    'totalCoupe', v_total,
    'totalCrowns', (SELECT COALESCE(sum(crowns_invested + crowns_conquered), 0)
                    FROM faction_members WHERE faction_id = p_faction_id),
    'members', v_members
  );
END;$$;

-- get_coupe_state : agrégation Compagnie par intervalle (topUsers + myBreakdown restent
-- personnels = toutes les actions, inchangés).
CREATE OR REPLACE FUNCTION public.get_coupe_state(p_user_id text, p_season_id bigint DEFAULT NULL::bigint)
 RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_season public.coupe_seasons%ROWTYPE; v_window_end timestamptz;
  v_factions jsonb; v_top_users jsonb; v_my_breakdown jsonb;
  v_c_discover int := _barem('coupe.discover_remote', 0);
  v_c_visit int := _barem('coupe.visit_gps', 3);
  v_c_plant int := _barem('coupe.plant_flag', 2);
  v_c_add int := _barem('coupe.add_place', 7);
  v_c_carnet int := _barem('coupe.carnet', 3);
  v_c_photo int := _barem('coupe.photo', 1);
  v_c_e_ve int := _barem('coupe.enigma_very_easy', 1);
  v_c_e_e int := _barem('coupe.enigma_easy', 1);
  v_c_e_m int := _barem('coupe.enigma_medium', 1);
  v_c_e_h int := _barem('coupe.enigma_hard', 1);
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN p_user_id := NULL; END IF;
  IF p_season_id IS NOT NULL THEN
    SELECT * INTO v_season FROM public.coupe_seasons WHERE id = p_season_id;
  ELSE
    SELECT * INTO v_season FROM public.coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;
  END IF;
  IF v_season.id IS NULL THEN RETURN json_build_object('error', 'no_season'); END IF;
  v_window_end := COALESCE(v_season.ended_at, now());

  -- Factions : somme par membre de la Coupe attribuée par intervalle
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

  -- Top contributeurs (personnel = toutes actions)
  WITH user_scores AS (
    SELECT pd.user_id, COUNT(*)::int * v_c_discover AS score FROM public.places_discovered pd
    WHERE pd.discovered_at >= v_season.started_at AND pd.discovered_at < v_window_end GROUP BY pd.user_id
    UNION ALL
    SELECT pe.user_id, COUNT(DISTINCT pe.place_id)::int * v_c_visit FROM public.place_explorers pe
    WHERE pe.visited_at >= v_season.started_at AND pe.visited_at < v_window_end GROUP BY pe.user_id
    UNION ALL
    SELECT p.author_id, COUNT(*)::int * v_c_add FROM public.places p
    WHERE p.created_at >= v_season.started_at AND p.created_at < v_window_end AND p.author_id IS NOT NULL GROUP BY p.author_id
    UNION ALL
    SELECT pc.user_id, COUNT(*)::int * v_c_carnet FROM public.place_contributions pc
    WHERE pc.type = 'carnet' AND pc.created_at >= v_season.started_at AND pc.created_at < v_window_end GROUP BY pc.user_id
    UNION ALL
    SELECT pc.user_id, COUNT(*)::int * v_c_photo FROM public.place_contributions pc
    WHERE pc.type = 'photo' AND pc.created_at >= v_season.started_at AND pc.created_at < v_window_end GROUP BY pc.user_id
    UNION ALL
    SELECT vh.user_id, COUNT(*)::int * v_c_plant FROM public.veille_history vh
    WHERE vh.planted_at >= v_season.started_at AND vh.planted_at < v_window_end GROUP BY vh.user_id
    UNION ALL
    SELECT er.user_id,
      ( COUNT(*) FILTER (WHERE e.difficulty='very_easy')::int * v_c_e_ve
      + COUNT(*) FILTER (WHERE e.difficulty='easy')::int      * v_c_e_e
      + COUNT(*) FILTER (WHERE e.difficulty='medium')::int    * v_c_e_m
      + COUNT(*) FILTER (WHERE e.difficulty='hard')::int      * v_c_e_h )
    FROM public.enigma_responses er JOIN public.enigmas e ON e.id = er.enigma_id
    WHERE er.correct = TRUE AND er.responded_at >= v_season.started_at AND er.responded_at < v_window_end GROUP BY er.user_id
  )
  SELECT jsonb_agg(jsonb_build_object(
    'userId', tu.user_id, 'displayName', COALESCE(u.display_name, u.first_name, 'Quelqu''un'),
    'avatarUrl', u.avatar_url, 'factionId', u.faction_id, 'score', tu.total_score, 'rank', tu.rnk
  ) ORDER BY tu.rnk)
  INTO v_top_users
  FROM (
    SELECT us.user_id, SUM(us.score)::int AS total_score,
           ROW_NUMBER() OVER (ORDER BY SUM(us.score) DESC)::int AS rnk
    FROM user_scores us GROUP BY us.user_id HAVING SUM(us.score) > 0
    ORDER BY total_score DESC LIMIT 20
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
