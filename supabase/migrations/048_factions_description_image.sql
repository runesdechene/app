-- ============================================
-- 048 : Ajout description + image_url sur factions
-- ============================================

ALTER TABLE factions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS image_url TEXT;
