-- 310_grades_libres_schema.sql
-- WHY : grades libres — capacité par grade (top N) + seuil de gouvernance réglable par le Chef.
-- ADDITIF. Backfill : les lignes custom existantes (rang 1-4) reçoivent capacités 1/1/3/NULL
-- (= comportement fixed-4 du 25/06). Les Compagnies sans lignes restent sur le défaut (résolu en code).
ALTER TABLE public.faction_grade_labels ADD COLUMN IF NOT EXISTS capacity int;
ALTER TABLE public.factions ADD COLUMN IF NOT EXISTS govern_grades int NOT NULL DEFAULT 2;

UPDATE public.faction_grade_labels
SET capacity = CASE rank WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 ELSE NULL END
WHERE capacity IS NULL;
