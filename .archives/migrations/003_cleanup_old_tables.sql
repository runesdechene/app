-- ============================================
-- NETTOYAGE : Suppression des anciennes tables Shopify/IVY
-- ============================================
-- A executer dans Supabase SQL Editor
-- Ces tables ne sont plus utilisees depuis la simplification du HUB.

-- Supprimer les policies d'abord
DROP POLICY IF EXISTS "Admin full access on hub_transactions" ON hub_transactions;
DROP POLICY IF EXISTS "Admin full access on hub_reward_rules" ON hub_reward_rules;
DROP POLICY IF EXISTS "Admin full access on hub_user_badges" ON hub_user_badges;
DROP POLICY IF EXISTS "Admin full access on hub_promo_codes" ON hub_promo_codes;
DROP POLICY IF EXISTS "Admin full access on hub_transaction_items" ON hub_transaction_items;

-- Supprimer les triggers
DROP TRIGGER IF EXISTS trigger_hub_transactions_updated_at ON hub_transactions;

-- Supprimer les fonctions
DROP FUNCTION IF EXISTS update_hub_transactions_updated_at();
DROP FUNCTION IF EXISTS generate_promo_code();
DROP FUNCTION IF EXISTS increment_user_purchases(VARCHAR);
DROP FUNCTION IF EXISTS find_badges_for_illustrations(TEXT[]);
DROP FUNCTION IF EXISTS assign_transaction_badges(VARCHAR, UUID, TEXT[]);
DROP FUNCTION IF EXISTS get_user_badges(VARCHAR);
DROP FUNCTION IF EXISTS get_user_order_history(VARCHAR);

-- Supprimer les tables (ordre important pour les FK)
DROP TABLE IF EXISTS hub_transaction_items CASCADE;
DROP TABLE IF EXISTS hub_promo_codes CASCADE;
DROP TABLE IF EXISTS hub_user_badges CASCADE;
DROP TABLE IF EXISTS hub_badge_mappings CASCADE;
DROP TABLE IF EXISTS hub_reward_rules CASCADE;
DROP TABLE IF EXISTS hub_transactions CASCADE;

-- Supprimer les colonnes Shopify/IVY de la table users
ALTER TABLE users DROP COLUMN IF EXISTS shopify_customer_id;
ALTER TABLE users DROP COLUMN IF EXISTS ivy_customer_id;
ALTER TABLE users DROP COLUMN IF EXISTS total_purchases;
ALTER TABLE users DROP COLUMN IF EXISTS total_spent;
