-- 036_content_points_by_likes_ranking.sql
-- Content points pérennes = basés sur le classement des carnets par likes
-- Rang 1 = 20pts, Rang 2 = 10pts, Rang 3 = 5pts, Rang 4+ = 2pts
-- Recalculé après chaque vote

-- ============================================================
-- 1. Fonction de recalcul des content_points d'un lieu
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_place_content_points(p_place_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  v_rank INT := 0;
  v_pts INT;
  v_faction_totals JSONB := '{}'::JSONB;
  v_current INT;
BEGIN
  -- Reset content_points pour ce lieu
  UPDATE place_influence SET content_points = 0 WHERE place_id = p_place_id;

  -- Parcourir les contributions classées par likes (votes_up - votes_down)
  FOR r IN
    SELECT pc.faction_id, (pc.votes_up - pc.votes_down) AS net_votes
    FROM place_contributions pc
    WHERE pc.place_id = p_place_id
      AND pc.type = 'carnet'
      AND pc.faction_id IS NOT NULL
    ORDER BY (pc.votes_up - pc.votes_down) DESC, pc.created_at ASC
  LOOP
    v_rank := v_rank + 1;
    v_pts := CASE
      WHEN v_rank = 1 THEN 20
      WHEN v_rank = 2 THEN 10
      WHEN v_rank = 3 THEN 5
      ELSE 2
    END;

    -- Accumuler par faction
    v_current := COALESCE((v_faction_totals->>r.faction_id)::INT, 0);
    v_faction_totals := jsonb_set(v_faction_totals, ARRAY[r.faction_id], to_jsonb(v_current + v_pts));
  END LOOP;

  -- Appliquer les totaux
  FOR r IN SELECT key AS faction_id, value::INT AS pts FROM jsonb_each_text(v_faction_totals)
  LOOP
    INSERT INTO place_influence (place_id, faction_id, content_points, updated_at)
    VALUES (p_place_id, r.faction_id, r.pts, NOW())
    ON CONFLICT (place_id, faction_id)
    DO UPDATE SET content_points = r.pts, updated_at = NOW();
  END LOOP;
END;
$$;

-- ============================================================
-- 2. vote_contribution — recalcule après chaque vote
-- ============================================================
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

  RETURN json_build_object('success', true,
    'newVotesUp', (SELECT votes_up FROM place_contributions WHERE id = p_contribution_id),
    'newVotesDown', (SELECT votes_down FROM place_contributions WHERE id = p_contribution_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.vote_contribution(TEXT, INT, INT) TO authenticated;

-- ============================================================
-- 3. contribute_to_place — plus de content_points directs
--    On garde exploration + erudition pour le joueur
-- ============================================================
CREATE OR REPLACE FUNCTION public.contribute_to_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_type TEXT,
  p_content TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_faction_id TEXT;
  v_exploration_gain INT := 0;
  v_erudition_gain INT := 0;
  v_contribution_id INT;
BEGIN
  SELECT faction_id INTO v_faction_id FROM users WHERE id = p_user_id;
  IF v_faction_id IS NULL THEN
    RETURN json_build_object('error', 'no_faction');
  END IF;

  INSERT INTO place_contributions (place_id, user_id, faction_id, type, content, image_url)
  VALUES (p_place_id, p_user_id, v_faction_id, p_type, p_content, p_image_url)
  ON CONFLICT (place_id, user_id, type)
  DO UPDATE SET content = COALESCE(EXCLUDED.content, place_contributions.content),
               image_url = COALESCE(EXCLUDED.image_url, place_contributions.image_url),
               updated_at = NOW()
  RETURNING id INTO v_contribution_id;

  -- Gains perso (exploration + erudition) — PAS d'influence content sur le lieu
  IF p_type = 'photo' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_photo'), 5) INTO v_exploration_gain;
  ELSIF p_type = 'carnet' THEN
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'exploration_add_carnet'), 5) INTO v_exploration_gain;
    SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'erudition_add_carnet'), 3) INTO v_erudition_gain;
  END IF;

  UPDATE users SET
    exploration_points = exploration_points + v_exploration_gain,
    erudition_points = erudition_points + v_erudition_gain
  WHERE id = p_user_id;

  -- Recalculer les content_points (le nouveau carnet entre dans le classement à 0 likes)
  PERFORM recalc_place_content_points(p_place_id);

  RETURN json_build_object(
    'success', true,
    'contributionId', v_contribution_id,
    'explorationGain', v_exploration_gain,
    'eruditionGain', v_erudition_gain
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.contribute_to_place(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 4. Recalculer tous les lieux existants
-- ============================================================
DO $$
DECLARE
  v_place_id TEXT;
BEGIN
  -- Reset tous les content_points
  UPDATE place_influence SET content_points = 0;

  -- Recalculer pour chaque lieu qui a des contributions
  FOR v_place_id IN SELECT DISTINCT place_id FROM place_contributions WHERE type = 'carnet'
  LOOP
    PERFORM recalc_place_content_points(v_place_id);
  END LOOP;

  -- Supprimer les entrées vides (placed = 0 et content = 0)
  DELETE FROM place_influence WHERE placed_points = 0 AND content_points = 0;
END;
$$;
