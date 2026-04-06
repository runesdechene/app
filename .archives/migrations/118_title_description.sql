-- ============================================
-- MIGRATION 118 : Description sur les titres
-- ============================================

ALTER TABLE titles ADD COLUMN IF NOT EXISTS description TEXT;
