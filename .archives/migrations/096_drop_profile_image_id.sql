-- ============================================================
-- MIGRATION 096 : Supprimer la colonne profile_image_id
-- ============================================================
-- Après migration 095 (backfill avatar_url + simplification RPCs),
-- profile_image_id n'est plus référencé nulle part.
-- On le supprime pour éviter toute confusion future.
-- ============================================================

ALTER TABLE users DROP COLUMN IF EXISTS profile_image_id;
