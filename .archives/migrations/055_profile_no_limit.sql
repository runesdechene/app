-- ============================================
-- 055 : Retirer le LIMIT 50 + servir les thumbnails
-- ============================================
-- 1. Retire le LIMIT 50 sur les 3 requêtes de lieux
-- 2. Préfère images->0->>'thumb' (400px) quand il existe,
--    sinon fallback sur images->0->>'url'

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
  v_displayed_general JSON;
  v_faction_title JSON;
  v_authored_places JSON;
  v_discovered_places JSON;
  v_claimed_places JSON;
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

  -- Charger titres via get_user_titles
  v_titles_data := get_user_titles(p_user_id);
  v_faction_title := v_titles_data->'factionTitle';

  -- Selection du joueur
  SELECT COALESCE(displayed_general_title_ids, '{}')
  INTO v_displayed_ids
  FROM users WHERE id = p_user_id;

  -- Filtrer les titres generaux affiches
  IF array_length(v_displayed_ids, 1) > 0 THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
    WHERE (elem->>'id')::INT = ANY(v_displayed_ids);
  END IF;

  -- Fallback : titre le plus haut (premier element, tri DESC)
  IF v_displayed_general IS NULL THEN
    SELECT json_agg(elem)
    INTO v_displayed_general
    FROM (
      SELECT elem FROM json_array_elements(v_titles_data->'unlockedGeneralTitles') elem
      LIMIT 1
    ) sub;
  END IF;

  -- Lieux ajoutes par le joueur (plus recents d'abord, sans limite)
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_authored_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'createdAt', p.created_at,
      'imageUrl', CASE
        WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
        THEN COALESCE(p.images->0->>'thumb', p.images->0->>'url')
        ELSE NULL
      END
    ) AS place_data
    FROM places p
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.author_id = p_user_id
    ORDER BY p.created_at DESC
  ) sub;

  -- Lieux explores par le joueur (plus recents d'abord, sans limite)
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_discovered_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE
        WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
        THEN COALESCE(p.images->0->>'thumb', p.images->0->>'url')
        ELSE NULL
      END
    ) AS place_data
    FROM places_explored pe
    JOIN places p ON p.id = pe.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE pe.user_id = p_user_id
    ORDER BY pe.created_at DESC
  ) sub;

  -- Lieux conquis par le joueur (plus recents d'abord, sans limite)
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_claimed_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE
        WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
        THEN COALESCE(p.images->0->>'thumb', p.images->0->>'url')
        ELSE NULL
      END
    ) AS place_data
    FROM places p
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.claimed_by = p_user_id
    ORDER BY p.claimed_at DESC
  ) sub;

  -- Resultat complet
  SELECT json_build_object(
    'userId', u.id,
    'name', COALESCE(u.first_name, u.email_address),
    'factionId', u.faction_id,
    'factionTitle', f.title,
    'factionColor', f.color,
    'factionPattern', f.pattern,
    'profileImage', v_avatar_url,
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
