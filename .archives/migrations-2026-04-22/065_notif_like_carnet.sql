-- 065_notif_like_carnet.sql
-- Add like_carnet + milestone_likes notifications to vote_contribution

CREATE OR REPLACE FUNCTION public.vote_contribution(
  p_user_id TEXT,
  p_contribution_id INT,
  p_vote INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contrib RECORD;
  v_old_vote INT;
  v_place_title TEXT;
  v_place_lat NUMERIC;
  v_place_lng NUMERIC;
  v_actor_name TEXT;
  v_author_name TEXT;
  v_faction_color TEXT;
  v_faction_pattern TEXT;
  v_actor_faction TEXT;
  v_actor_avatar TEXT;
  v_new_votes_up INT;
BEGIN
  SELECT * INTO v_contrib FROM place_contributions WHERE id = p_contribution_id;
  IF v_contrib.id IS NULL THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  IF v_contrib.user_id = p_user_id THEN
    RETURN json_build_object('error', 'cannot_vote_own');
  END IF;

  SELECT vote INTO v_old_vote FROM contribution_votes
  WHERE contribution_id = p_contribution_id AND user_id = p_user_id;

  IF v_old_vote IS NOT NULL THEN
    IF v_old_vote = p_vote THEN
      RETURN json_build_object('error', 'already_voted');
    END IF;
    UPDATE contribution_votes SET vote = p_vote WHERE contribution_id = p_contribution_id AND user_id = p_user_id;
    IF p_vote = 1 THEN
      UPDATE place_contributions SET votes_up = votes_up + 1, votes_down = votes_down - 1 WHERE id = p_contribution_id;
    ELSE
      UPDATE place_contributions SET votes_up = votes_up - 1, votes_down = votes_down + 1 WHERE id = p_contribution_id;
    END IF;
  ELSE
    INSERT INTO contribution_votes (contribution_id, user_id, vote) VALUES (p_contribution_id, p_user_id, p_vote);
    IF p_vote = 1 THEN
      UPDATE place_contributions SET votes_up = votes_up + 1 WHERE id = p_contribution_id;
    ELSE
      UPDATE place_contributions SET votes_down = votes_down + 1 WHERE id = p_contribution_id;
    END IF;
  END IF;

  -- Recalculer les content_points du lieu
  PERFORM recalc_place_content_points(v_contrib.place_id);

  -- Get updated votes_up for milestone check
  SELECT votes_up INTO v_new_votes_up FROM place_contributions WHERE id = p_contribution_id;

  -- Log activity + notifications : seulement sur un NOUVEAU like
  IF p_vote = 1 AND v_old_vote IS NULL THEN
    SELECT title, latitude, longitude INTO v_place_title, v_place_lat, v_place_lng
    FROM places WHERE id = v_contrib.place_id;

    SELECT COALESCE(display_name, first_name, 'Quelqu''un'), faction_id, avatar_url
    INTO v_actor_name, v_actor_faction, v_actor_avatar
    FROM users WHERE id = p_user_id;

    SELECT COALESCE(display_name, first_name, 'Quelqu''un')
    INTO v_author_name
    FROM users WHERE id = v_contrib.user_id;

    SELECT color, pattern INTO v_faction_color, v_faction_pattern
    FROM factions WHERE id = v_actor_faction;

    -- Activity log (toast)
    INSERT INTO activity_log (type, actor_id, place_id, faction_id, data)
    VALUES ('like_carnet', p_user_id, v_contrib.place_id, v_actor_faction,
      jsonb_build_object(
        'placeTitle', v_place_title,
        'placeLatitude', v_place_lat,
        'placeLongitude', v_place_lng,
        'actorName', v_actor_name,
        'actorAvatarUrl', v_actor_avatar,
        'authorName', v_author_name,
        'authorId', v_contrib.user_id,
        'contributionId', v_contrib.id,
        'factionColor', v_faction_color,
        'factionPattern', v_faction_pattern
      ));

    -- Notification like_carnet -> auteur du recit
    PERFORM notify(v_contrib.user_id, 'like_carnet', jsonb_build_object(
      'actorName', v_actor_name,
      'actorId', p_user_id,
      'placeTitle', v_place_title,
      'placeId', v_contrib.place_id,
      'contributionId', v_contrib.id
    ));

    -- Milestone likes : 5, 10, 20, 50
    IF v_new_votes_up IN (5, 10, 20, 50) THEN
      PERFORM notify(v_contrib.user_id, 'milestone_likes', jsonb_build_object(
        'placeId', v_contrib.place_id,
        'contributionId', v_contrib.id,
        'likeCount', v_new_votes_up
      ));
    END IF;
  END IF;

  RETURN json_build_object('success', true,
    'newVotesUp', v_new_votes_up,
    'newVotesDown', (SELECT votes_down FROM place_contributions WHERE id = p_contribution_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.vote_contribution(TEXT, INT, INT) TO authenticated;
