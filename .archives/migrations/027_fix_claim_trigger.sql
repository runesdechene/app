-- ============================================
-- MIGRATION 027 : Fix claim trigger + new_user trigger
-- ============================================
-- 1. Fix log_claim_activity : NEW.claimed_by → NEW.user_id
-- 2. Trigger new_user sur INSERT users → activity_log
-- ============================================

-- 1. Fix claim trigger

CREATE OR REPLACE FUNCTION log_claim_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_title TEXT;
  v_faction_title TEXT;
  v_actor_name TEXT;
BEGIN
  SELECT title INTO v_place_title FROM places WHERE id = NEW.place_id;
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
      'factionTitle', v_faction_title,
      'actorName', v_actor_name
    )
  );
  RETURN NEW;
END;
$$;

-- 2. Trigger : nouveau user → activity_log

CREATE OR REPLACE FUNCTION log_new_user_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_name TEXT;
BEGIN
  v_name := COALESCE(NEW.first_name, NEW.email_address);

  INSERT INTO activity_log (type, actor_id, data)
  VALUES (
    'new_user',
    NEW.id,
    jsonb_build_object('actorName', v_name)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_new_user ON users;
CREATE TRIGGER trg_log_new_user
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION log_new_user_activity();
