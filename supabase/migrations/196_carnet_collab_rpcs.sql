-- 196_carnet_collab_rpcs.sql
-- WHY : logique métier de la fiche collaborative (SECURITY DEFINER).
-- Aucune récompense (Gloire/influence) — contribuer est un geste gratuit (décision Uriel 2026-06-02).

BEGIN;

-- Helper interne : l'utilisateur a-t-il découvert le lieu ?
CREATE OR REPLACE FUNCTION public._has_discovered(p_user_id text, p_place_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS(SELECT 1 FROM places_discovered WHERE user_id = p_user_id AND place_id = p_place_id);
$$;

-- ÉDITION DE LA DESCRIPTION (wiki ouvert, réservé découvreurs) -------------------
CREATE OR REPLACE FUNCTION public.edit_place_description(
  p_user_id text, p_place_id text, p_content text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_content text := NULLIF(TRIM(p_content), '');
  v_faction text;
BEGIN
  IF v_content IS NULL THEN RETURN json_build_object('error','empty_content'); END IF;
  IF NOT public._has_discovered(p_user_id, p_place_id) THEN
    RETURN json_build_object('error','not_discovered');
  END IF;

  SELECT faction_id INTO v_faction FROM users WHERE id = p_user_id;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, created_at, updated_at)
  VALUES (p_place_id, p_user_id, v_faction, 'description', v_content, now(), now())
  ON CONFLICT (place_id) WHERE (type = 'description')
  DO UPDATE SET content = EXCLUDED.content, user_id = EXCLUDED.user_id,
               faction_id = EXCLUDED.faction_id, updated_at = now();

  INSERT INTO place_description_revisions (place_id, content, edited_by)
  VALUES (p_place_id, v_content, p_user_id);

  RETURN json_build_object('success', true, 'content', v_content);
END; $$;

-- RESTAURATION D'UNE RÉVISION ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.restore_place_description_revision(
  p_user_id text, p_place_id text, p_revision_id bigint
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_content text;
BEGIN
  IF NOT public._has_discovered(p_user_id, p_place_id) THEN
    RETURN json_build_object('error','not_discovered');
  END IF;
  SELECT content INTO v_content FROM place_description_revisions
  WHERE id = p_revision_id AND place_id = p_place_id;
  IF v_content IS NULL THEN RETURN json_build_object('error','revision_not_found'); END IF;
  RETURN public.edit_place_description(p_user_id, p_place_id, v_content);
END; $$;

-- HISTORIQUE ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_place_description_history(p_place_id text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COALESCE(json_agg(json_build_object(
    'id', r.id, 'content', r.content, 'createdAt', r.created_at,
    'editedBy', r.edited_by, 'editorName', u.first_name, 'editorAvatar', u.avatar_url
  ) ORDER BY r.created_at DESC), '[]'::json)
  FROM place_description_revisions r
  LEFT JOIN users u ON u.id = r.edited_by
  WHERE r.place_id = p_place_id;
$$;

-- AJOUT D'UN COMMENTAIRE (texte +/- photos ; réponses 1 niveau) ------------------
CREATE OR REPLACE FUNCTION public.add_place_comment(
  p_user_id text, p_place_id text, p_content text,
  p_images jsonb DEFAULT '[]'::jsonb, p_parent_id integer DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_content text := NULLIF(TRIM(p_content), '');
  v_faction text;
  v_parent_parent integer;
  v_id integer;
BEGIN
  IF v_content IS NULL THEN RETURN json_build_object('error','empty_content'); END IF;

  IF p_parent_id IS NOT NULL THEN
    SELECT parent_id INTO v_parent_parent FROM place_contributions
    WHERE id = p_parent_id AND place_id = p_place_id AND type = 'comment';
    IF NOT FOUND THEN RETURN json_build_object('error','parent_not_found'); END IF;
    IF v_parent_parent IS NOT NULL THEN p_parent_id := v_parent_parent; END IF;
  END IF;

  SELECT faction_id INTO v_faction FROM users WHERE id = p_user_id;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, images, parent_id, created_at, updated_at)
  VALUES (p_place_id, p_user_id, v_faction, 'comment', v_content, COALESCE(p_images,'[]'::jsonb), p_parent_id, now(), now())
  RETURNING id INTO v_id;

  RETURN json_build_object('success', true, 'id', v_id);
END; $$;

-- AJOUT DE PHOTO(S) SANS TEXTE ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_place_photos(
  p_user_id text, p_place_id text, p_images jsonb
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_faction text; v_id integer;
BEGIN
  IF p_images IS NULL OR jsonb_array_length(p_images) = 0 THEN
    RETURN json_build_object('error','no_images');
  END IF;
  SELECT faction_id INTO v_faction FROM users WHERE id = p_user_id;
  INSERT INTO place_contributions (place_id, user_id, faction_id, type, images, created_at, updated_at)
  VALUES (p_place_id, p_user_id, v_faction, 'photo', p_images, now(), now())
  RETURNING id INTO v_id;
  RETURN json_build_object('success', true, 'id', v_id);
END; $$;

-- EXTENSION DE get_place_detail_v05 (ajout description collaborative) -------------
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

  -- Description collaborative courante (+ nb révisions + like de l'utilisateur)
  SELECT json_build_object(
    'id', d.id, 'content', d.content, 'updatedAt', d.updated_at,
    'editedBy', d.user_id, 'editorName', u.first_name, 'editorAvatar', u.avatar_url,
    'votesUp', d.votes_up,
    'revisionCount', (SELECT count(*) FROM place_description_revisions r WHERE r.place_id = p_place_id),
    'likedByMe', CASE WHEN p_user_id IS NULL THEN false ELSE EXISTS(
      SELECT 1 FROM contribution_votes cv WHERE cv.contribution_id = d.id AND cv.user_id = p_user_id AND cv.vote = 1) END
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

GRANT EXECUTE ON FUNCTION
  public.edit_place_description(text,text,text),
  public.restore_place_description_revision(text,text,bigint),
  public.get_place_description_history(text),
  public.add_place_comment(text,text,text,jsonb,integer),
  public.add_place_photos(text,text,jsonb),
  public._has_discovered(text,text)
  TO authenticated, service_role;

COMMIT;
