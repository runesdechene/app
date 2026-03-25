-- ============================================
-- MIGRATION 126 : Champ icon_url sur les fragments
-- ============================================

ALTER TABLE title_fragments ADD COLUMN IF NOT EXISTS icon_url TEXT;

-- Mettre a jour get_all_player_titles pour retourner icon_url
CREATE OR REPLACE FUNCTION public.get_all_player_titles(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_displayed INT[];
  v_faction_id TEXT;
  v_game_titles JSON;
  v_faction_titles JSON;
  v_fragment_titles JSON;
  v_titles_data JSON;
BEGIN
  SELECT COALESCE(displayed_title_ids_v3, '{}'), faction_id
  INTO v_displayed, v_faction_id
  FROM users WHERE id = p_user_id;

  v_titles_data := get_user_titles(p_user_id);

  SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_game_titles
  FROM (
    SELECT t.id, t.name, t.icon, t.description, NULL::TEXT AS icon_url, NULL::TEXT AS image_url, t."order" AS t_order,
      EXISTS (SELECT 1 FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem WHERE (elem->>'id')::INT = t.id) AS unlocked
    FROM titles t WHERE t.type = 'general'
  ) row_data;

  IF v_faction_id IS NOT NULL THEN
    SELECT json_agg(row_data ORDER BY t_order DESC) INTO v_faction_titles
    FROM (
      SELECT t.id, t.name, t.icon, t.description, NULL::TEXT AS icon_url, NULL::TEXT AS image_url, t."order" AS t_order,
        (v_titles_data->'factionTitle' IS NOT NULL AND (v_titles_data->'factionTitle'->>'id')::INT = t.id) AS unlocked
      FROM titles t WHERE t.type = 'faction' AND t.faction_id = v_faction_id
    ) row_data;
  END IF;

  SELECT json_agg(row_data ORDER BY frag_name, word) INTO v_fragment_titles
  FROM (
    SELECT fw.id * -1 AS id, fw.word AS name, tf.icon,
      COALESCE(tf.description, tf.name) AS description,
      tf.icon_url, tf.image_url,
      tf.name AS frag_name, fw.word,
      EXISTS (SELECT 1 FROM user_fragments uf WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id) AS unlocked,
      tf.name AS source_label
    FROM fragment_words fw
    JOIN title_fragments tf ON tf.id = fw.fragment_id
  ) row_data;

  RETURN json_build_object(
    'gameTitles', COALESCE(v_game_titles, '[]'::json),
    'factionTitles', COALESCE(v_faction_titles, '[]'::json),
    'fragmentTitles', COALESCE(v_fragment_titles, '[]'::json),
    'displayedIds', v_displayed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_player_titles(TEXT) TO authenticated;

-- Mettre a jour get_player_profile pour retourner icon_url dans les titres
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

  SELECT COALESCE(displayed_title_ids_v3, '{}') INTO v_displayed_v3 FROM users WHERE id = p_user_id;

  IF array_length(v_displayed_v3, 1) > 0 THEN
    SELECT json_agg(row_data ORDER BY pos) INTO v_displayed_general
    FROM (
      SELECT t.id, t.name, t.icon, NULL::TEXT AS icon_url, array_position(v_displayed_v3, t.id) AS pos
      FROM titles t WHERE t.id = ANY(v_displayed_v3) AND t.id > 0
      UNION ALL
      SELECT fw.id * -1 AS id, fw.word AS name, tf.icon, tf.icon_url, array_position(v_displayed_v3, fw.id * -1) AS pos
      FROM fragment_words fw JOIN title_fragments tf ON tf.id = fw.fragment_id
      WHERE (fw.id * -1) = ANY(v_displayed_v3)
    ) row_data;
  END IF;

  IF v_displayed_general IS NULL THEN
    DECLARE v_old_ids INT[];
    BEGIN
      SELECT COALESCE(displayed_general_title_ids, '{}') INTO v_old_ids FROM users WHERE id = p_user_id;
      IF array_length(v_old_ids, 1) > 0 THEN
        SELECT json_agg(elem) INTO v_displayed_general
        FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
        WHERE (elem->>'id')::INT = ANY(v_old_ids);
      END IF;
    END;
  END IF;

  IF v_displayed_general IS NULL THEN
    SELECT json_agg(elem) INTO v_displayed_general
    FROM (SELECT elem FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem LIMIT 1) sub;
  END IF;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_authored_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''), 'createdAt', p.created_at,
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE p.author_id = p_user_id ORDER BY p.created_at DESC LIMIT 500) sub;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_discovered_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places_explored pe JOIN places p ON p.id = pe.place_id LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE pe.user_id = p_user_id ORDER BY pe.created_at DESC LIMIT 500) sub;

  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_claimed_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE p.claimed_by = p_user_id ORDER BY p.claimed_at DESC LIMIT 500) sub;

  SELECT json_build_object(
    'userId', u.id, 'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id, 'factionTitle', f.title, 'factionColor', f.color, 'factionPattern', f.pattern,
    'profileImage', u.avatar_url, 'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'claimedCount', (v_titles_data->'stats'->>'claims')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places, 'discoveredPlaces', v_discovered_places, 'claimedPlaces', v_claimed_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  ) INTO v_result FROM users u LEFT JOIN factions f ON f.id = u.faction_id WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_profile TO anon;
