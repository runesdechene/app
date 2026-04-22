-- 015_v05_rpc_decay_rating_wishlist.sql
-- V0.5 : Decay hebdomadaire + noter un lieu + wishlist

-- Decay : à appeler via un cron Supabase (pg_cron) ou manuellement chaque semaine
CREATE OR REPLACE FUNCTION public.decay_placed_influence()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_decay INT;
  v_affected INT;
BEGIN
  SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'influence_decay_per_week'), 1) INTO v_decay;

  UPDATE place_influence
  SET placed_points = GREATEST(0, placed_points - v_decay),
      updated_at = NOW()
  WHERE placed_points > 0;

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  -- Nettoyer les lignes mortes (0 placé + 0 contenu)
  DELETE FROM place_influence WHERE placed_points = 0 AND content_points = 0;

  RETURN json_build_object('decayed', v_affected, 'decayAmount', v_decay);
END;
$$;

-- Rate a place (explorateurs uniquement)
CREATE OR REPLACE FUNCTION public.rate_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_rating INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_explorer BOOLEAN;
  v_is_author BOOLEAN;
BEGIN
  -- Vérifier que le joueur est explorateur OU auteur du lieu
  SELECT EXISTS(SELECT 1 FROM place_explorers WHERE place_id = p_place_id AND user_id = p_user_id)
  INTO v_is_explorer;

  SELECT EXISTS(SELECT 1 FROM places WHERE id = p_place_id AND author_id = p_user_id)
  INTO v_is_author;

  IF NOT v_is_explorer AND NOT v_is_author THEN
    RETURN json_build_object('error', 'must_be_explorer');
  END IF;

  INSERT INTO place_ratings (place_id, user_id, rating)
  VALUES (p_place_id, p_user_id, p_rating)
  ON CONFLICT (place_id, user_id)
  DO UPDATE SET rating = p_rating, updated_at = NOW();

  RETURN json_build_object('success', true,
    'avgRating', (SELECT AVG(rating)::NUMERIC(2,1) FROM place_ratings WHERE place_id = p_place_id),
    'count', (SELECT COUNT(*) FROM place_ratings WHERE place_id = p_place_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.rate_place(TEXT, TEXT, INT) TO authenticated;

-- Toggle wishlist
CREATE OR REPLACE FUNCTION public.toggle_wishlist(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM place_wishlist WHERE place_id = p_place_id AND user_id = p_user_id)
  INTO v_exists;

  IF v_exists THEN
    DELETE FROM place_wishlist WHERE place_id = p_place_id AND user_id = p_user_id;
    RETURN json_build_object('wishlisted', false);
  ELSE
    INSERT INTO place_wishlist (place_id, user_id) VALUES (p_place_id, p_user_id);
    RETURN json_build_object('wishlisted', true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_wishlist(TEXT, TEXT) TO authenticated;
