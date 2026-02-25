-- ============================================
-- MIGRATION 059 : Backfill author discoveries
-- ============================================
-- Chaque auteur decouvre automatiquement ses propres lieux.
-- create_place le fait deja depuis la migration 053, mais les
-- lieux crees avant cette migration n'ont pas ete marques.
--
-- IMPORTANT : desactiver le trigger activity_log pour eviter
-- de creer des milliers de fausses notifications.
-- ============================================

-- Desactiver le trigger avant le backfill
ALTER TABLE places_discovered DISABLE TRIGGER trg_log_discover;

INSERT INTO places_discovered (user_id, place_id, method, discovered_at)
SELECT p.author_id, p.id, 'gps', p.created_at
FROM places p
WHERE p.author_id IS NOT NULL
ON CONFLICT (user_id, place_id) DO NOTHING;

-- Reactiver le trigger
ALTER TABLE places_discovered ENABLE TRIGGER trg_log_discover;
