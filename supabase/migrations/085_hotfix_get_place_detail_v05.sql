-- 085_hotfix_get_place_detail_v05.sql
-- WHY : HOTFIX URGENT 2/2. La RPC get_place_detail_v05 (baseline mig 001
-- ligne 3181, appelée par PlacePanel.tsx ligne 358) lit `place_influence`
-- droppée par mig 077. Plante en prod → fiche de lieu vide / contributions
-- non chargées.
--
-- FIX : reécrit get_place_detail_v05 en remplaçant le bloc influence par
-- des valeurs stables :
--   - influence = []
--   - dominantFaction = null
-- Le frontend (PlaceContent dans PlacePanel.tsx) gère ces valeurs via
-- v05.influence.map() et v05.dominantFaction (avec fallbacks acceptables
-- pour V1 — la "faction dominante" est désormais portée par place_veille
-- via la Veille V0.7, à intégrer en V2).
--
-- Aussi DROP decay_placed_influence (baseline ligne 1873) — fonction batch
-- qui faisait UPDATE/DELETE sur place_influence. Plus jamais appelée
-- (système V0.5 mort), pas de cron actif, peut être droppée.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_place_detail_v05(
  p_place_id text,
  p_user_id  text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_contributions JSON;
  v_explorers JSON;
  v_avg_rating NUMERIC;
  v_rating_count INT;
  v_user_rating INT;
  v_is_wishlisted BOOLEAN := FALSE;
  v_is_explorer BOOLEAN := FALSE;
  v_guardian RECORD;
BEGIN
  -- V085 : retiré tout le bloc place_influence (table droppée mig 077).
  -- influence et dominantFaction retournent [] et null désormais.

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
    'influence', '[]'::json,
    'dominantFaction', NULL,
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

GRANT EXECUTE ON FUNCTION public.get_place_detail_v05(text, text)
  TO authenticated, anon, service_role;

-- ============================================================
-- DROP decay_placed_influence (dead code V0.5)
-- ============================================================
DROP FUNCTION IF EXISTS public.decay_placed_influence();

COMMIT;
