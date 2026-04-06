-- ============================================
-- MIGRATION 045 : Trigger explore → activity_log
-- ============================================

CREATE OR REPLACE FUNCTION log_explore_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_title TEXT;
  v_actor_name TEXT;
  v_lat DOUBLE PRECISION;
  v_lng DOUBLE PRECISION;
BEGIN
  SELECT title, latitude, longitude
  INTO v_place_title, v_lat, v_lng
  FROM places WHERE id = NEW.place_id;

  SELECT COALESCE(first_name, email_address)
  INTO v_actor_name
  FROM users WHERE id = NEW.user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'explore',
    NEW.user_id,
    NEW.place_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'actorName', v_actor_name,
      'placeLatitude', v_lat,
      'placeLongitude', v_lng
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_explore ON places_explored;
CREATE TRIGGER trg_log_explore
  AFTER INSERT ON places_explored
  FOR EACH ROW
  EXECUTE FUNCTION log_explore_activity();
