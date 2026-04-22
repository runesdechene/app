-- 050_create_place_no_remote_influence.sql
-- Créer un lieu à distance ne donne plus le bonus d'influence (80 pts).
-- Le bonus n'est accordé que si le joueur est sur place (GPS < 500m).
-- Le créateur voit toujours le lieu (places_discovered) mais avec method='author' si distant.

CREATE OR REPLACE FUNCTION public.create_place(
  p_user_id    TEXT,
  p_title      TEXT,
  p_latitude   REAL,
  p_longitude  REAL,
  p_tag_id     TEXT,
  p_image_url  TEXT DEFAULT NULL,
  p_thumb_url  TEXT DEFAULT NULL,
  p_address    TEXT DEFAULT '',
  p_text       TEXT DEFAULT '',
  p_user_lat   REAL DEFAULT NULL,
  p_user_lng   REAL DEFAULT NULL
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
  v_influence_gain INT := 0;
  v_content_pts INT;
  v_is_gps     BOOLEAN := FALSE;
  v_distance_km NUMERIC;
  v_gps_radius  NUMERIC;
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

  -- Déterminer si le joueur est sur place (GPS)
  SELECT COALESCE((SELECT value::NUMERIC FROM app_settings WHERE key = 'distance_gps_km'), 0.5)
  INTO v_gps_radius;

  IF p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
    v_distance_km := 6371 * acos(
      LEAST(1, GREATEST(-1,
        cos(radians(p_user_lat)) * cos(radians(p_latitude))
        * cos(radians(p_longitude) - radians(p_user_lng))
        + sin(radians(p_user_lat)) * sin(radians(p_latitude))
      ))
    );
    v_is_gps := v_distance_km <= v_gps_radius;
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

  -- Insert place
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

  -- Créateur voit le lieu (pas de brouillard), method = gps ou author
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, v_new_id, CASE WHEN v_is_gps THEN 'gps' ELSE 'author' END)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- Influence stock : uniquement si sur place (GPS)
  IF v_is_gps THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_add_place'), 80)
    INTO v_influence_gain;

    UPDATE users SET
      influence_stock = influence_stock + v_influence_gain,
      exploration_points = exploration_points + 5
    WHERE id = p_user_id;
  ELSE
    -- Création à distance : seulement les 5 pts exploration de base
    UPDATE users SET
      exploration_points = exploration_points + 5
    WHERE id = p_user_id;
  END IF;

  -- Auto-create carnet contribution
  v_content_pts := 10;
  IF jsonb_array_length(v_images) > 0 THEN
    v_content_pts := v_content_pts + 10;
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

  -- Content influence for creator's faction
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
      'actorName', v_actor_name,
      'isGps', v_is_gps
    )
  );

  RETURN json_build_object(
    'success', true,
    'placeId', v_new_id,
    'influenceGain', v_influence_gain,
    'contentPoints', v_content_pts,
    'isGps', v_is_gps
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_place(TEXT, TEXT, REAL, REAL, TEXT, TEXT, TEXT, TEXT, TEXT, REAL, REAL) TO authenticated;

-- Supprimer l'ancienne signature (9 params) pour éviter l'ambiguïté
DROP FUNCTION IF EXISTS public.create_place(TEXT, TEXT, REAL, REAL, TEXT, TEXT, TEXT, TEXT, TEXT);
