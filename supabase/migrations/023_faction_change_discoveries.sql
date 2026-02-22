-- Migration 023 : Fix découvertes lors du changement de faction
--
-- 1. claim_place : auto-découvrir le lieu revendiqué
-- 2. set_user_faction : solidifier les découvertes de l'ancienne faction avant de changer

-- ============================================
-- 1. claim_place — ajouter INSERT places_discovered
-- ============================================

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
BEGIN
  -- Récupérer la faction du user
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;

  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'User has no faction');
  END IF;

  -- Vérifier que le lieu existe
  IF NOT EXISTS(SELECT 1 FROM places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'Place not found');
  END IF;

  -- Revendiquer le lieu
  UPDATE places
  SET faction_id = v_faction_id,
      claimed_by = p_user_id,
      claimed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_place_id;

  -- Historique
  INSERT INTO place_claims (place_id, user_id, faction_id)
  VALUES (p_place_id, p_user_id, v_faction_id);

  -- Auto-découvrir le lieu (idempotent)
  INSERT INTO places_discovered (user_id, place_id, method)
  VALUES (p_user_id, p_place_id, 'remote')
  ON CONFLICT (user_id, place_id) DO NOTHING;

  RETURN json_build_object(
    'success', true,
    'factionId', v_faction_id
  );
END;
$$;

-- ============================================
-- 2. set_user_faction — solidifier les découvertes
-- ============================================

CREATE OR REPLACE FUNCTION public.set_user_faction(
  p_user_id TEXT,
  p_faction_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_faction_id TEXT;
BEGIN
  -- Vérifier que la faction existe (ou null pour quitter)
  IF p_faction_id IS NOT NULL THEN
    IF NOT EXISTS(SELECT 1 FROM factions WHERE id = p_faction_id) THEN
      RETURN json_build_object('error', 'Faction not found');
    END IF;
  END IF;

  -- Récupérer l'ancienne faction
  SELECT faction_id INTO v_old_faction_id FROM users WHERE id = p_user_id;

  -- Solidifier : tous les lieux de l'ancienne faction deviennent des découvertes explicites
  IF v_old_faction_id IS NOT NULL THEN
    INSERT INTO places_discovered (user_id, place_id, method)
    SELECT p_user_id, p.id, 'remote'
    FROM places p
    WHERE p.faction_id = v_old_faction_id
    ON CONFLICT (user_id, place_id) DO NOTHING;
  END IF;

  UPDATE users SET faction_id = p_faction_id, updated_at = NOW() WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;
