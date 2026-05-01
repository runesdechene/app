-- 045_v07_levels_player_profile.sql
-- WHY : refonte de get_player_profile pour exposer level/xpTotal/xpToNextLevel/
-- veteranFirstEra et retirer glory/explorationPoints/eruditionPoints.
-- Reprise mig 038 avec adaptations.

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
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
  v_veilled_places JSON;
  v_unlocked_ids INT[];
  v_faction_title_id INT;
  v_xp_total INT;
  v_level INT;
  v_xp_to_next INT;
  v_xp_for_next_level INT;
  v_lieux_explores INT;
  v_lieux_veilles INT;
  v_enigmas_solved INT;
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

  SELECT COALESCE(displayed_title_ids_v3, '{}'), COALESCE(xp_total, 0)
    INTO v_displayed_v3, v_xp_total
    FROM users WHERE id = p_user_id;
  v_level := public._level_from_xp(v_xp_total);
  v_xp_for_next_level := public._xp_for_level(v_level + 1);
  v_xp_to_next := GREATEST(0, v_xp_for_next_level - v_xp_total);

  -- Filtrage des titres affichés (idem mig 038)
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

  -- Listes de lieux (idem mig 038)
  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_authored_places
  FROM (SELECT json_build_object('id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''), 'createdAt', p.created_at,
    'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END
  ) AS place_data FROM places p LEFT JOIN place_types pt ON pt.id = p.place_type_id
  WHERE p.author_id = p_user_id ORDER BY p.created_at DESC LIMIT 500) sub;

  SELECT COALESCE(json_agg(place_data ORDER BY last_visited_at DESC), '[]'::json) INTO v_discovered_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'visitsCount', stats.visits_count,
      'lastVisitedAt', stats.last_visited_at
    ) AS place_data,
    stats.last_visited_at
    FROM (
      SELECT pe.place_id, COUNT(*) AS visits_count, MAX(pe.visited_at) AS last_visited_at
      FROM public.place_explorers pe
      WHERE pe.user_id = p_user_id
      GROUP BY pe.place_id
    ) stats
    JOIN places p ON p.id = stats.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    ORDER BY stats.last_visited_at DESC
    LIMIT 500
  ) sub;

  SELECT COALESCE(json_agg(place_data ORDER BY total_points DESC), '[]'::json) INTO v_favorite_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'totalPoints', stats.total_points, 'lastActionAt', stats.last_action_at
    ) AS place_data, stats.total_points
    FROM (
      SELECT al.place_id, SUM((al.data->>'points')::INT) AS total_points, MAX(al.created_at) AS last_action_at
      FROM activity_log al
      WHERE al.actor_id = p_user_id AND al.type = 'place_influence' AND al.place_id IS NOT NULL
      GROUP BY al.place_id ORDER BY total_points DESC LIMIT 50
    ) stats
    JOIN places p ON p.id = stats.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
  ) sub;

  SELECT COALESCE(json_agg(place_data ORDER BY planted_at DESC), '[]'::json) INTO v_veilled_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'plantedAt', pv.planted_at,
      'memberCount', (SELECT count(*)::int FROM public.expedition_members em2 WHERE em2.expedition_id = pv.expedition_id)
    ) AS place_data, pv.planted_at
    FROM public.place_veille pv
    JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id AND em.user_id = p_user_id
    JOIN public.places p ON p.id = pv.place_id
    LEFT JOIN public.place_types pt ON pt.id = p.place_type_id
    ORDER BY pv.planted_at DESC LIMIT 500
  ) sub;

  SELECT COUNT(DISTINCT place_id) INTO v_lieux_explores FROM public.place_explorers WHERE user_id = p_user_id;
  SELECT COUNT(DISTINCT pv.place_id) INTO v_lieux_veilles
    FROM public.place_veille pv
    JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id
    WHERE em.user_id = p_user_id;
  SELECT COUNT(*) INTO v_enigmas_solved FROM public.enigma_responses WHERE user_id = p_user_id AND correct = TRUE;

  SELECT json_build_object(
    'userId', u.id, 'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id, 'factionTitle', f.title, 'factionColor', f.color, 'factionPattern', f.pattern,
    'profileImage', u.avatar_url,
    'level', v_level,
    'xpTotal', v_xp_total,
    'xpToNextLevel', v_xp_to_next,
    'xpForNextLevel', v_xp_for_next_level,
    'veteranFirstEra', COALESCE(u.veteran_first_era, false),
    'lieuxExplores', COALESCE(v_lieux_explores, 0),
    'lieuxVeilles',  COALESCE(v_lieux_veilles, 0),
    'enigmasSolved', COALESCE(v_enigmas_solved, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'placesAdded', (v_titles_data->'stats'->>'places_added')::INT,
    'carnetsCount', (v_titles_data->'stats'->>'carnets')::INT,
    'plantagesCount', (v_titles_data->'stats'->>'plantages')::INT,
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_general, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, u.biography, ''),
    'instagram', u.instagram,
    'authoredPlaces', v_authored_places,
    'discoveredPlaces', v_discovered_places,
    'favoritePlaces', v_favorite_places,
    'veilledPlaces', v_veilled_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  ) INTO v_result FROM users u LEFT JOIN factions f ON f.id = u.faction_id WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_profile(text) TO authenticated, anon, service_role;
