-- 199_place_description_contributors.sql
-- WHY : afficher TOUS les contributeurs de la description (avatars) sur la fiche.
-- get_place_detail_v05.description gagne un champ `contributors` = liste distincte des
-- éditeurs (depuis place_description_revisions), ordonnée par 1ère contribution (le
-- contributeur d'origine en tête). Purement additif au retour de la RPC.

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
  v_description JSON;
BEGIN
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
      'userAvatar', u.avatar_url,
      'parentId', pc.parent_id,
      'likedByMe', CASE WHEN p_user_id IS NULL THEN false ELSE EXISTS(
        SELECT 1 FROM contribution_votes cv WHERE cv.contribution_id = pc.id AND cv.user_id = p_user_id AND cv.vote = 1) END
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

  SELECT json_build_object(
    'id', d.id, 'content', d.content, 'updatedAt', d.updated_at,
    'editedBy', d.user_id, 'editorName', u.first_name, 'editorAvatar', u.avatar_url,
    'votesUp', d.votes_up,
    'revisionCount', (SELECT count(*) FROM place_description_revisions r WHERE r.place_id = p_place_id),
    'likedByMe', CASE WHEN p_user_id IS NULL THEN false ELSE EXISTS(
      SELECT 1 FROM contribution_votes cv WHERE cv.contribution_id = d.id AND cv.user_id = p_user_id AND cv.vote = 1) END,
    'contributors', (
      SELECT COALESCE(json_agg(
        json_build_object('userId', c.uid, 'name', c.name, 'avatar', c.avatar)
        ORDER BY c.first_at ASC
      ), '[]'::json)
      FROM (
        SELECT r.edited_by AS uid, u2.first_name AS name, u2.avatar_url AS avatar, MIN(r.created_at) AS first_at
        FROM place_description_revisions r
        JOIN users u2 ON u2.id = r.edited_by
        WHERE r.place_id = p_place_id
        GROUP BY r.edited_by, u2.first_name, u2.avatar_url
      ) c
    )
  ) INTO v_description
  FROM place_contributions d JOIN users u ON u.id = d.user_id
  WHERE d.place_id = p_place_id AND d.type = 'description';

  RETURN json_build_object(
    'influence', '[]'::json,
    'dominantFaction', NULL,
    'description', v_description,
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

COMMIT;
