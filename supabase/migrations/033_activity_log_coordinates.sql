-- ============================================
-- MIGRATION 033 : Ajouter coordonnées aux triggers activity_log
-- ============================================
-- Pour permettre le clic sur un toast → fly to sur la carte
-- ============================================

-- 1. Trigger claim : ajouter latitude/longitude

CREATE OR REPLACE FUNCTION log_claim_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_title TEXT;
  v_place_lat DOUBLE PRECISION;
  v_place_lng DOUBLE PRECISION;
  v_faction_title TEXT;
  v_actor_name TEXT;
BEGIN
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = NEW.place_id;
  SELECT title INTO v_faction_title FROM factions WHERE id = NEW.faction_id;
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = NEW.user_id;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'claim',
    NEW.user_id,
    NEW.place_id,
    NEW.faction_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'factionTitle', v_faction_title,
      'actorName', v_actor_name
    )
  );
  RETURN NEW;
END;
$$;

-- 2. Trigger discover : ajouter latitude/longitude

CREATE OR REPLACE FUNCTION log_discover_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_title TEXT;
  v_place_lat DOUBLE PRECISION;
  v_place_lng DOUBLE PRECISION;
  v_actor_name TEXT;
BEGIN
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = NEW.place_id;
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = NEW.user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'discover',
    NEW.user_id,
    NEW.place_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name
    )
  );
  RETURN NEW;
END;
$$;
