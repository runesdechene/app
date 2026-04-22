-- Migration 045: Fragment tag affinities boost remote influence limit
-- Drops: claim_daily_fragment_bonus(TEXT) — no longer needed

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
  v_base_remote INT;
  v_fragment_bonus INT := 0;
  v_max_remote INT;
  v_today_remote INT;
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

  IF NOT v_is_gps THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_max_remote_per_day'), 5)
    INTO v_base_remote;

    SELECT COALESCE(SUM(fta.bonus_points), 0) INTO v_fragment_bonus
    FROM user_fragments uf
    JOIN fragment_tag_affinities fta ON fta.fragment_id = uf.fragment_id
    WHERE uf.user_id = p_user_id
      AND fta.tag_id IN (SELECT tag_id FROM place_tags WHERE place_id = p_place_id);

    v_max_remote := v_base_remote + v_fragment_bonus;

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

  UPDATE users SET influence_stock = influence_stock - v_actual_points
  WHERE id = p_user_id;

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
    'maxRemote', v_max_remote,
    'fragmentBonus', v_fragment_bonus,
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

GRANT EXECUTE ON FUNCTION public.place_influence_action(TEXT, TEXT, INT, NUMERIC, NUMERIC, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.claim_daily_fragment_bonus(TEXT);
