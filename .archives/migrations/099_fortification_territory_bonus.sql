-- ============================================
-- MIGRATION 099 : Bonus territoire par fortification + nouveaux poids
-- ============================================
-- Likes ×5, Vues ×0.1, Explorations ×10
-- Fortifications: Tour +10, Défense +20, Bastion +50, Forteresse +100
-- ============================================

CREATE OR REPLACE FUNCTION public.place_influence_score(p_place_id TEXT)
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT GREATEST(0, ROUND(
    COALESCE((SELECT COUNT(*) FROM places_liked WHERE place_id = p_place_id), 0) * 5
    + COALESCE((SELECT COUNT(*) FROM places_viewed WHERE place_id = p_place_id), 0) * 0.1
    + COALESCE((SELECT COUNT(*) FROM places_explored WHERE place_id = p_place_id), 0) * 10
    + CASE COALESCE((SELECT fortification_level FROM places WHERE id = p_place_id), 0)
        WHEN 1 THEN 10
        WHEN 2 THEN 20
        WHEN 3 THEN 50
        WHEN 4 THEN 100
        ELSE 0
      END
  ))::int;
$$;
