-- 020_backfill_explorers_and_carnets.sql
-- Backfill: place authors → explorers + discoverer's carnet from places.text/images
-- Also update get_place_detail_v05 to return images JSONB on contributions

-- 0. Allow NULL faction_id (players without heritage still get carnets)
ALTER TABLE place_contributions ALTER COLUMN faction_id DROP NOT NULL;

-- 1. (REMOVED) — Discoverers are NOT auto-explorers. Only GPS visits count.
-- place_explorers backfill removed in migration 023.

-- 2. Backfill place_contributions: discoverer's carnet from places.text + images
--    Only insert where no carnet already exists for that author+place
INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, images, created_at)
SELECT
  p.id,
  p.author_id,
  u.faction_id,
  'carnet',
  COALESCE(NULLIF(TRIM(p.text), ''), 'Lieu découvert.'),
  COALESCE(
    (SELECT jsonb_agg(img->>'url') FROM jsonb_array_elements(p.images) AS img WHERE img->>'url' IS NOT NULL),
    '[]'::jsonb
  ),
  p.created_at
FROM places p
JOIN users u ON u.id = p.author_id
WHERE p.author_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM place_contributions pc
    WHERE pc.place_id = p.id AND pc.user_id = p.author_id AND pc.type = 'carnet'
  )
ON CONFLICT (place_id, user_id, type) DO NOTHING;

-- 2b. Backfill place_influence: content_points from carnets (10pts/carnet + 5pts/photo)
--     Only for authors with a faction (no faction = no heritage to credit)
INSERT INTO place_influence (place_id, faction_id, placed_points, content_points)
SELECT pc.place_id, pc.faction_id, 0, 10 + (COALESCE(jsonb_array_length(pc.images), 0) * 5)
FROM place_contributions pc
WHERE pc.type = 'carnet' AND pc.faction_id IS NOT NULL
ON CONFLICT (place_id, faction_id)
DO UPDATE SET content_points = place_influence.content_points + EXCLUDED.content_points;

-- 3. Update get_place_detail_v05: add images to contributions JSON
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
  -- Influence par héritage
  SELECT json_agg(
    json_build_object(
      'factionId', pi.faction_id,
      'placed', pi.placed_points,
      'content', pi.content_points,
      'total', pi.placed_points + pi.content_points
    ) ORDER BY (pi.placed_points + pi.content_points) DESC
  ) INTO v_influence
  FROM place_influence pi WHERE pi.place_id = p_place_id;

  -- Faction dominante
  SELECT faction_id, (placed_points + content_points)
  INTO v_dominant_faction, v_dominant_score
  FROM place_influence
  WHERE place_id = p_place_id
  ORDER BY (placed_points + content_points) DESC
  LIMIT 1;

  -- Contributions (triées par votes) — NOW INCLUDES images JSONB
  SELECT json_agg(
    json_build_object(
      'id', pc.id,
      'userId', pc.user_id,
      'factionId', pc.faction_id,
      'type', pc.type,
      'content', pc.content,
      'imageUrl', pc.image_url,
      'images', COALESCE(pc.images, '[]'::jsonb),
      'votesUp', pc.votes_up,
      'votesDown', pc.votes_down,
      'createdAt', pc.created_at,
      'userName', u.first_name,
      'userAvatar', u.avatar_url
    ) ORDER BY pc.votes_up DESC, pc.created_at ASC
  ) INTO v_contributions
  FROM place_contributions pc
  JOIN users u ON u.id = pc.user_id
  WHERE pc.place_id = p_place_id;

  -- Explorateurs (Hall of Fame)
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

  -- Note moyenne
  SELECT AVG(rating)::NUMERIC(2,1), COUNT(*) INTO v_avg_rating, v_rating_count
  FROM place_ratings WHERE place_id = p_place_id;

  -- Gardien (top contributeur)
  SELECT pc.user_id, u.first_name AS name, u.avatar_url, u.faction_id,
    SUM(pc.votes_up) AS total_votes
  INTO v_guardian
  FROM place_contributions pc
  JOIN users u ON u.id = pc.user_id
  WHERE pc.place_id = p_place_id
  GROUP BY pc.user_id, u.first_name, u.avatar_url, u.faction_id
  ORDER BY total_votes DESC
  LIMIT 1;

  -- Infos joueur connecté
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
