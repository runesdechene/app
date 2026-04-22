-- 082_unlike_contribution.sql
-- Fix runtime bug : l'appel `unlike_contribution` dans CarnetCard.tsx
-- pointait vers une RPC inexistante → l'unlike de carnet était cassé silencieusement.
-- On crée une RPC dédiée qui supprime le vote et décrémente votes_up,
-- en gardant la symétrie sémantique avec vote_contribution (p_vote=1).

CREATE OR REPLACE FUNCTION public.unlike_contribution(
  p_user_id TEXT,
  p_contribution_id INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contrib RECORD;
  v_old_vote INT;
BEGIN
  SELECT * INTO v_contrib FROM place_contributions WHERE id = p_contribution_id;
  IF v_contrib.id IS NULL THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  SELECT vote INTO v_old_vote FROM contribution_votes
  WHERE contribution_id = p_contribution_id AND user_id = p_user_id;

  -- Seul un like existant (+1) peut être "unliké". Si rien ou déjà -1, no-op succès.
  IF v_old_vote IS NULL THEN
    RETURN json_build_object('success', true, 'changed', false);
  END IF;

  IF v_old_vote = 1 THEN
    DELETE FROM contribution_votes
    WHERE contribution_id = p_contribution_id AND user_id = p_user_id;

    UPDATE place_contributions
    SET votes_up = GREATEST(0, votes_up - 1)
    WHERE id = p_contribution_id;

    -- Recalc content_points du lieu
    PERFORM recalc_place_content_points(v_contrib.place_id);
  END IF;

  RETURN json_build_object('success', true, 'changed', v_old_vote = 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlike_contribution(TEXT, INT) TO authenticated;
