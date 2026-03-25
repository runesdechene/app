-- Fix: bio et instagram étaient écrasés à NULL par GameModeModal/ConquestToggle
-- car update_my_profile ne les protégeait pas avec COALESCE.

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
  SELECT first_name INTO v_old_name FROM users WHERE id = p_user_id;

  UPDATE users
  SET first_name  = COALESCE(p_first_name, first_name),
      bio         = COALESCE(p_bio, bio),
      instagram   = COALESCE(p_instagram, instagram),
      avatar_url  = COALESCE(p_avatar_url, avatar_url),
      game_mode   = COALESCE(p_game_mode, game_mode),
      updated_at  = NOW()
  WHERE id = p_user_id;

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
