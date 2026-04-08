-- 051_influence_no_limit_permanent_gps.sql
-- 1. Supprimer la limite de clics remote par jour sur place_influence_action
-- 2. Ajouter permanent_points sur place_influence (influence GPS = permanente, pas de decay)
-- 3. visit_place_gps et revisit_place_gps placent de l'influence permanente
-- 4. decay_placed_influence ne touche que placed_points

-- ============================================================
-- 1. Nouvelle colonne permanent_points
-- ============================================================
ALTER TABLE place_influence ADD COLUMN IF NOT EXISTS permanent_points INT NOT NULL DEFAULT 0;

-- ============================================================
-- 2. place_influence_action — plus de limite remote/jour
-- ============================================================
CREATE OR REPLACE FUNCTION public.place_influence_action(
  p_user_id TEXT,
  p_place_id TEXT,
  p_points INT,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_target_faction_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_faction_id TEXT;
  v_target_faction TEXT;
  v_stock INT;
  v_is_gps BOOLEAN := FALSE;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_actual_points INT;
  v_place_title TEXT;
  v_actor_name TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
  v_faction_title TEXT;
BEGIN
  SELECT faction_id, influence_stock INTO v_user_faction_id, v_stock
  FROM users WHERE id = p_user_id;

  IF v_user_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  v_target_faction := COALESCE(p_target_faction_id, v_user_faction_id);

  IF NOT EXISTS (SELECT 1 FROM factions WHERE id = v_target_faction) THEN
    RETURN json_build_object('error', 'invalid_faction');
  END IF;

  IF v_stock < p_points OR p_points <= 0 THEN
    RETURN json_build_object('error', 'not_enough_influence', 'stock', v_stock);
  END IF;

  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng FROM places WHERE id = p_place_id;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_is_gps := v_distance_km < 0.2;
  END IF;

  -- Plus de limite remote : le stock est la seule limite
  v_actual_points := p_points;

  UPDATE users SET influence_stock = influence_stock - v_actual_points
  WHERE id = p_user_id;

  -- Influence cliquée = placed_points (soumis au decay)
  INSERT INTO place_influence (place_id, faction_id, placed_points, updated_at)
  VALUES (p_place_id, v_target_faction, v_actual_points, NOW())
  ON CONFLICT (place_id, faction_id)
  DO UPDATE SET placed_points = place_influence.placed_points + v_actual_points,
               updated_at = NOW();

  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM users WHERE id = p_user_id;

  SELECT color, pattern, title INTO v_faction_color, v_faction_pattern, v_faction_title
  FROM factions WHERE id = v_target_faction;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('place_influence', p_user_id, p_place_id, v_target_faction,
    jsonb_build_object(
      'points', v_actual_points,
      'remote', NOT v_is_gps,
      'gps', v_is_gps,
      'target_faction', v_target_faction,
      'own_faction', v_user_faction_id,
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern,
      'factionTitle', v_faction_title
    ));

  RETURN json_build_object(
    'success', true,
    'pointsPlaced', v_actual_points,
    'remainingStock', (SELECT influence_stock FROM users WHERE id = p_user_id),
    'gps', v_is_gps,
    'placeInfluence', (
      SELECT json_agg(json_build_object(
        'factionId', pi.faction_id,
        'placed', pi.placed_points,
        'permanent', pi.permanent_points,
        'content', pi.content_points,
        'total', pi.placed_points + pi.content_points + pi.permanent_points
      ))
      FROM place_influence pi WHERE pi.place_id = p_place_id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_influence_action(TEXT, TEXT, INT, NUMERIC, NUMERIC, TEXT) TO authenticated;

-- ============================================================
-- 3. visit_place_gps — place de l'influence permanente
-- ============================================================
CREATE OR REPLACE FUNCTION public.visit_place_gps(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC,
  p_user_lng NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_already_visited BOOLEAN;
  v_influence_gain INT;
  v_exploration_gain INT;
  v_new_influence_stock INT;
  v_new_exploration INT;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);

  IF v_distance_km > 0.1 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::NUMERIC, 2));
  END IF;

  SELECT EXISTS(SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id)
  INTO v_already_visited;

  IF v_already_visited THEN
    RETURN json_build_object('error', 'already_visited');
  END IF;

  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_visit_gps'), 20) INTO v_influence_gain;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_visit_gps'), 20) INTO v_exploration_gain;

  INSERT INTO place_explorers (place_id, user_id) VALUES (p_place_id, p_user_id);

  -- Exploration points (gloire)
  UPDATE users SET
    exploration_points = exploration_points + v_exploration_gain
  WHERE id = p_user_id
  RETURNING exploration_points INTO v_new_exploration;

  SELECT influence_stock INTO v_new_influence_stock FROM users WHERE id = p_user_id;

  -- Influence PERMANENTE placée directement sur le lieu (pas de decay)
  INSERT INTO place_influence (place_id, faction_id, permanent_points, updated_at)
  VALUES (p_place_id, v_faction_id, v_influence_gain, NOW())
  ON CONFLICT (place_id, faction_id)
  DO UPDATE SET permanent_points = place_influence.permanent_points + v_influence_gain,
               updated_at = NOW();

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('visit_gps', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object('influenceGain', v_influence_gain, 'explorationGain', v_exploration_gain, 'permanent', true));

  RETURN json_build_object(
    'success', true,
    'influenceGain', v_influence_gain,
    'explorationGain', v_exploration_gain,
    'newInfluenceStock', v_new_influence_stock,
    'newExploration', v_new_exploration,
    'newGlory', v_new_exploration + (SELECT erudition_points FROM users WHERE id = p_user_id),
    'permanent', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.visit_place_gps(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- ============================================================
-- 4. revisit_place_gps — influence permanente aussi
-- ============================================================
CREATE OR REPLACE FUNCTION public.revisit_place_gps(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC,
  p_user_lng NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_visit_count INT;
  v_base_influence INT;
  v_actual_influence INT;
  v_exploration_gain INT;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);

  IF v_distance_km > 0.1 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::NUMERIC, 2));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error', 'not_visited_yet');
  END IF;

  -- Diminishing returns: count previous revisits today
  SELECT COUNT(*) INTO v_visit_count
  FROM activity_log
  WHERE actor_id = p_user_id AND type = 'revisit_gps' AND place_id = p_place_id
    AND created_at::DATE = CURRENT_DATE;

  IF v_visit_count >= 3 THEN
    RETURN json_build_object('error', 'daily_revisit_limit');
  END IF;

  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_revisit_gps'), 10) INTO v_base_influence;
  -- Diminishing: 100%, 50%, 25%
  v_actual_influence := GREATEST(1, v_base_influence / (1 << v_visit_count));
  v_exploration_gain := GREATEST(1, v_actual_influence / 2);

  -- Exploration points
  UPDATE users SET exploration_points = exploration_points + v_exploration_gain
  WHERE id = p_user_id;

  -- Influence PERMANENTE (terrain = permanent)
  INSERT INTO place_influence (place_id, faction_id, permanent_points, updated_at)
  VALUES (p_place_id, v_faction_id, v_actual_influence, NOW())
  ON CONFLICT (place_id, faction_id)
  DO UPDATE SET permanent_points = place_influence.permanent_points + v_actual_influence,
               updated_at = NOW();

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('revisit_gps', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object('influenceGain', v_actual_influence, 'explorationGain', v_exploration_gain, 'visitCount', v_visit_count + 1, 'permanent', true));

  RETURN json_build_object(
    'success', true,
    'influenceGain', v_actual_influence,
    'explorationGain', v_exploration_gain,
    'visitCount', v_visit_count + 1,
    'permanent', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revisit_place_gps(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- ============================================================
-- 5. get_place_detail_v05 — inclure permanent_points dans le total
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_place_detail_v05(
  p_place_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_influence JSON;
  v_contributions JSON;
  v_explorers JSON;
  v_avg_rating NUMERIC;
  v_rating_count INT;
  v_user_rating INT;
  v_is_wishlisted BOOLEAN := FALSE;
  v_is_explorer BOOLEAN := FALSE;
  v_dominant_faction TEXT;
  v_dominant_score INT := 0;
  v_guardian RECORD;
BEGIN
  -- Influence par héritage (inclut permanent_points)
  SELECT json_agg(
    json_build_object(
      'factionId', pi.faction_id,
      'placed', pi.placed_points,
      'permanent', pi.permanent_points,
      'content', pi.content_points,
      'total', pi.placed_points + pi.content_points + pi.permanent_points
    ) ORDER BY (pi.placed_points + pi.content_points + pi.permanent_points) DESC
  ) INTO v_influence
  FROM place_influence pi WHERE pi.place_id = p_place_id;

  -- Faction dominante
  SELECT faction_id, (placed_points + content_points + permanent_points)
  INTO v_dominant_faction, v_dominant_score
  FROM place_influence
  WHERE place_id = p_place_id
  ORDER BY (placed_points + content_points + permanent_points) DESC
  LIMIT 1;

  -- Contributions (triées par votes)
  SELECT json_agg(
    json_build_object(
      'id', pc.id,
      'userId', pc.user_id,
      'factionId', pc.faction_id,
      'type', pc.type,
      'content', pc.content,
      'imageUrl', pc.image_url,
      'images', COALESCE(pc.images, '[]'::jsonb),
      'votesUp', pc.votes_up,
      'votesDown', pc.votes_down,
      'createdAt', pc.created_at,
      'userName', u.first_name,
      'userAvatar', u.avatar_url
    ) ORDER BY pc.votes_up DESC, pc.created_at ASC
  ) INTO v_contributions
  FROM place_contributions pc
  JOIN users u ON u.id = pc.user_id
  WHERE pc.place_id = p_place_id;

  -- Explorateurs (Hall of Fame)
  SELECT json_agg(
    json_build_object(
      'userId', pe.user_id,
      'visitedAt', pe.visited_at,
      'userName', u.first_name,
      'userAvatar', u.avatar_url,
      'factionId', u.faction_id
    ) ORDER BY pe.visited_at ASC
  ) INTO v_explorers
  FROM place_explorers pe
  JOIN users u ON u.id = pe.user_id
  WHERE pe.place_id = p_place_id;

  -- Note moyenne
  SELECT AVG(rating)::NUMERIC(2,1), COUNT(*) INTO v_avg_rating, v_rating_count
  FROM place_ratings WHERE place_id = p_place_id;

  -- Gardien (top contributeur)
  SELECT pc.user_id, u.first_name AS name, u.avatar_url, u.faction_id,
    SUM(pc.votes_up) AS total_votes
  INTO v_guardian
  FROM place_contributions pc
  JOIN users u ON u.id = pc.user_id
  WHERE pc.place_id = p_place_id
  GROUP BY pc.user_id, u.first_name, u.avatar_url, u.faction_id
  ORDER BY total_votes DESC
  LIMIT 1;

  -- Infos joueur connecté
  IF p_user_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM place_wishlist WHERE place_id = p_place_id AND user_id = p_user_id)
    INTO v_is_wishlisted;
    SELECT EXISTS(SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id)
    INTO v_is_explorer;
    SELECT rating INTO v_user_rating FROM place_ratings WHERE place_id = p_place_id AND user_id = p_user_id;
  END IF;

  RETURN json_build_object(
    'influence', COALESCE(v_influence, '[]'::json),
    'dominantFaction', v_dominant_faction,
    'contributions', COALESCE(v_contributions, '[]'::json),
    'explorers', COALESCE(v_explorers, '[]'::json),
    'avgRating', v_avg_rating,
    'ratingCount', v_rating_count,
    'userRating', v_user_rating,
    'isWishlisted', v_is_wishlisted,
    'isExplorer', v_is_explorer,
    'guardian', CASE WHEN v_guardian.user_id IS NOT NULL THEN
      json_build_object('userId', v_guardian.user_id, 'name', v_guardian.name,
        'avatar', v_guardian.avatar_url, 'factionId', v_guardian.faction_id)
    ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_detail_v05(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_detail_v05(TEXT, TEXT) TO anon;

-- ============================================================
-- 6. decay — ne touche que placed_points, pas permanent_points
-- ============================================================
CREATE OR REPLACE FUNCTION public.decay_placed_influence()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_decay INT;
  v_affected INT;
BEGIN
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_decay_per_week'), 1) INTO v_decay;

  UPDATE place_influence
  SET placed_points = GREATEST(0, placed_points - v_decay),
      updated_at = NOW()
  WHERE placed_points > 0;

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  -- Nettoyer les lignes mortes (0 partout)
  DELETE FROM place_influence WHERE placed_points = 0 AND content_points = 0 AND permanent_points = 0;

  RETURN json_build_object('decayed', v_affected, 'decayAmount', v_decay);
END;
$$;
