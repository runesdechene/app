-- 245_get_player_profile_planted_gps_and_wishlist.sql
-- WHY : refonte des catégories de lieux du profil (V0.9.53).
--   1. veilledPlaces expose désormais 'byInfluence' (place_veille.by_influence) :
--      le front sépare le carrousel « Étendard planté sur… » (GPS pur, by_influence
--      = false) du badge « lieux protégés » (total tenu = GPS + distance, basé sur
--      veilledPlaces.length, inchangé).
--   2. Nouveau 'wishlistPlaces' (place_wishlist) — carrousel « À visiter », public.
-- Discipline B1 : copie verbatim de la baseline (mig 240) + 3 ajouts ciblés
-- (déclaration v_wishlist_places, champ byInfluence, bloc + sortie wishlist).

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
  v_wishlist_places JSON;
  v_unlocked_ids INT[];
  v_faction_title_id INT;
  v_xp_total INT;
  v_level INT;
  v_xp_to_next INT;
  v_xp_for_next_level INT;
  v_xp_for_current_level INT;
  v_lieux_explores INT;
  v_lieux_veilles INT;
  v_enigmas_solved INT;
  v_crowns_balance INT;
  v_coupe_season public.coupe_seasons%ROWTYPE;
  v_coupe_window_end timestamptz;
  v_coupe_score_current_season INT;
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
  v_xp_for_current_level := public._xp_for_level(v_level);
  v_xp_for_next_level := public._xp_for_level(v_level + 1);
  v_xp_to_next := GREATEST(0, v_xp_for_next_level - v_xp_total);

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

  -- ── authored : + tagIcon + tagColor ──
  SELECT COALESCE(json_agg(place_data), '[]'::json) INTO v_authored_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'createdAt', p.created_at,
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'tagIcon', primary_tag.icon,
      'tagColor', primary_tag.color
    ) AS place_data
    FROM places p
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    LEFT JOIN public.place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
    LEFT JOIN public.tags primary_tag ON primary_tag.id = ptag.tag_id
    WHERE p.author_id = p_user_id
    ORDER BY p.created_at DESC
    LIMIT 500
  ) sub;

  -- ── discovered : + tagIcon + tagColor ──
  SELECT COALESCE(json_agg(place_data ORDER BY last_visited_at DESC), '[]'::json) INTO v_discovered_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'visitsCount', stats.visits_count,
      'lastVisitedAt', stats.last_visited_at,
      'tagIcon', primary_tag.icon,
      'tagColor', primary_tag.color
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
    LEFT JOIN public.place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
    LEFT JOIN public.tags primary_tag ON primary_tag.id = ptag.tag_id
    ORDER BY stats.last_visited_at DESC
    LIMIT 500
  ) sub;

  -- ── favorite : + tagIcon + tagColor (par cohérence) ──
  SELECT COALESCE(json_agg(place_data ORDER BY total_points DESC), '[]'::json) INTO v_favorite_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'totalPoints', stats.total_points, 'lastActionAt', stats.last_action_at,
      'tagIcon', primary_tag.icon,
      'tagColor', primary_tag.color
    ) AS place_data, stats.total_points
    FROM (
      SELECT al.place_id, SUM((al.data->>'points')::INT) AS total_points, MAX(al.created_at) AS last_action_at
      FROM activity_log al
      WHERE al.actor_id = p_user_id AND al.type = 'place_influence' AND al.place_id IS NOT NULL
      GROUP BY al.place_id ORDER BY total_points DESC LIMIT 50
    ) stats
    JOIN places p ON p.id = stats.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    LEFT JOIN public.place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
    LEFT JOIN public.tags primary_tag ON primary_tag.id = ptag.tag_id
  ) sub;

  -- ── veilled : + tagIcon + tagColor + byInfluence (V0.9.53) ──
  -- byInfluence distingue le plantage GPS (false) de la tenue à distance via La
  -- Cour (true). Le front filtre le carrousel « Étendard planté » sur GPS pur,
  -- tout en gardant veilledPlaces.length comme total pour le badge « lieux protégés ».
  SELECT COALESCE(json_agg(place_data ORDER BY planted_at DESC), '[]'::json) INTO v_veilled_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'plantedAt', pv.planted_at,
      'memberCount', (SELECT count(*)::int FROM public.expedition_members em2 WHERE em2.expedition_id = pv.expedition_id),
      'byInfluence', COALESCE(pv.by_influence, false),
      'tagIcon', primary_tag.icon,
      'tagColor', primary_tag.color
    ) AS place_data, pv.planted_at
    FROM public.place_veille pv
    JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id AND em.user_id = p_user_id
    JOIN public.places p ON p.id = pv.place_id
    LEFT JOIN public.place_types pt ON pt.id = p.place_type_id
    LEFT JOIN public.place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
    LEFT JOIN public.tags primary_tag ON primary_tag.id = ptag.tag_id
    ORDER BY pv.planted_at DESC LIMIT 500
  ) sub;

  -- ── wishlist : lieux « à visiter » (place_wishlist), public (V0.9.53) ──
  SELECT COALESCE(json_agg(place_data ORDER BY created_at DESC), '[]'::json) INTO v_wishlist_places
  FROM (
    SELECT json_build_object(
      'id', p.id, 'title', p.title, 'type', COALESCE(pt.title, ''),
      'imageUrl', CASE WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0 THEN p.images->0->>'url' ELSE NULL END,
      'tagIcon', primary_tag.icon,
      'tagColor', primary_tag.color
    ) AS place_data, w.created_at
    FROM public.place_wishlist w
    JOIN public.places p ON p.id = w.place_id
    LEFT JOIN public.place_types pt ON pt.id = p.place_type_id
    LEFT JOIN public.place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
    LEFT JOIN public.tags primary_tag ON primary_tag.id = ptag.tag_id
    WHERE w.user_id = p_user_id
    ORDER BY w.created_at DESC LIMIT 500
  ) sub;

  SELECT COUNT(DISTINCT place_id) INTO v_lieux_explores FROM public.place_explorers WHERE user_id = p_user_id;
  SELECT COUNT(DISTINCT pv.place_id) INTO v_lieux_veilles
    FROM public.place_veille pv
    JOIN public.expedition_members em ON em.expedition_id = pv.expedition_id
    WHERE em.user_id = p_user_id;
  SELECT COUNT(*) INTO v_enigmas_solved FROM public.enigma_responses WHERE user_id = p_user_id AND correct = TRUE;

  SELECT COALESCE(balance, 0) INTO v_crowns_balance FROM public.user_crowns WHERE user_id = p_user_id;
  v_crowns_balance := COALESCE(v_crowns_balance, 0);

  SELECT * INTO v_coupe_season
  FROM public.coupe_seasons
  ORDER BY (ended_at IS NULL) DESC, started_at DESC
  LIMIT 1;

  IF v_coupe_season.id IS NOT NULL THEN
    v_coupe_window_end := COALESCE(v_coupe_season.ended_at, now());
    v_coupe_score_current_season := public._user_coupe_score(
      p_user_id, v_coupe_season.started_at, v_coupe_window_end
    );
  ELSE
    v_coupe_score_current_season := 0;
  END IF;

  SELECT json_build_object(
    'userId', u.id, 'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id, 'factionTitle', f.title, 'factionColor', f.color, 'factionPattern', f.pattern,
    'factionImage', f.image_url,
    'profileImage', u.avatar_url,
    'level', v_level,
    'xpTotal', v_xp_total,
    'xpToNextLevel', v_xp_to_next,
    'xpForNextLevel', v_xp_for_next_level,
    'xpForCurrentLevel', v_xp_for_current_level,
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
    'wishlistPlaces', v_wishlist_places,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles',
    'crownsBalance', CASE WHEN p_user_id = auth.uid()::text THEN COALESCE(v_crowns_balance, 0) ELSE NULL END,
    'coupeScoreCurrentSeason', COALESCE(v_coupe_score_current_season, 0),
    'coupeSeasonName', v_coupe_season.name
  ) INTO v_result FROM users u LEFT JOIN factions f ON f.id = u.faction_id WHERE u.id = p_user_id;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_player_profile(text) TO authenticated, anon, service_role;
