-- Fix blob calculation: reduce effective radius by 60% to compensate for Voronoi clipping
-- The backend uses raw circle radius but the frontend clips circles to Voronoi cells,
-- so the visual territory is smaller than the theoretical circle.
-- This caused blobs to include distant places that don't visually touch.

CREATE OR REPLACE FUNCTION public.territory_radius_km(p_score INT)
RETURNS DOUBLE PRECISION
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_score <= 0 THEN 0.0
    WHEN p_score <= 1 THEN 0.25 * 0.6
    ELSE (0.25 + sqrt(p_score - 1) * 0.65) * 0.6
  END;
$$;
