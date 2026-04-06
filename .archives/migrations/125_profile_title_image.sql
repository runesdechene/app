-- ============================================
-- MIGRATION 125 : Retourner image_url dans les titres affiches du profil
-- ============================================

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_titles_data JSON;
  v_displayed_v3 INT[];
  v_displayed_general JSON;
  v_faction_title JSON;
  v_authored_places JSON;
  v_discovered_places JSON;
  v_claimed_places JSON;
BEGIN
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  SELECT COALESCE(displayed_title_ids_v3, '{}')
  INTO v_displayed_v3
  FROM users WHERE id = p_user_id;

  IF array_length(v_displayed_v3, 1) > 0 THEN
    SELECT json_agg(row_data ORDER BY pos) INTO v_displayed_general
    FROM (
      SELECT t.id, t.name, t.icon, NULL AS image_url, array_position(v_displayed_v3, t.id) AS pos
      FROM titles t
      WHERE t.id = ANY(v_displayed_v3) AND t.id > 0
      UNION ALL
      SELECT fw.id * -1 AS id, fw.word AS name, tf.icon, tf.image_url, array_position(v_displayed_v3, fw.id * -1) AS pos
      FROM fragment_words fw
      JOIN title_fragments tf ON tf.id = fw.fragment_id
      WHERE (fw.id * -1) = ANY(v_displayed_v3)
    ) row_data;
  END IF;

  IF v_displayed_general IS NULL THEN
    DECLARE v_old_ids INT[];
    BEGIN
      SELECT COALESCE(displayed_general_title_ids, '{}')
      INTO v_old_ids
      FROM users WHERE id = p_user_id;

      IF array_length(v_old_ids, 1) > 0 THEN
        SELECT json_agg(elem)
        INTO v_displayed_general
        FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
        WHERE (elem->>'id')::INT = ANY(v_old_ids);
      END IF;
    END;
  END IF;

  IF v_displayed_general IS NULL THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM (
      SELECT elem FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
      LIMIT 1
    ) sub;
  END IF;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_authored_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'createdAt', p.created_at,
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
    ) AS place_data
    FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.author_id = p_user_id ORDER BY p.created_at DESC LIMIT 500
  ) sub;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_discovered_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
    ) AS place_data
    FROM places_explored pe JOIN places p ON p.id = pe.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE pe.user_id = p_user_id ORDER BY pe.created_at DESC LIMIT 500
  ) sub;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_claimed_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
    ) AS place_data
    FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.claimed_by = p_user_id ORDER BY p.claimed_at DESC LIMIT 500
  ) sub;

  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', u.avatar_url,
    'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'claimedCount', (v_titles_data->'stats'->>'claims')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places,
    'discoveredPlaces', v_discovered_places,
    'claimedPlaces', v_claimed_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  )
  INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_profile TO anon;
