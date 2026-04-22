-- ============================================
-- MIGRATION 089 : Fix handle_new_user — rank manquant dans ELSE branch
-- ============================================
-- Bug critique : les signups de NOUVEAUX comptes plantent avec
-- "Database error saving new user" depuis ~5 jours.
--
-- Cause racine : la colonne users.rank est NOT NULL sans DEFAULT en prod
-- (quelqu'un a probablement fait ALTER COLUMN ... DROP DEFAULT).
-- Le trigger handle_new_user, dans sa branche ELSE (nouveau user),
-- n'incluait pas `rank` dans l'INSERT → Postgres rejetait.
--
-- Le DOUBLON branch (réactivation ancien compte) fournissait déjà
-- `COALESCE(v_existing.rank, 'guest')`, d'où le symptôme "les
-- réactivations marchent, pas les nouveaux".
--
-- Fix : rewrite handle_new_user avec rank = 'guest' dans l'INSERT ELSE.
-- Par précaution : restaurer aussi DEFAULT 'guest' sur la colonne
-- (bénin, c'est la valeur historique).
-- ============================================

BEGIN;

-- 1. Restaurer le default historique sur la colonne (belt + suspenders)
ALTER TABLE public.users ALTER COLUMN rank SET DEFAULT 'guest';

-- 2. Rewrite handle_new_user avec rank inclus dans l'INSERT ELSE
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
      UPDATE public.users SET email_address = '', shopify_customer_id = NULL WHERE id = v_existing.id;

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
        COALESCE(v_existing.rank, 'guest'),
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
      UPDATE territory_name_proposals SET proposed_by = NEW.id::TEXT WHERE proposed_by = v_existing.id;
      UPDATE territory_name_votes SET voter_id = NEW.id::TEXT WHERE voter_id = v_existing.id;
      UPDATE user_fragments SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE fragment_ability_uses SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;
      UPDATE purchase_log SET user_id = NEW.id::TEXT WHERE user_id = v_existing.id;

      DELETE FROM public.users WHERE id = v_existing.id;

    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      RAISE WARNING '[handle_new_user] Migration failed for % (old_id=%, new_id=%): %',
        NEW.email, v_existing.id, NEW.id, v_err;

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
    SELECT COALESCE(value::NUMERIC, 5)
    INTO v_max_e
    FROM app_settings
    WHERE key = 'default_max_energy';

    v_max_e := COALESCE(v_max_e, 5.0);

    -- ⚠️ FIX MIGRATION 089 : `rank` ajouté (colonne NOT NULL sans default en prod)
    INSERT INTO public.users (
      id, email_address, first_name, rank, role,
      energy_points, max_energy, account_source,
      created_at, updated_at
    )
    VALUES (
      NEW.id::TEXT,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'Aventurier'),
      'guest',
      'user',
      v_max_e,
      v_max_e,
      'app',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;

-- ============================================
-- SMOKE TEST post-apply
-- ============================================
-- Créer un nouveau compte depuis l'app (email jamais utilisé).
-- Doit passer sans "Database error saving new user".
-- Vérifier ensuite : SELECT id, email_address, rank, role, max_energy
--                    FROM users WHERE id = '<new_user_id>';
-- → rank doit être 'guest', role 'user', max_energy = default_max_energy.
