-- ============================================
-- MIGRATION 156 : Image dédiée pour les compétences
-- ============================================

ALTER TABLE title_fragments ADD COLUMN IF NOT EXISTS ability_icon_url TEXT DEFAULT NULL;
