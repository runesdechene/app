-- 022_phase6_influence_map.sql
-- Phase 6: Map driven by influence, not claims. Reset all V0.4 claims.

-- 1. Reset old claims on places (keep faction_id column but null it out)
UPDATE places SET
  faction_id = NULL,
  claimed_by = NULL,
  claimed_at = NULL,
  claimed_avatar_url = NULL,
  fortification_level = 0;

-- 2. Rewrite get_map_places to use influence for faction coloring
CREATE OR REPLACE FUNCTION public.get_map_places(
  p_type TEXT DEFAULT 'all',
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_latitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_longitude_delta DOUBLE PRECISION DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Helper CTE: dominant faction per place (from place_influence)
  -- Used by all branches

  IF p_type = 'all' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id, 'title', t.title, 'color', t.color, 'background', t.background
          ) ELSE NULL END,
        -- V0.5: faction = dominant faction by influence (not old claim)
        'faction', CASE
          WHEN dom.faction_id IS NOT NULL THEN json_build_object(
            'id', dom.faction_id,
            'title', dom.faction_title,
            'color', dom.faction_color,
            'pattern', dom.faction_pattern
          ) ELSE NULL END,
        'claimedByName', NULL,
        'claimedById', NULL,
        'fortificationLevel', 0,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0) + COALESCE(vw.views_count, 0) * 0.1 + COALESCE(ex.explored_count, 0) * 2
        )::int,
        -- V0.5: influence data for territory worker
        'totalInfluence', COALESCE(inf.total_influence, 0),
        'influenceByFaction', COALESCE(inf.by_faction, '{}'::json)
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      -- Dominant faction subquery
      LEFT JOIN LATERAL (
        SELECT pi.faction_id, f.title AS faction_title, f.color AS faction_color, f.pattern AS faction_pattern
        FROM place_influence pi
        JOIN factions f ON f.id = pi.faction_id
        WHERE pi.place_id = p.id
        ORDER BY (pi.placed_points + pi.content_points) DESC
        LIMIT 1
      ) dom ON true
      -- Influence aggregates
      LEFT JOIN LATERAL (
        SELECT
          SUM(pi.placed_points + pi.content_points)::int AS total_influence,
          json_object_agg(pi.faction_id, pi.placed_points + pi.content_points) AS by_faction
        FROM place_influence pi
        WHERE pi.place_id = p.id
      ) inf ON true
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count FROM places_liked GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count FROM places_viewed GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count FROM places_explored GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id, 'title', t.title, 'color', t.color, 'background', t.background
          ) ELSE NULL END,
        'faction', CASE
          WHEN dom.faction_id IS NOT NULL THEN json_build_object(
            'id', dom.faction_id, 'title', dom.faction_title,
            'color', dom.faction_color, 'pattern', dom.faction_pattern
          ) ELSE NULL END,
        'claimedByName', NULL,
        'claimedById', NULL,
        'fortificationLevel', 0,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0) + COALESCE(vw.views_count, 0) * 0.1 + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'totalInfluence', COALESCE(inf.total_influence, 0),
        'influenceByFaction', COALESCE(inf.by_faction, '{}'::json)
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN LATERAL (
        SELECT pi.faction_id, f.title AS faction_title, f.color AS faction_color, f.pattern AS faction_pattern
        FROM place_influence pi JOIN factions f ON f.id = pi.faction_id
        WHERE pi.place_id = p.id
        ORDER BY (pi.placed_points + pi.content_points) DESC LIMIT 1
      ) dom ON true
      LEFT JOIN LATERAL (
        SELECT SUM(pi.placed_points + pi.content_points)::int AS total_influence,
          json_object_agg(pi.faction_id, pi.placed_points + pi.content_points) AS by_faction
        FROM place_influence pi WHERE pi.place_id = p.id
      ) inf ON true
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count FROM places_liked GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count FROM places_viewed GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count FROM places_explored GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id, dom.faction_id, dom.faction_title, dom.faction_color, dom.faction_pattern,
        inf.total_influence, inf.by_faction, lk.likes_count, vw.views_count, ex.explored_count
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_limit
    ) sub;

  ELSE -- 'latest' and default
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id, 'title', t.title, 'color', t.color, 'background', t.background
          ) ELSE NULL END,
        'faction', CASE
          WHEN dom.faction_id IS NOT NULL THEN json_build_object(
            'id', dom.faction_id, 'title', dom.faction_title,
            'color', dom.faction_color, 'pattern', dom.faction_pattern
          ) ELSE NULL END,
        'claimedByName', NULL,
        'claimedById', NULL,
        'fortificationLevel', 0,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0) + COALESCE(vw.views_count, 0) * 0.1 + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'totalInfluence', COALESCE(inf.total_influence, 0),
        'influenceByFaction', COALESCE(inf.by_faction, '{}'::json)
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN LATERAL (
        SELECT pi.faction_id, f.title AS faction_title, f.color AS faction_color, f.pattern AS faction_pattern
        FROM place_influence pi JOIN factions f ON f.id = pi.faction_id
        WHERE pi.place_id = p.id
        ORDER BY (pi.placed_points + pi.content_points) DESC LIMIT 1
      ) dom ON true
      LEFT JOIN LATERAL (
        SELECT SUM(pi.placed_points + pi.content_points)::int AS total_influence,
          json_object_agg(pi.faction_id, pi.placed_points + pi.content_points) AS by_faction
        FROM place_influence pi WHERE pi.place_id = p.id
      ) inf ON true
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count FROM places_liked GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count FROM places_viewed GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count FROM places_explored GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_map_places(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_map_places(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT, TEXT) TO anon;
