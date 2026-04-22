-- 019_v05_contributions_images.sql
-- Ajouter support multi-photos sur les contributions (carnets)
-- Les photos étaient un type séparé, maintenant elles sont embarquées dans le carnet

ALTER TABLE place_contributions ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN place_contributions.images IS 'Array of image URLs attached to this contribution. Format: ["url1", "url2", ...]';
