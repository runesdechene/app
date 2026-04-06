-- ============================================
-- MIGRATION 052 : Profil unifie + Faction payante + Membres
-- ============================================
-- 1. set_user_faction rewrite — cout notoriete au changement
-- 2. get_faction_members() — liste des joueurs d'une faction
-- 3. get_player_profile() rewrite — bio, instagram, lieux ajoutes
-- 4. update_my_profile() — modifier bio + instagram
-- ============================================

-- ============================================
-- 1. set_user_faction — reset notoriete si changement
-- ============================================

CREATE OR REPLACE FUNCTION public.set_user_faction(
  p_user_id TEXT,
  p_faction_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_faction_id TEXT;
  v_notoriety_lost INT;
BEGIN
  -- Verifier que la faction existe (ou null pour quitter)
  IF p_faction_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM factions WHERE id = p_faction_id) THEN
      RETURN json_build_object('error', 'Faction not found');
    END IF;
  END IF;

  -- Recuperer l'ancienne faction + notoriete actuelle
  SELECT faction_id, COALESCE(notoriety_points, 0)
  INTO v_old_faction_id, v_notoriety_lost
  FROM users WHERE id = p_user_id;

  -- Solidifier : tous les lieux de l'ancienne faction deviennent des decouvertes
  IF v_old_faction_id IS NOT NULL THEN
    INSERT INTO places_discovered (user_id, place_id, method)
    SELECT p_user_id, p.id, 'remote'
    FROM places p
    WHERE p.faction_id = v_old_faction_id
    ON CONFLICT (user_id, place_id) DO NOTHING;
  END IF;

  -- Si CHANGEMENT de faction (avait une, passe a une autre differente) → reset notoriete
  IF v_old_faction_id IS NOT NULL
     AND p_faction_id IS NOT NULL
     AND v_old_faction_id != p_faction_id THEN
    UPDATE users
    SET faction_id = p_faction_id,
        notoriety_points = 0,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN json_build_object('success', true, 'notorietyLost', v_notoriety_lost);
  ELSE
    -- Premier join ou depart → pas de cout
    UPDATE users SET faction_id = p_faction_id, updated_at = NOW() WHERE id = p_user_id;
    RETURN json_build_object('success', true, 'notorietyLost', 0);
  END IF;
END;
$$;

-- ============================================
-- 2. get_faction_members(p_faction_id)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_faction_members(p_faction_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT COALESCE(json_agg(member), '[]'::json) INTO v_result
  FROM (
    SELECT json_build_object(
      'userId', u.id,
      'name', COALESCE(u.first_name, u.email_address),
      'profileImage', (
        SELECT COALESCE(
          (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
          (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
          (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
        )
        FROM image_media im WHERE im.id = u.profile_image_id
      ),
      'notorietyPoints', COALESCE(u.notoriety_points, 0),
      'displayedGeneralTitles', (
        SELECT COALESCE(json_agg(
          json_build_object('id', t.id, 'name', t.name, 'icon', t.icon)
        ), '[]'::json)
        FROM titles t
        WHERE t.id = ANY(COALESCE(u.displayed_general_title_ids, '{}'))
          AND t.type = 'general'
      ),
      'factionTitle2', (SELECT get_user_titles(u.id)->'factionTitle')
    ) AS member
    FROM users u
    WHERE u.faction_id = p_faction_id
    ORDER BY u.notoriety_points DESC NULLS LAST
  ) sub;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_faction_members TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_faction_members TO anon;

-- ============================================
-- 3. get_player_profile() — ajout bio, instagram, lieux
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

  -- Lieux ajoutes par le joueur (max 50, plus recents d'abord)
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
        THEN p.images->0->>'url'
        ELSE NULL
      END
    ) AS place_data
    FROM places p
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.author_id = p_user_id
    ORDER BY p.created_at DESC
    LIMIT 50
  ) sub;

  -- Lieux explores (clic explicite "Explorer") par le joueur (max 50, plus recents d'abord)
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_discovered_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE
        WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
        THEN p.images->0->>'url'
        ELSE NULL
      END
    ) AS place_data
    FROM places_explored pe
    JOIN places p ON p.id = pe.place_id
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE pe.user_id = p_user_id
    ORDER BY pe.created_at DESC
    LIMIT 50
  ) sub;

  -- Lieux conquis (revendiques) par le joueur (max 50, plus recents d'abord)
  SELECT COALESCE(json_agg(place_data), '[]'::json)
  INTO v_claimed_places
  FROM (
    SELECT json_build_object(
      'id', p.id,
      'title', p.title,
      'type', COALESCE(pt.title, ''),
      'imageUrl', CASE
        WHEN p.images IS NOT NULL AND jsonb_array_length(p.images) > 0
        THEN p.images->0->>'url'
        ELSE NULL
      END
    ) AS place_data
    FROM places p
    LEFT JOIN place_types pt ON pt.id = p.place_type_id
    WHERE p.claimed_by = p_user_id
    ORDER BY p.claimed_at DESC
    LIMIT 50
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

-- ============================================
-- 4. update_my_profile(p_user_id, p_bio, p_instagram)
-- ============================================

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_user_id TEXT,
  p_bio TEXT DEFAULT NULL,
  p_instagram TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET bio = p_bio,
      instagram = p_instagram,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_profile TO authenticated;

-- ============================================
-- 5. delete_place(p_user_id, p_place_id)
-- ============================================

CREATE OR REPLACE FUNCTION public.delete_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_author_id TEXT;
  v_user_role TEXT;
BEGIN
  -- Verifier que le lieu existe et recuperer l'auteur
  SELECT author_id INTO v_author_id FROM places WHERE id = p_place_id;
  IF v_author_id IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Verifier les droits : auteur ou admin
  SELECT role INTO v_user_role FROM users WHERE id = p_user_id;
  IF v_author_id != p_user_id AND COALESCE(v_user_role, 'user') != 'admin' THEN
    RETURN json_build_object('error', 'Not authorized');
  END IF;

  -- Nettoyer activity_log (FK sans CASCADE)
  DELETE FROM activity_log WHERE place_id = p_place_id;

  -- Supprimer (CASCADE sur toutes les tables liees)
  DELETE FROM places WHERE id = p_place_id;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_place TO authenticated;

-- ============================================
-- 6. get_leaderboard(p_type, p_limit)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_type TEXT DEFAULT 'notoriety',
  p_limit INT DEFAULT 20
)
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
        'profileImage', (
          SELECT COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
          FROM image_media im WHERE im.id = u.profile_image_id
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
        'profileImage', (
          SELECT COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
          FROM image_media im WHERE im.id = u.profile_image_id
        ),
        'factionColor', f.color,
        'value', COUNT(*)::INT
      ) AS row_data
      FROM users u
      JOIN places p ON p.author_id = u.id
      LEFT JOIN factions f ON f.id = u.faction_id
      GROUP BY u.id, u.first_name, u.email_address, u.profile_image_id, f.color
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
        'profileImage', (
          SELECT COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
          FROM image_media im WHERE im.id = u.profile_image_id
        ),
        'factionColor', f.color,
        'value', COUNT(*)::INT
      ) AS row_data
      FROM users u
      JOIN places_explored pe ON pe.user_id = u.id
      LEFT JOIN factions f ON f.id = u.faction_id
      GROUP BY u.id, u.first_name, u.email_address, u.profile_image_id, f.color
      ORDER BY COUNT(*) DESC
      LIMIT p_limit
    ) sub;

  ELSE
    v_result := '[]'::json;
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard TO anon;
