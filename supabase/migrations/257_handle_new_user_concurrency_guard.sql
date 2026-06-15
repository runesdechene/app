-- 257_handle_new_user_concurrency_guard.sql
-- Fix « unexpected error » à la connexion des comptes Shopify.
--
-- Cause racine : DEUX chemins font la même migration legacy -> auth UUID sans
-- coordination :
--   1. trigger public.handle_new_user  (à la création auth.users, pendant le signup)
--   2. RPC    public.migrate_user_to_auth_id  (appelée par le front usePlayer.ts au login)
-- Les deux recopient le même shopify_customer_id dans une nouvelle ligne. En
-- concurrence (signup + login, double-tap, retry), ils violent l'index partiel
-- unique idx_users_shopify_customer_id -> rollback -> aucun auth.users créé ->
-- l'app affiche le message brut « unexpected error ».
--
-- Correctif : un MÊME verrou advisory transaction-level, clé dérivée de l'email
-- (hashtext('handle_new_user:'||lower(email))), pris par les DEUX fonctions ->
-- elles deviennent mutuellement exclusives par email. Pas de garde par format
-- d'id (il existe ~1200 lignes legacy à id UUID sans auth.users ; une garde
-- "skip si UUID" les laisserait sans profil). La condition d'origine
-- v_existing.id <> NEW.id suffit à l'idempotence (déjà migré -> no-op).
-- Logique interne de migration (INSERT/SELECT, boucle FK, fallback) inchangée.

-- ============================================================================
-- 1) Trigger function : handle_new_user
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing RECORD;
  v_err TEXT;
  v_max_e NUMERIC(4,1);
  v_fk RECORD;
BEGIN
  -- Sérialise avec l'autre chemin de migration (RPC) pour le même email.
  PERFORM pg_advisory_xact_lock(hashtext('handle_new_user:' || LOWER(COALESCE(NEW.email, ''))));

  SELECT * INTO v_existing
  FROM public.users
  WHERE LOWER(email_address) = LOWER(COALESCE(NEW.email, ''))
  LIMIT 1
  FOR UPDATE;

  IF v_existing.id IS NOT NULL AND v_existing.id <> NEW.id::TEXT THEN
    -- ===== Ligne legacy -> migration vers NEW.id =====
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

      -- Redirige toutes les FK pointant sur l'ancien id (boucle dynamique resiliente).
      FOR v_fk IN
        SELECT tc.table_schema, tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_schema = 'public'
          AND ccu.table_name   = 'users'
          AND ccu.column_name  = 'id'
          AND NOT (tc.table_schema = 'public' AND tc.table_name = 'users')
      LOOP
        EXECUTE format('UPDATE %I.%I SET %I = $1 WHERE %I = $2',
                       v_fk.table_schema, v_fk.table_name, v_fk.column_name, v_fk.column_name)
                USING NEW.id::TEXT, v_existing.id;
      END LOOP;

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
    -- ===== Pas de legacy (ou déjà à NEW.id) -> nouveau compte app (no-op si déjà présent) =====
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
$function$;

-- ============================================================================
-- 2) RPC : migrate_user_to_auth_id (chemin front usePlayer.ts)
--    Même verrou advisory que le trigger -> mutuellement exclusifs par email.
--    Re-check après acquisition du verrou : si le trigger a déjà migré, no-op.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.migrate_user_to_auth_id(p_old_id text, p_new_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email TEXT;
  v_err TEXT;
  v_fk RECORD;
BEGIN
  IF auth.uid()::TEXT != p_new_id THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT email_address INTO v_email FROM public.users WHERE id = p_old_id;
  IF v_email IS NULL THEN
    RETURN json_build_object('error', 'old_user_not_found');
  END IF;

  -- Sérialise avec le trigger handle_new_user pour le même email.
  PERFORM pg_advisory_xact_lock(hashtext('handle_new_user:' || LOWER(COALESCE(v_email, ''))));

  -- Le trigger a pu migrer (et supprimer) l'ancienne ligne pendant l'attente du verrou.
  PERFORM 1 FROM public.users WHERE id = p_old_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', true, 'note', 'already_migrated', 'migrated_to', p_new_id);
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

  -- Redirige toutes les FK pointant sur l'ancien id (boucle dynamique).
  FOR v_fk IN
    SELECT tc.table_schema, tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'public'
      AND ccu.table_name   = 'users'
      AND ccu.column_name  = 'id'
      AND NOT (tc.table_schema = 'public' AND tc.table_name = 'users')
  LOOP
    EXECUTE format('UPDATE %I.%I SET %I = $1 WHERE %I = $2',
                   v_fk.table_schema, v_fk.table_name, v_fk.column_name, v_fk.column_name)
            USING p_new_id, p_old_id;
  END LOOP;

  DELETE FROM public.users WHERE id = p_old_id;

  RETURN json_build_object('success', true, 'migrated_from', p_old_id, 'migrated_to', p_new_id);

EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
  RAISE WARNING '[migrate_user_to_auth_id] Failed: %', v_err;
  RETURN json_build_object('error', v_err);
END;
$function$;
