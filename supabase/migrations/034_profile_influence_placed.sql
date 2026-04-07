-- 034_profile_influence_placed.sql
-- Ajouter influencePlaced au profil joueur

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT oid::regprocedure::text AS sig FROM pg_proc
    WHERE proname = 'get_player_profile' AND pronamespace = 'public'::regnamespace
  LOOP EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE'; END LOOP;
END;
$$;

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
  v_unlocked_ids INT[];
  v_faction_title_id INT;
  v_influence_placed INT;
BEGIN
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  IF v_faction_title IS NOT NULL THEN
    v_faction_title_id := (v_faction_title->>'id')::INT;
  END IF;

  SELECT array_agg((elem->>'id')::INT) INTO v_unlocked_ids
  FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem;
  v_unlocked_ids := COALESCE(v_unlocked_ids, '{}');

  IF v_faction_title_id IS NOT NULL THEN
    v_unlocked_ids := v_unlocked_ids || v_faction_title_id;
  END IF;

  SELECT COALESCE(displayed_title_ids_v3, '{}') INTO v_displayed_v3 FROM users WHERE id = p_user_id;

  IF array_length(v_displayed_v3, 1) > 0 THEN
    SELECT json_agg(row_data ORDER BY pos) INTO v_displayed_general
    FROM (
      SELECT t.id, t.name, t.icon, NULL::TEXT AS icon_url, array_position(v_displayed_v3, t.id) AS pos
      FROM titles t WHERE t.id = ANY(v_displayed_v3) AND t.id > 0 AND t.id = ANY(v_unlocked_ids)
      UNION ALL
      SELECT fw.id * -1 AS id, fw.word AS name, tf.icon, tf.icon_url, array_position(v_displayed_v3, fw.id * -1) AS pos
      FROM fragment_words fw JOIN title_fragments tf ON tf.id = fw.fragment_id
      WHERE (fw.id * -1) = ANY(v_displayed_v3)
        AND EXISTS (SELECT 1 FROM user_fragments uf WHERE uf.user_id = p_user_id AND uf.fragment_id = tf.id)
    ) row_data;

    UPDATE users
    SET displayed_title_ids_v3 = (
      SELECT COALESCE(array_agg(tid), '{}')
      FROM unnest(v_displayed_v3) AS tid
      WHERE tid = ANY(v_unlocked_ids)
        OR (tid < 0 AND EXISTS (
          SELECT 1 FROM user_fragments uf
          JOIN fragment_words fw ON fw.fragment_id = uf.fragment_id
          WHERE uf.user_id = p_user_id AND fw.id * -1 = tid
        ))
    )
    WHERE id = p_user_id
      AND displayed_title_ids_v3 IS DISTINCT FROM (
        SELECT COALESCE(array_agg(tid), '{}')
        FROM unnest(v_displayed_v3) AS tid
        WHERE tid = ANY(v_unlocked_ids)
          OR (tid < 0 AND EXISTS (
            SELECT 1 FROM user_fragments uf
            JOIN fragment_words fw ON fw.fragment_id = uf.fragment_id
            WHERE uf.user_id = p_user_id AND fw.id * -1 = tid
          ))
      );
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

  -- Influence placée (somme des points dans activity_log)
  SELECT COALESCE(SUM((al.data->>'points')::INT), 0) INTO v_influence_placed
  FROM activity_log al
  WHERE al.actor_id = p_user_id AND al.type = 'place_influence';

  SELECT json_build_object(
    'userId', u.id, 'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id, 'factionTitle', f.title, 'factionColor', f.color, 'factionPattern', f.pattern,
    'profileImage', u.avatar_url,
    'explorationPoints', COALESCE(u.exploration_points, 0),
    'eruditionPoints', COALESCE(u.erudition_points, 0),
    'influenceStock', COALESCE(u.influence_stock, 0),
    'influencePlaced', v_influence_placed,
    'glory', COALESCE(u.exploration_points, 0) + COALESCE(u.erudition_points, 0),
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

GRANT EXECUTE ON FUNCTION public.get_player_profile(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_profile(TEXT) TO anon;
