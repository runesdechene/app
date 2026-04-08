-- 066_notif_new_carnet.sql
-- Add new_carnet notifications to contribute_to_place
-- Destinataires : tous les explorateurs du lieu sauf l'auteur du recit

CREATE OR REPLACE FUNCTION public.contribute_to_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_type TEXT,
  p_content TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_exploration_gain INT := 0;
  v_erudition_gain INT := 0;
  v_contribution_id INT;
  v_place_title TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_actor_name TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
  v_explorer RECORD;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Fetch place + actor + faction info for activity_log
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = p_place_id;

  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM users WHERE id = p_user_id;

  SELECT color, pattern INTO v_faction_color, v_faction_pattern
  FROM factions WHERE id = v_faction_id;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, image_url)
  VALUES (p_place_id, p_user_id, v_faction_id, p_type, p_content, p_image_url)
  ON CONFLICT (place_id, user_id, type)
  DO UPDATE SET content = COALESCE(EXCLUDED.content, place_contributions.content),
               image_url = COALESCE(EXCLUDED.image_url, place_contributions.image_url),
               updated_at = NOW()
  RETURNING id INTO v_contribution_id;

  -- Gains perso (exploration + erudition)
  IF p_type = 'photo' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_photo'), 5) INTO v_exploration_gain;
  ELSIF p_type = 'carnet' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_carnet'), 5) INTO v_exploration_gain;
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'erudition_add_carnet'), 3) INTO v_erudition_gain;
  END IF;

  UPDATE users SET
    exploration_points = exploration_points + v_exploration_gain,
    erudition_points = erudition_points + v_erudition_gain
  WHERE id = p_user_id;

  -- Recalculer les content_points
  PERFORM recalc_place_content_points(p_place_id);

  -- Log activite pour les toasts
  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('contribute', p_user_id, p_place_id, v_faction_id,
    jsonb_build_object(
      'contributionType', p_type,
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern,
      'explorationGain', v_exploration_gain,
      'eruditionGain', v_erudition_gain
    ));

  -- Notification new_carnet : tous les explorateurs du lieu sauf l'auteur
  IF p_type = 'carnet' THEN
    FOR v_explorer IN
      SELECT user_id FROM place_explorers
      WHERE place_id = p_place_id AND user_id != p_user_id
    LOOP
      PERFORM notify(v_explorer.user_id, 'new_carnet', jsonb_build_object(
        'actorName', v_actor_name,
        'actorId', p_user_id,
        'placeId', p_place_id
      ));
    END LOOP;
  END IF;

  RETURN json_build_object(
    'success', true,
    'contributionId', v_contribution_id,
    'explorationGain', v_exploration_gain,
    'eruditionGain', v_erudition_gain
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.contribute_to_place(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
