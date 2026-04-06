-- ============================================================
-- MIGRATION 097 : Auto-claim à la création d'un lieu
-- ============================================================
-- Si le joueur a une faction, le lieu est automatiquement
-- revendiqué pour sa faction à la création. Gratuit (pas de coût).
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
BEGIN
  -- Auth guard
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Verify user exists + récupérer faction
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  -- Verify tag exists
  IF NOT EXISTS(SELECT 1 FROM tags WHERE id = p_tag_id) THEN
    RETURN json_build_object('error', 'Tag not found');
  END IF;

  -- Generate place ID
  v_new_id := gen_random_uuid()::TEXT;

  -- Build images JSONB (avec thumb si fourni)
  IF p_image_url IS NOT NULL AND p_image_url <> '' THEN
    v_img_obj := jsonb_build_object('id', gen_random_uuid()::TEXT, 'url', p_image_url);
    IF p_thumb_url IS NOT NULL AND p_thumb_url <> '' THEN
      v_img_obj := v_img_obj || jsonb_build_object('thumb', p_thumb_url);
    END IF;
    v_images := jsonb_build_array(v_img_obj);
  ELSE
    v_images := '[]'::JSONB;
  END IF;

  -- Insert place (auto-claim si faction)
  INSERT INTO places (
    id, created_at, updated_at,
    author_id, place_type_id,
    title, text, address,
    latitude, longitude,
    images, private, masked,
    faction_id, claimed_by, claimed_at
  ) VALUES (
    v_new_id, NOW(), NOW(),
    p_user_id, 'lieu',
    p_title, p_text, p_address,
    p_latitude, p_longitude,
    v_images, false, false,
    v_faction_id, CASE WHEN v_faction_id IS NOT NULL THEN p_user_id ELSE NULL END,
    CASE WHEN v_faction_id IS NOT NULL THEN NOW() ELSE NULL END
  );

  -- Insert primary tag
  INSERT INTO place_tags (place_id, tag_id, is_primary)
  VALUES (v_new_id, p_tag_id, true);

  -- Auto-discover (author discovers their own place)
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, v_new_id, 'gps')
  ON CONFLICT (user_id, place_id) DO NOTHING;

  -- Historique claim (si faction) — déclenche le trigger trg_log_claim
  IF v_faction_id IS NOT NULL THEN
    INSERT INTO place_claims (place_id, user_id, faction_id)
    VALUES (v_new_id, p_user_id, v_faction_id);
  END IF;

  -- Activity log new_place
  SELECT COALESCE(first_name, email_address) INTO v_actor_name
  FROM users WHERE id = p_user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'new_place',
    p_user_id,
    v_new_id,
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
    'claimed', v_faction_id IS NOT NULL,
    'factionId', v_faction_id
  );
END;
$$;
