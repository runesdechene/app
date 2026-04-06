-- ============================================
-- MIGRATION 058 : RPC rename_faction
-- ============================================
-- Permet de renommer l'ID (handle) d'une faction.
-- Cascade sur toutes les tables qui referent factions(id).
-- ============================================

CREATE OR REPLACE FUNCTION public.rename_faction(
  p_old_id TEXT,
  p_new_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verifier que l'ancien ID existe
  IF NOT EXISTS(SELECT 1 FROM factions WHERE id = p_old_id) THEN
    RETURN json_build_object('error', 'Faction not found');
  END IF;

  -- Verifier que le nouvel ID n'existe pas deja
  IF EXISTS(SELECT 1 FROM factions WHERE id = p_new_id) THEN
    RETURN json_build_object('error', 'ID already exists');
  END IF;

  -- 1. Inserer la nouvelle faction (copie de l'ancienne)
  INSERT INTO factions (id, title, color, pattern, description, image_url, "order",
    bonus_energy, bonus_conquest, bonus_construction,
    bonus_regen_energy, bonus_regen_conquest, bonus_regen_construction,
    created_at, updated_at)
  SELECT p_new_id, title, color, pattern, description, image_url, "order",
    bonus_energy, bonus_conquest, bonus_construction,
    bonus_regen_energy, bonus_regen_conquest, bonus_regen_construction,
    created_at, NOW()
  FROM factions WHERE id = p_old_id;

  -- 2. Mettre a jour toutes les references
  UPDATE users SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE places SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE place_claims SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE activity_log SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE chat_messages SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE titles SET faction_id = p_new_id WHERE faction_id = p_old_id;

  -- 3. Supprimer l'ancienne faction
  DELETE FROM factions WHERE id = p_old_id;

  RETURN json_build_object('success', true, 'newId', p_new_id);
END;
$$;
