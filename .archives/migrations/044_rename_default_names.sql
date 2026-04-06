-- ============================================
-- MIGRATION 044 : Renommer les noms par défaut
-- ============================================
-- Remplace "Aventurier" et "Intrépide" par "Un voyageur sans nom"

UPDATE users
SET first_name = 'Un voyageur sans nom'
WHERE first_name IN ('Aventurier', 'Intrépide');

UPDATE users
SET last_name = 'Un voyageur sans nom'
WHERE last_name IN ('Aventurier', 'Intrépide');
