-- 203_like_notify_all_description_contributors.sql
-- WHY : un like sur une DESCRIPTION (collaborative) doit notifier TOUS ses
-- contributeurs (« dont tu es collaborateur »), pas seulement le dernier éditeur.
-- Un like sur un COMMENTAIRE notifie son auteur. (Demande Uriel.)

BEGIN;

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
  v_rev RECORD;
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

  IF v_liked AND v_existing IS NULL THEN
    SELECT title INTO v_place FROM places WHERE id = v_contrib.place_id;
    SELECT COALESCE(display_name, first_name, 'Quelqu''un') AS name INTO v_actor FROM users WHERE id = p_user_id;

    IF v_contrib.type = 'description' THEN
      -- Tous les contributeurs distincts de la description (hors le liker).
      FOR v_rev IN
        SELECT DISTINCT edited_by FROM place_description_revisions
        WHERE place_id = v_contrib.place_id AND edited_by <> p_user_id
      LOOP
        PERFORM notify(v_rev.edited_by, 'like_contribution', jsonb_build_object(
          'actorName', v_actor.name, 'actorId', p_user_id, 'placeTitle', v_place.title,
          'placeId', v_contrib.place_id, 'contributionId', v_contrib.id, 'contributionType', 'description'));
      END LOOP;
    ELSIF v_contrib.user_id <> p_user_id THEN
      PERFORM notify(v_contrib.user_id, 'like_contribution', jsonb_build_object(
        'actorName', v_actor.name, 'actorId', p_user_id, 'placeTitle', v_place.title,
        'placeId', v_contrib.place_id, 'contributionId', v_contrib.id, 'contributionType', v_contrib.type));
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'liked', v_liked, 'votesUp', v_count);
END; $$;

COMMIT;
