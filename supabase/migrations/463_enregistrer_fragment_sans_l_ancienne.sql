-- 463 — enregistrer_fragment : l'ancienne version à cinq paramètres part
--
-- WHY : la mig 461 avait ajouté la version à six (avec p_theme, la culture) à côté de l'ancienne,
--   le temps de déployer le Hub. Le Hub déployé le 08/10/2026 n'appelle plus que la nouvelle.
--   Vérifié à la main le 08/10 : un seul appel dans le dépôt (apps/hub/…/FragmentsShopify.tsx,
--   avec p_theme), aucun dans le thème Shopify, aucun appel interne en SQL ; le Hub en ligne sert
--   le build local. Retirée du registre de purge (docs/v2/purge-back.md).

DROP FUNCTION IF EXISTS public.enregistrer_fragment(integer, double precision, double precision, text, boolean);
