# Fix concurrence migration Shopify (`handle_new_user` + RPC) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supprimer le « unexpected error » à la connexion des comptes Shopify en sérialisant les deux chemins de migration legacy → auth UUID.

**Architecture:** `CREATE OR REPLACE` des DEUX fonctions de migration (`public.handle_new_user()` ET la RPC `public.migrate_user_to_auth_id(text,text)`), en leur faisant prendre le **même `pg_advisory_xact_lock(hashtext('handle_new_user:'||lower(email)))`** → mutuellement exclusives par email (tue la race trigger↔RPC). **Pas de garde par format d'id** (les ~1218 lignes legacy à id UUID la casseraient) : la condition d'origine `v_existing.id <> NEW.id` suffit à l'idempotence. Logique interne de migration (INSERT/SELECT, boucle 61 FK, DELETE) et blocs `EXCEPTION` **identiques**. Pas de changement de signature, pas de recréation du trigger.

**Tech Stack:** PostgreSQL 17 / Supabase, PL/pgSQL, Supabase MCP (`execute_sql`, `apply_migration`, `get_logs`). project_id : `ukpapqssgsxirsgmcvof`.

**Spec:** `docs/superpowers/specs/2026-06-15-handle-new-user-migration-concurrency-fix-design.md`

---

## File Structure

- **Source canonique du code :** `supabase/migrations/257_handle_new_user_concurrency_guard.sql` (déjà écrit). Contient le `CREATE OR REPLACE` des deux fonctions avec le verrou partagé. **Ce plan ne duplique pas le SQL** — il référence ce fichier.
- Aucun autre fichier. Pas de schéma, pas de réparation de données, pas de front.

Les tests sont des `DO`-block transaction-locaux (chacun finit par un `RAISE EXCEPTION` sentinelle → ROLLBACK total). Listés intégralement ci-dessous.

---

## Task 1 : Baseline (fonction actuelle) — déjà fait ✅

Confirme que le harnais marche et que les chemins séquentiels passent sur la fonction **actuellement déployée**.

- [x] **Test migration legacy** (fire trigger réel, rollback) → `TEST1_PASS_ROLLBACK`
- [x] **Test nouvel utilisateur** (fire trigger réel, rollback) → `TEST2_PASS_ROLLBACK`

(Le test « guard regex » de la 1ʳᵉ version est supprimé : le design révisé n'utilise plus de regex.)

---

## Task 2 : Vérifier le fichier de migration

**Files:** `supabase/migrations/257_handle_new_user_concurrency_guard.sql` (déjà écrit)

- [ ] **Step 1 : Relire le fichier et confirmer**

Vérifier dans le fichier :
- `CREATE OR REPLACE FUNCTION public.handle_new_user()` : `PERFORM pg_advisory_xact_lock(hashtext('handle_new_user:' || LOWER(COALESCE(NEW.email, ''))));` en 1ʳᵉ instruction ; `SELECT ... FOR UPDATE` ; branche `IF v_existing.id IS NOT NULL AND v_existing.id <> NEW.id::TEXT THEN <migration> ELSE <new app user> END IF;` **sans regex UUID** ; bloc `EXCEPTION` fallback inchangé ; `RETURN NEW;`.
- `CREATE OR REPLACE FUNCTION public.migrate_user_to_auth_id(text, text)` : check `auth.uid()::TEXT != p_new_id` ; `SELECT email_address INTO v_email ... ; IF v_email IS NULL THEN RETURN 'old_user_not_found'` ; **puis** `PERFORM pg_advisory_xact_lock(hashtext('handle_new_user:' || LOWER(COALESCE(v_email, ''))));` ; **re-check** `PERFORM 1 FROM public.users WHERE id = p_old_id; IF NOT FOUND THEN RETURN already_migrated` ; reste de la migration inchangé ; même clé de verrou que le trigger.
- Dollar-quoting `$function$` intact pour les deux fonctions.

Attendu : tout présent. Sinon corriger le fichier.

---

## Task 3 : Tester les fonctions durcies (SANS déployer — gate humain)

> ⚠️ Le déploiement (apply_migration) est gardé par l'humain (Task 4). Pour tester les NOUVELLES fonctions sans déployer durablement, exécuter chaque test dans une **transaction explicite qui inclut le `CREATE OR REPLACE` ET un `ROLLBACK` final**, en un seul appel `execute_sql`. Si `execute_sql` n'autorise pas `BEGIN; ... ROLLBACK;` explicite (autocommit), **NE PAS** exécuter de `CREATE OR REPLACE` isolé (= déploiement) ; reporter le blocage à l'humain et tester après le go.

- [ ] **Step 1 : Tester trigger durci (migration + nouvel user + idempotence) en transaction rollback**

Un seul `execute_sql` :

```sql
BEGIN;
-- (coller ici le CREATE OR REPLACE FUNCTION public.handle_new_user() du fichier 257)

DO $$
DECLARE v_uid uuid := '00000000-0000-0000-0000-0000000b0001'; v_email text := 'hnu_rev_legacy@example.invalid';
        v_old text := 'shopify-999999000011'; v_cnt int; v_old_cnt int; v_shop bigint;
BEGIN
  INSERT INTO public.users (id, email_address, first_name, rank, role, account_source, shopify_customer_id, created_at, updated_at)
  VALUES (v_old, v_email, 'L', 'guest', 'user', 'shopify', 999999000011, now(), now());
  INSERT INTO auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email, '{}'::jsonb, '{}'::jsonb, now(), now());
  SELECT count(*) INTO v_cnt FROM public.users WHERE id=v_uid::text AND lower(email_address)=v_email;
  SELECT count(*) INTO v_old_cnt FROM public.users WHERE id=v_old;
  SELECT shopify_customer_id INTO v_shop FROM public.users WHERE id=v_uid::text;
  IF v_cnt<>1 THEN RAISE EXCEPTION 'FAIL migrated missing %', v_cnt; END IF;
  IF v_old_cnt<>0 THEN RAISE EXCEPTION 'FAIL old not deleted %', v_old_cnt; END IF;
  IF v_shop IS DISTINCT FROM 999999000011 THEN RAISE EXCEPTION 'FAIL shop % ', v_shop; END IF;
  RAISE NOTICE 'legacy OK';
END $$;

DO $$
DECLARE v_uid uuid := '00000000-0000-0000-0000-0000000b0002'; v_email text := 'hnu_rev_new@example.invalid'; v_src text; v_cnt int;
BEGIN
  INSERT INTO auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email, '{}'::jsonb, '{"first_name":"N"}'::jsonb, now(), now());
  SELECT count(*), max(account_source) INTO v_cnt, v_src FROM public.users WHERE id=v_uid::text;
  IF v_cnt<>1 OR v_src IS DISTINCT FROM 'app' THEN RAISE EXCEPTION 'FAIL new user cnt=% src=%', v_cnt, v_src; END IF;
  RAISE NOTICE 'new OK';
END $$;

ROLLBACK;
```

Attendu : exécution sans erreur `FAIL …`, puis rollback (aucune persistance). Si l'outil renvoie une erreur de transaction (autocommit), suivre la consigne de gate ci-dessus.

- [ ] **Step 2 : Tester la RPC durcie (migration + re-check already_migrated) en transaction rollback**

Un seul `execute_sql` :

```sql
BEGIN;
-- (coller ici les DEUX CREATE OR REPLACE du fichier 257 : handle_new_user ET migrate_user_to_auth_id)

DO $$
DECLARE v_new text := '00000000-0000-0000-0000-0000000b0003'; v_old text := 'shopify-999999000012';
        v_email text := 'hnu_rev_rpc@example.invalid'; r json; v_cnt int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_new)::text, true); -- auth.uid() = v_new
  INSERT INTO public.users (id, email_address, first_name, rank, role, account_source, shopify_customer_id, created_at, updated_at)
  VALUES (v_old, v_email, 'R', 'guest', 'user', 'shopify', 999999000012, now(), now());

  r := public.migrate_user_to_auth_id(v_old, v_new);
  IF (r->>'success') IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'FAIL rpc1 %', r; END IF;
  SELECT count(*) INTO v_cnt FROM public.users WHERE id=v_new AND lower(email_address)=v_email;
  IF v_cnt<>1 THEN RAISE EXCEPTION 'FAIL rpc migrated %', v_cnt; END IF;

  -- 2e appel (ancienne ligne déjà partie) -> old_user_not_found OU already_migrated, jamais d'erreur dup
  r := public.migrate_user_to_auth_id(v_old, v_new);
  IF (r ? 'error') AND (r->>'error') NOT IN ('old_user_not_found') THEN RAISE EXCEPTION 'FAIL rpc2 %', r; END IF;
  RAISE NOTICE 'rpc OK';
END $$;

ROLLBACK;
```

Attendu : pas d'erreur `FAIL …`, rollback. Confirme migration RPC + absence de double-INSERT au 2ᵉ appel.

---

## Task 4 : Déploiement (GATE HUMAIN) + commit

- [ ] **Step 1 : Feu vert humain** avant tout `apply_migration`.
- [ ] **Step 2 : Déployer** le contenu de `257_handle_new_user_concurrency_guard.sql` via `apply_migration` (name `handle_new_user_concurrency_guard`). `CREATE OR REPLACE` idempotent. Vérifier le trigger intact :

```sql
SELECT t.tgname, p.proname FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
WHERE t.tgrelid='auth.users'::regclass AND NOT t.tgisinternal;
```
Attendu : `on_auth_user_created | handle_new_user`.

- [ ] **Step 3 : Post-deploy — re-jouer les tests Task 3 Steps 1 & 2** (maintenant les fonctions sont déployées ; les tests restent en rollback). Attendu : aucun `FAIL`.
- [ ] **Step 4 : Commit + push**

```bash
git add "supabase/migrations/257_handle_new_user_concurrency_guard.sql"
git commit -m "fix(auth): handle_new_user + migrate_user_to_auth_id concurrency-safe (shared advisory lock)

Verrou advisory partage par email sur les deux chemins de migration Shopify
pour eliminer la race sur idx_users_shopify_customer_id (cause du 'unexpected
error' a la connexion). Suppression de la garde par format d'id (cassait les
~1218 lignes legacy a id UUID).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push
```

Le hook `graphify-sql` se déclenche (commit touchant `supabase/migrations/`).

---

## Task 5 : Vérification post-déploiement

- [ ] **Step 1 :** `get_logs` (postgres) → confirmer l'absence de **nouvelles** occurrences de `duplicate key value violates unique constraint "idx_users_shopify_customer_id"` après le déploiement.
- [ ] **Step 2 (optionnel) :** spot-check d'une connexion legacy réelle → migration vers UUID OK.
- [ ] **Step 3 :** recontrôle des logs ~24 h plus tard : zéro dup = critère d'acceptation validé.

---

## Self-review (couverture spec)

- Race trigger↔RPC → verrou partagé même clé sur les 2 fonctions (Task 2/3) + critères #2. ✓
- Pas de garde format d'id (1218 lignes) → condition d'origine `<> NEW.id` (Task 2) + critère #5. ✓
- Migration legacy + non-régression nouvel user → Task 3 Step 1 + critères #1, #4. ✓
- Idempotence trigger + RPC `already_migrated` → Task 3 Steps 1-2 + critère #3. ✓
- Fallback EXCEPTION inchangé (pas de shopify_customer_id) → fichier 257. ✓
- Idempotence fichier + trigger intact → `CREATE OR REPLACE` + vérif (Task 4 Step 2) + critère #6. ✓
- Absence d'erreur post-deploy → Task 5 + critère #7. ✓
- Gate humain avant déploiement prod → Task 4 Step 1. ✓
