-- 009_enigmas_theme_column.sql
-- WHY : Ajouter un champ `theme` libre (sans FK) sur les énigmes pour
-- - Tag thématique permanent indépendant de la mécanique faction
-- - Permettre des énigmes transverses (heritage_id NULL, theme = 'grecque' / 'médiéval'...)
-- - Préparer de futurs achievements ("Expert nordique" si N énigmes du theme répondues)
-- - Si demain une faction émerge sur un theme, simple UPDATE ciblé pour lier
--
-- `heritage_id` reste FK sur factions (sémantique faction du jeu).
-- `theme` reste libre (sémantique tag culturel).

ALTER TABLE enigmas ADD COLUMN IF NOT EXISTS theme TEXT;

-- Backfill 1-pour-1 sur les 4 factions actuelles
UPDATE enigmas SET theme = 'celtique'  WHERE heritage_id = 'faction-celtique'  AND theme IS NULL;
UPDATE enigmas SET theme = 'nordique'  WHERE heritage_id = 'faction-nordique'  AND theme IS NULL;
UPDATE enigmas SET theme = 'romaine'   WHERE heritage_id = 'faction-romaine'   AND theme IS NULL;
UPDATE enigmas SET theme = 'byzantine' WHERE heritage_id = 'faction-byzantine' AND theme IS NULL;

-- Index pour les stats / futurs achievements (COUNT WHERE theme = X)
CREATE INDEX IF NOT EXISTS idx_enigmas_theme ON enigmas(theme);
