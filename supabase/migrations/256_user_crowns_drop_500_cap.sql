-- 256_user_crowns_drop_500_cap.sql
-- WHY : La récompense manuelle admin (mig 255, award_crowns_manual) crédite SANS
-- plafond (don volontaire). Mais user_crowns.balance porte une contrainte
-- CHECK (balance >= 0 AND balance <= 500) depuis mig 021 → tout don dépassant 500
-- violait la contrainte et annulait le crédit (et l'email, et la notif).
-- On retire le plafond HAUT de la contrainte, on garde le plancher (>= 0).
-- Les flux AUTO (énigmes, UGC, quêtes…) restent plafonnés à 500 par leur propre
-- LEAST(500, …) — ce changement n'affecte donc QUE les dons manuels admin.

ALTER TABLE public.user_crowns DROP CONSTRAINT IF EXISTS user_crowns_balance_check;
ALTER TABLE public.user_crowns ADD CONSTRAINT user_crowns_balance_check CHECK (balance >= 0);
