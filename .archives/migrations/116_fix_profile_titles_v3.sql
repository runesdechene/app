-- ============================================
-- MIGRATION 116 : Fix get_player_profile pour lire displayed_title_ids_v3
-- ============================================
-- Le profil doit afficher les titres sélectionnés via le système v3.
-- IDs positifs = titles.id, IDs négatifs = fragment_words.id * -1
-- ============================================

CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_avatar_url TEXT;
  v_titles_data JSON;
  v_displayed_ids INT[];
  v_displayed_titles JSON;
  v_faction_title JSON;
BEGIN
  -- Avatar
  SELECT COALESCE(
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_avatar_url
  FROM users u2
  JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = p_user_id;

  -- Charger titres via get_user_titles (pour faction title)
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  -- Lire les IDs v3
  SELECT COALESCE(displayed_title_ids_v3, '{}')
  INTO v_displayed_ids
  FROM users WHERE id = p_user_id;

  -- Construire les titres affiches depuis v3
  IF array_length(v_displayed_ids, 1) > 0 THEN
    SELECT json_agg(row_data ORDER BY pos) INTO v_displayed_titles
    FROM (
      -- Titres positifs = table titles
      SELECT t.id, t.name, t.icon, array_position(v_displayed_ids, t.id) AS pos
      FROM titles t
      WHERE t.id = ANY(v_displayed_ids) AND t.id > 0
      UNION ALL
      -- Titres negatifs = fragment_words (id * -1)
      SELECT fw.id * -1 AS id, fw.word AS name, tf.icon, array_position(v_displayed_ids, fw.id * -1) AS pos
      FROM fragment_words fw
      JOIN title_fragments tf ON tf.id = fw.fragment_id
      WHERE (fw.id * -1) = ANY(v_displayed_ids)
    ) row_data;
  END IF;

  -- Fallback : si pas de v3, utiliser l'ancien systeme
  IF v_displayed_titles IS NULL THEN
    SELECT json_agg(elem)
    INTO v_displayed_titles
    FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
    LIMIT 1;
  END IF;

  -- Resultat
  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', COALESCE(u.avatar_url, v_avatar_url),
    'notorietyPoints', COALESCE(u.notoriety_points, 0),
    'discoveredCount', (v_titles_data->'stats'->>'discoveries')::INT,
    'claimedCount', (v_titles_data->'stats'->>'claims')::INT,
    'likesCount', (v_titles_data->'stats'->>'likes')::INT,
    'placesAdded', (SELECT COUNT(*) FROM places p WHERE p.author_id = u.id),
    'joinedAt', u.created_at,
    'displayedGeneralTitles', COALESCE(v_displayed_titles, '[]'::json),
    'factionTitle2', v_faction_title,
    'biography', COALESCE(u.bio, ''),
    'instagram', u.instagram,
    'unlockedGeneralTitles', v_titles_data->'unlockedGeneralTitles'
  )
  INTO v_result
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  RETURN v_result;
END;
$$;
