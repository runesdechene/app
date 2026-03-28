-- ============================================
-- MIGRATION 136 : Supprimer les tags inutilisés
-- ============================================

DELETE FROM tags WHERE id IN (
  'ff7ef112-119b-49d2-bae2-472f7c0ba0e9',
  'kD45LWnJdKiZ7yjZpNnj'
);
