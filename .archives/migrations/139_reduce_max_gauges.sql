-- ============================================
-- MIGRATION 139 : Réduire le max par défaut à 3 pour les 4 jauges
-- ============================================
-- Avec 4 jauges au lieu de 3, il faut réduire le max par défaut
-- pour que les Fragments aient plus de valeur (+1 max = +33% au lieu de +20%)

-- Mettre à jour les valeurs par défaut
ALTER TABLE users ALTER COLUMN max_energy SET DEFAULT 3.0;
ALTER TABLE users ALTER COLUMN max_conquest SET DEFAULT 3.0;
ALTER TABLE users ALTER COLUMN max_construction SET DEFAULT 3.0;
ALTER TABLE users ALTER COLUMN max_vitalite SET DEFAULT 3.0;

-- Mettre à jour les joueurs existants qui ont encore les valeurs par défaut (5)
UPDATE users SET max_energy = 3 WHERE max_energy = 5;
UPDATE users SET max_conquest = 3 WHERE max_conquest = 5;
UPDATE users SET max_construction = 3 WHERE max_construction = 5;
UPDATE users SET max_vitalite = 3 WHERE max_vitalite = 5;

-- Plafonner les points actuels au nouveau max
UPDATE users SET energy_points = LEAST(energy_points, 3) WHERE energy_points > 3 AND max_energy = 3;
UPDATE users SET conquest_points = LEAST(conquest_points, 3) WHERE conquest_points > 3 AND max_conquest = 3;
UPDATE users SET construction_points = LEAST(construction_points, 3) WHERE construction_points > 3 AND max_construction = 3;
UPDATE users SET vitalite_points = LEAST(vitalite_points, 3) WHERE vitalite_points > 3 AND max_vitalite = 3;
