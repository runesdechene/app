-- ============================================
-- MIGRATION 069 : handle_new_user — bon ordre d'operations
-- ============================================
-- Bug : les UPDATE FK echouaient car le nouvel ID n'existait
-- pas encore dans users (violation de FK constraint).
-- Fix : 1) copier l'ancien user avec le nouvel ID
--        2) migrer les FK
--        3) supprimer l'ancien doublon
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
BEGIN
  -- Chercher si un user avec cet email existe deja
  SELECT * INTO v_existing
  FROM public.users
  WHERE LOWER(email_address) = LOWER(COALESCE(NEW.email, ''))
  LIMIT 1;

  IF v_existing.id IS NOT NULL AND v_existing.id != NEW.id::TEXT THEN
    -- 1) Creer un nouveau user avec le nouvel ID (copie de l'ancien)
    INSERT INTO public.users (
      id, email_address, first_name, last_name, gender, rank, role, bio,
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
      v_existing.last_name,
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

    -- 2) Migrer toutes les FK de l'ancien ID vers le nouveau
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

    -- 3) Supprimer l'ancien doublon (plus aucune FK ne pointe dessus)
    DELETE FROM public.users WHERE id = v_existing.id;

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
