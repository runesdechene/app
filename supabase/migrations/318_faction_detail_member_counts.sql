-- 318_faction_detail_member_counts.sql
-- WHY : UX/clarté du Hall. Le `breakdown` ne renvoyait que des POINTS (ex. 98) qu'on lisait
-- à tort comme des quantités (« 98 lieux » alors que = 14 lieux × 7 pts). On expose en plus
-- un objet `counts` par membre = les VRAIS nombres d'actions (énigmes résolues, lieux ajoutés,
-- visites, veilles, photos), pour afficher « 14 lieux (+98) ». Corps = mig 317 + n_enig + `counts`.
-- ADDITIF : `breakdown` (points) et `coupe` (total) sont conservés tels quels.
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
  v_mc int;
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
      COALESCE(u.title_gender, 'm') AS title_gender,
      (u.faction_id IS DISTINCT FROM p_faction_id) AS is_ally,
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
      -- Points d'énigmes (pondérés par difficulté via le barème).
      (SELECT COALESCE(
          count(*) FILTER (WHERE e.difficulty = 'very_easy') * v_e_ve
        + count(*) FILTER (WHERE e.difficulty = 'easy')      * v_e_e
        + count(*) FILTER (WHERE e.difficulty = 'medium')    * v_e_m
        + count(*) FILTER (WHERE e.difficulty = 'hard')      * v_e_h, 0)
        FROM enigma_responses er JOIN enigmas e ON e.id = er.enigma_id
        WHERE er.user_id = m.user_id AND er.correct = TRUE
          AND er.responded_at >= v_from AND er.responded_at < v_to
          AND EXISTS (SELECT 1 FROM iv WHERE iv.user_id = m.user_id AND er.responded_at >= iv.started_at AND er.responded_at < iv.ended_at))::int AS enig_pts,
      -- Nombre d'énigmes résolues (le COMPTE, indépendant de la pondération du barème).
      (SELECT count(*)
        FROM enigma_responses er JOIN enigmas e ON e.id = er.enigma_id
        WHERE er.user_id = m.user_id AND er.correct = TRUE
          AND er.responded_at >= v_from AND er.responded_at < v_to
          AND EXISTS (SELECT 1 FROM iv WHERE iv.user_id = m.user_id AND er.responded_at >= iv.started_at AND er.responded_at < iv.ended_at))::int AS n_enig
    FROM faction_members m JOIN users u ON u.id = m.user_id
    WHERE m.faction_id = p_faction_id
  ),
  mem_pts AS (
    SELECT *, n_vis * v_visit AS vis_pts, n_add * v_add AS add_pts,
      n_plant * v_plant AS plant_pts, n_photo * v_photo AS photo_pts
    FROM mem
  ),
  gbounds AS (
    SELECT rank, SUM(COALESCE(capacity, 2147483647)) OVER (ORDER BY rank) AS cum_upper
    FROM faction_grade_labels WHERE faction_id = p_faction_id
    UNION ALL
    SELECT * FROM (VALUES (1, 1), (2, 2), (3, 5), (4, 2147483647)) AS d(rank, cum_upper)
    WHERE NOT EXISTS (SELECT 1 FROM faction_grade_labels WHERE faction_id = p_faction_id)
  ),
  ranked AS (
    SELECT mp.*,
      CASE WHEN is_ally THEN NULL ELSE
        ROW_NUMBER() OVER (
          PARTITION BY is_ally
          ORDER BY (vis_pts + add_pts + plant_pts + photo_pts + enig_pts
                    + crowns_invested + crowns_conquered / 10.0) DESC, joined_at ASC)
      END AS principal_pos
    FROM mem_pts mp
  ),
  graded AS (
    SELECT r.*,
      CASE WHEN principal_pos IS NULL THEN NULL
           ELSE (SELECT MIN(gb.rank) FROM gbounds gb WHERE gb.cum_upper >= r.principal_pos) END AS grade_rank
    FROM ranked r
  )
  SELECT
    COALESCE(json_agg(json_build_object(
      'userId', user_id, 'name', name, 'avatarUrl', avatar_url,
      'joinedAt', joined_at, 'isFounder', is_founder, 'isAlly', is_ally,
      'titleGender', title_gender,
      'crownsInvested', crowns_invested, 'crownsConquered', crowns_conquered,
      'coupe', (vis_pts + add_pts + plant_pts + photo_pts + enig_pts),
      'gradeRank', grade_rank,
      'gradeLabel', public._grade_label(p_faction_id, grade_rank, title_gender),
      'breakdown', jsonb_strip_nulls(jsonb_build_object(
        'enigmes', NULLIF(enig_pts, 0), 'visites', NULLIF(vis_pts, 0),
        'ajouts',  NULLIF(add_pts, 0), 'veilles', NULLIF(plant_pts, 0), 'photos', NULLIF(photo_pts, 0)
      )),
      'counts', jsonb_strip_nulls(jsonb_build_object(
        'enigmes', NULLIF(n_enig, 0), 'visites', NULLIF(n_vis, 0),
        'ajouts',  NULLIF(n_add, 0), 'veilles', NULLIF(n_plant, 0), 'photos', NULLIF(n_photo, 0)
      ))
    ) ORDER BY is_ally ASC, (vis_pts + add_pts + plant_pts + photo_pts + enig_pts + crowns_invested + crowns_conquered / 10.0) DESC, joined_at ASC), '[]'::json),
    COALESCE(sum(vis_pts + add_pts + plant_pts + photo_pts + enig_pts), 0)::int
  INTO v_members, v_total
  FROM graded;

  v_mc := (SELECT count(*) FROM faction_members WHERE faction_id = p_faction_id);

  RETURN json_build_object(
    'id', v_f.id, 'name', v_f.title, 'color', v_f.color, 'imageUrl', v_f.image_url,
    'description', v_f.description, 'tags', to_json(v_f.tags),
    'emblemIcon', v_f.emblem_icon, 'emblemMono', v_f.emblem_mono, 'publicSlug', v_f.public_slug,
    'createdBy', v_f.created_by, 'isOfficial', (v_f.created_by IS NULL),
    'memberCount', v_mc,
    'locked', public._faction_is_locked(p_faction_id),
    'totalCoupe', v_total,
    'totalCrowns', (SELECT COALESCE(sum(crowns_invested + crowns_conquered), 0)
                    FROM faction_members WHERE faction_id = p_faction_id),
    'governGrades', (SELECT govern_grades FROM factions WHERE id = p_faction_id),
    'grades', COALESCE((
      SELECT json_agg(json_build_object(
        'position', g.rank,
        'labelM', public._grade_label(p_faction_id, g.rank, 'm'),
        'labelF', public._grade_label(p_faction_id, g.rank, 'f'),
        'labelN', public._grade_label(p_faction_id, g.rank, 'n'),
        'capacity', g.capacity
      ) ORDER BY g.rank) FROM faction_grade_labels g WHERE g.faction_id = p_faction_id),
      '[{"position":1,"labelM":"Seigneur","labelF":"Dame","labelN":"Seigneur·e","capacity":1},
        {"position":2,"labelM":"Co-seigneur","labelF":"Co-dame","labelN":"Co-seigneur·e","capacity":1},
        {"position":3,"labelM":"Officier","labelF":"Officière","labelN":"Officier·ère","capacity":3},
        {"position":4,"labelM":"Membre","labelF":"Membre","labelN":"Membre","capacity":null}]'::json
    ),
    'members', v_members
  );
END;$$;
