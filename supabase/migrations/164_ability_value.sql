-- ============================================
-- MIGRATION 164 : Valeur configurable pour les compétences
-- ============================================
-- Permet de configurer le % de réduction pour discount_claim, discount_discover, etc.

ALTER TABLE title_fragments ADD COLUMN IF NOT EXISTS ability_value NUMERIC(5,2) DEFAULT 0;
