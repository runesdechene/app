-- 039_revisit_diminishing_returns.sql
-- Revisites GPS : bonus décroissant selon la fréquence récente (30 jours)
-- 0-1 revisites → 10pts, 2-3 → 8pts, 4-5 → 6pts, 6-8 → 4pts, 9+ → 2pts

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
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_distance_km NUMERIC;
  v_already_explored BOOLEAN;
  v_already_today BOOLEAN;
  v_recent_count INT;
  v_base_gain INT;
  v_influence_gain INT;
  v_faction_id TEXT;
BEGIN
  SELECT EXISTS(SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id)
  INTO v_already_explored;

  IF NOT v_already_explored THEN
    RETURN json_build_object('error', 'not_explored_yet');
  END IF;

  SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);

  IF v_distance_km > 0.2 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::NUMERIC, 2));
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM activity_log
    WHERE actor_id = p_user_id
      AND place_id = p_place_id
      AND type = 'revisit_gps'
      AND created_at::DATE = CURRENT_DATE
  ) INTO v_already_today;

  IF v_already_today THEN
    RETURN json_build_object('error', 'already_revisited_today');
  END IF;

  -- Compter les revisites des 30 derniers jours sur ce lieu
  SELECT COUNT(*) INTO v_recent_count
  FROM activity_log
  WHERE actor_id = p_user_id
    AND place_id = p_place_id
    AND type = 'revisit_gps'
    AND created_at > NOW() - INTERVAL '30 days';

  -- Bonus de base (configurable)
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_revisit_gps'), 10)
  INTO v_base_gain;

  -- Malus selon la fréquence récente
  v_influence_gain := CASE
    WHEN v_recent_count <= 1 THEN 10
    WHEN v_recent_count <= 3 THEN 6
    WHEN v_recent_count <= 5 THEN 4
    WHEN v_recent_count <= 8 THEN 3
    ELSE 2
  END;

  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  INSERT INTO place_influence (place_id, faction_id, placed_points, updated_at)
  VALUES (p_place_id, v_faction_id, v_influence_gain, NOW())
  ON CONFLICT (place_id, faction_id)
  DO UPDATE SET placed_points = place_influence.placed_points + v_influence_gain,
               updated_at = NOW();

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('revisit_gps', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object('influenceGain', v_influence_gain, 'recentCount', v_recent_count));

  RETURN json_build_object(
    'success', true,
    'influenceGain', v_influence_gain,
    'recentRevisits', v_recent_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revisit_place_gps(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
