-- ============================================
-- MIGRATION 192 : Supprimer account_source = 'both'
-- ============================================
-- La source indique D'OU vient le compte : 'app' ou 'shopify'.
-- 'both' n'a pas de sens — un compte est créé à UN endroit.
-- Le lien Shopify se voit via shopify_customer_id (non null = client).
--
-- Règle : si l'id commence par 'shopify-' → source shopify, sinon → app.
-- ============================================

-- Corriger tous les 'both' : la vraie source dépend de comment l'ID a été créé
UPDATE users SET account_source = 'shopify' WHERE account_source = 'both' AND id LIKE 'shopify-%';
UPDATE users SET account_source = 'app' WHERE account_source = 'both' AND id NOT LIKE 'shopify-%';

-- Sécurité : mettre à jour le CHECK constraint pour interdire 'both'
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_source_check;
ALTER TABLE users ADD CONSTRAINT users_account_source_check
  CHECK (account_source IN ('app', 'shopify'));
