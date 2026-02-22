-- Ajouter la colonne faction_pattern pour l'icone de faction dans le chat
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS faction_pattern TEXT;
