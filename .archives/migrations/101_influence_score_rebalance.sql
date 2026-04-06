-- Rebalance influence score weights
-- Likes ×1, Vues ×0.1, Explorations ×3
-- Fortifications: 10, 20, 30, 60

CREATE OR REPLACE FUNCTION public.place_influence_score(p_place_id TEXT)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT GREATEST(0, ROUND(
    COALESCE((SELECT COUNT(*) FROM places_liked WHERE place_id = p_place_id), 0) * 1
    + COALESCE((SELECT COUNT(*) FROM places_viewed WHERE place_id = p_place_id), 0) * 0.1
    + COALESCE((SELECT COUNT(*) FROM places_explored WHERE place_id = p_place_id), 0) * 3
    + CASE COALESCE((SELECT fortification_level FROM places WHERE id = p_place_id), 0)
        WHEN 1 THEN 10
        WHEN 2 THEN 20
        WHEN 3 THEN 30
        WHEN 4 THEN 60
        ELSE 0
      END
  ))::int;
$$;
