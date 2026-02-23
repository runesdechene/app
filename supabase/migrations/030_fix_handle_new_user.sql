-- ============================================
-- MIGRATION 030 : Fix handle_new_user trigger
-- ============================================
-- Problème : si un email existe déjà dans public.users (créé via Hub)
-- mais pas dans auth.users, le trigger échoue car il essaie d'INSERT
-- avec un nouvel ID alors que l'email existe déjà.
-- Fix : d'abord chercher par email, mettre à jour l'ID si trouvé,
-- sinon insérer normalement.
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id TEXT;
BEGIN
  -- Chercher si un user avec cet email existe déjà
  SELECT id INTO v_existing_id
  FROM public.users
  WHERE email_address = COALESCE(NEW.email, '')
  LIMIT 1;

  IF v_existing_id IS NOT NULL AND v_existing_id != NEW.id::TEXT THEN
    -- L'email existe avec un autre ID : mettre à jour l'ID pour matcher auth
    UPDATE public.users
    SET id = NEW.id::TEXT,
        updated_at = NOW()
    WHERE id = v_existing_id;
  ELSE
    -- Pas de doublon : insert normal avec ON CONFLICT sur id
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
  END IF;

  RETURN NEW;
END;
$$;
