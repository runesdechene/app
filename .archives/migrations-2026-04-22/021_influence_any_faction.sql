-- 021_influence_any_faction.sql
-- Allow placing influence on any faction's banner, not just your own.
-- Adds optional p_target_faction_id parameter (defaults to player's faction).

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
  v_max_remote INT;
  v_today_remote INT;
  v_actual_points INT;
BEGIN
  -- Récupérer faction et stock du joueur
  SELECT faction_id, influence_stock INTO v_user_faction_id, v_stock
  FROM users WHERE id = p_user_id;

  IF v_user_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Target faction: explicit or player's own
  v_target_faction := COALESCE(p_target_faction_id, v_user_faction_id);

  -- Verify target faction exists
  IF NOT EXISTS (SELECT 1 FROM factions WHERE id = v_target_faction) THEN
    RETURN json_build_object('error', 'invalid_faction');
  END IF;

  IF v_stock < p_points OR p_points <= 0 THEN
    RETURN json_build_object('error', 'not_enough_influence', 'stock', v_stock);
  END IF;

  -- Vérifier distance (GPS = sur place ?)
  SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);
    v_is_gps := v_distance_km < 0.1;
  END IF;

  IF NOT v_is_gps THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_max_remote_per_day'), 5)
    INTO v_max_remote;

    -- Count remote placements today FOR THIS PLACE (not global)
    SELECT COALESCE(SUM((data->>'points')::INT), 0) INTO v_today_remote
    FROM activity_log
    WHERE actor_id = p_user_id
      AND type = 'place_influence'
      AND place_id = p_place_id
      AND (data->>'remote')::BOOLEAN = TRUE
      AND created_at::DATE = CURRENT_DATE;

    v_actual_points := LEAST(p_points, v_max_remote - v_today_remote);
    IF v_actual_points <= 0 THEN
      RETURN json_build_object('error', 'daily_remote_limit', 'remaining', GREATEST(0, v_max_remote - v_today_remote));
    END IF;
  ELSE
    v_actual_points := p_points;
  END IF;

  -- Déduire du stock
  UPDATE users SET influence_stock = influence_stock - v_actual_points
  WHERE id = p_user_id;

  -- Ajouter l'influence pour la faction ciblée
  INSERT INTO place_influence (place_id, faction_id, placed_points, updated_at)
  VALUES (p_place_id, v_target_faction, v_actual_points, NOW())
  ON CONFLICT (place_id, faction_id)
  DO UPDATE SET placed_points = place_influence.placed_points + v_actual_points,
               updated_at = NOW();

  -- Log (includes target faction)
  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('place_influence', p_user_id, p_place_id, v_target_faction,
    jsonb_build_object('points', v_actual_points, 'remote', NOT v_is_gps, 'gps', v_is_gps,
      'target_faction', v_target_faction, 'own_faction', v_user_faction_id));

  RETURN json_build_object(
    'success', true,
    'pointsPlaced', v_actual_points,
    'remainingStock', (SELECT influence_stock FROM users WHERE id = p_user_id),
    'gps', v_is_gps,
    'placeInfluence', (
      SELECT json_agg(json_build_object(
        'factionId', pi.faction_id,
        'placed', pi.placed_points,
        'content', pi.content_points,
        'total', pi.placed_points + pi.content_points
      ))
      FROM place_influence pi WHERE pi.place_id = p_place_id
    )
  );
END;
$$;

-- Need to drop the old signature first since we're adding a parameter
-- The CREATE OR REPLACE handles this for same-name functions with compatible signatures
GRANT EXECUTE ON FUNCTION public.place_influence_action(TEXT, TEXT, INT, NUMERIC, NUMERIC, TEXT) TO authenticated;
