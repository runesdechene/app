-- ============================================
-- MIGRATION 090 : Toast new_user apres onboarding, pas apres signup
-- ============================================
-- Probleme : le trigger trg_log_new_user se declenchait sur INSERT users,
-- AVANT l'onboarding. Le first_name etait NULL, donc le toast affichait
-- l'email du joueur (COALESCE(first_name, email_address)).
--
-- Fix : supprimer le trigger. A la place, inserer dans activity_log
-- depuis update_my_profile, uniquement la premiere fois que le joueur
-- choisit son nom (first_name passe de NULL a une valeur).
-- ============================================

-- 1. Supprimer le trigger qui se declenchait trop tot
DROP TRIGGER IF EXISTS trg_log_new_user ON users;
DROP FUNCTION IF EXISTS log_new_user_activity();

-- 2. update_my_profile : ajouter le log new_user au premier onboarding
DROP FUNCTION IF EXISTS public.update_my_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_user_id TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_instagram TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_game_mode TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_name TEXT;
BEGIN
  -- Verifier si c'est le premier onboarding (first_name etait NULL)
  SELECT first_name INTO v_old_name FROM users WHERE id = p_user_id;

  UPDATE users
  SET first_name = COALESCE(p_first_name, first_name),
      bio = p_bio,
      instagram = p_instagram,
      avatar_url = COALESCE(p_avatar_url, avatar_url),
      game_mode = COALESCE(p_game_mode, game_mode),
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Premier onboarding : notifier les autres joueurs avec le vrai nom
  IF v_old_name IS NULL AND p_first_name IS NOT NULL THEN
    INSERT INTO activity_log (type, actor_id, data)
    VALUES (
      'new_user',
      p_user_id,
      jsonb_build_object('actorName', p_first_name)
    );
  END IF;

  RETURN json_build_object('success', true);
END;
$$;
