-- ============================================
-- MIGRATION 185 : Fix account_source v2
-- ============================================
-- Le critère last_login_at/faction_id était trop strict.
-- Le vrai critère : l'ID est un UUID (créé par auth Supabase) = joueur app.
-- L'ID commence par 'shopify-' = importé de Shopify, jamais connecté.

-- Vrais joueurs app qui sont aussi clients Shopify = 'both'
UPDATE users SET account_source = 'both'
WHERE shopify_customer_id IS NOT NULL
  AND id NOT LIKE 'shopify-%';

-- Profils importés de Shopify (jamais connectés à l'app) = 'shopify'
UPDATE users SET account_source = 'shopify'
WHERE id LIKE 'shopify-%';

-- Joueurs app sans lien Shopify = 'app'
UPDATE users SET account_source = 'app'
WHERE shopify_customer_id IS NULL
  AND id NOT LIKE 'shopify-%';
