-- ============================================
-- MIGRATION 068 : handle_new_user — version defensive
-- ============================================
-- Si la migration d'ID echoue (FK constraint, unique index, etc.),
-- on supprime l'ancien user (les FK CASCADE gerent le nettoyage)
-- et on cree un nouveau user propre.
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
  WHERE LOWER(email_address) = LOWER(COALESCE(NEW.email, ''))
  LIMIT 1;

  IF v_existing_id IS NOT NULL AND v_existing_id != NEW.id::TEXT THEN
    -- L'email existe avec un ancien ID : tenter la migration
    BEGIN
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
      UPDATE place_claims SET previous_claimed_by = NEW.id::TEXT WHERE previous_claimed_by = v_existing_id;

      -- Migrer l'ID de l'user
      UPDATE public.users
      SET id = NEW.id::TEXT,
          updated_at = NOW()
      WHERE id = v_existing_id;

    EXCEPTION WHEN OTHERS THEN
      -- La migration a echoue : supprimer l'ancien user
      -- Les FK avec ON DELETE CASCADE nettoient automatiquement
      -- Les FK sans CASCADE (hub tables, activity_log) : on nettoie manuellement
      UPDATE hub_community_photos SET user_id = NULL WHERE user_id = v_existing_id;
      UPDATE hub_community_photos SET moderated_by = NULL WHERE moderated_by = v_existing_id;
      UPDATE hub_photo_submissions SET user_id = NULL WHERE user_id = v_existing_id;
      UPDATE hub_photo_submissions SET moderated_by = NULL WHERE moderated_by = v_existing_id;
      UPDATE hub_review_submissions SET user_id = NULL WHERE user_id = v_existing_id;
      UPDATE hub_review_submissions SET moderated_by = NULL WHERE moderated_by = v_existing_id;
      UPDATE activity_log SET actor_id = NULL WHERE actor_id = v_existing_id;
      UPDATE place_claims SET previous_claimed_by = NULL WHERE previous_claimed_by = v_existing_id;

      DELETE FROM public.users WHERE id = v_existing_id;

      -- Creer un user propre avec le nouvel ID
      INSERT INTO public.users (id, email_address, last_name, gender, rank, role, bio, created_at, updated_at)
      VALUES (
        NEW.id::TEXT,
        COALESCE(NEW.email, ''),
        'Aventurier', 'unknown', 'guest', 'user', '',
        NOW(), NOW()
      );
    END;

  ELSE
    -- Pas de doublon : insert normal
    INSERT INTO public.users (id, email_address, last_name, gender, rank, role, bio, created_at, updated_at)
    VALUES (
      NEW.id::TEXT,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'Aventurier'),
      COALESCE(NEW.raw_user_meta_data->>'gender', 'unknown'),
      'guest', 'user', '',
      NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email_address = COALESCE(EXCLUDED.email_address, public.users.email_address),
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;
