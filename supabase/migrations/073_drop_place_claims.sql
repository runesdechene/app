-- 073_drop_place_claims.sql
-- WHY: Sprint Purification (mai 2026) — la table place_claims est legacy
--      du système de claim V0 (avant V0.5 influence). Elle n'est plus
--      référencée nulle part dans le code TS. Cleanup déjà flagué dès la
--      mig 011 ("cleanup futur").
--
-- Les colonnes places.claimed_by / claimed_at / claimed_avatar_url /
-- fortification_level restent intactes pour le moment — leur retrait est
-- prévu dans le batch B7 du sprint (bascule sur le système d'influence
-- V0.5+ comme source de vérité unique pour "qui contrôle ce lieu").
--
-- 3 fonctions baseline référencent place_claims dans leur corps et doivent
-- être redéfinies SANS ces UPDATE avant le DROP, sinon elles planteraient
-- à l'exécution :
--   - handle_new_user()        — trigger Firebase→Supabase auto-migration
--   - migrate_user_to_auth_id  — appelée depuis usePlayer.ts (auto-migration)
--   - rename_faction           — outil admin Hub Factions.tsx

-- ============================================================
-- 1. Redéfinir handle_new_user() sans les UPDATE place_claims
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_existing RECORD;
  v_err TEXT;
  v_max_e NUMERIC(4,1);
BEGIN
  SELECT * INTO v_existing
  FROM public.users
  WHERE LOWER(email_address) = LOWER(COALESCE(NEW.email, ''))
  LIMIT 1;

  IF v_existing.id IS NOT NULL AND v_existing.id != NEW.id::TEXT THEN
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
    SELECT COALESCE(value::NUMERIC, 5)
    INTO v_max_e
    FROM app_settings
    WHERE key = 'default_max_energy';

    v_max_e := COALESCE(v_max_e, 5.0);

    INSERT INTO public.users (
      id, email_address, first_name, rank, role,
      energy_points, max_energy, account_source,
      created_at, updated_at
    )
    VALUES (
      NEW.id::TEXT,
      COALESCE(NEW.email, ''),
      NEW.raw_user_meta_data->>'first_name',
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

-- ============================================================
-- 2. Redéfinir migrate_user_to_auth_id() sans les UPDATE place_claims
-- ============================================================

CREATE OR REPLACE FUNCTION public.migrate_user_to_auth_id(p_old_id text, p_new_id text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_email TEXT;
  v_err TEXT;
BEGIN
  IF auth.uid()::TEXT != p_new_id THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT email_address INTO v_email FROM public.users WHERE id = p_old_id;
  IF v_email IS NULL THEN
    RETURN json_build_object('error', 'old_user_not_found');
  END IF;

  DELETE FROM public.users
  WHERE id = p_new_id
    AND (email_address LIKE '__migrated_%' OR email_address = '');

  UPDATE public.users SET email_address = '', shopify_customer_id = NULL WHERE id = p_old_id;

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
    p_new_id,
    v_email,
    first_name, gender, rank, role, bio,
    avatar_url, display_name, instagram, location_name, location_zip,
    faction_id, energy_points, energy_reset_at,
    conquest_points, conquest_reset_at,
    construction_points, construction_reset_at,
    max_energy, max_conquest, max_construction,
    COALESCE(vitalite_points, 5), COALESCE(max_vitalite, 5), COALESCE(vitalite_reset_at, NOW()),
    notoriety_points, displayed_general_title_ids,
    displayed_title_ids_v3, game_mode,
    shopify_customer_id, account_source,
    is_active, website_url,
    created_at, NOW()
  FROM public.users WHERE id = p_old_id
  ON CONFLICT (id) DO NOTHING;

  UPDATE places_discovered SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE chat_messages SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_viewed SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_liked SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_explored SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE places_bookmarked SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE reviews SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE image_media SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE member_codes SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_community_photos SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_photo_submissions SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_review_submissions SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE hub_community_photos SET moderated_by = p_new_id WHERE moderated_by = p_old_id;
  UPDATE hub_photo_submissions SET moderated_by = p_new_id WHERE moderated_by = p_old_id;
  UPDATE hub_review_submissions SET moderated_by = p_new_id WHERE moderated_by = p_old_id;
  UPDATE places SET author_id = p_new_id WHERE author_id = p_old_id;
  UPDATE places SET claimed_by = p_new_id WHERE claimed_by = p_old_id;
  UPDATE activity_log SET actor_id = p_new_id WHERE actor_id = p_old_id;
  UPDATE territory_name_proposals SET proposed_by = p_new_id WHERE proposed_by = p_old_id;
  UPDATE territory_name_votes SET voter_id = p_new_id WHERE voter_id = p_old_id;
  UPDATE user_fragments SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE fragment_ability_uses SET user_id = p_new_id WHERE user_id = p_old_id;
  UPDATE purchase_log SET user_id = p_new_id WHERE user_id = p_old_id;

  DELETE FROM public.users WHERE id = p_old_id;

  RETURN json_build_object('success', true, 'migrated_from', p_old_id, 'migrated_to', p_new_id);

EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
  RAISE WARNING '[migrate_user_to_auth_id] Failed: %', v_err;
  RETURN json_build_object('error', v_err);
END;
$$;

-- ============================================================
-- 3. Redéfinir rename_faction() sans le UPDATE place_claims
-- ============================================================

CREATE OR REPLACE FUNCTION public.rename_faction(p_old_id text, p_new_id text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM factions WHERE id = p_old_id) THEN
    RETURN json_build_object('error', 'Faction not found');
  END IF;

  IF EXISTS(SELECT 1 FROM factions WHERE id = p_new_id) THEN
    RETURN json_build_object('error', 'ID already exists');
  END IF;

  INSERT INTO factions (id, title, color, pattern, description, image_url, "order",
    bonus_energy, bonus_conquest, bonus_construction,
    bonus_regen_energy, bonus_regen_conquest, bonus_regen_construction,
    created_at, updated_at)
  SELECT p_new_id, title, color, pattern, description, image_url, "order",
    bonus_energy, bonus_conquest, bonus_construction,
    bonus_regen_energy, bonus_regen_conquest, bonus_regen_construction,
    created_at, NOW()
  FROM factions WHERE id = p_old_id;

  UPDATE users SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE places SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE activity_log SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE chat_messages SET faction_id = p_new_id WHERE faction_id = p_old_id;
  UPDATE titles SET faction_id = p_new_id WHERE faction_id = p_old_id;

  DELETE FROM factions WHERE id = p_old_id;

  RETURN json_build_object('success', true, 'newId', p_new_id);
END;
$$;

-- ============================================================
-- 4. DROP table place_claims (CASCADE = trigger trg_log_claim, FK,
--    indexes idx_place_claims_*, sequence place_claims_id_seq, policies RLS)
-- ============================================================

DROP TABLE IF EXISTS public.place_claims CASCADE;

-- ============================================================
-- 5. DROP la trigger function (déjà détachée par le CASCADE ci-dessus)
-- ============================================================

DROP FUNCTION IF EXISTS public.log_claim_activity();
