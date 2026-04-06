-- ============================================
-- MIGRATION 026 : Activity Log (notifications)
-- ============================================
-- Table d'historique des actions de jeu.
-- Triggers automatiques sur claim et discover.
-- RPC pour recuperer l'activite recente.
-- ============================================

-- 1. Table

CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  type VARCHAR(30) NOT NULL,
  actor_id VARCHAR(255) REFERENCES users(id),
  place_id VARCHAR(255) REFERENCES places(id),
  faction_id VARCHAR(255) REFERENCES factions(id),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log(type);

-- 2. Trigger : claim → activity_log

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

DROP TRIGGER IF EXISTS trg_log_claim ON place_claims;
CREATE TRIGGER trg_log_claim
  AFTER INSERT ON place_claims
  FOR EACH ROW
  EXECUTE FUNCTION log_claim_activity();

-- 3. Trigger : discover → activity_log

CREATE OR REPLACE FUNCTION log_discover_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_place_title TEXT;
  v_actor_name TEXT;
BEGIN
  SELECT title INTO v_place_title FROM places WHERE id = NEW.place_id;
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = NEW.user_id;

  INSERT INTO activity_log (type, actor_id, place_id, data)
  VALUES (
    'discover',
    NEW.user_id,
    NEW.place_id,
    jsonb_build_object(
      'placeTitle', v_place_title,
      'actorName', v_actor_name
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_discover ON places_discovered;
CREATE TRIGGER trg_log_discover
  AFTER INSERT ON places_discovered
  FOR EACH ROW
  EXECUTE FUNCTION log_discover_activity();

-- 4. RPC : activite recente

CREATE OR REPLACE FUNCTION public.get_recent_activity(
  p_limit INT DEFAULT 20
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(t))
    FROM (
      SELECT
        a.id,
        a.type,
        a.actor_id,
        a.place_id,
        a.faction_id,
        a.data,
        a.created_at
      FROM activity_log a
      ORDER BY a.created_at DESC
      LIMIT p_limit
    ) t
  );
END;
$$;
