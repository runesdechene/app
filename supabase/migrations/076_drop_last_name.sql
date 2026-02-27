-- ============================================
-- MIGRATION 076 : Supprimer last_name
-- ============================================
-- La colonne last_name n'est plus utilisee.
-- On la supprime et on met a jour les fonctions
-- qui la referencent.
-- ============================================

-- 1. Supprimer la colonne
ALTER TABLE public.users DROP COLUMN IF EXISTS last_name;

-- 2. Mettre a jour handle_new_user (retirer last_name)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_err TEXT;
BEGIN
  SELECT * INTO v_existing
  FROM public.users
  WHERE LOWER(email_address) = LOWER(COALESCE(NEW.email, ''))
  LIMIT 1;

  IF v_existing.id IS NOT NULL AND v_existing.id != NEW.id::TEXT THEN
    BEGIN
      UPDATE public.users SET email_address = '' WHERE id = v_existing.id;

      INSERT INTO public.users (
        id, email_address, first_name, gender, rank, role, bio,
        avatar_url, display_name, instagram, location_name, location_zip,
        faction_id, energy_points, energy_reset_at,
        conquest_points, conquest_reset_at,
        construction_points, construction_reset_at,
        max_energy, max_conquest, max_construction,
        notoriety_points, displayed_general_title_ids,
        is_active, website_url, profile_image_id,
        created_at, updated_at
      )
      SELECT
        NEW.id::TEXT,
        v_existing.email_address,
        v_existing.first_name,
        v_existing.gender,
        v_existing.rank,
        v_existing.role,
        v_existing.bio,
        v_existing.avatar_url,
        v_existing.display_name,
        v_existing.instagram,
        v_existing.location_name,
        v_existing.location_zip,
        v_existing.faction_id,
        v_existing.energy_points,
        v_existing.energy_reset_at,
        v_existing.conquest_points,
        v_existing.conquest_reset_at,
        v_existing.construction_points,
        v_existing.construction_reset_at,
        v_existing.max_energy,
        v_existing.max_conquest,
        v_existing.max_construction,
        v_existing.notoriety_points,
        v_existing.displayed_general_title_ids,
        v_existing.is_active,
        v_existing.website_url,
        v_existing.profile_image_id,
        v_existing.created_at,
        NOW()
      ON CONFLICT (id) DO NOTHING;

      UPDATE places_discovered SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE place_claims SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE chat_messages SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_viewed SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_liked SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_explored SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE places_bookmarked SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE reviews SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE image_media SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE member_codes SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_community_photos SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_photo_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_review_submissions SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE hub_community_photos SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE hub_photo_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE hub_review_submissions SET moderated_by = NEW.id::TEXT WHERE moderated_by = v_existing.id;
      UPDATE places SET author_id = NEW.id::TEXT WHERE author_id = v_existing.id;
      UPDATE places SET claimed_by = NEW.id::TEXT WHERE claimed_by = v_existing.id;
      UPDATE activity_log SET actor_id = NEW.id::TEXT WHERE actor_id = v_existing.id;
      UPDATE place_claims SET previous_claimed_by = NEW.id::TEXT WHERE previous_claimed_by = v_existing.id;

      DELETE FROM public.users WHERE id = v_existing.id;

    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      RAISE WARNING '[handle_new_user] Migration failed for % (old_id=%, new_id=%): %',
        NEW.email, v_existing.id, NEW.id, v_err;

      INSERT INTO public.users (id, email_address, first_name, gender, rank, role, bio, created_at, updated_at)
      VALUES (
        NEW.id::TEXT,
        '',
        COALESCE(v_existing.first_name, 'Aventurier'),
        COALESCE(v_existing.gender, 'unknown'),
        COALESCE(v_existing.rank, 'guest'),
        COALESCE(v_existing.role, 'user'),
        COALESCE(v_existing.bio, ''),
        NOW(), NOW()
      )
      ON CONFLICT (id) DO NOTHING;
    END;

  ELSE
    INSERT INTO public.users (id, email_address, gender, rank, role, bio, created_at, updated_at)
    VALUES (
      NEW.id::TEXT,
      COALESCE(NEW.email, ''),
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

-- 3. Mettre a jour create_user_from_submission (retirer p_last_name)
DROP FUNCTION IF EXISTS public.create_user_from_submission(VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_user_from_submission(VARCHAR, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.create_user_from_submission(
  p_id VARCHAR(255),
  p_email TEXT,
  p_first_name TEXT,
  p_instagram TEXT,
  p_location_name TEXT DEFAULT NULL,
  p_location_zip TEXT DEFAULT NULL
)
RETURNS VARCHAR(255)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO users (id, email_address, first_name, instagram, location_name, location_zip, role, is_active, rank, biography)
  VALUES (p_id, p_email, p_first_name, p_instagram, p_location_name, p_location_zip, 'user', true, 0, '');
  RETURN p_id;
END;
$$;
