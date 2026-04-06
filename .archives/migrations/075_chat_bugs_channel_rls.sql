-- ============================================
-- MIGRATION 075 : RLS pour le canal chat 'bugs'
-- ============================================
-- Le canal 'bugs' n'est ni 'general' ni un faction_id.
-- Les policies existantes le bloquaient car la policy faction
-- exigeait faction_id = 'bugs' qui n'existe pas.
-- ============================================

-- SELECT bugs : tous les authentifies
CREATE POLICY "chat_read_bugs" ON chat_messages FOR SELECT
  USING (channel = 'bugs' AND auth.role() = 'authenticated');

-- INSERT bugs : authentifie, son propre user_id
CREATE POLICY "chat_insert_bugs" ON chat_messages FOR INSERT
  WITH CHECK (
    channel = 'bugs'
    AND auth.uid()::text = user_id
  );

-- Corriger la policy faction pour exclure 'bugs'
-- (sinon elle match channel != 'general' et echoue sur le check faction_id)
DROP POLICY IF EXISTS "chat_read_faction" ON chat_messages;
CREATE POLICY "chat_read_faction" ON chat_messages FOR SELECT
  USING (
    channel NOT IN ('general', 'bugs')
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::text
        AND faction_id = chat_messages.channel
    )
  );

DROP POLICY IF EXISTS "chat_insert_faction" ON chat_messages;
CREATE POLICY "chat_insert_faction" ON chat_messages FOR INSERT
  WITH CHECK (
    channel NOT IN ('general', 'bugs')
    AND auth.uid()::text = user_id
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::text
        AND faction_id = channel
    )
  );
