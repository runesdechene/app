-- ============================================================
-- 011 — Profil joueur : Veillés → Influencés + Visités enrichi
-- ============================================================
-- Contexte : passage du système "claim/veillé" (legacy) vers le système
-- d'influence V0.5. Le tab "Veillés" du profil disparaît, remplacé par
-- "Influencés" (top lieux par points dépensés via activity_log).
--
-- Modifications de get_player_profile :
--   - vire claimedPlaces (basé sur places.claimed_by) + claimedCount
--   - ajoute favoritePlaces : top 50 lieux du user par SUM(activity_log.data->>'points')
--                             type='place_influence', GROUP BY place_id, ORDER BY total DESC
--   - enrichit discoveredPlaces avec visitsCount + lastVisitedAt (depuis places_explored)
--
-- Hors scope (cleanup futur — voir memory project_cleanup_claim_legacy) :
--   places.claimed_by, places.claimed_at, table place_claims, RPC claim_place,
--   et tous les usages legacy "qui veille ce lieu" dans territoryWorker / hooks /
--   panel détail de lieu. Ces usages restent actifs en prod tant qu'on n'a pas
--   migré l'affichage "qui contrôle ce lieu" vers la faction-influence.
-- ============================================================

CREATE OR REPLACE FUNCTION "public"."get_player_profile"("p_user_id" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result JSON;
  v_titles_data JSON;
  v_displayed_v3 INT[];
  v_displayed_general JSON;
  v_faction_title JSON;
  v_authored_places JSON;
  v_discovered_places JSON;
  v_favorite_places JSON;
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

  -- Lieux ajoutés (Tab Ajoutés — grille existante, inchangé)
  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_authored_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''), 'createdAt', p.created_at,
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE p.author_id = p_user_id ORDER BY p.created_at DESC LIMIT 500) sub;

  -- Lieux visités (Tab Visités — enrichi avec visitsCount + lastVisitedAt)
  SELECT COALESCE(json_agg(place_data ORDER BY last_visited_at DESC), '[]'::json) INTO v_discovered_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'visitsCount', stats.visits_count,
      'lastVisitedAt', stats.last_visited_at
    ) AS place_data,
    stats.last_visited_at
    FROM (
      SELECT pe.place_id,
             COUNT(*) AS visits_count,
             MAX(pe.created_at) AS last_visited_at
      FROM places_explored pe
      WHERE pe.user_id = p_user_id
      GROUP BY pe.place_id
    ) stats
    JOIN places p ON p.id = stats.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    ORDER BY stats.last_visited_at DESC
    LIMIT 500
  ) sub;

  -- Lieux influencés (Tab Influencés — top 50 par points dépensés)
  SELECT COALESCE(json_agg(place_data ORDER BY total_points DESC), '[]'::json) INTO v_favorite_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'totalPoints', stats.total_points,
      'lastActionAt', stats.last_action_at
    ) AS place_data,
    stats.total_points
    FROM (
      SELECT al.place_id,
             SUM((al.data->>'points')::INT) AS total_points,
             MAX(al.created_at) AS last_action_at
      FROM activity_log al
      WHERE al.actor_id = p_user_id
        AND al.type = 'place_influence'
        AND al.place_id IS NOT NULL
      GROUP BY al.place_id
      ORDER BY total_points DESC
      LIMIT 50
    ) stats
    JOIN places p ON p.id = stats.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
  ) sub;

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
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places,
    'discoveredPlaces', v_discovered_places,
    'favoritePlaces', v_favorite_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  ) INTO v_result FROM users u LEFT JOIN factions f ON f.id = u.faction_id WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;
