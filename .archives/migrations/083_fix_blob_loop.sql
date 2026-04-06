-- ============================================
-- MIGRATION 083 : Fix blob traversal — PL/pgSQL loop au lieu de CTE
-- ============================================
-- Le WITH RECURSIVE causait une erreur 400 dans PL/pgSQL.
-- On utilise maintenant une boucle iterative avec des arrays.
-- Cette migration re-declare claim_place et get_place_by_id.
-- ============================================

CREATE OR REPLACE FUNCTION public.claim_place(p_user_id TEXT, p_place_id TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_faction_id TEXT;
  v_fortification INT;
  v_neighbor_fort INT;
  v_neighbor_count INT;
  v_claim_cost NUMERIC(6,1);
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_max_conquest NUMERIC(6,1);
  v_bonus_conquest NUMERIC(6,1);
  v_current_faction TEXT;
  v_current_claimer TEXT;
  v_notoriety NUMERIC(10,2);
  v_role TEXT;
  v_score INT;
  v_lat DOUBLE PRECISION;
  v_lon DOUBLE PRECISION;
  v_target_score INT;
  v_target_radius DOUBLE PRECISION;
  v_zone_multiplier NUMERIC(4,2);
  v_size_multiplier NUMERIC(4,2);
  v_radius_km NUMERIC(6,1);
  v_lat_delta NUMERIC(8,5);
  v_lon_delta NUMERIC(8,5);
  v_blob_ids TEXT[];
  v_new_ids TEXT[];
BEGIN
  -- Faction du joueur
  SELECT faction_id, role INTO v_faction_id, v_role FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Info du lieu
  SELECT faction_id, claimed_by, fortification_level, latitude, longitude
  INTO v_current_faction, v_current_claimer, v_fortification, v_lat, v_lon
  FROM places WHERE id = p_place_id;

  IF v_lat IS NULL THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  -- Deja possede par la meme faction
  IF v_current_faction = v_faction_id THEN
    RETURN json_build_object('error', 'already_owned');
  END IF;

  -- Lire les settings
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_fort_multiplier'), '0.5')::NUMERIC(4,2) INTO v_zone_multiplier;
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'territory_size_defense_mult'), '0')::NUMERIC(4,2) INTO v_size_multiplier;
  SELECT COALESCE((SELECT value FROM app_settings WHERE key = 'zone_detection_radius_km'), '10')::NUMERIC(6,1) INTO v_radius_km;

  -- Convertir le rayon en delta de coordonnees
  v_lat_delta := v_radius_km / 111.0;
  v_lon_delta := v_radius_km / 79.0;

  -- Fortification voisins (limitee par rayon configurable)
  v_neighbor_fort := 0;
  v_neighbor_count := 0;
  IF v_current_faction IS NOT NULL THEN
    v_target_score := place_influence_score(p_place_id);
    v_target_radius := territory_radius_km(v_target_score);

    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_neighbor_fort
    FROM places p2
    WHERE p2.faction_id = v_current_faction
      AND p2.id != p_place_id
      AND ABS(p2.latitude - v_lat) < v_lat_delta
      AND ABS(p2.longitude - v_lon) < v_lon_delta
      AND (
        territory_radius_km(place_influence_score(p2.id)) + v_target_radius
        >=
        sqrt(
          pow((p2.latitude - v_lat) * 111, 2)
          + pow((p2.longitude - v_lon) * 79, 2)
        )
      );

    -- Taille du territoire (blob entier via boucle iterative)
    v_blob_ids := ARRAY[p_place_id];
    LOOP
      SELECT array_agg(p2.id) INTO v_new_ids
      FROM places p2
      WHERE p2.faction_id = v_current_faction
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
    v_neighbor_count := array_length(v_blob_ids, 1) - 1;
  END IF;

  -- Cout dynamique : base + fort + zone bonus + territory size bonus
  v_claim_cost := 1
    + COALESCE(v_fortification, 0)
    + FLOOR(v_neighbor_fort * v_zone_multiplier)
    + FLOOR(v_neighbor_count * v_size_multiplier);

  -- Verifier les points de conquete
  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest,
      'claimCost', v_claim_cost,
      'neighborFort', v_neighbor_fort,
      'neighborCount', v_neighbor_count
    );
  END IF;

  -- Max conquete (avec bonus faction)
  SELECT max_conquest INTO v_max_conquest FROM users WHERE id = p_user_id;
  SELECT COALESCE(bonus_conquest, 0) INTO v_bonus_conquest FROM factions WHERE id = v_faction_id;
  v_max_conquest := GREATEST(1, v_max_conquest + v_bonus_conquest);

  -- Deduire les points
  UPDATE users
  SET conquest_points = GREATEST(0, conquest_points - v_claim_cost)
  WHERE id = p_user_id
  RETURNING conquest_points INTO v_conquest;

  -- Reset fortification si changement de faction
  IF v_current_faction IS NOT NULL AND v_current_faction != v_faction_id THEN
    v_fortification := 0;
  END IF;

  -- Mettre a jour le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = COALESCE(v_fortification, 0)
  WHERE id = p_place_id;

  -- Notoriete
  UPDATE users
  SET notoriety_points = notoriety_points + 10
  WHERE id = p_user_id
  RETURNING notoriety_points INTO v_notoriety;

  -- Log activite
  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'claim',
    p_user_id,
    p_place_id,
    v_faction_id,
    jsonb_build_object(
      'previousFaction', v_current_faction,
      'actorName', (SELECT COALESCE(first_name, 'Quelqu''un') FROM users WHERE id = p_user_id)
    )
  );

  RETURN json_build_object(
    'ok', true,
    'conquestPoints', v_conquest,
    'maxConquest', v_max_conquest,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', 0,
    'claimCost', v_claim_cost,
    'neighborFort', v_neighbor_fort,
    'neighborCount', v_neighbor_count
  );
END;
$$;


-- ============================================
-- get_place_by_id : blob loop version
-- ============================================

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
  v_author_profile_url TEXT;
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

  -- Photo de profil de l'auteur
  SELECT COALESCE(
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
    (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
  )
  INTO v_author_profile_url
  FROM users u2
  JOIN image_media im ON im.id = u2.profile_image_id
  WHERE u2.id = v_place.author_id;

  -- Metrics
  SELECT COUNT(*) INTO v_views_count FROM places_viewed WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_likes_count FROM places_liked WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_explored_count FROM places_explored WHERE place_id = p_id;
  SELECT COUNT(*) INTO v_geocache_count FROM reviews WHERE place_id = p_id AND geocache = true;
  SELECT AVG(score) INTO v_avg_score FROM reviews WHERE place_id = p_id;

  -- Derniers explorateurs
  SELECT json_agg(explorer) INTO v_last_explorers
  FROM (
    SELECT json_build_object(
      'id', u.id,
      'lastName', COALESCE(u.display_name, u.first_name, 'Aventurier'),
      'profileImageUrl', CASE
        WHEN im.variants IS NOT NULL AND jsonb_array_length(im.variants) > 0 THEN
          COALESCE(
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'png_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'webp_small' LIMIT 1),
            (SELECT v->>'url' FROM jsonb_array_elements(im.variants) v WHERE v->>'name' = 'original' LIMIT 1)
          )
        ELSE NULL
      END
    ) AS explorer
    FROM places_explored pe
    JOIN users u ON u.id = pe.user_id
    LEFT JOIN image_media im ON im.id = u.profile_image_id
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

  -- Fortification voisins (limitee par rayon configurable)
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
      'profileImageUrl', v_author_profile_url
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
