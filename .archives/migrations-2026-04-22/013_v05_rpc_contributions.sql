-- 013_v05_rpc_contributions.sql
-- V0.5 : Ajouter une contribution sur un lieu + voter

CREATE OR REPLACE FUNCTION public.contribute_to_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_type TEXT,          -- 'carnet', 'photo', 'accessibility', 'season', 'warning'
  p_content TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_influence_gain INT := 0;
  v_exploration_gain INT := 0;
  v_erudition_gain INT := 0;
  v_contribution_id INT;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  -- Insérer la contribution (UNIQUE constraint = 1 par type par user)
  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, image_url)
  VALUES (p_place_id, p_user_id, v_faction_id, p_type, p_content, p_image_url)
  ON CONFLICT (place_id, user_id, type)
  DO UPDATE SET content = COALESCE(EXCLUDED.content, place_contributions.content),
               image_url = COALESCE(EXCLUDED.image_url, place_contributions.image_url),
               updated_at = NOW()
  RETURNING id INTO v_contribution_id;

  -- Gains selon le type
  IF p_type = 'photo' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_add_photo'), 5) INTO v_influence_gain;
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_photo'), 1) INTO v_exploration_gain;
  ELSIF p_type = 'carnet' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_add_carnet'), 10) INTO v_influence_gain;
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_carnet'), 1) INTO v_exploration_gain;
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'erudition_add_carnet'), 1) INTO v_erudition_gain;
  END IF;

  -- Créditer le joueur
  UPDATE users SET
    influence_stock = influence_stock + v_influence_gain,
    exploration_points = exploration_points + v_exploration_gain,
    erudition_points = erudition_points + v_erudition_gain
  WHERE id = p_user_id;

  -- Ajouter de l'influence de contenu sur le lieu
  IF v_influence_gain > 0 THEN
    INSERT INTO place_influence (place_id, faction_id, content_points, updated_at)
    VALUES (p_place_id, v_faction_id, v_influence_gain, NOW())
    ON CONFLICT (place_id, faction_id)
    DO UPDATE SET content_points = place_influence.content_points + v_influence_gain,
                 updated_at = NOW();
  END IF;

  RETURN json_build_object(
    'success', true,
    'contributionId', v_contribution_id,
    'influenceGain', v_influence_gain,
    'explorationGain', v_exploration_gain,
    'eruditionGain', v_erudition_gain
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.contribute_to_place(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Voter sur une contribution
CREATE OR REPLACE FUNCTION public.vote_contribution(
  p_user_id TEXT,
  p_contribution_id INT,
  p_vote INT           -- 1 = up, -1 = down
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

  -- Pas de vote sur son propre contenu
  IF v_contrib.user_id = p_user_id THEN
    RETURN json_build_object('error', 'cannot_vote_own');
  END IF;

  -- Vérifier vote existant
  SELECT vote INTO v_old_vote FROM contribution_votes
  WHERE contribution_id = p_contribution_id AND user_id = p_user_id;

  IF v_old_vote IS NOT NULL THEN
    IF v_old_vote = p_vote THEN
      RETURN json_build_object('error', 'already_voted');
    END IF;
    -- Changer de vote
    UPDATE contribution_votes SET vote = p_vote WHERE contribution_id = p_contribution_id AND user_id = p_user_id;
    IF p_vote = 1 THEN
      UPDATE place_contributions SET votes_up = votes_up + 1, votes_down = votes_down - 1 WHERE id = p_contribution_id;
    ELSE
      UPDATE place_contributions SET votes_up = votes_up - 1, votes_down = votes_down + 1 WHERE id = p_contribution_id;
    END IF;
  ELSE
    -- Nouveau vote
    INSERT INTO contribution_votes (contribution_id, user_id, vote) VALUES (p_contribution_id, p_user_id, p_vote);
    IF p_vote = 1 THEN
      UPDATE place_contributions SET votes_up = votes_up + 1 WHERE id = p_contribution_id;
      -- +1 influence permanente pour l'auteur sur le lieu
      INSERT INTO place_influence (place_id, faction_id, content_points, updated_at)
      VALUES (v_contrib.place_id, v_contrib.faction_id, 1, NOW())
      ON CONFLICT (place_id, faction_id)
      DO UPDATE SET content_points = place_influence.content_points + 1, updated_at = NOW();
    ELSE
      UPDATE place_contributions SET votes_down = votes_down + 1 WHERE id = p_contribution_id;
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'newVotesUp', (SELECT votes_up FROM place_contributions WHERE id = p_contribution_id),
    'newVotesDown', (SELECT votes_down FROM place_contributions WHERE id = p_contribution_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.vote_contribution(TEXT, INT, INT) TO authenticated;
