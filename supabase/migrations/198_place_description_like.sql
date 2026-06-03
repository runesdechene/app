-- 198_place_description_like.sql
-- WHY : la description d'un lieu est COLLABORATIVE — tout le monde doit pouvoir la liker,
-- y compris son contributeur courant. La RPC générique vote_contribution refuse le vote sur
-- sa propre contribution (_vote_contribution_internal → 'cannot_vote_own'), ce qui cassait le
-- like de la description pour l'auteur du lieu. RPC dédiée toggle, sans ce garde.
-- Écrit dans contribution_votes (contribution_id = id de la ligne type='description') + maintient
-- place_contributions.votes_up, exactement comme la lecture dans get_place_detail_v05.

BEGIN;

CREATE OR REPLACE FUNCTION public.toggle_place_description_like(
  p_user_id text, p_place_id text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_desc_id integer;
  v_existing integer;   -- vote courant (-1/1) ou NULL
  v_liked boolean;
  v_count integer;
BEGIN
  IF p_user_id IS NULL THEN RETURN json_build_object('error','unauthorized'); END IF;

  SELECT id INTO v_desc_id FROM place_contributions
  WHERE place_id = p_place_id AND type = 'description';
  IF v_desc_id IS NULL THEN RETURN json_build_object('error','no_description'); END IF;

  SELECT vote INTO v_existing FROM contribution_votes
  WHERE contribution_id = v_desc_id AND user_id = p_user_id;

  IF v_existing = 1 THEN
    -- déjà liké → unlike
    DELETE FROM contribution_votes WHERE contribution_id = v_desc_id AND user_id = p_user_id;
    UPDATE place_contributions SET votes_up = GREATEST(0, votes_up - 1) WHERE id = v_desc_id;
    v_liked := false;
  ELSIF v_existing IS NULL THEN
    -- pas de vote → like
    INSERT INTO contribution_votes (contribution_id, user_id, vote) VALUES (v_desc_id, p_user_id, 1);
    UPDATE place_contributions SET votes_up = votes_up + 1 WHERE id = v_desc_id;
    v_liked := true;
  ELSE
    -- ancien downvote (-1) → passe en like
    UPDATE contribution_votes SET vote = 1 WHERE contribution_id = v_desc_id AND user_id = p_user_id;
    UPDATE place_contributions SET votes_up = votes_up + 1 WHERE id = v_desc_id;
    v_liked := true;
  END IF;

  SELECT votes_up INTO v_count FROM place_contributions WHERE id = v_desc_id;
  RETURN json_build_object('success', true, 'liked', v_liked, 'votesUp', v_count);
END; $$;

GRANT EXECUTE ON FUNCTION public.toggle_place_description_like(text,text)
  TO authenticated, service_role;

COMMIT;
