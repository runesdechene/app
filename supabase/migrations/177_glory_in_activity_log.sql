-- ============================================
-- MIGRATION 177 : Ajouter gloryGain dans les activity_log
-- ============================================
-- Le trigger claim lit glory_claim + glory_cost_bonus_pct depuis app_settings
-- et calcule une estimation du gain de Gloire pour l'afficher dans les toasts

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
  v_faction_color TEXT;
  v_faction_pattern TEXT;
  v_actor_name TEXT;
  v_glory_base INT;
  v_previous_faction TEXT;
  v_previous_actor TEXT;
  v_previous_actor_name TEXT;
BEGIN
  SELECT title, latitude, longitude, faction_id, claimed_by
  INTO v_place_title, v_place_lat, v_place_lng, v_previous_faction, v_previous_actor
  FROM places WHERE id = NEW.place_id;
  SELECT title, color, pattern INTO v_faction_title, v_faction_color, v_faction_pattern
  FROM factions WHERE id = NEW.faction_id;
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = NEW.user_id;
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'glory_claim'), 5) INTO v_glory_base;

  IF v_previous_actor IS NOT NULL AND v_previous_actor != NEW.user_id THEN
    SELECT COALESCE(first_name, email_address) INTO v_previous_actor_name FROM users WHERE id = v_previous_actor;
  END IF;

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
      'factionColor', v_faction_color,
      'factionPattern', v_faction_pattern,
      'actorName', v_actor_name,
      'gloryGain', v_glory_base,
      'previousFactionId', v_previous_faction,
      'previousActorId', v_previous_actor,
      'previousActorName', v_previous_actor_name
    )
  );
  RETURN NEW;
END;
$$;
