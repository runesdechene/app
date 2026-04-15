-- 085_restore_get_place_detail_v05.sql
-- FIX BUG REGRESSION : la migration 084 a droppé get_place_detail_v05 par erreur.
-- Cette RPC est bien utilisée en prod — PlacePanel.tsx:433 l'appelle pour charger
-- les carnets, explorers, ratings et influence d'un lieu.
--
-- Cause racine : l'audit Phase 1.2 a cherché "rpc.*get_place_detail_v05" mais
-- le grep n'a pas matché la vraie syntaxe (call dans un Promise.all).
-- L'appel est présent et actif.
--
-- Remède : restauration de la définition de la migration 079_rating_on_contributions
-- (dernière version connue).

CREATE OR REPLACE FUNCTION public.get_place_detail_v05(
  p_place_id TEXT,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_influence JSON;
  v_contributions JSON;
  v_explorers JSON;
  v_avg_rating NUMERIC;
  v_rating_count INT;
  v_user_rating INT;
  v_is_wishlisted BOOLEAN := FALSE;
  v_is_explorer BOOLEAN := FALSE;
  v_dominant_faction TEXT;
  v_dominant_score INT := 0;
  v_guardian RECORD;
BEGIN
  SELECT json_agg(
    json_build_object(
      'factionId', pi.faction_id,
      'placed', pi.placed_points,
      'permanent', pi.permanent_points,
      'content', pi.content_points,
      'total', pi.placed_points + pi.content_points + pi.permanent_points
    ) ORDER BY (pi.placed_points + pi.content_points + pi.permanent_points) DESC
  ) INTO v_influence
  FROM place_influence pi WHERE pi.place_id = p_place_id;

  SELECT faction_id, (placed_points + content_points + permanent_points)
  INTO v_dominant_faction, v_dominant_score
  FROM place_influence
  WHERE place_id = p_place_id
  ORDER BY (placed_points + content_points + permanent_points) DESC
  LIMIT 1;

  SELECT json_agg(
    json_build_object(
      'id', pc.id,
      'userId', pc.user_id,
      'factionId', pc.faction_id,
      'type', pc.type,
      'title', pc.title,
      'content', pc.content,
      'imageUrl', pc.image_url,
      'images', COALESCE(pc.images, '[]'::jsonb),
      'rating', pr.rating,
      'votesUp', pc.votes_up,
      'votesDown', pc.votes_down,
      'createdAt', pc.created_at,
      'userName', u.first_name,
      'userAvatar', u.avatar_url
    ) ORDER BY pc.votes_up DESC, pc.created_at ASC
  ) INTO v_contributions
  FROM place_contributions pc
  JOIN users u ON u.id = pc.user_id
  LEFT JOIN place_ratings pr ON pr.place_id = pc.place_id AND pr.user_id = pc.user_id
  WHERE pc.place_id = p_place_id;

  SELECT json_agg(
    json_build_object(
      'userId', pe.user_id,
      'visitedAt', pe.visited_at,
      'userName', u.first_name,
      'userAvatar', u.avatar_url,
      'factionId', u.faction_id
    ) ORDER BY pe.visited_at ASC
  ) INTO v_explorers
  FROM place_explorers pe
  JOIN users u ON u.id = pe.user_id
  WHERE pe.place_id = p_place_id;

  SELECT AVG(rating)::NUMERIC(2,1), COUNT(*) INTO v_avg_rating, v_rating_count
  FROM place_ratings WHERE place_id = p_place_id;

  SELECT pc.user_id, u.first_name AS name, u.avatar_url, u.faction_id,
    SUM(pc.votes_up) AS total_votes
  INTO v_guardian
  FROM place_contributions pc
  JOIN users u ON u.id = pc.user_id
  WHERE pc.place_id = p_place_id
  GROUP BY pc.user_id, u.first_name, u.avatar_url, u.faction_id
  ORDER BY total_votes DESC
  LIMIT 1;

  IF p_user_id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM place_wishlist WHERE place_id = p_place_id AND user_id = p_user_id)
    INTO v_is_wishlisted;
    SELECT EXISTS(SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id)
    INTO v_is_explorer;
    SELECT rating INTO v_user_rating FROM place_ratings WHERE place_id = p_place_id AND user_id = p_user_id;
  END IF;

  RETURN json_build_object(
    'influence', COALESCE(v_influence, '[]'::json),
    'dominantFaction', v_dominant_faction,
    'contributions', COALESCE(v_contributions, '[]'::json),
    'explorers', COALESCE(v_explorers, '[]'::json),
    'avgRating', v_avg_rating,
    'ratingCount', v_rating_count,
    'userRating', v_user_rating,
    'isWishlisted', v_is_wishlisted,
    'isExplorer', v_is_explorer,
    'guardian', CASE WHEN v_guardian.user_id IS NOT NULL THEN
      json_build_object('userId', v_guardian.user_id, 'name', v_guardian.name,
        'avatar', v_guardian.avatar_url, 'factionId', v_guardian.faction_id)
    ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_detail_v05(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_place_detail_v05(TEXT, TEXT) TO anon;
