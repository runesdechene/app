-- 284_faction_detail_member_breakdown.sql
-- WHY : dans le Hall, on veut voir D'OÙ viennent les points de chaque membre (énigmes,
-- visites, ajouts, veilles, photos, conquête à l'or) qui composent son total Coupe.
-- get_faction_detail renvoie désormais un `breakdown` par membre (points par source,
-- non-nuls seulement), gaté par la bannière active (mêmes règles que _user_coupe_score)
-- + l'or de la Compagnie. ADDITIF.

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

  WITH mem AS (
    SELECT
      m.user_id,
      COALESCE(u.display_name, u.first_name, 'Veilleur') AS name,
      u.avatar_url, m.joined_at, m.is_founder, m.crowns_invested,
      (u.faction_id = p_faction_id) AS act,
      (SELECT count(DISTINCT pe.place_id) FROM place_explorers pe
        WHERE pe.user_id = m.user_id AND pe.visited_at >= v_from AND pe.visited_at < v_to)::int AS n_vis,
      (SELECT count(*) FROM places p
        WHERE p.author_id = m.user_id AND p.created_at >= v_from AND p.created_at < v_to)::int AS n_add,
      (SELECT count(*) FROM veille_history vh
        WHERE vh.user_id = m.user_id AND vh.planted_at >= v_from AND vh.planted_at < v_to)::int AS n_plant,
      (SELECT count(DISTINCT pc.place_id) FROM place_contributions pc
        WHERE pc.user_id = m.user_id AND pc.type = 'photo'
          AND pc.created_at >= v_from AND pc.created_at < v_to)::int AS n_photo,
      (SELECT COALESCE(
          count(*) FILTER (WHERE e.difficulty = 'very_easy') * v_e_ve
        + count(*) FILTER (WHERE e.difficulty = 'easy')      * v_e_e
        + count(*) FILTER (WHERE e.difficulty = 'medium')    * v_e_m
        + count(*) FILTER (WHERE e.difficulty = 'hard')      * v_e_h, 0)
        FROM enigma_responses er JOIN enigmas e ON e.id = er.enigma_id
        WHERE er.user_id = m.user_id AND er.correct = TRUE
          AND er.responded_at >= v_from AND er.responded_at < v_to)::int AS enig_pts,
      public._member_gold_coupe(m.user_id, p_faction_id, v_from, v_to) AS or_pts
    FROM faction_members m JOIN users u ON u.id = m.user_id
    WHERE m.faction_id = p_faction_id
  ),
  mem_pts AS (
    SELECT *,
      CASE WHEN act THEN n_vis  * v_visit ELSE 0 END AS vis_pts,
      CASE WHEN act THEN n_add  * v_add   ELSE 0 END AS add_pts,
      CASE WHEN act THEN n_plant* v_plant ELSE 0 END AS plant_pts,
      CASE WHEN act THEN n_photo* v_photo ELSE 0 END AS photo_pts,
      CASE WHEN act THEN enig_pts          ELSE 0 END AS enig_pts2
    FROM mem
  )
  SELECT
    COALESCE(json_agg(json_build_object(
      'userId', user_id, 'name', name, 'avatarUrl', avatar_url,
      'joinedAt', joined_at, 'isFounder', is_founder,
      'crownsInvested', crowns_invested,
      'coupe', (vis_pts + add_pts + plant_pts + photo_pts + enig_pts2 + or_pts),
      'breakdown', jsonb_strip_nulls(jsonb_build_object(
        'enigmes',  NULLIF(enig_pts2, 0),
        'visites',  NULLIF(vis_pts, 0),
        'ajouts',   NULLIF(add_pts, 0),
        'veilles',  NULLIF(plant_pts, 0),
        'photos',   NULLIF(photo_pts, 0),
        'or',       NULLIF(or_pts, 0)
      ))
    ) ORDER BY (vis_pts + add_pts + plant_pts + photo_pts + enig_pts2 + or_pts + crowns_invested) DESC, joined_at ASC), '[]'::json),
    COALESCE(sum(vis_pts + add_pts + plant_pts + photo_pts + enig_pts2 + or_pts), 0)::int
  INTO v_members, v_total
  FROM mem_pts;

  RETURN json_build_object(
    'id', v_f.id, 'name', v_f.title, 'color', v_f.color, 'imageUrl', v_f.image_url,
    'description', v_f.description,
    'tags', to_json(v_f.tags),
    'emblemIcon', v_f.emblem_icon, 'emblemMono', v_f.emblem_mono,
    'publicSlug', v_f.public_slug,
    'createdBy', v_f.created_by,
    'isOfficial', (v_f.created_by IS NULL),
    'memberCount', (SELECT count(*) FROM faction_members WHERE faction_id = p_faction_id),
    'totalCoupe', v_total,
    'totalCrowns', (SELECT COALESCE(sum(crowns_invested + crowns_conquered), 0)
                    FROM faction_members WHERE faction_id = p_faction_id),
    'members', v_members
  );
END;$$;
