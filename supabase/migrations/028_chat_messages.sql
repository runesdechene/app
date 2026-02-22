-- ============================================
-- MIGRATION 028 : Chat Messages (La Discussion)
-- ============================================
-- Table de messages pour le chat en jeu.
-- Deux canaux : 'general' (tous) et faction_id (faction only).
-- Auto-suppression apres 14 jours via RPC.
-- ============================================

-- 1. Table
CREATE TABLE IF NOT EXISTS chat_messages (
  id            BIGSERIAL PRIMARY KEY,
  channel       VARCHAR(255) NOT NULL,       -- 'general' ou faction_id
  user_id       VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name     VARCHAR(255) NOT NULL,       -- denormalise pour perf affichage
  faction_id    VARCHAR(255) REFERENCES factions(id),
  faction_color VARCHAR(50),                 -- denormalise
  faction_pattern TEXT,                      -- URL icone faction (denormalise)
  content       TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Index pour requetes par channel + tri chrono
CREATE INDEX idx_chat_channel_created ON chat_messages(channel, created_at DESC);

-- 3. RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- SELECT general : tous les authentifies
CREATE POLICY "chat_read_general" ON chat_messages FOR SELECT
  USING (channel = 'general' AND auth.role() = 'authenticated');

-- SELECT faction : membres uniquement
CREATE POLICY "chat_read_faction" ON chat_messages FOR SELECT
  USING (
    channel != 'general'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::text
        AND faction_id = chat_messages.channel
    )
  );

-- INSERT general : authentifie, son propre user_id
CREATE POLICY "chat_insert_general" ON chat_messages FOR INSERT
  WITH CHECK (
    channel = 'general'
    AND auth.uid()::text = user_id
  );

-- INSERT faction : membre de la faction, son propre user_id
CREATE POLICY "chat_insert_faction" ON chat_messages FOR INSERT
  WITH CHECK (
    channel != 'general'
    AND auth.uid()::text = user_id
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()::text
        AND faction_id = channel
    )
  );

-- 4. Activer Realtime sur cette table
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- 5. Nettoyage des messages > 14 jours (appele periodiquement)
CREATE OR REPLACE FUNCTION public.cleanup_old_chat_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM chat_messages
  WHERE created_at < NOW() - INTERVAL '14 days';
END;
$$;
