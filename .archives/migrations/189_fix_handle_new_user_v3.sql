-- ============================================
-- MIGRATION 189 : handle_new_user — FIX URGENT v3
-- ============================================
-- Bug critique : "Database error saving new user" pour les anciens membres.
-- La version 078 de handle_new_user est obsolete : il manque les FK
-- ajoutees depuis (territory_*, user_fragments, fragment_ability_uses,
-- purchase_log) + les nouvelles colonnes (vitalite_*, shopify_*, account_source).
--
-- Causes du crash :
-- 1. territory_name_proposals et territory_name_votes referent users(id)
--    SANS ON DELETE CASCADE → le DELETE de l'ancien user echoue.
-- 2. L'EXCEPTION handler inserait email='' → UNIQUE violation si un
--    ghost user existait deja avec email=''.
-- 3. user_fragments, fragment_ability_uses CASCADE-deleted = perte data.
-- 4. Colonnes vitalite/shopify non copiees lors de la migration.
--
-- Fix :
-- 1. Migrer TOUTES les FK (y compris les nouvelles tables)
-- 2. Copier TOUTES les colonnes actuelles
-- 3. Fallback email = unique hash pour eviter les conflits
-- ============================================

-- D'abord, nettoyer les ghost users avec email vide (restes de migrations echouees)
-- On les supprime seulement s'ils n'ont aucune donnee associee
DELETE FROM public.users
WHERE email_address = ''
  AND id NOT IN (SELECT DISTINCT user_id FROM places_discovered)
  AND id NOT IN (SELECT DISTINCT author_id FROM places WHERE author_id IS NOT NULL)
  AND id NOT IN (SELECT DISTINCT claimed_by FROM places WHERE claimed_by IS NOT NULL)
  AND id NOT IN (SELECT DISTINCT user_id FROM chat_messages)
  AND id NOT IN (SELECT user_id FROM user_fragments);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_err TEXT;
  v_max_e NUMERIC(4,1);
  v_max_c NUMERIC(6,1);
  v_max_b NUMERIC(6,1);
BEGIN
  -- Chercher si un user avec cet email existe deja
  SELECT * INTO v_existing
  FROM public.users
  WHERE LOWER(email_address) = LOWER(COALESCE(NEW.email, ''))
  LIMIT 1;

  IF v_existing.id IS NOT NULL AND v_existing.id != NEW.id::TEXT THEN
    -- =============================================
    -- ANCIEN COMPTE PRE-SUPABASE : migrer vers le nouvel auth ID
    -- =============================================
    BEGIN
      -- 0) Vider l'email et shopify_customer_id de l'ancien user pour liberer les index uniques
      UPDATE public.users SET email_address = '', shopify_customer_id = NULL WHERE id = v_existing.id;

      -- 1) Creer un nouveau user avec le nouvel ID (copie COMPLETE de l'ancien)
      INSERT INTO public.users (
        id, email_address, first_name, gender, rank, role, bio,
        avatar_url, display_name, instagram, location_name, location_zip,
        faction_id, energy_points, energy_reset_at,
        conquest_points, conquest_reset_at,
        construction_points, construction_reset_at,
        max_energy, max_conquest, max_construction,
        vitalite_points, max_vitalite, vitalite_reset_at,
        notoriety_points, displayed_general_title_ids,
        displayed_title_ids_v3, game_mode,
        shopify_customer_id, account_source,
        is_active, website_url,
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
        COALESCE(v_existing.vitalite_points, 5),
        COALESCE(v_existing.max_vitalite, 5),
        COALESCE(v_existing.vitalite_reset_at, NOW()),
        v_existing.notoriety_points,
        v_existing.displayed_general_title_ids,
        v_existing.displayed_title_ids_v3,
        v_existing.game_mode,
        v_existing.shopify_customer_id,
        v_existing.account_source,
        v_existing.is_active,
        v_existing.website_url,
        v_existing.created_at,
        NOW()
      ON CONFLICT (id) DO NOTHING;

      -- 2) Migrer TOUTES les FK de l'ancien ID vers le nouveau
      -- === Tables originales (depuis 078) ===
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

      -- === NOUVELLES TABLES (ajoutees apres 078) ===
      UPDATE territory_name_proposals SET proposed_by = NEW.id::TEXT WHERE proposed_by = v_existing.id;
      UPDATE territory_name_votes SET voter_id = NEW.id::TEXT WHERE voter_id = v_existing.id;
      UPDATE user_fragments SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE fragment_ability_uses SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE purchase_log SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;

      -- 3) Supprimer l'ancien doublon (email deja vide, FKs migrees)
      DELETE FROM public.users WHERE id = v_existing.id;

    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      RAISE WARNING '[handle_new_user] Migration failed for % (old_id=%, new_id=%): %',
        NEW.email, v_existing.id, NEW.id, v_err;

      -- Fallback : creer un user basique avec email UNIQUE (pas '' qui peut conflictuer)
      INSERT INTO public.users (id, email_address, first_name, gender, rank, role, bio, created_at, updated_at)
      VALUES (
        NEW.id::TEXT,
        '__migrated_' || NEW.id::TEXT,
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
    -- =============================================
    -- PAS DE DOUBLON : insert normal
    -- =============================================
    SELECT max_energy, max_conquest, max_construction
    INTO v_max_e, v_max_c, v_max_b
    FROM public.users
    WHERE role = 'user'
    ORDER BY created_at ASC
    LIMIT 1;

    v_max_e := COALESCE(v_max_e, 5.0);
    v_max_c := COALESCE(v_max_c, 5.0);
    v_max_b := COALESCE(v_max_b, 5.0);

    INSERT INTO public.users (
      id, email_address, gender, rank, role, bio,
      max_energy, max_conquest, max_construction,
      energy_points, conquest_points, construction_points,
      energy_reset_at, conquest_reset_at, construction_reset_at,
      created_at, updated_at
    )
    VALUES (
      NEW.id::TEXT,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'gender', 'unknown'),
      'guest', 'user', '',
      v_max_e, v_max_c, v_max_b,
      v_max_e, v_max_c, v_max_b,
      NOW(), NOW(), NOW(),
      NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email_address = COALESCE(EXCLUDED.email_address, public.users.email_address),
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;
