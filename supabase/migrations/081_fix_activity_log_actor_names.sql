-- 081: Fix activity_log entries missing actorName/placeTitle in visit_place_gps, revisit_place_gps, answer_fragment_enigma
-- These functions insert into activity_log without actorName, so toasts show "Quelqu'un"

-- 1. revisit_place_gps — add actorName, placeTitle, factionColor, factionPattern, actorAvatarUrl
CREATE OR REPLACE FUNCTION public.revisit_place_gps(
  p_user_id TEXT, p_place_id TEXT, p_user_lat NUMERIC, p_user_lng NUMERIC
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
  v_actor_name TEXT;
  v_actor_avatar TEXT;
  v_place_title TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  SELECT COALESCE(display_name, first_name, 'Quelqu''un'), avatar_url
  INTO v_actor_name, v_actor_avatar
  FROM users WHERE id = p_user_id;

  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = p_place_id;

  v_distance_km := haversine_km(p_user_lat, p_user_lng, v_place_lat, v_place_lng);

  IF v_distance_km > 0.1 THEN
    RETURN json_build_object('error', 'too_far', 'distanceKm', ROUND(v_distance_km::NUMERIC, 2));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error', 'not_visited_yet');
  END IF;

  SELECT COUNT(*) INTO v_visit_count
  FROM activity_log
  WHERE actor_id = p_user_id AND type = 'revisit_gps' AND place_id = p_place_id
    AND created_at::DATE = CURRENT_DATE;

  IF v_visit_count >= 3 THEN
    RETURN json_build_object('error', 'daily_revisit_limit');
  END IF;

  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_revisit_gps'), 10) INTO v_base_influence;
  v_actual_influence := GREATEST(1, v_base_influence / (1 << v_visit_count));
  v_exploration_gain := GREATEST(1, v_actual_influence / 2);

  UPDATE users SET exploration_points = exploration_points + v_exploration_gain
  WHERE id = p_user_id;

  INSERT INTO place_influence (place_id, faction_id, permanent_points, updated_at)
  VALUES (p_place_id, v_faction_id, v_actual_influence, NOW())
  ON CONFLICT (place_id, faction_id)
  DO UPDATE SET permanent_points = place_influence.permanent_points + v_actual_influence,
               updated_at = NOW();

  SELECT color, pattern INTO v_faction_color, v_faction_pattern
  FROM factions WHERE id = v_faction_id;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('revisit_gps', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object(
      'influenceGain', v_actual_influence,
      'explorationGain', v_exploration_gain,
      'visitCount', v_visit_count + 1,
      'permanent', true,
      'actorName', v_actor_name,
      'actorAvatarUrl', v_actor_avatar,
      'placeTitle', v_place_title,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern
    ));

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

-- 2. visit_place_gps — add actorName, placeTitle, factionColor, factionPattern, actorAvatarUrl
-- First get the current full definition to see all the logic
DO $$
DECLARE
  v_def TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'visit_place_gps';

  -- Check if it already has actorName
  IF v_def LIKE '%actorName%' THEN
    RAISE NOTICE 'visit_place_gps already has actorName, skipping';
    RETURN;
  END IF;

  -- Patch: replace the bare jsonb_build_object in the INSERT
  v_def := replace(v_def,
    'jsonb_build_object(''influenceGain'', v_influence_gain, ''explorationGain'', v_exploration_gain, ''permanent'', true)',
    'jsonb_build_object(''influenceGain'', v_influence_gain, ''explorationGain'', v_exploration_gain, ''permanent'', true, ''actorName'', COALESCE((SELECT display_name FROM users WHERE id = p_user_id), (SELECT first_name FROM users WHERE id = p_user_id), ''Quelqu''''un''), ''placeTitle'', (SELECT title FROM places WHERE id = p_place_id), ''actorAvatarUrl'', (SELECT avatar_url FROM users WHERE id = p_user_id), ''factionColor'', (SELECT color FROM factions WHERE id = v_faction_id), ''factionPattern'', (SELECT pattern FROM factions WHERE id = v_faction_id))'
  );

  EXECUTE v_def;
  RAISE NOTICE 'Patched visit_place_gps with actorName';
END;
$$;
