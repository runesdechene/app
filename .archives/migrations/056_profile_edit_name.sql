-- ============================================
-- 056 : Ajouter p_first_name a update_my_profile
-- ============================================

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_user_id TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_bio TEXT DEFAULT NULL,
  p_instagram TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET first_name = COALESCE(p_first_name, first_name),
      bio = p_bio,
      instagram = p_instagram,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;
