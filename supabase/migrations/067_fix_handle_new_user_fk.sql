-- ============================================
-- MIGRATION 067 : Fix handle_new_user — cascade FK
-- ============================================
-- Quand un ancien compte (email dans users mais pas dans auth)
-- essaie de se connecter, le trigger doit migrer l'ancien ID
-- vers le nouveau ID auth. Il faut aussi mettre a jour
-- toutes les tables qui referencent users.id.
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
  -- Chercher si un user avec cet email existe deja
  SELECT id INTO v_existing_id
  FROM public.users
  WHERE email_address = COALESCE(NEW.email, '')
  LIMIT 1;

  IF v_existing_id IS NOT NULL AND v_existing_id != NEW.id::TEXT THEN
    -- L'email existe avec un autre ID : migrer toutes les FK vers le nouvel ID

    -- Tables avec user_id
    UPDATE places_discovered SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE place_claims SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE chat_messages SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE places_viewed SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE places_liked SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE places_explored SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE places_bookmarked SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE reviews SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE image_media SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE member_codes SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE hub_community_photos SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE hub_photo_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;
    UPDATE hub_review_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing_id;

    -- Tables avec moderated_by
    UPDATE hub_community_photos SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing_id;
    UPDATE hub_photo_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing_id;
    UPDATE hub_review_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing_id;

    -- Tables avec author_id / claimed_by / actor_id
    UPDATE places SET author_id = NEW.id::TEXT WHERE author_id = v_existing_id;
    UPDATE places SET claimed_by = NEW.id::TEXT WHERE claimed_by = v_existing_id;
    UPDATE activity_log SET actor_id = NEW.id::TEXT WHERE actor_id = v_existing_id;

    -- place_claims.previous_claimed_by (tracking conquete)
    UPDATE place_claims SET previous_claimed_by = NEW.id::TEXT WHERE previous_claimed_by = v_existing_id;

    -- Enfin, mettre a jour l'ID de l'user
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
