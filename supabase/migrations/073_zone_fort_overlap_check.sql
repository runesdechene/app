-- ============================================
-- MIGRATION 073 : Zone fortification — verifier l'overlap des territoires
-- ============================================
-- Le bonus de zone ne s'applique QUE si les cercles de territoire
-- se touchent (territoires fusionnes visuellement).
-- Formule rayon : 0.25 + sqrt(score - 1) * 0.65 km
-- Formule score : likes + vues*0.1 + explorations*2
-- Condition : distance(A,B) <= rayon(A) + rayon(B)
-- ============================================

-- 1. Helper : score d'influence d'un lieu
CREATE OR REPLACE FUNCTION public.place_influence_score(p_place_id TEXT)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT GREATEST(0, ROUND(
    COALESCE((SELECT COUNT(*) FROM places_liked WHERE place_id = p_place_id), 0)
    + COALESCE((SELECT COUNT(*) FROM places_viewed WHERE place_id = p_place_id), 0) * 0.1
    + COALESCE((SELECT COUNT(*) FROM places_explored WHERE place_id = p_place_id), 0) * 2
  ))::int;
$$;

-- 2. Helper : rayon de territoire en km (meme formule que territoryWorker.ts)
CREATE OR REPLACE FUNCTION public.territory_radius_km(p_score INT)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_score <= 0 THEN 0.0
    WHEN p_score <= 1 THEN 0.25
    ELSE 0.25 + sqrt(p_score - 1) * 0.65
  END;
$$;

-- 3. Mettre a jour claim_place — bonus zone seulement si territoires fusionnes
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_fortification INT;
  v_neighbor_fort INT;
  v_claim_cost NUMERIC(6,1);
  v_conquest NUMERIC(6,1);
  v_construction NUMERIC(6,1);
  v_energy NUMERIC(4,1);
  v_notoriety INT;
  v_max_conquest NUMERIC(6,1);
  v_max_construction NUMERIC(6,1);
  v_conquest_reset_at TIMESTAMPTZ;
  v_conquest_cycle INT := 14400;
  v_conquest_elapsed FLOAT;
  v_conquest_ticks INT;
  v_conquest_next_in INT;
  v_construction_reset_at TIMESTAMPTZ;
  v_construction_cycle INT := 14400;
  v_construction_elapsed FLOAT;
  v_construction_ticks INT;
  v_construction_next_in INT;
  v_prev_faction_id TEXT;
  v_prev_claimed_by TEXT;
  v_lat REAL;
  v_lon REAL;
  v_current_faction TEXT;
  v_target_score INT;
  v_target_radius DOUBLE PRECISION;
BEGIN
  -- Recuperer faction + max du user + bonus faction + cycles regen
  SELECT u.faction_id,
         GREATEST(1, u.max_conquest + COALESCE(f.bonus_conquest, 0)),
         GREATEST(1, u.max_construction + COALESCE(f.bonus_construction, 0)),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_conquest, 0)) / 100)::INT),
         GREATEST(600, (14400 * (100 - COALESCE(f.bonus_regen_construction, 0)) / 100)::INT)
  INTO v_faction_id, v_max_conquest, v_max_construction,
       v_conquest_cycle, v_construction_cycle
  FROM users u
  LEFT JOIN factions f ON f.id = u.faction_id
  WHERE u.id = p_user_id;

  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe + lire fortification + coordonnees + faction actuelle
  SELECT fortification_level, latitude, longitude, faction_id
  INTO v_fortification, v_lat, v_lon, v_current_faction
  FROM places WHERE id = p_place_id;

  IF v_fortification IS NULL THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Score et rayon du lieu cible
  v_target_score := place_influence_score(p_place_id);
  v_target_radius := territory_radius_km(v_target_score);

  -- Fortification des voisins dont le territoire est fusionne (cercles qui se touchent)
  v_neighbor_fort := 0;
  IF v_current_faction IS NOT NULL THEN
    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_neighbor_fort
    FROM places p2
    WHERE p2.faction_id = v_current_faction
      AND p2.id != p_place_id
      AND p2.fortification_level > 0
      AND ABS(p2.latitude - v_lat) < 0.09
      AND ABS(p2.longitude - v_lon) < 0.127
      -- Verifier que les cercles de territoire se touchent
      AND (v_target_radius + territory_radius_km(place_influence_score(p2.id)))
          >= sqrt(
            pow((p2.latitude - v_lat) * 111, 2)
            + pow((p2.longitude - v_lon) * 79, 2)
          );
  END IF;

  -- Cout dynamique : 1 + fort du lieu + bonus zone (x0.5)
  v_claim_cost := 1 + COALESCE(v_fortification, 0) + FLOOR(v_neighbor_fort * 0.5);

  -- Verifier les points de conquete
  SELECT conquest_points INTO v_conquest FROM users WHERE id = p_user_id;
  IF v_conquest < v_claim_cost THEN
    RETURN json_build_object(
      'error', 'Not enough conquest points',
      'conquestPoints', v_conquest,
      'claimCost', v_claim_cost,
      'neighborFort', v_neighbor_fort
    );
  END IF;

  -- Capturer l'ancien controleur AVANT l'update
  SELECT faction_id, claimed_by
  INTO v_prev_faction_id, v_prev_claimed_by
  FROM places WHERE id = p_place_id;

  -- Revendiquer le lieu (reset fortification a 0)
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      fortification_level = 0,
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Historique
  INSERT INTO place_claims (place_id, user_id, faction_id, previous_faction_id, previous_claimed_by)
  VALUES (p_place_id, p_user_id, v_faction_id, v_prev_faction_id, v_prev_claimed_by);

  -- Deduire le cout + ajouter notoriete
  UPDATE users
  SET conquest_points = conquest_points - v_claim_cost,
      notoriety_points = notoriety_points + 10
  WHERE id = p_user_id;

  -- Lire les valeurs mises a jour
  SELECT energy_points, conquest_points, conquest_reset_at,
         construction_points, construction_reset_at, notoriety_points
  INTO v_energy, v_conquest, v_conquest_reset_at,
       v_construction, v_construction_reset_at, v_notoriety
  FROM users WHERE id = p_user_id;

  -- Calculer le temps avant prochain point de conquete
  v_conquest_elapsed := EXTRACT(EPOCH FROM (NOW() - v_conquest_reset_at));
  v_conquest_ticks := GREATEST(0, floor(v_conquest_elapsed / v_conquest_cycle)::int);
  IF v_conquest >= v_max_conquest THEN
    v_conquest_next_in := 0;
  ELSE
    v_conquest_next_in := GREATEST(0, (v_conquest_cycle - (v_conquest_elapsed - v_conquest_ticks * v_conquest_cycle))::int);
  END IF;

  -- Calculer le temps avant prochain point de construction
  v_construction_elapsed := EXTRACT(EPOCH FROM (NOW() - v_construction_reset_at));
  v_construction_ticks := GREATEST(0, floor(v_construction_elapsed / v_construction_cycle)::int);
  IF v_construction >= v_max_construction THEN
    v_construction_next_in := 0;
  ELSE
    v_construction_next_in := GREATEST(0, (v_construction_cycle - (v_construction_elapsed - v_construction_ticks * v_construction_cycle))::int);
  END IF;

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id,
    'energy', v_energy,
    'conquestPoints', v_conquest,
    'conquestNextPointIn', v_conquest_next_in,
    'constructionPoints', v_construction,
    'constructionNextPointIn', v_construction_next_in,
    'notorietyPoints', v_notoriety,
    'fortificationLevel', 0,
    'claimCost', v_claim_cost,
    'neighborFort', v_neighbor_fort
  );
END;
$$;

-- 4. Mettre a jour get_place_by_id — zone fort seulement si territoires fusionnes
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
  v_target_score INT;
  v_target_radius DOUBLE PRECISION;
  v_claimer_name TEXT;
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
      'lastName', u.last_name,
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

  -- Fortification de zone : seulement les voisins dont le territoire est fusionne
  v_zone_fort := 0;
  IF v_place.faction_id IS NOT NULL THEN
    v_target_score := place_influence_score(p_id);
    v_target_radius := territory_radius_km(v_target_score);

    SELECT COALESCE(SUM(p2.fortification_level), 0)
    INTO v_zone_fort
    FROM places p2
    WHERE p2.faction_id = v_place.faction_id
      AND p2.id != p_id
      AND p2.fortification_level > 0
      AND ABS(p2.latitude - v_place.latitude) < 0.09
      AND ABS(p2.longitude - v_place.longitude) < 0.127
      -- Verifier que les cercles de territoire se touchent
      AND (v_target_radius + territory_radius_km(place_influence_score(p2.id)))
          >= sqrt(
            pow((p2.latitude - v_place.latitude) * 111, 2)
            + pow((p2.longitude - v_place.longitude) * 79, 2)
          );
  END IF;

  -- Nom du joueur qui a revendique
  IF v_place.claimed_by IS NOT NULL THEN
    SELECT COALESCE(first_name, last_name, 'Inconnu')
    INTO v_claimer_name
    FROM users WHERE id = v_place.claimed_by;
  END IF;

  -- Claim info (avec fortification + zone + nom du joueur)
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
      'zoneFortification', v_zone_fort
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
      'lastName', COALESCE(v_author.first_name, v_author.last_name, 'Utilisateur inconnu'),
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
