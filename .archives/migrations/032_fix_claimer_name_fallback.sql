-- ============================================
-- MIGRATION 032 : Fix claimedByName fallback
-- ============================================
-- claimer.last_name → COALESCE(first_name, email_address)
-- On n'utilise JAMAIS last_name (résidu des anciens comptes)
-- ============================================

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
  IF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'claimedByName', COALESCE(claimer.first_name, claimer.email_address),
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN users claimer ON claimer.id = p.claimed_by
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id, f.id, claimer.first_name, claimer.email_address, lk.likes_count, vw.views_count, ex.explored_count
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'latest' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'claimedByName', COALESCE(claimer.first_name, claimer.email_address),
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN users claimer ON claimer.id = p.claimed_by
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;

  ELSE
    -- type = 'all' avec viewport optionnel
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object(
          'id', pt.id,
          'title', pt.title
        ),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id,
            'title', t.title,
            'color', t.color,
            'background', t.background
          )
          ELSE NULL
        END,
        'faction', CASE
          WHEN f.id IS NOT NULL THEN json_build_object(
            'id', f.id,
            'title', f.title,
            'color', f.color,
            'pattern', f.pattern
          )
          ELSE NULL
        END,
        'claimedByName', COALESCE(claimer.first_name, claimer.email_address),
        'location', json_build_object(
          'latitude', p.latitude,
          'longitude', p.longitude
        ),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0)
          + COALESCE(vw.views_count, 0) * 0.1
          + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'requester', CASE
          WHEN p_user_id IS NOT NULL THEN json_build_object(
            'viewed', EXISTS(
              SELECT 1 FROM places_viewed pv
              WHERE pv.place_id = p.id AND pv.user_id = p_user_id
            )
          )
          ELSE NULL
        END
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN factions f ON f.id = p.faction_id
      LEFT JOIN users claimer ON claimer.id = p.claimed_by
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count
        FROM places_liked
        GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count
        FROM places_viewed
        GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count
        FROM places_explored
        GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
        AND (
          p_latitude IS NULL
          OR (
            p.latitude >= (p_latitude - p_latitude_delta)
            AND p.latitude <= (p_latitude + p_latitude_delta)
            AND p.longitude >= (p_longitude - p_longitude_delta)
            AND p.longitude <= (p_longitude + p_longitude_delta)
          )
        )
      ORDER BY p.created_at
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
