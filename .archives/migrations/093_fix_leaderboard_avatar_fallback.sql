-- Fix: avatars missing for users who set avatar_url (onboarding flow)
-- get_leaderboard() and get_place_by_id() only checked image_media variants,
-- ignoring users.avatar_url which is set by the onboarding avatar upload.
-- Now: avatar_url is checked first, then image_media variants as fallback.

-- ============================================================
-- 1. Fix get_leaderboard
-- ============================================================
DROP FUNCTION IF EXISTS get_leaderboard(TEXT, INT);
CREATE OR REPLACE FUNCTION get_leaderboard(p_type TEXT, p_limit INT DEFAULT 50)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'notoriety' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COALESCE(u.notoriety_points, 0) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', COALESCE(
          u.avatar_url,
          (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v WHERE im.id = u.profile_image_id AND v->>'name' = 'png_small' LIMIT 1),
          (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v WHERE im.id = u.profile_image_id AND v->>'name' = 'webp_small' LIMIT 1),
          (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v WHERE im.id = u.profile_image_id AND v->>'name' = 'original' LIMIT 1)
        ),
        'factionColor', f.color,
        'value', COALESCE(u.notoriety_points, 0)
      ) AS row_data
      FROM users u
      LEFT JOIN factions f ON f.id = u.faction_id
      WHERE COALESCE(u.notoriety_points, 0) > 0
      ORDER BY COALESCE(u.notoriety_points, 0) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'authored' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', COALESCE(
          u.avatar_url,
          (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v WHERE im.id = u.profile_image_id AND v->>'name' = 'png_small' LIMIT 1),
          (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v WHERE im.id = u.profile_image_id AND v->>'name' = 'webp_small' LIMIT 1),
          (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v WHERE im.id = u.profile_image_id AND v->>'name' = 'original' LIMIT 1)
        ),
        'factionColor', f.color,
        'value', COUNT(*)::INT
      ) AS row_data
      FROM users u
      JOIN places p ON p.author_id = u.id
      LEFT JOIN factions f ON f.id = u.faction_id
      GROUP BY u.id, u.first_name, u.email_address, u.profile_image_id, u.avatar_url, f.color
      ORDER BY COUNT(*) DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'explored' THEN
    SELECT COALESCE(json_agg(row_data), '[]'::json) INTO v_result
    FROM (
      SELECT json_build_object(
        'rank', ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC),
        'userId', u.id,
        'name', COALESCE(u.first_name, u.email_address),
        'profileImage', COALESCE(
          u.avatar_url,
          (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v WHERE im.id = u.profile_image_id AND v->>'name' = 'png_small' LIMIT 1),
          (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v WHERE im.id = u.profile_image_id AND v->>'name' = 'webp_small' LIMIT 1),
          (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v WHERE im.id = u.profile_image_id AND v->>'name' = 'original' LIMIT 1)
        ),
        'factionColor', f.color,
        'value', COUNT(*)::INT
      ) AS row_data
      FROM users u
      JOIN places_explored pe ON pe.user_id = u.id
      LEFT JOIN factions f ON f.id = u.faction_id
      GROUP BY u.id, u.first_name, u.email_address, u.profile_image_id, u.avatar_url, f.color
      ORDER BY COUNT(*) DESC
      LIMIT p_limit
    ) sub;

  ELSE
    v_result := '[]'::json;
  END IF;

  RETURN v_result;
END;
$$;
