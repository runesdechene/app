-- ============================================
-- MIGRATION 060 : Ajouter couleur faction au trigger fortify
-- ============================================

CREATE OR REPLACE FUNCTION public.log_fortify_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_name TEXT;
  v_place_title TEXT;
  v_place_lat DOUBLE PRECISION;
  v_place_lng DOUBLE PRECISION;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
BEGIN
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = NEW.claimed_by;
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng FROM places WHERE id = NEW.id;
  SELECT color, pattern INTO v_faction_color, v_faction_pattern FROM factions WHERE id = NEW.faction_id;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES (
    'fortify',
    NEW.claimed_by,
    NEW.id,
    NEW.faction_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'placeLatitude', v_place_lat,
      'placeLongitude', v_place_lng,
      'actorName', v_actor_name,
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern,
      'fortificationLevel', NEW.fortification_level
    )
  );

  RETURN NEW;
END;
$$;
