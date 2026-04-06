-- ============================================
-- 007: Auto-create public.users row on auth signup
-- Trigger qui cree automatiquement une ligne dans public.users
-- quand un nouvel utilisateur s'inscrit via Supabase Auth (OTP)
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email_address,
    last_name,
    gender,
    rank,
    role,
    bio,
    created_at,
    updated_at
  ) VALUES (
    NEW.id::TEXT,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'Aventurier'),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'unknown'),
    'guest',
    'user',
    '',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email_address = COALESCE(EXCLUDED.email_address, public.users.email_address),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Supprime le trigger s'il existe deja
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Cree le trigger sur la table auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
