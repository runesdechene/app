-- ============================================
-- MIGRATION 064 : Notification "territoire perdu"
-- ============================================
-- Quand un joueur conquiert un lieu deja controle, l'ancien
-- controleur recoit une notification.
-- On stocke l'ancien proprietaire dans place_claims et on
-- l'inclut dans l'activity_log via le trigger.
-- ============================================

-- 1. Colonnes historique ancien controleur
ALTER TABLE place_claims ADD COLUMN IF NOT EXISTS previous_faction_id VARCHAR(255);
ALTER TABLE place_claims ADD COLUMN IF NOT EXISTS previous_claimed_by VARCHAR(255);

-- 2. MAJ claim_place : capturer l'ancien proprio AVANT l'update
CREATE OR REPLACE FUNCTION public.claim_place(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_prev_faction_id TEXT;
  v_prev_claimed_by TEXT;
BEGIN
  -- Recuperer la faction du user
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;

  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Verifier que le lieu existe
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Capturer l'ancien controleur AVANT l'update
  SELECT faction_id, claimed_by
  INTO v_prev_faction_id, v_prev_claimed_by
  FROM places WHERE id = p_place_id;

  -- Revendiquer le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Historique (avec ancien proprio)
  INSERT INTO place_claims (place_id, user_id, faction_id, previous_faction_id, previous_claimed_by)
  VALUES (p_place_id, p_user_id, v_faction_id, v_prev_faction_id, v_prev_claimed_by);

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id
  );
END;
$$;

-- 3. MAJ trigger : inclure l'ancien controleur dans activity_log.data
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
  v_prev_faction_title TEXT;
  v_prev_claimer_name TEXT;
BEGIN
  SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
  FROM places WHERE id = NEW.place_id;
  SELECT title, color, pattern INTO v_faction_title, v_faction_color, v_faction_pattern
  FROM factions WHERE id = NEW.faction_id;
  SELECT COALESCE(first_name, email_address) INTO v_actor_name FROM users WHERE id = NEW.user_id;

  -- Ancien controleur (si le lieu etait deja revendique)
  IF NEW.previous_faction_id IS NOT NULL THEN
    SELECT title INTO v_prev_faction_title FROM factions WHERE id = NEW.previous_faction_id;
  END IF;
  IF NEW.previous_claimed_by IS NOT NULL THEN
    SELECT COALESCE(first_name, email_address) INTO v_prev_claimer_name FROM users WHERE id = NEW.previous_claimed_by;
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
      'previousClaimedBy', NEW.previous_claimed_by,
      'previousFactionId', NEW.previous_faction_id,
      'previousFactionTitle', v_prev_faction_title,
      'previousClaimerName', v_prev_claimer_name
    )
  );
  RETURN NEW;
END;
$$;
