-- ============================================
-- MIGRATION 183 : Lien Shopify ↔ Users
-- ============================================
-- Ajouter le lien vers le client Shopify sur chaque user
-- et la source du compte (app, shopify, both)

-- Lien vers le client Shopify
ALTER TABLE users ADD COLUMN IF NOT EXISTS shopify_customer_id BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_shopify_customer_id ON users(shopify_customer_id) WHERE shopify_customer_id IS NOT NULL;

-- Source du compte
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_source VARCHAR(20) DEFAULT 'app';
-- Valeurs : 'app' (inscrit via l'app), 'shopify' (importé de Shopify), 'both' (les deux)

-- Marquer les users existants comme source 'app'
UPDATE users SET account_source = 'app' WHERE account_source IS NULL;
