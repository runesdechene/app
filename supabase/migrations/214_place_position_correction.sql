-- 214_place_position_correction.sql
-- WHY : permettre à l'auteur OU à un visiteur (place_explorers) de corriger la
--       position d'un lieu mal placé. Édition immédiate sans plafond de distance,
--       trace en lecture seule, notification auteur + veilleur (hors éditeur).
--       Spec : docs/superpowers/specs/2026-06-05-correction-position-lieu-design.md

BEGIN;

-- 1) Table d'historique (trace lecture seule) ---------------------------------
CREATE TABLE IF NOT EXISTS public.place_position_history (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id      varchar     NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id       varchar     NOT NULL REFERENCES public.users(id),
  old_latitude  real        NOT NULL,
  old_longitude real        NOT NULL,
  new_latitude  real        NOT NULL,
  new_longitude real        NOT NULL,
  old_address   text,
  new_address   text,
  created_at    timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_place_position_history_place
  ON public.place_position_history (place_id, created_at DESC);

ALTER TABLE public.place_position_history ENABLE ROW LEVEL SECURITY;

-- Lecture transparente (trace = anti-abus). Écriture : RPC SECURITY DEFINER only.
DROP POLICY IF EXISTS place_position_history_read ON public.place_position_history;
CREATE POLICY place_position_history_read
  ON public.place_position_history FOR SELECT
  TO authenticated, anon
  USING (true);

-- 2) RPC update_place_position ------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_place_position(
  p_user_id   text,
  p_place_id  text,
  p_latitude  real,
  p_longitude real,
  p_address   text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_author_id   text;
  v_old_lat     real;
  v_old_lng     real;
  v_old_address text;
  v_place_title text;
  v_is_eligible boolean;
  v_guardian_id text;
  v_editor_name text;
  v_distance_km numeric;
BEGIN
  -- Identité non spoofable : p_user_id doit correspondre au caller authentifié.
  -- Convention de l'app (cf. plant_flag mig 017, invest_crowns mig 021). Crucial
  -- ici : le modèle anti-abus repose sur la transparence (trace + notif), donc
  -- l'acteur tracé DOIT être authentique.
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT author_id, latitude, longitude, address, title
    INTO v_author_id, v_old_lat, v_old_lng, v_old_address, v_place_title
    FROM public.places WHERE id = p_place_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  -- Éligibilité serveur : auteur OU visiteur présent dans place_explorers.
  v_is_eligible := (v_author_id = p_user_id)
    OR EXISTS (SELECT 1 FROM public.place_explorers
               WHERE place_id = p_place_id AND user_id = p_user_id);
  IF NOT v_is_eligible THEN
    RETURN json_build_object('error', 'not_eligible');
  END IF;

  -- Trace (ancien + nouveau).
  INSERT INTO public.place_position_history
    (place_id, user_id, old_latitude, old_longitude,
     new_latitude, new_longitude, old_address, new_address)
  VALUES
    (p_place_id, p_user_id, v_old_lat, v_old_lng,
     p_latitude, p_longitude, v_old_address, p_address);

  -- Mise à jour immédiate, pour tous les joueurs.
  UPDATE public.places
     SET latitude = p_latitude, longitude = p_longitude,
         address = p_address, updated_at = NOW()
   WHERE id = p_place_id;

  -- Notifications : auteur + veilleur, en excluant l'éditeur.
  v_guardian_id := public.get_place_guardian(p_place_id);
  v_distance_km := public.haversine_km(v_old_lat, v_old_lng, p_latitude, p_longitude);
  SELECT first_name INTO v_editor_name FROM public.users WHERE id = p_user_id;

  IF v_author_id IS NOT NULL AND v_author_id <> p_user_id THEN
    PERFORM public.notify(v_author_id, 'place_position_edited', jsonb_build_object(
      'actorName', v_editor_name, 'actorId', p_user_id,
      'placeId', p_place_id, 'placeTitle', v_place_title,
      'distanceKm', ROUND(v_distance_km, 2)));
  END IF;

  IF v_guardian_id IS NOT NULL
     AND v_guardian_id <> p_user_id
     AND v_guardian_id <> COALESCE(v_author_id, '') THEN
    PERFORM public.notify(v_guardian_id, 'place_position_edited', jsonb_build_object(
      'actorName', v_editor_name, 'actorId', p_user_id,
      'placeId', p_place_id, 'placeTitle', v_place_title,
      'distanceKm', ROUND(v_distance_km, 2)));
  END IF;

  -- Trace globale.
  INSERT INTO public.activity_log (type, actor_id, place_id, data)
  VALUES ('place_position_edited', p_user_id, p_place_id, jsonb_build_object(
    'distanceKm', ROUND(v_distance_km, 2), 'editorName', v_editor_name));

  RETURN json_build_object('success', true,
    'latitude', p_latitude, 'longitude', p_longitude, 'address', p_address);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_place_position(text, text, real, real, text)
  TO authenticated, service_role;

-- 3) Extension de get_place_detail_v05 : + lastPositionEdit -------------------
-- Recopie intégrale de la def 199 + un bloc v_last_position_edit additif.
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
  v_last_position_edit JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'id', pc.id, 'userId', pc.user_id, 'factionId', pc.faction_id,
      'type', pc.type, 'title', pc.title, 'content', pc.content,
      'imageUrl', pc.image_url, 'images', COALESCE(pc.images, '[]'::jsonb),
      'rating', pr.rating, 'votesUp', pc.votes_up, 'votesDown', pc.votes_down,
      'createdAt', pc.created_at, 'userName', u.first_name, 'userAvatar', u.avatar_url,
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
      'userId', pe.user_id, 'visitedAt', pe.visited_at,
      'userName', u.first_name, 'userAvatar', u.avatar_url, 'factionId', u.faction_id
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

  -- NEW : dernière correction de position (pour l'inline "Position modifiée par …").
  SELECT json_build_object(
    'editorName', u.first_name,
    'editorId', h.user_id,
    'createdAt', h.created_at,
    'distanceKm', ROUND(public.haversine_km(h.old_latitude, h.old_longitude, h.new_latitude, h.new_longitude), 2)
  ) INTO v_last_position_edit
  FROM place_position_history h
  JOIN users u ON u.id = h.user_id
  WHERE h.place_id = p_place_id
  ORDER BY h.created_at DESC
  LIMIT 1;

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
    ELSE NULL END,
    'lastPositionEdit', v_last_position_edit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_detail_v05(text, text)
  TO authenticated, anon, service_role;

COMMIT;
