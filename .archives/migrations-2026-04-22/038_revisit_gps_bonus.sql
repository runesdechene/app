-- 038_revisit_gps_bonus.sql
-- Revisite GPS : 10 pts d'influence à placer, 1x/jour/lieu
-- (Première visite reste 20 exploration + 10 influence via visit_place_gps)

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
  v_influence_gain INT;
  v_faction_id TEXT;
BEGIN
  -- Vérifier qu'on a déjà exploré ce lieu (sinon c'est visit_place_gps)
  SELECT EXISTS(SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id)
  INTO v_already_explored;

  IF NOT v_already_explored THEN
    RETURN json_build_object('error', 'not_explored_yet');
  END IF;

  -- Vérifier proximité (200m)
  SELECT latitude, longitude INTO v_place_lat, v_place_lng FROM places WHERE id = p_place_id;
  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);

  IF v_distance_km > 0.2 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::NUMERIC, 2));
  END IF;

  -- 1x par jour par lieu
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

  -- Bonus : influence placée directement sur ce lieu pour la faction du joueur
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_revisit_gps'), 10)
  INTO v_influence_gain;

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
    jsonb_build_object('influenceGain', v_influence_gain));

  RETURN json_build_object(
    'success', true,
    'influenceGain', v_influence_gain
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.revisit_place_gps(TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;

-- Settings
INSERT INTO app_settings (key, value) VALUES ('influence_revisit_gps', '10')
ON CONFLICT (key) DO NOTHING;

-- Première visite : passer l'influence à 20
UPDATE app_settings SET value = '20' WHERE key = 'influence_visit_gps';
