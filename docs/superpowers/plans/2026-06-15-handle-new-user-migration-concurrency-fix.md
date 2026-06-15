# Fix concurrence migration Shopify (`handle_new_user`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le trigger `public.handle_new_user` sûr en concurrence et idempotent, pour supprimer le « unexpected error » à la connexion des comptes Shopify (race sur `idx_users_shopify_customer_id`).

**Architecture:** `CREATE OR REPLACE FUNCTION public.handle_new_user()` (Approche A) : ajout d'un `pg_advisory_xact_lock` dérivé de l'email + `SELECT … FOR UPDATE` + une garde d'idempotence basée sur le **format de l'id existant** (UUID = déjà migré → no-op ; non-UUID = legacy → migration). La logique interne de migration (INSERT/SELECT, boucle de redirection des 61 FK, DELETE) et le bloc `EXCEPTION` fallback restent **identiques**. Pas de changement de signature, pas de recréation du trigger `on_auth_user_created`.

**Tech Stack:** PostgreSQL 17 / Supabase, PL/pgSQL, Supabase MCP (`execute_sql`, `apply_migration`, `get_logs`).

**Spec:** `docs/superpowers/specs/2026-06-15-handle-new-user-migration-concurrency-fix-design.md`

---

## File Structure

- **Create:** `supabase/migrations/257_handle_new_user_concurrency_guard.sql` — la nouvelle définition complète de la fonction (record repo + déclenche le hook graphify-sql au commit).
- **Aucun autre fichier.** Pas de changement de schéma, pas de réparation de données, pas de front (le message FR de `useAuthForm.ts` est hors-scope, traité séparément).

Les tests sont des **scripts SQL `DO`-block transaction-locaux** exécutés via `execute_sql` (chacun se termine par un `RAISE EXCEPTION` sentinelle → rollback total, aucune écriture persistée). Ils ne vivent pas dans un fichier du repo (pas de framework de test SQL ici) ; ils sont listés intégralement dans ce plan.

---

## Task 1 : Établir la baseline de tests (fonction actuelle)

But : prouver que le harnais de test fonctionne et que les chemins **séquentiels** passent déjà avec la fonction actuelle (la régression à ne pas casser). La race concurrente n'est pas reproductible en session SQL unique — elle est couverte structurellement par le verrou (cf. Task 2) et vérifiée post-deploy (Task 5).

**Files:** aucun (exécution via `execute_sql` sur le projet `ukpapqssgsxirsgmcvof`).

- [ ] **Step 1 : Test guard regex (unit) — doit déjà passer**

Exécuter via `execute_sql` :

```sql
DO $$
DECLARE uuid_re text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
BEGIN
  IF NOT ('855154e4-fc02-4847-bc97-04fea50c89e0' ~* uuid_re) THEN RAISE EXCEPTION 'FAIL uuid'; END IF;
  IF ('shopify-8526091616523' ~* uuid_re) THEN RAISE EXCEPTION 'FAIL shopify matched'; END IF;
  IF ('d3Hanbxl5N0DCE97ROSZF' ~* uuid_re) THEN RAISE EXCEPTION 'FAIL nanoid matched'; END IF;
  RAISE EXCEPTION 'TEST3_PASS_ROLLBACK';
END $$;
```

Attendu : erreur `TEST3_PASS_ROLLBACK` (toutes assertions OK, rollback). Toute autre erreur `FAIL …` = bug du test.

- [ ] **Step 2 : Test migration legacy (integration) — doit déjà passer sur la fonction actuelle**

```sql
DO $$
DECLARE
  v_uid uuid := '00000000-0000-0000-0000-0000000a0001';
  v_email text := 'hnu_test_legacy@example.invalid';
  v_old_id text := 'shopify-999999000001';
  v_count int; v_old int; v_shop bigint;
BEGIN
  INSERT INTO public.users (id, email_address, first_name, rank, role, account_source, shopify_customer_id, created_at, updated_at)
  VALUES (v_old_id, v_email, 'TestLegacy', 'guest', 'user', 'shopify', 999999000001, now(), now());

  INSERT INTO auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email, '{}'::jsonb, '{}'::jsonb, now(), now());

  SELECT count(*) INTO v_count FROM public.users WHERE id = v_uid::text AND lower(email_address) = v_email;
  SELECT count(*) INTO v_old   FROM public.users WHERE id = v_old_id;
  SELECT shopify_customer_id INTO v_shop FROM public.users WHERE id = v_uid::text;

  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL: migrated row missing (got %)', v_count; END IF;
  IF v_old   <> 0 THEN RAISE EXCEPTION 'FAIL: old legacy row not deleted (got %)', v_old; END IF;
  IF v_shop IS DISTINCT FROM 999999000001 THEN RAISE EXCEPTION 'FAIL: shopify_customer_id not preserved (got %)', v_shop; END IF;

  RAISE EXCEPTION 'TEST1_PASS_ROLLBACK';
END $$;
```

Attendu : erreur `TEST1_PASS_ROLLBACK`.

- [ ] **Step 3 : Test nouvel utilisateur (integration) — doit déjà passer**

```sql
DO $$
DECLARE
  v_uid uuid := '00000000-0000-0000-0000-0000000a0002';
  v_email text := 'hnu_test_new@example.invalid';
  v_src text; v_cnt int;
BEGIN
  INSERT INTO auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email, '{}'::jsonb, '{"first_name":"Newbie"}'::jsonb, now(), now());

  SELECT count(*), max(account_source) INTO v_cnt, v_src FROM public.users WHERE id = v_uid::text;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'FAIL: new user row missing (got %)', v_cnt; END IF;
  IF v_src IS DISTINCT FROM 'app' THEN RAISE EXCEPTION 'FAIL: account_source expected app got %', v_src; END IF;

  RAISE EXCEPTION 'TEST2_PASS_ROLLBACK';
END $$;
```

Attendu : erreur `TEST2_PASS_ROLLBACK`.

> Si un de ces inserts `auth.users` échoue pour cause de colonne NOT NULL manquante propre à cette instance, ajouter la colonne fautive avec une valeur neutre (ex. `confirmation_token=''`) — l'objectif est seulement de **déclencher le trigger**.

---

## Task 2 : Écrire et déployer la fonction durcie

**Files:**
- Create: `supabase/migrations/257_handle_new_user_concurrency_guard.sql`

- [ ] **Step 1 : Créer le fichier de migration**

Contenu intégral de `supabase/migrations/257_handle_new_user_concurrency_guard.sql` :

```sql
-- 257_handle_new_user_concurrency_guard.sql
-- Fix « unexpected error » connexion comptes Shopify.
-- Cause : race concurrente (double-tap mobile) dans handle_new_user ->
--   double INSERT du même shopify_customer_id -> violation idx_users_shopify_customer_id
--   -> rollback de la transaction GoTrue -> aucun auth.users créé.
-- Approche A : advisory lock par email + FOR UPDATE + garde d'idempotence (id UUID vs legacy).
-- Logique interne de migration et fallback EXCEPTION inchangés.

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
  -- (1) Sérialise les requêtes concurrentes pour le même email (anti double-tap / retry mobile).
  PERFORM pg_advisory_xact_lock(hashtext('handle_new_user:' || LOWER(COALESCE(NEW.email, ''))));

  -- (2) Verrouille la ligne existante éventuelle.
  SELECT * INTO v_existing
  FROM public.users
  WHERE LOWER(email_address) = LOWER(COALESCE(NEW.email, ''))
  LIMIT 1
  FOR UPDATE;

  IF v_existing.id IS NOT NULL
     AND v_existing.id <> NEW.id::TEXT
     AND v_existing.id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    -- (3a) Ligne LEGACY (shopify / stand / ancien nanoid app) -> migration vers NEW.id.
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

  ELSIF v_existing.id IS NOT NULL THEN
    -- (3b) Ligne déjà présente pour ce compte (id = NEW.id) OU autre UUID même email
    --      (improbable, bloqué par l'unicité email auth) : idempotent, ne rien faire.
    NULL;

  ELSE
    -- (3c) Aucun profil existant -> nouveau compte app.
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
```

- [ ] **Step 2 : Déployer sur le projet distant**

Appliquer le **contenu exact** du fichier via `apply_migration` (project_id `ukpapqssgsxirsgmcvof`, name `handle_new_user_concurrency_guard`). La fonction est en `CREATE OR REPLACE` → idempotente, aucun risque de doublon.

Attendu : succès, pas d'erreur. Vérifier ensuite que le trigger est intact :

```sql
SELECT t.tgname, p.proname FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
WHERE t.tgrelid='auth.users'::regclass AND NOT t.tgisinternal;
```

Attendu : 1 ligne `on_auth_user_created | handle_new_user`.

---

## Task 3 : Re-jouer les tests sur la fonction durcie

**Files:** aucun.

- [ ] **Step 1 : Re-exécuter Test guard / migration / nouvel utilisateur**

Ré-exécuter via `execute_sql` les 3 `DO`-blocks de la **Task 1, Steps 1-3** (identiques).

Attendu : `TEST3_PASS_ROLLBACK`, puis `TEST1_PASS_ROLLBACK`, puis `TEST2_PASS_ROLLBACK`. Aucune autre erreur.

- [ ] **Step 2 : Test idempotence de la garde (nouveau, spécifique au fix)**

Vérifie qu'une ligne **déjà en UUID** n'est pas re-migrée si la fonction la rencontre (branche 3b). On exerce la branche en insérant un `auth.users` dont l'email correspond à une ligne `public.users` déjà en UUID préexistante.

```sql
DO $$
DECLARE
  v_uid uuid := '00000000-0000-0000-0000-0000000a0003';
  v_email text := 'hnu_test_idem@example.invalid';
  v_cnt int;
BEGIN
  -- arrange : ligne DEJA en UUID (= déjà migrée), même id que le futur auth user
  INSERT INTO public.users (id, email_address, first_name, rank, role, account_source, created_at, updated_at)
  VALUES (v_uid::text, v_email, 'AlreadyMigrated', 'guest', 'user', 'app', now(), now());

  -- act : le trigger se déclenche pour ce même id/email
  INSERT INTO auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email, '{}'::jsonb, '{}'::jsonb, now(), now());

  -- assert : toujours exactement 1 ligne, aucune duplication / corruption
  SELECT count(*) INTO v_cnt FROM public.users WHERE lower(email_address) = v_email;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'FAIL: expected 1 row, got %', v_cnt; END IF;

  RAISE EXCEPTION 'TEST4_PASS_ROLLBACK';
END $$;
```

Attendu : erreur `TEST4_PASS_ROLLBACK`.

---

## Task 4 : Commit & push

**Files:** `supabase/migrations/257_handle_new_user_concurrency_guard.sql`

- [ ] **Step 1 : Commit du fichier de migration**

```bash
git add "supabase/migrations/257_handle_new_user_concurrency_guard.sql"
git commit -m "fix(auth): handle_new_user concurrency-safe migration Shopify

Advisory lock par email + FOR UPDATE + garde idempotence (UUID vs legacy)
pour eliminer la race sur idx_users_shopify_customer_id qui causait le
'unexpected error' a la connexion des comptes Shopify.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

Le hook post-commit `graphify-sql` se déclenchera (commit touchant `supabase/migrations/`). Attendu : rebuild SQL sans erreur.

- [ ] **Step 2 : Push**

```bash
git push
```

Attendu : push réussi sur `main`.

---

## Task 5 : Vérification post-déploiement

**Files:** aucun.

- [ ] **Step 1 : Contrôle des logs Postgres**

Via `get_logs` (service `postgres`), confirmer l'**absence de nouvelles** occurrences de :
`duplicate key value violates unique constraint "idx_users_shopify_customer_id"`
après l'horodatage du déploiement.

- [ ] **Step 2 : Spot-check connexion réelle (optionnel, si un compte legacy de test est disponible)**

Vérifier qu'un profil `shopify-%` qui se connecte migre bien vers un id UUID (`account_source` préservé, FK intactes) et que `auth.users` est créé.

- [ ] **Step 3 : Surveillance différée**

Recontrôler les logs `postgres` ~24 h plus tard : zéro `idx_users_shopify_customer_id` dup = critère d'acceptation #6 validé.

---

## Self-review (couverture spec)

- Race concurrente → `pg_advisory_xact_lock` (Task 2 Step 1) + critère #2. ✓
- Garde idempotence UUID vs legacy → branche regex (Task 2) + Test 4 (Task 3 Step 2) + critère #3. ✓
- Migration legacy inchangée → bloc identique (Task 2) + Test 1 (Task 1/3) + critère #1. ✓
- Non-régression nouvel utilisateur → branche 3c + Test 2 + critère #4. ✓
- Fallback EXCEPTION sûr (pas de `shopify_customer_id`) → conservé tel quel (Task 2). ✓
- Idempotence fichier + trigger intact → `CREATE OR REPLACE`, vérif trigger (Task 2 Step 2) + critère #5. ✓
- Absence de l'erreur post-deploy → Task 5 + critère #6. ✓
- Hors-scope (réparation données, Approche C, front) → non inclus, conforme spec. ✓
