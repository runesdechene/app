-- 195_v05_users_new_columns.sql
-- V0.5 : ajout exploration_points, erudition_points, influence_stock
-- Additif pur — ne modifie aucune colonne existante

ALTER TABLE users ADD COLUMN IF NOT EXISTS exploration_points INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS erudition_points INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS influence_stock INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN users.exploration_points IS 'Rang terrain permanent. +N par découverte, ajout lieu, visite GPS, photo, description.';
COMMENT ON COLUMN users.erudition_points IS 'Rang savoir permanent. +N par énigme (quotidienne ou de lieu).';
COMMENT ON COLUMN users.influence_stock IS 'Stock d influence dépensable sur les lieux. Gagné via énigmes, contributions, visites.';

-- Index pour le leaderboard
CREATE INDEX IF NOT EXISTS idx_users_glory ON users ((exploration_points + erudition_points) DESC);
