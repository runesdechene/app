-- ============================================
-- MIGRATION 035 : Trigger like → activity_log
-- ============================================

CREATE OR REPLACE FUNCTION log_like_activity()
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
    'like',
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

DROP TRIGGER IF EXISTS trg_log_like ON places_liked;
CREATE TRIGGER trg_log_like
  AFTER INSERT ON places_liked
  FOR EACH ROW
  EXECUTE FUNCTION log_like_activity();
