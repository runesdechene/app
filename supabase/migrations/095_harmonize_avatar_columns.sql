-- ============================================================
-- MIGRATION 095 : Harmoniser les colonnes avatar
-- ============================================================
-- Problème : deux systèmes coexistent pour les photos de profil :
--   1. profile_image_id → image_media.variants (ancien, onboarding legacy)
--   2. avatar_url (nouveau, onboarding actuel depuis migration 057)
-- Les anciens users ont profile_image_id mais pas avatar_url.
-- Les nouveaux users ont avatar_url mais pas profile_image_id.
-- Résultat : certaines RPCs ne trouvent pas l'avatar selon le système utilisé.
--
-- Solution :
--   1. Backfill avatar_url pour les anciens users depuis image_media
--   2. Simplifier TOUTES les RPCs pour n'utiliser QUE avatar_url
-- ============================================================

-- 1. Backfill avatar_url depuis image_media pour les anciens users
UPDATE users
SET avatar_url = COALESCE(
  (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v
   WHERE im.id = users.profile_image_id AND v->>'name' = 'png_small' LIMIT 1),
  (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v
   WHERE im.id = users.profile_image_id AND v->>'name' = 'webp_small' LIMIT 1),
  (SELECT v->>'url' FROM image_media im, jsonb_array_elements(im.variants) v
   WHERE im.id = users.profile_image_id AND v->>'name' = 'original' LIMIT 1)
)
WHERE profile_image_id IS NOT NULL
  AND avatar_url IS NULL;

-- ============================================================
-- 2. Simplifier get_leaderboard — avatar_url uniquement
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
        'profileImage', u.avatar_url,
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
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value', COUNT(*)::INT
      ) AS row_data
      FROM users u
      JOIN places p ON p.author_id = u.id
      LEFT JOIN factions f ON f.id = u.faction_id
      GROUP BY u.id, u.first_name, u.email_address, u.avatar_url, f.color
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
        'profileImage', u.avatar_url,
        'factionColor', f.color,
        'value', COUNT(*)::INT
      ) AS row_data
      FROM users u
      JOIN places_explored pe ON pe.user_id = u.id
      LEFT JOIN factions f ON f.id = u.faction_id
      GROUP BY u.id, u.first_name, u.email_address, u.avatar_url, f.color
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

-- ============================================================
-- 3. Simplifier get_place_by_id — avatar_url uniquement
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_place_by_id(
  p_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place RECORD;
  v_place_type RECORD;
  v_author RECORD;
  v_views_count INT;
  v_likes_count INT;
  v_explored_count INT;
  v_geocache_count INT;
  v_avg_score DOUBLE PRECISION;
  v_last_explorers JSON;
  v_requester JSON;
  v_primary_tag JSON;
  v_all_tags JSON;
  v_claim JSON;
  v_zone_fort INT;
  v_zone_count INT;
  v_target_score INT;
  v_target_radius DOUBLE PRECISION;
  v_claimer_name TEXT;
  v_radius_km NUMERIC(6,1);
  v_lat_delta NUMERIC(8,5);
  v_lon_delta NUMERIC(8,5);
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  SELECT * INTO v_place FROM places WHERE id = p_id;
  IF v_place IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  SELECT * INTO v_place_type FROM place_types WHERE id = v_place.place_type_id;
  SELECT * INTO v_author FROM users WHERE id = v_place.author_id;

  -- Metrics
  SELECT COUNT(*) INTO v_views_count FROM places_viewed WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_likes_count FROM places_liked WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_explored_count FROM places_explored WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_geocache_count FROM reviews WHERE place_id = p_id AND geocache = true;
  SELECT AVG(score) INTO v_avg_score FROM reviews WHERE place_id = p_id;

  -- Derniers explorateurs — avatar_url uniquement
  SELECT json_agg(explorer) INTO v_last_explorers
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'lastName', COALESCE(u.display_name, u.first_name, 'Aventurier'),
      'profileImageUrl', u.avatar_url
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    WHERE pe.place_id = p_id AND pe.user_id != v_place.author_id
    ORDER BY pe.updated_at DESC
  ) sub;

  -- Tag primaire
  SELECT json_build_object(
    'id', t.id,
    'title', t.title,
    'color', t.color,
    'background', t.background
  ) INTO v_primary_tag
  FROM place_tags ptag
  JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_id AND ptag.is_primary = TRUE
  LIMIT 1;

  -- Tous les tags
  SELECT json_agg(tag_data) INTO v_all_tags
  FROM (
    SELECT json_build_object(
      'id', t.id,
      'title', t.title,
      'color', t.color,
      'background', t.background,
      'isPrimary', ptag.is_primary
    ) AS tag_data
    FROM place_tags ptag
    JOIN tags t ON t.id = ptag.tag_id
    WHERE ptag.place_id = p_id
    ORDER BY ptag.is_primary DESC, t."order"
  ) sub;

  -- Requester state
  IF p_user_id IS NOT NULL THEN
    v_requester := json_build_object(
      'bookmarked', EXISTS(SELECT 1 FROM places_bookmarked WHERE place_id = p_id AND user_id = p_user_id),
      'liked', EXISTS(SELECT 1 FROM places_liked WHERE place_id = p_id AND user_id = p_user_id),
      'explored', EXISTS(SELECT 1 FROM places_explored WHERE place_id = p_id AND user_id = p_user_id)
    );
  ELSE
    v_requester := NULL;
  END IF;

  -- Lire le rayon configurable
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_detection_radius_km'), '10')::NUMERIC(6,1) INTO v_radius_km;
  v_lat_delta := v_radius_km / 111.0;
  v_lon_delta := v_radius_km / 79.0;

  -- Fortification voisins
  v_zone_fort := 0;
  v_zone_count := 0;
  IF v_place.faction_id IS NOT NULL THEN
    v_target_score := place_influence_score(p_id);
    v_target_radius := territory_radius_km(v_target_score);

    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_zone_fort
    FROM places p2
    WHERE p2.faction_id = v_place.faction_id
      AND p2.id != p_id
      AND ABS(p2.latitude - v_place.latitude) < v_lat_delta
      AND ABS(p2.longitude - v_place.longitude) < v_lon_delta
      AND (v_target_radius + territory_radius_km(place_influence_score(p2.id)))
          >= sqrt(
            pow((p2.latitude - v_place.latitude) * 111, 2)
            + pow((p2.longitude - v_place.longitude) * 79, 2)
          );

    -- Taille du territoire (blob entier via boucle iterative)
    v_blob_ids := ARRAY[p_id];
    LOOP
      SELECT array_agg(p2.id) INTO v_new_ids
      FROM places p2
      WHERE p2.faction_id = v_place.faction_id
        AND NOT (p2.id = ANY(v_blob_ids))
        AND EXISTS (
          SELECT 1 FROM places pb
          WHERE pb.id = ANY(v_blob_ids)
            AND territory_radius_km(place_influence_score(p2.id))
              + territory_radius_km(place_influence_score(pb.id))
              >= sqrt(
                pow((p2.latitude - pb.latitude) * 111, 2)
                + pow((p2.longitude - pb.longitude) * 79, 2)
              )
        );
      EXIT WHEN v_new_ids IS NULL;
      v_blob_ids := v_blob_ids || v_new_ids;
    END LOOP;
    v_zone_count := array_length(v_blob_ids, 1) - 1;
  END IF;

  -- Nom du joueur qui a revendique
  IF v_place.claimed_by IS NOT NULL THEN
    SELECT COALESCE(display_name, first_name, 'Inconnu')
    INTO v_claimer_name
    FROM users WHERE id = v_place.claimed_by;
  END IF;

  -- Claim info
  IF v_place.faction_id IS NOT NULL THEN
    SELECT json_build_object(
      'factionId', f.id,
      'factionTitle', f.title,
      'factionColor', f.color,
      'factionPattern', f.pattern,
      'claimedBy', v_place.claimed_by,
      'claimedByName', COALESCE(v_claimer_name, 'Inconnu'),
      'claimedAt', v_place.claimed_at,
      'fortificationLevel', v_place.fortification_level,
      'zoneFortification', v_zone_fort,
      'zoneNeighborCount', v_zone_count
    ) INTO v_claim
    FROM factions f
    WHERE f.id = v_place.faction_id;
  ELSE
    v_claim := NULL;
  END IF;

  RETURN json_build_object(
    'id', v_place.id,
    'title', v_place.title,
    'text', v_place.text,
    'address', v_place.address,
    'accessibility', v_place.accessibility,
    'sensible', COALESCE(v_place.sensible, false),
    'geocaching', v_geocache_count > 0,
    'images', v_place.images,
    'author', json_build_object(
      'id', COALESCE(v_author.id, v_place.author_id),
      'lastName', COALESCE(v_author.display_name, v_author.first_name, 'Utilisateur inconnu'),
      'profileImageUrl', v_author.avatar_url
    ),
    'type', json_build_object(
      'id', v_place_type.id,
      'title', v_place_type.title
    ),
    'primaryTag', v_primary_tag,
    'tags', COALESCE(v_all_tags, '[]'::json),
    'location', json_build_object(
      'latitude', v_place.latitude,
      'longitude', v_place.longitude
    ),
    'metrics', json_build_object(
      'views', v_views_count,
      'likes', v_likes_count,
      'explored', v_explored_count,
      'note', v_avg_score
    ),
    'claim', v_claim,
    'requester', v_requester,
    'lastExplorers', COALESCE(v_last_explorers, '[]'::json),
    'beginAt', v_place.begin_at,
    'endAt', v_place.end_at,
    'createdAt', v_place.created_at
  );
END;
$$;

-- ============================================================
-- 4. Simplifier get_place_likers — avatar_url uniquement
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_place_likers(
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(liker) INTO v_result
  FROM (
    SELECT json_build_object(
      'userId', u.id,
      'name', COALESCE(u.first_name, u.email_address),
      'factionColor', f.color,
      'profileImage', u.avatar_url
    ) AS liker
    FROM places_liked pl
    JOIN users u ON u.id = pl.user_id
    LEFT JOIN factions f ON f.id = u.faction_id
    WHERE pl.place_id = p_place_id
    ORDER BY pl.created_at DESC
  ) sub;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_likers TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_likers TO anon;

-- ============================================================
-- 5. Simplifier get_place_explorers — avatar_url uniquement
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_place_explorers(
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(explorer) INTO v_result
  FROM (
    SELECT json_build_object(
      'userId', u.id,
      'name', COALESCE(u.first_name, u.email_address),
      'factionColor', f.color,
      'profileImage', u.avatar_url,
      'exploredAt', pe.created_at
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    LEFT JOIN factions f ON f.id = u.faction_id
    WHERE pe.place_id = p_place_id
    ORDER BY pe.created_at DESC
  ) sub;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_explorers TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_explorers TO anon;

-- ============================================================
-- 6. Simplifier get_faction_members — avatar_url uniquement
-- ============================================================
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
      'profileImage', u.avatar_url,
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

-- ============================================================
-- 7. Simplifier get_player_profile — avatar_url uniquement
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_player_profile(p_user_id TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
  v_titles_data JSON;
  v_displayed_ids INT[];
  v_displayed_general JSON;
  v_faction_title JSON;
  v_authored_places JSON;
  v_discovered_places JSON;
  v_claimed_places JSON;
BEGIN
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

  -- Lieux ajoutes par le joueur (max 50)
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

  -- Lieux explores par le joueur (max 50)
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

  -- Lieux conquis par le joueur (max 50)
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

  -- Resultat complet — avatar_url uniquement
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
