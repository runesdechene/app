-- Migration 073 : table eras + colonnes era_id/year_exact sur places + mise à jour create_place RPC

-- ============================================================
-- 1. Table eras
-- ============================================================

CREATE TABLE IF NOT EXISTS public.eras (
  id         VARCHAR PRIMARY KEY,
  name       VARCHAR NOT NULL,
  year_start INTEGER,
  year_end   INTEGER,
  sort_order SMALLINT NOT NULL
);

INSERT INTO public.eras (id, name, year_start, year_end, sort_order) VALUES
  ('prehistory',          'Préhistoire',            NULL,  -3300, 1),
  ('bronze-age',          'Âge du Bronze',          -3300, -1200, 2),
  ('iron-age',            'Âge du Fer',             -1200, -500,  3),
  ('classical-antiquity', 'Antiquité classique',    -500,  476,   4),
  ('early-middle-ages',   'Haut Moyen Âge',         476,   1000,  5),
  ('late-middle-ages',    'Bas Moyen Âge',          1000,  1453,  6),
  ('renaissance',         'Renaissance',            1453,  1600,  7),
  ('early-modern',        'Époque moderne',         1600,  1789,  8),
  ('contemporary',        'Époque contemporaine',   1789,  1945,  9),
  ('post-1945',           'Monde post-1945',        1945,  2020,  10),
  ('digital-era',         'Ère digitale',           2020,  NULL,  11)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.eras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eras_read" ON public.eras FOR SELECT USING (true);

-- ============================================================
-- 2. Colonnes sur places
-- ============================================================

ALTER TABLE public.places ADD COLUMN IF NOT EXISTS era_id VARCHAR REFERENCES public.eras(id);
ALTER TABLE public.places ADD COLUMN IF NOT EXISTS year_exact INTEGER;

-- ============================================================
-- 3. Mise à jour de la RPC create_place
-- ============================================================

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
  p_user_lng   REAL DEFAULT NULL,
  p_carnet_title TEXT DEFAULT NULL,
  p_era_id       TEXT DEFAULT NULL,
  p_year_exact   INTEGER DEFAULT NULL
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

  IF p_image_url IS NOT NULL AND p_image_url <> '' THEN
    v_img_obj := jsonb_build_object('id', gen_random_uuid()::TEXT, 'url', p_image_url);
    IF p_thumb_url IS NOT NULL AND p_thumb_url <> '' THEN
      v_img_obj := v_img_obj || jsonb_build_object('thumb', p_thumb_url);
    END IF;
    v_images := jsonb_build_array(v_img_obj);
  ELSE
    v_images := '[]'::JSONB;
  END IF;

  INSERT INTO places (
    id, created_at, updated_at,
    author_id, place_type_id,
    title, text, address,
    latitude, longitude,
    images, private, masked,
    era_id, year_exact
  ) VALUES (
    v_new_id, NOW(), NOW(),
    p_user_id, 'lieu',
    p_title, p_text, p_address,
    p_latitude, p_longitude,
    v_images, false, false,
    p_era_id, p_year_exact
  );

  INSERT INTO place_tags (place_id, tag_id, is_primary)
  VALUES (v_new_id, p_tag_id, true);

  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, v_new_id, CASE WHEN v_is_gps THEN 'gps' ELSE 'author' END)
  ON CONFLICT (user_id, place_id) DO NOTHING;

  UPDATE users SET exploration_points = exploration_points + 5
  WHERE id = p_user_id;

  IF v_is_gps THEN
    v_influence_gain := 30;
    UPDATE users SET exploration_points = exploration_points + 10
    WHERE id = p_user_id;
    INSERT INTO place_influence (place_id, faction_id, permanent_points, updated_at)
    VALUES (v_new_id, v_faction_id, v_influence_gain, NOW())
    ON CONFLICT (place_id, faction_id)
    DO UPDATE SET permanent_points = place_influence.permanent_points + v_influence_gain,
                 updated_at = NOW();
    INSERT INTO place_explorers (place_id, user_id)
    VALUES (v_new_id, p_user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  v_content_pts := 10;
  IF jsonb_array_length(v_images) > 0 THEN
    v_content_pts := v_content_pts + 10;
  END IF;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, title, content, images, created_at)
  VALUES (
    v_new_id, p_user_id, v_faction_id, 'carnet',
    NULLIF(TRIM(COALESCE(p_carnet_title, '')), ''),
    COALESCE(NULLIF(TRIM(p_text), ''), 'Lieu découvert.'),
    COALESCE(
      (SELECT jsonb_agg(img->>'url') FROM jsonb_array_elements(v_images) AS img WHERE img->>'url' IS NOT NULL),
      '[]'::jsonb
    ),
    NOW()
  )
  ON CONFLICT (place_id, user_id, type) DO NOTHING;

  PERFORM recalc_place_content_points(v_new_id);

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
      'isGps', v_is_gps,
      'permanent', v_is_gps
    )
  );

  RETURN json_build_object(
    'success', true,
    'placeId', v_new_id,
    'isGps', v_is_gps,
    'rewards', json_build_object(
      'permanentInfluence', v_influence_gain,
      'explorationGain', CASE WHEN v_is_gps THEN 15 ELSE 5 END,
      'contentPoints', v_content_pts,
      'isExplorer', v_is_gps
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_place(TEXT, TEXT, REAL, REAL, TEXT, TEXT, TEXT, TEXT, TEXT, REAL, REAL, TEXT, TEXT, INTEGER) TO authenticated;
