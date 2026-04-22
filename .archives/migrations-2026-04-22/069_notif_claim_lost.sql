-- 069_notif_claim_lost.sql
-- Add claim_lost notifications to the claim trigger
-- Destinataires : explorateurs du lieu de la faction qui a perdu l'emprise

CREATE OR REPLACE FUNCTION log_claim_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_title TEXT;
  v_faction_title TEXT;
  v_actor_name TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
  v_previous_faction TEXT;
  v_previous_claimed_by TEXT;
  v_actor_avatar TEXT;
  v_explorer RECORD;
BEGIN
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = NEW.place_id;

  SELECT title, color, pattern INTO v_faction_title, v_faction_color, v_faction_pattern
  FROM factions WHERE id = NEW.faction_id;

  SELECT COALESCE(display_name, first_name, 'Quelqu''un'), avatar_url
  INTO v_actor_name, v_actor_avatar
  FROM users WHERE id = NEW.user_id;

  -- Find previous claim (the one before this new one)
  SELECT faction_id, user_id INTO v_previous_faction, v_previous_claimed_by
  FROM place_claims
  WHERE place_id = NEW.place_id AND id != NEW.id
  ORDER BY created_at DESC
  LIMIT 1;

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
      'actorAvatarUrl', v_actor_avatar,
      'previousActorId', v_previous_claimed_by,
      'previousFactionId', v_previous_faction
    )
  );

  -- Notification claim_lost : explorateurs du lieu de la faction precedente
  IF v_previous_faction IS NOT NULL AND v_previous_faction != NEW.faction_id THEN
    FOR v_explorer IN
      SELECT pe.user_id FROM place_explorers pe
      JOIN users u ON u.id = pe.user_id
      WHERE pe.place_id = NEW.place_id
        AND u.faction_id = v_previous_faction
        AND pe.user_id != NEW.user_id
    LOOP
      PERFORM notify(v_explorer.user_id, 'claim_lost', jsonb_build_object(
        'placeId', NEW.place_id
      ));
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
