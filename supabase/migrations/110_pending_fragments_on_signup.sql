-- ============================================
-- MIGRATION 110 : Deblocage automatique des fragments pending au signup
-- ============================================
-- Quand un joueur se connecte pour la premiere fois, on verifie
-- si des fragments sont en attente pour son email dans purchase_log.
-- Si oui, on les debloque automatiquement.
-- ============================================

CREATE OR REPLACE FUNCTION public.unlock_pending_fragments(p_user_id TEXT, p_email TEXT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
  v_row RECORD;
BEGIN
  FOR v_row IN
    SELECT id, unlock_ref_id
    FROM purchase_log
    WHERE email = p_email
      AND status = 'pending'
      AND unlock_type = 'fragment'
  LOOP
    -- Inserer le fragment (ignore si deja present)
    INSERT INTO user_fragments (user_id, fragment_id, source)
    VALUES (p_user_id, v_row.unlock_ref_id, 'shopify')
    ON CONFLICT (user_id, fragment_id) DO NOTHING;

    -- Mettre a jour le log
    UPDATE purchase_log
    SET user_id = p_user_id, status = 'unlocked'
    WHERE id = v_row.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlock_pending_fragments(TEXT, TEXT) TO authenticated;
