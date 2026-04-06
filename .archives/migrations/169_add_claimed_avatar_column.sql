-- ============================================
-- MIGRATION 169 : Ajouter la colonne claimed_avatar_url sur places
-- ============================================
ALTER TABLE places ADD COLUMN IF NOT EXISTS claimed_avatar_url TEXT;
