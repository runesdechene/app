-- 024_create_place_v05_rewards.sql
-- V0.5: create_place gives influence rewards (not discover_place)
-- - Creator gets 50 influence_stock
-- - Auto-creates carnet contribution (text + photos)
-- - Adds content_points to place_influence for creator's faction
-- - No more auto-claim (faction_id/claimed_by on places)

CREATE OR REPLACE FUNCTION public.create_place(
  p_user_id    TEXT,
  p_title      TEXT,
  p_latitude   REAL,
  p_longitude  REAL,
  p_tag_id     TEXT,
  p_image_url  TEXT DEFAULT NULL,
  p_thumb_url  TEXT DEFAULT NULL,
  p_address    TEXT DEFAULT '',
  p_text       TEXT DEFAULT ''
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_id     TEXT;
  v_actor_name TEXT;
  v_images     JSONB;
  v_img_obj    JSONB;
  v_faction_id TEXT;
  v_influence_gain INT;
  v_content_pts INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM tags WHERE id = p_tag_id) THEN
    RETURN json_build_object('error', 'Tag not found');
  END IF;

  v_new_id := gen_random_uuid()::TEXT;

  -- Build images JSONB
  IF p_image_url IS NOT NULL AND p_image_url <> '' THEN
    v_img_obj := jsonb_build_object('id', gen_random_uuid()::TEXT, 'url', p_image_url);
    IF p_thumb_url IS NOT NULL AND p_thumb_url <> '' THEN
      v_img_obj := v_img_obj || jsonb_build_object('thumb', p_thumb_url);
    END IF;
    v_images := jsonb_build_array(v_img_obj);
  ELSE
    v_images := '[]'::JSONB;
  END IF;

  -- Insert place (NO faction_id / claimed_by — old claim system removed)
  INSERT INTO places (
    id, created_at, updated_at,
    author_id, place_type_id,
    title, text, address,
    latitude, longitude,
    images, private, masked
  ) VALUES (
    v_new_id, NOW(), NOW(),
    p_user_id, 'lieu',
    p_title, p_text, p_address,
    p_latitude, p_longitude,
    v_images, false, false
  );

  -- Primary tag
  INSERT INTO place_tags (place_id, tag_id, is_primary)
  VALUES (v_new_id, p_tag_id, true);

  -- Auto-discover (creator sees the place without fog)
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, v_new_id, 'gps')
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- V0.5: Creator gets influence stock reward
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_add_place'), 50)
  INTO v_influence_gain;

  UPDATE users SET
    influence_stock = influence_stock + v_influence_gain,
    exploration_points = exploration_points + 5
  WHERE id = p_user_id;

  -- V0.5: Auto-create discoverer's carnet contribution
  v_content_pts := 10; -- text
  IF jsonb_array_length(v_images) > 0 THEN
    v_content_pts := v_content_pts + 10; -- photos bonus (flat)
  END IF;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, images, created_at)
  VALUES (
    v_new_id, p_user_id, v_faction_id, 'carnet',
    COALESCE(NULLIF(TRIM(p_text), ''), 'Lieu découvert.'),
    COALESCE(
      (SELECT jsonb_agg(img->>'url') FROM jsonb_array_elements(v_images) AS img WHERE img->>'url' IS NOT NULL),
      '[]'::jsonb
    ),
    NOW()
  )
  ON CONFLICT (place_id, user_id, type) DO NOTHING;

  -- V0.5: Content influence for creator's faction
  IF v_faction_id IS NOT NULL THEN
    INSERT INTO place_influence (place_id, faction_id, content_points)
    VALUES (v_new_id, v_faction_id, v_content_pts)
    ON CONFLICT (place_id, faction_id)
    DO UPDATE SET content_points = place_influence.content_points + EXCLUDED.content_points;
  END IF;

  -- Activity log
  SELECT COALESCE(first_name, email_address) INTO v_actor_name
  FROM users WHERE id = p_user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'new_place', p_user_id, v_new_id,
    jsonb_build_object(
      'placeTitle', p_title,
      'placeLatitude', p_latitude,
      'placeLongitude', p_longitude,
      'actorName', v_actor_name
    )
  );

  RETURN json_build_object(
    'success', true,
    'placeId', v_new_id,
    'influenceGain', v_influence_gain,
    'contentPoints', v_content_pts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_place(TEXT, TEXT, REAL, REAL, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Also clean up discover_place: remove influence reward entirely
-- (discover = remove fog, costs energy, gives glory + exploration only)
CREATE OR REPLACE FUNCTION public.discover_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_method TEXT DEFAULT 'remote',
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_free BOOLEAN DEFAULT FALSE,
  p_glory_mult NUMERIC DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already BOOLEAN;
  v_cost NUMERIC;
  v_energy NUMERIC;
  v_preview JSON;
  v_reward_energy INT := 0;
  v_glory_base INT;
  v_glory_cost_pct NUMERIC;
  v_glory_gain INT;
  v_exploration_gain INT;
BEGIN
  SELECT EXISTS (SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id)
  INTO v_already;
  IF v_already THEN RETURN json_build_object('error', 'already_discovered'); END IF;

  IF p_free THEN
    v_cost := 0;
  ELSIF p_method = 'gps' THEN
    v_cost := 0;
  ELSE
    v_preview := preview_action_cost(p_user_id, p_place_id, 'discover', p_user_lat, p_user_lng);
    v_cost := (v_preview->>'cost')::NUMERIC;
  END IF;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  IF v_energy < v_cost THEN
    RETURN json_build_object('error', 'not_enough_energy', 'energy', v_energy, 'cost', v_cost);
  END IF;

  IF v_cost > 0 THEN
    UPDATE users SET energy_points = GREATEST(0, energy_points - v_cost) WHERE id = p_user_id;
  END IF;

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, p_method) ON CONFLICT (user_id, place_id) DO NOTHING;

  SELECT COALESCE(t.reward_energy, 0) INTO v_reward_energy
  FROM place_tags ptag JOIN tags t ON t.id = ptag.tag_id
  WHERE ptag.place_id = p_place_id AND ptag.is_primary = TRUE LIMIT 1;

  IF v_reward_energy > 0 THEN
    UPDATE users SET energy_points = LEAST(energy_points + v_reward_energy, max_energy) WHERE id = p_user_id;
  END IF;

  -- Glory
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'glory_discover'), 2) INTO v_glory_base;
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'glory_cost_bonus_pct'), 10) INTO v_glory_cost_pct;
  v_glory_gain := GREATEST(1, ROUND((v_glory_base + v_cost * v_glory_cost_pct / 100) * COALESCE(p_glory_mult, 1)));
  UPDATE users SET notoriety_points = notoriety_points + v_glory_gain WHERE id = p_user_id;

  -- Exploration points only (NO influence stock — that's for create_place and visit_gps)
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_place'), 5) INTO v_exploration_gain;
  UPDATE users SET exploration_points = exploration_points + v_exploration_gain WHERE id = p_user_id;

  SELECT energy_points INTO v_energy FROM users WHERE id = p_user_id;
  RETURN json_build_object(
    'success', true,
    'cost', v_cost,
    'energy', v_energy,
    'free', p_free,
    'gloryGain', v_glory_gain,
    'explorationGain', v_exploration_gain,
    'influenceGain', 0,
    'newInfluenceStock', (SELECT influence_stock FROM users WHERE id = p_user_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, NUMERIC) TO authenticated;
