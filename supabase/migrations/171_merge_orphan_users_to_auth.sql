-- 168_merge_orphan_users_to_auth.sql
-- WHY : 6 users incrits via Supabase Auth entre le 14 et 16 mai 2026 ont leur row
-- public.users en stub `__migrated_<uuid>` parce que le trigger handle_new_user
-- avait une liste hardcodee de tables FK pour la migration shopify-* -> UUID auth,
-- et le DELETE final plantait sur notifications.recipient_id (FK absente de la liste).
-- Resultat : leur vrai profil reste sur l'ancien id (shopify-* ou app-*),
-- inaccessible via leur JWT (qui pointe sur l'UUID auth). Symptome : "Unauthorized"
-- au moment de rejoindre une faction et autres actions.
--
-- Cette migration fait le merge data + FK redirection pour chaque stub, en
-- enumerant les FK dynamiquement via information_schema (donc plus de derive
-- avec le schema).
-- Idempotente : si plus de stub, la boucle ne fait rien.

DO $$
DECLARE
  r RECORD;
  fk RECORD;
  v_old TEXT;
  v_new TEXT;
  v_shopify BIGINT;
  v_email   TEXT;
BEGIN
  FOR r IN
    SELECT
      stub.id    AS new_id,
      old_row.id AS old_id,
      old_row.shopify_customer_id AS old_shopify_customer_id,
      au.email   AS new_email
    FROM public.users stub
    JOIN auth.users au ON au.id::TEXT = stub.id
    JOIN public.users old_row
      ON LOWER(old_row.email_address) = LOWER(au.email)
      AND old_row.id != stub.id
    WHERE stub.email_address LIKE '__migrated_%'
  LOOP
    v_old     := r.old_id;
    v_new     := r.new_id;
    v_shopify := r.old_shopify_customer_id;
    v_email   := r.new_email;
    RAISE NOTICE '[merge_orphan_users] merging % -> % (%)', v_old, v_new, v_email;

    -- 1. Libere temporairement l'email + le shopify_customer_id de l'ancienne row
    --    (contraintes UNIQUE) pour pouvoir les reaffecter a la nouvelle.
    UPDATE public.users
    SET email_address = '__transit_' || v_old,
        shopify_customer_id = NULL
    WHERE id = v_old;

    -- 2. Copie les donnees gameplay de l'ancienne row vers la stub
    --    (qui garde son id UUID auth).
    UPDATE public.users dst
    SET
      email_address               = v_email,
      first_name                  = src.first_name,
      gender                      = src.gender,
      rank                        = COALESCE(src.rank, 'guest'),
      role                        = COALESCE(src.role, 'user'),
      bio                         = src.bio,
      avatar_url                  = src.avatar_url,
      display_name                = src.display_name,
      instagram                   = src.instagram,
      location_name               = src.location_name,
      location_zip                = src.location_zip,
      faction_id                  = src.faction_id,
      faction_changed_at          = src.faction_changed_at,
      energy_points               = src.energy_points,
      energy_reset_at             = src.energy_reset_at,
      conquest_points             = src.conquest_points,
      conquest_reset_at           = src.conquest_reset_at,
      construction_points         = src.construction_points,
      construction_reset_at       = src.construction_reset_at,
      max_energy                  = src.max_energy,
      max_conquest                = src.max_conquest,
      max_construction            = src.max_construction,
      vitalite_points             = COALESCE(src.vitalite_points, dst.vitalite_points),
      max_vitalite                = COALESCE(src.max_vitalite, dst.max_vitalite),
      vitalite_reset_at           = COALESCE(src.vitalite_reset_at, dst.vitalite_reset_at),
      notoriety_points            = src.notoriety_points,
      displayed_general_title_ids = src.displayed_general_title_ids,
      displayed_title_ids_v3      = src.displayed_title_ids_v3,
      game_mode                   = src.game_mode,
      shopify_customer_id         = v_shopify,
      account_source              = src.account_source,
      is_active                   = src.is_active,
      website_url                 = src.website_url,
      biography                   = COALESCE(src.biography, dst.biography),
      instagram_id                = src.instagram_id,
      created_at                  = src.created_at,
      updated_at                  = NOW()
    FROM public.users src
    WHERE dst.id = v_new
      AND src.id = v_old;

    -- 3. Redirige toutes les FK pointant sur l'ancien id (boucle dynamique sur
    --    information_schema, donc resilient aux nouvelles tables a venir).
    FOR fk IN
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
                     fk.table_schema, fk.table_name, fk.column_name, fk.column_name)
              USING v_new, v_old;
    END LOOP;

    -- 4. Supprime l'ancienne row (les FK pointant dessus sont desormais
    --    redirigees ; le DELETE ne peut plus planter).
    DELETE FROM public.users WHERE id = v_old;
  END LOOP;
END;
$$;
