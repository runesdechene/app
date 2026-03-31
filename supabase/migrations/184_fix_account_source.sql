-- ============================================
-- MIGRATION 184 : Corriger account_source
-- ============================================
-- 'both' = s'est connecté à l'app ET est client Shopify
-- 'shopify' = client Shopify qui ne s'est jamais connecté à l'app
-- 'app' = joueur app sans compte Shopify

-- Tous les profils avec un shopify_customer_id qui se sont connectés à l'app = 'both'
UPDATE users SET account_source = 'both'
WHERE shopify_customer_id IS NOT NULL
  AND (last_login_at IS NOT NULL OR faction_id IS NOT NULL);

-- Tous les profils avec un shopify_customer_id qui ne se sont JAMAIS connectés = 'shopify'
UPDATE users SET account_source = 'shopify'
WHERE shopify_customer_id IS NOT NULL
  AND last_login_at IS NULL
  AND faction_id IS NULL;

-- Les joueurs sans shopify = 'app'
UPDATE users SET account_source = 'app'
WHERE shopify_customer_id IS NULL;
