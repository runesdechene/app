-- 202_carnet_collab_activity_notifications.sql
-- WHY : les actions de la fiche collaborative (commentaire, édition de description,
-- ajout de photo, like) n'étaient reliées NI au feed d'activité (toasts globaux)
-- NI aux notifications personnelles. On les y branche, en réutilisant les types
-- que le front sait déjà rendre :
--   - feed : activity_log type='contribute' (data.contributionType) ou 'like'
--   - notif perso : notify(recipient, type, data) (+ trigger push existant)
-- + nouvelle RPC générique toggle_contribution_like : like ouvert à tous (y
--   compris son propre contenu — collaboratif), pour la description ET les
--   commentaires. Remplace l'usage de vote_contribution (qui interdit le self-like).
--
-- Choix anti-spam : commentaires/description/photos → feed + notif ; likes → notif perso seule.

BEGIN;

-- ─── LIKE GÉNÉRIQUE (description OU commentaire, self-like autorisé) ───────────
CREATE OR REPLACE FUNCTION public.toggle_contribution_like(
  p_user_id text, p_contribution_id integer
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_contrib RECORD;
  v_existing integer;
  v_liked boolean;
  v_count integer;
  v_place RECORD;
  v_actor RECORD;
BEGIN
  IF p_user_id IS NULL THEN RETURN json_build_object('error','unauthorized'); END IF;
  SELECT id, place_id, user_id, type INTO v_contrib FROM place_contributions WHERE id = p_contribution_id;
  IF NOT FOUND THEN RETURN json_build_object('error','not_found'); END IF;

  SELECT vote INTO v_existing FROM contribution_votes
  WHERE contribution_id = p_contribution_id AND user_id = p_user_id;

  IF v_existing = 1 THEN
    DELETE FROM contribution_votes WHERE contribution_id = p_contribution_id AND user_id = p_user_id;
    UPDATE place_contributions SET votes_up = GREATEST(0, votes_up - 1) WHERE id = p_contribution_id;
    v_liked := false;
  ELSIF v_existing IS NULL THEN
    INSERT INTO contribution_votes (contribution_id, user_id, vote) VALUES (p_contribution_id, p_user_id, 1);
    UPDATE place_contributions SET votes_up = votes_up + 1 WHERE id = p_contribution_id;
    v_liked := true;
  ELSE
    UPDATE contribution_votes SET vote = 1 WHERE contribution_id = p_contribution_id AND user_id = p_user_id;
    UPDATE place_contributions SET votes_up = votes_up + 1 WHERE id = p_contribution_id;
    v_liked := true;
  END IF;

  SELECT votes_up INTO v_count FROM place_contributions WHERE id = p_contribution_id;

  -- Notif au propriétaire seulement sur un like neuf et si ce n'est pas son propre contenu.
  IF v_liked AND v_existing IS NULL AND v_contrib.user_id <> p_user_id THEN
    SELECT title INTO v_place FROM places WHERE id = v_contrib.place_id;
    SELECT COALESCE(display_name, first_name, 'Quelqu''un') AS name INTO v_actor FROM users WHERE id = p_user_id;
    PERFORM notify(v_contrib.user_id, 'like_contribution', jsonb_build_object(
      'actorName', v_actor.name, 'actorId', p_user_id,
      'placeTitle', v_place.title, 'placeId', v_contrib.place_id,
      'contributionId', v_contrib.id, 'contributionType', v_contrib.type));
  END IF;

  RETURN json_build_object('success', true, 'liked', v_liked, 'votesUp', v_count);
END; $$;

-- ─── COMMENTAIRE (+ activité + notif) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_place_comment(
  p_user_id text, p_place_id text, p_content text,
  p_images jsonb DEFAULT '[]'::jsonb, p_parent_id integer DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_content text := NULLIF(TRIM(p_content), '');
  v_faction text;
  v_parent_parent integer;
  v_parent_author text;
  v_id integer;
  v_place RECORD;
  v_actor RECORD;
BEGIN
  IF v_content IS NULL THEN RETURN json_build_object('error','empty_content'); END IF;

  IF p_parent_id IS NOT NULL THEN
    SELECT parent_id, user_id INTO v_parent_parent, v_parent_author FROM place_contributions
    WHERE id = p_parent_id AND place_id = p_place_id AND type = 'comment';
    IF NOT FOUND THEN RETURN json_build_object('error','parent_not_found'); END IF;
    IF v_parent_parent IS NOT NULL THEN
      p_parent_id := v_parent_parent;
      SELECT user_id INTO v_parent_author FROM place_contributions WHERE id = p_parent_id;
    END IF;
  END IF;

  SELECT faction_id INTO v_faction FROM users WHERE id = p_user_id;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, images, parent_id, created_at, updated_at)
  VALUES (p_place_id, p_user_id, v_faction, 'comment', v_content, COALESCE(p_images,'[]'::jsonb), p_parent_id, now(), now())
  RETURNING id INTO v_id;

  SELECT title, latitude, longitude, author_id INTO v_place FROM places WHERE id = p_place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') AS name, avatar_url, faction_id INTO v_actor FROM users WHERE id = p_user_id;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('contribute', p_user_id, p_place_id, v_actor.faction_id,
    jsonb_build_object(
      'contributionType', CASE WHEN p_parent_id IS NULL THEN 'comment' ELSE 'reply' END,
      'placeTitle', v_place.title, 'placeLatitude', v_place.latitude, 'placeLongitude', v_place.longitude,
      'actorName', v_actor.name, 'actorAvatarUrl', v_actor.avatar_url));

  -- Réponse → notifier l'auteur du commentaire parent.
  IF p_parent_id IS NOT NULL AND v_parent_author IS NOT NULL AND v_parent_author <> p_user_id THEN
    PERFORM notify(v_parent_author, 'comment_reply', jsonb_build_object(
      'actorName', v_actor.name, 'actorId', p_user_id, 'placeTitle', v_place.title,
      'placeId', p_place_id, 'contributionId', v_id));
  END IF;
  -- Commentaire racine → notifier l'auteur du lieu (sauf lui-même / déjà notifié).
  IF v_place.author_id IS NOT NULL AND v_place.author_id <> p_user_id
     AND (p_parent_id IS NULL OR v_place.author_id <> v_parent_author) THEN
    PERFORM notify(v_place.author_id, 'new_comment', jsonb_build_object(
      'actorName', v_actor.name, 'actorId', p_user_id, 'placeTitle', v_place.title,
      'placeId', p_place_id, 'contributionId', v_id));
  END IF;

  RETURN json_build_object('success', true, 'id', v_id);
END; $$;

-- ─── ÉDITION DESCRIPTION (+ activité + notif aux contributeurs précédents) ─────
CREATE OR REPLACE FUNCTION public.edit_place_description(
  p_user_id text, p_place_id text, p_content text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_content text := NULLIF(TRIM(p_content), '');
  v_faction text;
  v_place RECORD;
  v_actor RECORD;
  v_prev RECORD;
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

  SELECT title, latitude, longitude INTO v_place FROM places WHERE id = p_place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') AS name, avatar_url, faction_id INTO v_actor FROM users WHERE id = p_user_id;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('contribute', p_user_id, p_place_id, v_actor.faction_id,
    jsonb_build_object('contributionType','description',
      'placeTitle', v_place.title, 'placeLatitude', v_place.latitude, 'placeLongitude', v_place.longitude,
      'actorName', v_actor.name, 'actorAvatarUrl', v_actor.avatar_url));

  -- Notifier les contributeurs précédents (hors soi-même).
  FOR v_prev IN
    SELECT DISTINCT edited_by FROM place_description_revisions
    WHERE place_id = p_place_id AND edited_by <> p_user_id
  LOOP
    PERFORM notify(v_prev.edited_by, 'description_edited', jsonb_build_object(
      'actorName', v_actor.name, 'actorId', p_user_id, 'placeTitle', v_place.title, 'placeId', p_place_id));
  END LOOP;

  RETURN json_build_object('success', true, 'content', v_content);
END; $$;

-- ─── PHOTOS SANS TEXTE (+ activité + notif auteur du lieu) ─────────────────────
CREATE OR REPLACE FUNCTION public.add_place_photos(
  p_user_id text, p_place_id text, p_images jsonb
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_faction text; v_id integer; v_place RECORD; v_actor RECORD;
BEGIN
  IF p_images IS NULL OR jsonb_array_length(p_images) = 0 THEN
    RETURN json_build_object('error','no_images');
  END IF;
  SELECT faction_id INTO v_faction FROM users WHERE id = p_user_id;
  INSERT INTO place_contributions (place_id, user_id, faction_id, type, images, created_at, updated_at)
  VALUES (p_place_id, p_user_id, v_faction, 'photo', p_images, now(), now())
  RETURNING id INTO v_id;

  SELECT title, latitude, longitude, author_id INTO v_place FROM places WHERE id = p_place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') AS name, avatar_url, faction_id INTO v_actor FROM users WHERE id = p_user_id;

  INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
  VALUES ('contribute', p_user_id, p_place_id, v_actor.faction_id,
    jsonb_build_object('contributionType','photo',
      'placeTitle', v_place.title, 'placeLatitude', v_place.latitude, 'placeLongitude', v_place.longitude,
      'actorName', v_actor.name, 'actorAvatarUrl', v_actor.avatar_url));

  IF v_place.author_id IS NOT NULL AND v_place.author_id <> p_user_id THEN
    PERFORM notify(v_place.author_id, 'new_photo', jsonb_build_object(
      'actorName', v_actor.name, 'actorId', p_user_id, 'placeTitle', v_place.title, 'placeId', p_place_id));
  END IF;

  RETURN json_build_object('success', true, 'id', v_id);
END; $$;

GRANT EXECUTE ON FUNCTION public.toggle_contribution_like(text, integer) TO authenticated, service_role;

COMMIT;
