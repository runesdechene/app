# Compagnies — Lot 1 « Compagnie légère » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une première Compagnie jouable et autonome — fonder (coût en Couronnes), rejoindre, identité (nom/image/couleur/description), chat de Compagnie, et bannière active (multi-appartenance max 2 + cooldown de bascule) — sans le moteur d'échelons organique ni les pactes de lieu (lots ultérieurs).

**Architecture:** Backend Supabase = une migration additive `275` (tables `companies` / `company_members` / `company_messages` / `company_bans`, colonnes `users.active_company_id` + `active_banner_switched_at`, RPCs `SECURITY DEFINER`, realtime sur le chat). On calque le patron existant `missions`/`voyages` (entité + table de jointure + table de messages + RPC + hook front `useRealtimeChat`). Frontend = un store zustand `companyStore`, un hook `useCompanyChat`, des composants sous `components/companies/`, branchés dans les menus existants. **Pas de recoloration de carte** en Lot 1 (→ SPEC 3 Territoire).

**Tech Stack:** Postgres/plpgsql (Supabase, prod directe), React 18 + react-router v7, zustand, MapLibre (hors-scope ici), Vitest (logique pure front), pnpm monorepo.

## Global Constraints

- **Mode additif STRICT** (campagne V1, cf. `docs/db/cleanup-v1-identity.md`) : uniquement `CREATE`, colonnes nullable/à défaut, nouvelles RPC. Zéro `DROP`, zéro `ALTER` cassant, zéro `NOT NULL` sur colonne peuplée. Le Dortoir/chat de Maison **reste en place** (on ajoute le chat Compagnie à côté ; sa suppression ira dans `cleanup-v1-identity.md`).
- **Prochain numéro de migration = `275`** (270 manquant ; max actuel = 274). Un numéro = un seul fichier.
- **Canal d'application UNIQUE** : `npx supabase db push --dry-run --linked` puis `npx supabase db push --linked`. INTERDITS : MCP `apply_migration`, dashboard SQL editor, `db query -f`. On travaille **sur la prod** (`https://ukpapqssgsxirsgmcvof.supabase.co`) — il n'existe pas de DB de dev.
- **Pas de DB de dev** → une RPC ne peut être smoke-testée qu'**après** le push. Le « test » des tâches DB = `migration-preview` + `db push --dry-run` (validité SQL) avant push, puis appels réels après push.
- **Toute RPC** : `SECURITY DEFINER SET search_path TO 'public'`, garde `p_user_id = auth.uid()::text` en première ligne, `GRANT EXECUTE ... TO authenticated`. Reste `VOLATILE` (défaut) dès qu'elle écrit (`STABLE` ignore les UPDATE silencieusement).
- **Retours RPC** : `json_build_object('success',true,...)` en succès, `json_build_object('error','<code>',...)` en échec. Le front destructure toujours `{ data, error }` (l'`error` Supabase ≠ l'erreur métier dans `data.error`).
- **Nom affiché** : `COALESCE(display_name, first_name, 'Quelqu''un')` (users n'a pas de `last_name`).
- **Realtime** : pour toute nouvelle table de chat, `ALTER PUBLICATION supabase_realtime ADD TABLE ...` **enveloppé dans un DO block idempotent** (pas de `IF NOT EXISTS` natif sur publication).
- **Bucket `company-emblems`** : créé **manuellement** par Uriel (jamais en SQL). À signaler explicitement (nom, public, policies). L'upload front réutilise la compression WebP existante.
- **Front** : sous-dossiers par domaine, fichiers < 300 lignes, pas de `any`, hook (stateful) vs lib (pur) ; client unique `src/lib/supabase.ts`. Build gate `pnpm build` (= `tsc && vite build`). Tests `pnpm test` (Vitest).
- **Échelons différés** : Lot 1 = interim **« fondateur-admin »** (le `founder_user_id` est le seul à éditer l'identité et exclure). Échafaudage explicitement remplacé au Lot 2 par les pouvoirs d'échelon. Aucune autre notion de rang en Lot 1.

---

## Vérification préalable (à faire AVANT la Task 1, ne rien committer)

Le plan suppose deux schémas existants. Confirme-les sur la prod (lecture seule) :

- [ ] **Étape 0a : schéma `app_settings`** — Run :
  `npx supabase db dump --linked --schema public --data-only=false 2>/dev/null | grep -A6 "CREATE TABLE public.app_settings"` (ou lire le baseline). Confirme les colonnes `key` / `value` (types). Le plan suppose `app_settings(key text PRIMARY KEY, value text)`. Si la forme diffère (ex. `value jsonb`), adapter les casts `value::int` partout dans la migration.
- [ ] **Étape 0b : schéma `user_crowns` et `users.id`** — Confirme `user_crowns(user_id text, balance integer)` et `users.id text`. (Issu du rapport d'exploration ; vérifier au `pg_get_functiondef` d'une RPC Couronnes ou dans le baseline.)

> Si l'une des hypothèses est fausse, corriger les snippets SQL concernés avant de continuer. Ne pas committer cette étape (lecture seule).

---

## Task 1 : Migration 275 — schéma (tables, colonnes, settings, realtime, index)

**Files:**
- Create: `supabase/migrations/275_companies_lot1.sql`

**Interfaces:**
- Produces (consommé par toutes les RPC suivantes, même fichier) : tables `public.companies(id uuid, name text, color text, description text, image_url text, founder_user_id text NULL, is_official boolean, created_at timestamptz)`, `public.company_members(company_id uuid, user_id text, joined_at timestamptz)`, `public.company_messages(id bigint, company_id uuid, user_id text, user_name text, content text, created_at timestamptz)`, `public.company_bans(company_id uuid, user_id text, until timestamptz)`, colonnes `public.users.active_company_id uuid` + `public.users.active_banner_switched_at timestamptz`, clés `app_settings`: `company_founding_cost`=`'150'`, `banner_switch_cooldown_hours`=`'6'`, `company_max_count`=`'2'`, `company_ban_hours`=`'24'`.

- [ ] **Step 1 : Créer le fichier avec l'en-tête + le bloc schéma**

```sql
-- 275_companies_lot1.sql
-- WHY : Lot 1 de la refonte identité V1 (SPEC 2 — Les Compagnies). Micro-factions
-- joueur : fonder (coût Couronnes), rejoindre (max 2 par joueur), bannière active
-- (1 à la fois + cooldown), identité (nom/image/couleur/description), chat dédié.
-- Additif strict : on ne touche ni aux factions/Classes ni au Dortoir existant.
-- Échelons organiques + pactes de lieu = lots ultérieurs (interim : fondateur-admin).

BEGIN;

-- 1. Entité Compagnie
CREATE TABLE IF NOT EXISTS public.companies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  color         text NOT NULL DEFAULT '#C19A6B',
  description   text,
  image_url     text,
  founder_user_id text REFERENCES public.users(id) ON DELETE SET NULL,  -- nullable : NULL pour les officielles
  is_official   boolean NOT NULL DEFAULT false,                         -- §1bis seed admin
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- Nom unique insensible à la casse (sans dépendre de citext)
CREATE UNIQUE INDEX IF NOT EXISTS companies_name_lower_uidx
  ON public.companies (lower(name));

-- 2. Appartenance (table de jointure, multi-appartenance plafonnée)
CREATE TABLE IF NOT EXISTS public.company_members (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id    text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, user_id)
);
CREATE INDEX IF NOT EXISTS company_members_user_idx ON public.company_members (user_id);

-- 3. Chat de Compagnie
CREATE TABLE IF NOT EXISTS public.company_messages (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id    text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name  text NOT NULL,
  content    text NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS company_messages_company_idx
  ON public.company_messages (company_id, created_at);

-- 4. Bannissements courts (porte ouverte + exclusion → cooldown anti re-join)
CREATE TABLE IF NOT EXISTS public.company_bans (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id    text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  until      timestamptz NOT NULL,
  PRIMARY KEY (company_id, user_id)
);

-- 5. Bannière active sur users (additif, nullable = bannière perso)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active_company_id uuid
  REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active_banner_switched_at timestamptz;

-- 6. Réglages
INSERT INTO public.app_settings (key, value) VALUES
  ('company_founding_cost', '150'),
  ('banner_switch_cooldown_hours', '6'),
  ('company_max_count', '2'),
  ('company_ban_hours', '24')
ON CONFLICT (key) DO NOTHING;

-- 7. Plafond d'appartenance au niveau DB (défense en profondeur)
CREATE OR REPLACE FUNCTION public.enforce_company_member_cap()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_max int; v_count int;
BEGIN
  v_max := COALESCE((SELECT value::int FROM public.app_settings WHERE key = 'company_max_count'), 2);
  SELECT count(*) INTO v_count FROM public.company_members WHERE user_id = NEW.user_id;
  IF v_count >= v_max THEN
    RAISE EXCEPTION 'company_member_cap_exceeded';
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS trg_company_member_cap ON public.company_members;
CREATE TRIGGER trg_company_member_cap
  BEFORE INSERT ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_company_member_cap();

-- 8. Realtime sur le chat (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'company_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.company_messages;
  END IF;
END $$;

COMMIT;
```

> Note : `DROP TRIGGER IF EXISTS` sur un objet qu'on (re)crée dans la même migration est idempotent et non destructif de données — autorisé (ce n'est pas un DROP de table/colonne).

- [ ] **Step 2 : Valider la syntaxe (preview)**

Run : `node scripts/migration-preview.mjs supabase/migrations/275_companies_lot1.sql`
Expected : le preview liste les objets créés sans erreur de parse (tables, index, trigger, ALTER PUBLICATION). Pas encore de push.

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/275_companies_lot1.sql
git commit -m "feat(db): migration 275 — schéma Compagnies (tables, colonnes bannière, settings, realtime)"
```

---

## Task 2 : RPCs cycle de vie — fonder / rejoindre / quitter

**Files:**
- Modify: `supabase/migrations/275_companies_lot1.sql` (append avant le `COMMIT;` final — ou en bloc séparé après ; garder un seul `COMMIT` en fin de fichier en déplaçant les RPC à l'intérieur de la transaction).

**Interfaces:**
- Consumes : tables de la Task 1, clés `app_settings`, `public.user_crowns(user_id text, balance integer)`.
- Produces :
  - `public.create_company(p_user_id text, p_name text, p_color text, p_description text, p_image_url text) RETURNS json` → `{success,companyId,cost}` | `{error}`
  - `public.join_company(p_user_id text, p_company_id uuid) RETURNS json` → `{success}` | `{error}`
  - `public.leave_company(p_user_id text, p_company_id uuid) RETURNS json` → `{success,extinguished bool}` | `{error}`
  - `public.admin_create_company(p_name text, p_color text, p_description text, p_image_url text) RETURNS json` → `{success,companyId}` | `{error}` (admin-gated, `is_official=true`, sans coût)

- [ ] **Step 1 : Écrire `create_company`** (insérer dans la transaction de 275, avant `COMMIT;`)

```sql
CREATE OR REPLACE FUNCTION public.create_company(
  p_user_id text, p_name text, p_color text, p_description text, p_image_url text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_cost int; v_balance int; v_max int; v_count int; v_company_id uuid; v_name text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  v_name := btrim(coalesce(p_name, ''));
  IF v_name = '' THEN RETURN json_build_object('error', 'name_required'); END IF;
  IF length(v_name) > 60 THEN RETURN json_build_object('error', 'name_too_long'); END IF;
  IF EXISTS (SELECT 1 FROM companies WHERE lower(name) = lower(v_name)) THEN
    RETURN json_build_object('error', 'name_taken');
  END IF;

  v_max := COALESCE((SELECT value::int FROM app_settings WHERE key = 'company_max_count'), 2);
  SELECT count(*) INTO v_count FROM company_members WHERE user_id = p_user_id;
  IF v_count >= v_max THEN RETURN json_build_object('error', 'too_many_companies'); END IF;

  v_cost := COALESCE((SELECT value::int FROM app_settings WHERE key = 'company_founding_cost'), 150);
  SELECT balance INTO v_balance FROM user_crowns WHERE user_id = p_user_id FOR UPDATE;
  IF COALESCE(v_balance, 0) < v_cost THEN
    RETURN json_build_object('error', 'insufficient_crowns', 'cost', v_cost, 'balance', COALESCE(v_balance, 0));
  END IF;

  UPDATE user_crowns SET balance = balance - v_cost, updated_at = now() WHERE user_id = p_user_id;

  INSERT INTO companies (name, color, description, image_url, founder_user_id)
    VALUES (v_name, COALESCE(NULLIF(btrim(p_color), ''), '#C19A6B'), NULLIF(btrim(p_description), ''), NULLIF(btrim(p_image_url), ''), p_user_id)
    RETURNING id INTO v_company_id;

  INSERT INTO company_members (company_id, user_id) VALUES (v_company_id, p_user_id);

  -- La Compagnie fondée devient la bannière active
  UPDATE users SET active_company_id = v_company_id, active_banner_switched_at = now()
    WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'companyId', v_company_id, 'cost', v_cost);
END;$$;
GRANT EXECUTE ON FUNCTION public.create_company(text, text, text, text, text) TO authenticated;
```

- [ ] **Step 2 : Écrire `join_company`**

```sql
CREATE OR REPLACE FUNCTION public.join_company(p_user_id text, p_company_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_max int; v_count int;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM companies WHERE id = p_company_id) THEN
    RETURN json_build_object('error', 'company_not_found');
  END IF;
  IF EXISTS (SELECT 1 FROM company_members WHERE company_id = p_company_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error', 'already_member');
  END IF;
  IF EXISTS (SELECT 1 FROM company_bans WHERE company_id = p_company_id AND user_id = p_user_id AND until > now()) THEN
    RETURN json_build_object('error', 'banned');
  END IF;
  v_max := COALESCE((SELECT value::int FROM app_settings WHERE key = 'company_max_count'), 2);
  SELECT count(*) INTO v_count FROM company_members WHERE user_id = p_user_id;
  IF v_count >= v_max THEN RETURN json_build_object('error', 'too_many_companies'); END IF;

  INSERT INTO company_members (company_id, user_id) VALUES (p_company_id, p_user_id);
  RETURN json_build_object('success', true);
END;$$;
GRANT EXECUTE ON FUNCTION public.join_company(text, uuid) TO authenticated;
```

- [ ] **Step 3 : Écrire `leave_company`** (gère l'extinction à 0 membre + reset bannière)

```sql
CREATE OR REPLACE FUNCTION public.leave_company(p_user_id text, p_company_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_remaining int; v_extinguished boolean := false;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM company_members WHERE company_id = p_company_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error', 'not_member');
  END IF;

  DELETE FROM company_members WHERE company_id = p_company_id AND user_id = p_user_id;

  -- Si c'était la bannière active → retour bannière perso
  UPDATE users SET active_company_id = NULL, active_banner_switched_at = now()
    WHERE id = p_user_id AND active_company_id = p_company_id;

  -- Extinction à 0 membre — SAUF Compagnies officielles (elles persistent, §1bis)
  SELECT count(*) INTO v_remaining FROM company_members WHERE company_id = p_company_id;
  IF v_remaining = 0 AND NOT EXISTS (SELECT 1 FROM companies WHERE id = p_company_id AND is_official) THEN
    DELETE FROM companies WHERE id = p_company_id;  -- cascade messages/bans/members
    v_extinguished := true;
  END IF;

  RETURN json_build_object('success', true, 'extinguished', v_extinguished);
END;$$;
GRANT EXECUTE ON FUNCTION public.leave_company(text, uuid) TO authenticated;
```

- [ ] **Step 4 : Écrire `admin_create_company`** (officielles — admin-gated, sans coût, `is_official=true`)

```sql
CREATE OR REPLACE FUNCTION public.admin_create_company(
  p_name text, p_color text, p_description text, p_image_url text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_name text; v_company_id uuid;
BEGIN
  IF NOT public._is_admin() THEN
    RETURN json_build_object('error', 'forbidden');
  END IF;
  v_name := btrim(coalesce(p_name, ''));
  IF v_name = '' THEN RETURN json_build_object('error', 'name_required'); END IF;
  IF EXISTS (SELECT 1 FROM companies WHERE lower(name) = lower(v_name)) THEN
    RETURN json_build_object('error', 'name_taken');
  END IF;
  INSERT INTO companies (name, color, description, image_url, founder_user_id, is_official)
    VALUES (v_name, COALESCE(NULLIF(btrim(p_color), ''), '#C19A6B'),
            NULLIF(btrim(p_description), ''), NULLIF(btrim(p_image_url), ''), NULL, true)
    RETURNING id INTO v_company_id;
  RETURN json_build_object('success', true, 'companyId', v_company_id);
END;$$;
GRANT EXECUTE ON FUNCTION public.admin_create_company(text, text, text, text) TO authenticated;
```

> ⚠️ Vérifier que `public._is_admin()` existe et est la garde admin canonique (cf. `award_crowns_manual`, mig 255). Si la signature diffère, l'aligner.

- [ ] **Step 5 : Preview** — Run : `node scripts/migration-preview.mjs supabase/migrations/275_companies_lot1.sql` → Expected : 4 fonctions supplémentaires détectées, pas d'erreur de parse.

- [ ] **Step 6 : Commit**

```bash
git add supabase/migrations/275_companies_lot1.sql
git commit -m "feat(db): RPC create_company / join_company / leave_company / admin_create_company (Lot 1)"
```

---

## Task 3 : RPCs bannière, chat, lecture, identité, exclusion

**Files:**
- Modify: `supabase/migrations/275_companies_lot1.sql` (append dans la transaction)

**Interfaces:**
- Consumes : tables Task 1, RPC de Task 2.
- Produces :
  - `public.set_active_banner(p_user_id text, p_company_id uuid) RETURNS json` → `{success,activeCompanyId}` | `{error,secondsRemaining?}`
  - `public.send_company_message(p_user_id text, p_company_id uuid, p_content text) RETURNS json` → `{success,id}` | `{error}`
  - `public.get_company_messages(p_company_id uuid, p_limit int) RETURNS json` → tableau JSON `[{id,userId,userName,content,createdAt}]`
  - `public.list_companies(p_search text) RETURNS json` → `[{id,name,color,imageUrl,description,memberCount}]`
  - `public.get_company(p_company_id uuid) RETURNS json` → `{id,name,color,imageUrl,description,founderUserId,memberCount,members:[{userId,name,joinedAt,isFounder}]}`
  - `public.get_my_companies(p_user_id text) RETURNS json` → `{activeCompanyId,companies:[{id,name,color,imageUrl,memberCount,isActive,isFounder}]}`
  - `public.update_company_identity(p_user_id text, p_company_id uuid, p_name text, p_color text, p_description text, p_image_url text) RETURNS json` → `{success}` | `{error}` (interim fondateur-admin)
  - `public.remove_company_member(p_user_id text, p_company_id uuid, p_target_user_id text) RETURNS json` → `{success}` | `{error}` (interim fondateur-admin)

- [ ] **Step 1 : `set_active_banner`** (cooldown ; null = bannière perso)

```sql
CREATE OR REPLACE FUNCTION public.set_active_banner(p_user_id text, p_company_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_cd_hours int; v_last timestamptz; v_next timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  IF p_company_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM company_members WHERE company_id = p_company_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error', 'not_member');
  END IF;

  v_cd_hours := COALESCE((SELECT value::int FROM app_settings WHERE key = 'banner_switch_cooldown_hours'), 6);
  SELECT active_banner_switched_at INTO v_last FROM users WHERE id = p_user_id;
  IF v_last IS NOT NULL THEN
    v_next := v_last + make_interval(hours => v_cd_hours);
    IF now() < v_next THEN
      RETURN json_build_object('error', 'cooldown',
        'secondsRemaining', ceil(extract(epoch FROM (v_next - now())))::int);
    END IF;
  END IF;

  UPDATE users SET active_company_id = p_company_id, active_banner_switched_at = now()
    WHERE id = p_user_id;
  RETURN json_build_object('success', true, 'activeCompanyId', p_company_id);
END;$$;
GRANT EXECUTE ON FUNCTION public.set_active_banner(text, uuid) TO authenticated;
```

- [ ] **Step 2 : `send_company_message`** (membre uniquement)

```sql
CREATE OR REPLACE FUNCTION public.send_company_message(p_user_id text, p_company_id uuid, p_content text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_name text; v_id bigint; v_content text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM company_members WHERE company_id = p_company_id AND user_id = p_user_id) THEN
    RETURN json_build_object('error', 'not_member');
  END IF;
  v_content := btrim(coalesce(p_content, ''));
  IF length(v_content) < 1 OR length(v_content) > 500 THEN
    RETURN json_build_object('error', 'invalid_content');
  END IF;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_name FROM users WHERE id = p_user_id;
  INSERT INTO company_messages (company_id, user_id, user_name, content)
    VALUES (p_company_id, p_user_id, v_name, v_content) RETURNING id INTO v_id;
  RETURN json_build_object('success', true, 'id', v_id);
END;$$;
GRANT EXECUTE ON FUNCTION public.send_company_message(text, uuid, text) TO authenticated;
```

- [ ] **Step 3 : `get_company_messages`** (lecture initiale ; le live passe par realtime)

```sql
CREATE OR REPLACE FUNCTION public.get_company_messages(p_company_id uuid, p_limit int DEFAULT 50)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid text; v_rows json;
BEGIN
  v_uid := auth.uid()::text;
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM company_members WHERE company_id = p_company_id AND user_id = v_uid) THEN
    RETURN json_build_object('error', 'not_member');
  END IF;
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at), '[]'::json) INTO v_rows
  FROM (
    SELECT id, user_id AS "userId", user_name AS "userName", content, created_at AS "createdAt"
    FROM company_messages WHERE company_id = p_company_id
    ORDER BY created_at DESC LIMIT GREATEST(1, LEAST(p_limit, 200))
  ) t;
  RETURN v_rows;
END;$$;
GRANT EXECUTE ON FUNCTION public.get_company_messages(uuid, int) TO authenticated;
```

- [ ] **Step 4 : `list_companies`** (annuaire pour rejoindre — porte ouverte)

```sql
CREATE OR REPLACE FUNCTION public.list_companies(p_search text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rows json;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO v_rows
  FROM (
    SELECT c.id, c.name, c.color, c.image_url AS "imageUrl", c.description, c.is_official AS "isOfficial",
           (SELECT count(*) FROM company_members m WHERE m.company_id = c.id) AS "memberCount"
    FROM companies c
    WHERE p_search IS NULL OR c.name ILIKE '%' || p_search || '%'
    ORDER BY c.is_official DESC, "memberCount" DESC, c.created_at DESC
    LIMIT 100
  ) t;
  RETURN v_rows;
END;$$;
GRANT EXECUTE ON FUNCTION public.list_companies(text) TO authenticated;
```

- [ ] **Step 5 : `get_company`** (détail + membres)

```sql
CREATE OR REPLACE FUNCTION public.get_company(p_company_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_company json; v_members json; v_founder text;
BEGIN
  SELECT founder_user_id INTO v_founder FROM companies WHERE id = p_company_id;
  IF v_founder IS NULL AND NOT EXISTS (SELECT 1 FROM companies WHERE id = p_company_id) THEN
    RETURN json_build_object('error', 'company_not_found');
  END IF;
  SELECT json_build_object(
    'id', c.id, 'name', c.name, 'color', c.color, 'imageUrl', c.image_url,
    'description', c.description, 'founderUserId', c.founder_user_id,
    'memberCount', (SELECT count(*) FROM company_members m WHERE m.company_id = c.id)
  ) INTO v_company FROM companies c WHERE c.id = p_company_id;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.joined_at), '[]'::json) INTO v_members
  FROM (
    SELECT m.user_id AS "userId",
           COALESCE(u.display_name, u.first_name, 'Quelqu''un') AS name,
           m.joined_at AS "joinedAt",
           (m.user_id = v_founder) AS "isFounder"
    FROM company_members m JOIN users u ON u.id = m.user_id
    WHERE m.company_id = p_company_id
  ) t;

  RETURN (v_company::jsonb || jsonb_build_object('members', v_members))::json;
END;$$;
GRANT EXECUTE ON FUNCTION public.get_company(uuid) TO authenticated;
```

- [ ] **Step 6 : `get_my_companies`** (mes 0–2 Compagnies + laquelle est active)

```sql
CREATE OR REPLACE FUNCTION public.get_my_companies(p_user_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_active uuid; v_rows json;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  SELECT active_company_id INTO v_active FROM users WHERE id = p_user_id;
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.joined_at), '[]'::json) INTO v_rows
  FROM (
    SELECT c.id, c.name, c.color, c.image_url AS "imageUrl",
           (SELECT count(*) FROM company_members m2 WHERE m2.company_id = c.id) AS "memberCount",
           (c.id = v_active) AS "isActive",
           (c.founder_user_id = p_user_id) AS "isFounder",
           m.joined_at
    FROM company_members m JOIN companies c ON c.id = m.company_id
    WHERE m.user_id = p_user_id
  ) t;
  RETURN json_build_object('activeCompanyId', v_active, 'companies', v_rows);
END;$$;
GRANT EXECUTE ON FUNCTION public.get_my_companies(text) TO authenticated;
```

- [ ] **Step 7 : `update_company_identity`** (interim fondateur-admin)

```sql
CREATE OR REPLACE FUNCTION public.update_company_identity(
  p_user_id text, p_company_id uuid, p_name text, p_color text, p_description text, p_image_url text
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_name text;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  -- INTERIM Lot 1 : fondateur (Compagnie joueur) OU admin (Compagnie officielle).
  -- Remplacé au Lot 2 par le pouvoir d'échelon Capitaine.
  IF NOT (public._is_admin()
          OR EXISTS (SELECT 1 FROM companies WHERE id = p_company_id AND founder_user_id = p_user_id)) THEN
    RETURN json_build_object('error', 'forbidden');
  END IF;
  v_name := btrim(coalesce(p_name, ''));
  IF v_name = '' THEN RETURN json_build_object('error', 'name_required'); END IF;
  IF length(v_name) > 60 THEN RETURN json_build_object('error', 'name_too_long'); END IF;
  IF EXISTS (SELECT 1 FROM companies WHERE lower(name) = lower(v_name) AND id <> p_company_id) THEN
    RETURN json_build_object('error', 'name_taken');
  END IF;
  UPDATE companies SET
    name = v_name,
    color = COALESCE(NULLIF(btrim(p_color), ''), color),
    description = NULLIF(btrim(p_description), ''),
    image_url = NULLIF(btrim(p_image_url), '')
  WHERE id = p_company_id;
  RETURN json_build_object('success', true);
END;$$;
GRANT EXECUTE ON FUNCTION public.update_company_identity(text, uuid, text, text, text, text) TO authenticated;
```

- [ ] **Step 8 : `remove_company_member`** (interim fondateur-admin + ban court)

```sql
CREATE OR REPLACE FUNCTION public.remove_company_member(p_user_id text, p_company_id uuid, p_target_user_id text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_ban_hours int;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  IF NOT (public._is_admin()
          OR EXISTS (SELECT 1 FROM companies WHERE id = p_company_id AND founder_user_id = p_user_id)) THEN
    RETURN json_build_object('error', 'forbidden');
  END IF;
  IF p_target_user_id = p_user_id THEN
    RETURN json_build_object('error', 'cannot_remove_self');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM company_members WHERE company_id = p_company_id AND user_id = p_target_user_id) THEN
    RETURN json_build_object('error', 'not_member');
  END IF;

  v_ban_hours := COALESCE((SELECT value::int FROM app_settings WHERE key = 'company_ban_hours'), 24);
  DELETE FROM company_members WHERE company_id = p_company_id AND user_id = p_target_user_id;
  INSERT INTO company_bans (company_id, user_id, until)
    VALUES (p_company_id, p_target_user_id, now() + make_interval(hours => v_ban_hours))
    ON CONFLICT (company_id, user_id) DO UPDATE SET until = EXCLUDED.until;
  -- Si la Compagnie était la bannière active du viré → bannière perso
  UPDATE users SET active_company_id = NULL, active_banner_switched_at = now()
    WHERE id = p_target_user_id AND active_company_id = p_company_id;
  RETURN json_build_object('success', true);
END;$$;
GRANT EXECUTE ON FUNCTION public.remove_company_member(text, uuid, text) TO authenticated;
```

- [ ] **Step 9 : Preview** — Run : `node scripts/migration-preview.mjs supabase/migrations/275_companies_lot1.sql` → Expected : toutes les RPC détectées, aucun parse error. Vérifier visuellement que le `COMMIT;` reste la dernière instruction.

- [ ] **Step 10 : `graphify-sql` + Commit**

```bash
python3 scripts/graphify-sql.py
git add supabase/migrations/275_companies_lot1.sql graphify-out/
git commit -m "feat(db): RPC bannière/chat/lecture/identité/exclusion Compagnies (Lot 1)"
```

---

## Task 4 : Appliquer la migration en prod (CHECKPOINT — validation Uriel)

**Files:** aucun (opération infra).

> ⚠️ Push sur la **prod réelle**. Faire valider par Uriel avant `db push` (pas de rollback simple). Pré-requis : avoir lu la def LIVE d'`app_settings`/`user_crowns` (Étape 0).

- [ ] **Step 1 : Dry-run** — Run : `npx supabase db push --dry-run --linked`
  Expected : la migration `275_companies_lot1.sql` apparaît comme **seule** migration en attente ; aucune erreur.
- [ ] **Step 2 : GO d'Uriel** — confirmer explicitement avant d'appliquer.
- [ ] **Step 3 : Push** — Run : `npx supabase db push --linked`
  Expected : `Applying migration 275_companies_lot1.sql...` puis succès ; l'historique enregistre 275.
- [ ] **Step 4 : Smoke test prod (lecture)** — via le MCP Supabase `execute_sql` ou psql, vérifier la présence :
  `SELECT to_regclass('public.companies'), to_regclass('public.company_members'), to_regclass('public.company_messages'), to_regclass('public.company_bans');`
  Expected : les 4 tables non-null.
  `SELECT key, value FROM app_settings WHERE key LIKE 'company\_%' OR key = 'banner_switch_cooldown_hours';`
  Expected : 4 lignes (cost 150, cooldown 6, max 2, ban 24).
  `SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='company_messages';`
  Expected : 1 ligne.
- [ ] **Step 5 : Seed des 4 Compagnies officielles** — une fois la migration en prod, un **admin** crée les 4 grandes (§1bis) via `admin_create_company`. Noms / couleurs / descriptions *fun* **fournis par Uriel** (ne rien inventer). Ex. d'appel (MCP Supabase `execute_sql` avec session admin, ou depuis le Hub) :
  `SELECT public.admin_create_company('<nom>', '<#couleur>', '<mission fun>', NULL);`
  Expected : 4 × `{success:true, companyId:...}`. Les **images** seront ajoutées ensuite via l'édition d'identité (bucket `company-emblems`, Task 5) une fois le front livré.
  Vérif : `SELECT name, is_official FROM companies WHERE is_official;` → 4 lignes.
- [ ] **Step 6 : Pas de commit** (rien de versionné ne change ici ; l'historique migration est géré par Supabase).

---

## Task 5 : Bucket `company-emblems` (manuel — Uriel) + signalement

**Files:**
- Modify: `docs/db/storage.md` (documenter le nouveau bucket)
- Modify: `docs/db/cleanup-v1-identity.md` (tracer la dette : suppression Dortoir, etc. — ligne à ajouter)

- [ ] **Step 1 : Signaler à Uriel le bucket à créer manuellement** :
  - Nom : `company-emblems`
  - Public : **oui** (lecture publique, comme `place-images`)
  - Paths : `companies/{companyId}.webp`
  - Policy RLS : insert/update réservés aux `authenticated` (l'autorisation fine fondateur/Capitaine est vérifiée côté RPC, pas au bucket).
- [ ] **Step 2 : Documenter** dans `docs/db/storage.md` (section buckets) : ajouter `company-emblems` avec les specs ci-dessus.
- [ ] **Step 3 : Commit**

```bash
git add docs/db/storage.md docs/db/cleanup-v1-identity.md
git commit -m "docs(db): bucket company-emblems + dette Dortoir (Lot 1 Compagnies)"
```

---

## Task 6 : Front — helper de compression d'image Compagnie

**Files:**
- Create: `apps/explore-web/src/lib/companyImageUpload.ts`
- Test: `apps/explore-web/src/lib/companyImageUpload.test.ts`
- Reference (mirror) : `apps/explore-web/src/lib/avatarUpload.ts` + `apps/explore-web/src/lib/imageUtils.ts` (compression WebP existante)

**Interfaces:**
- Produces : `export async function uploadCompanyImage(companyId: string, file: File): Promise<string>` (retourne l'URL publique) ; `export function companyImagePath(companyId: string): string` (pur, testable).

- [ ] **Step 1 : Test du helper pur de chemin**

```ts
import { describe, it, expect } from 'vitest'
import { companyImagePath } from './companyImageUpload'

describe('companyImagePath', () => {
  it('construit le chemin dans le bucket', () => {
    expect(companyImagePath('abc-123')).toBe('companies/abc-123.webp')
  })
})
```

- [ ] **Step 2 : Run le test (échoue)** — Run : `pnpm --filter explore-web test companyImageUpload` → Expected : FAIL (`companyImagePath` introuvable).

- [ ] **Step 3 : Implémenter** (calquer `avatarUpload.ts` pour la partie upload : compression via `imageUtils`, `supabase.storage.from('company-emblems').upload(path, blob, { upsert:true })`, puis `getPublicUrl`).

```ts
import { supabase } from './supabase'
import { compressToWebp } from './imageUtils' // mirror avatarUpload.ts pour le nom exact

export function companyImagePath(companyId: string): string {
  return `companies/${companyId}.webp`
}

export async function uploadCompanyImage(companyId: string, file: File): Promise<string> {
  const blob = await compressToWebp(file, { maxSize: 800, quality: 0.82 })
  const path = companyImagePath(companyId)
  const { error } = await supabase.storage.from('company-emblems').upload(path, blob, {
    upsert: true, contentType: 'image/webp',
  })
  if (error) throw error
  const { data } = supabase.storage.from('company-emblems').getPublicUrl(path)
  return data.publicUrl
}
```

> ⚠️ Vérifier le vrai nom de la fonction de compression dans `avatarUpload.ts`/`imageUtils.ts` et l'aligner (le rapport d'exploration cite `compressImage.ts` comme nom possible — utiliser le symbole réellement exporté).

- [ ] **Step 4 : Run le test (passe)** — Run : `pnpm --filter explore-web test companyImageUpload` → Expected : PASS.
- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/lib/companyImageUpload.ts apps/explore-web/src/lib/companyImageUpload.test.ts
git commit -m "feat(web): helper upload image de Compagnie (bucket company-emblems)"
```

---

## Task 7 : Front — store `companyStore` (zustand)

**Files:**
- Create: `apps/explore-web/src/stores/companyStore.ts`
- Test: `apps/explore-web/src/stores/companyStore.test.ts` (logique pure uniquement : sélecteur `canSwitchBanner`)
- Reference (mirror) : `apps/explore-web/src/stores/crownsStore.ts` (pattern rpc + `{ data, error }`), `apps/explore-web/src/stores/playerStore.ts`.

**Interfaces:**
- Consumes : RPC `get_my_companies`, `create_company`, `join_company`, `leave_company`, `set_active_banner`, `list_companies`, `get_company`, `update_company_identity`, `remove_company_member`.
- Produces : store avec `{ myCompanies: MyCompany[], activeCompanyId: string|null, directory: CompanySummary[], loadMine(userId), loadDirectory(search?), create(...), join(id), leave(id), switchBanner(userId, id|null), ... }` et le sélecteur pur `export function bannerCooldownRemaining(switchedAt: string|null, cooldownHours: number, now: number): number`.

- [ ] **Step 1 : Test du sélecteur pur de cooldown**

```ts
import { describe, it, expect } from 'vitest'
import { bannerCooldownRemaining } from './companyStore'

describe('bannerCooldownRemaining', () => {
  const H = 3600_000
  it('0 si jamais basculé', () => {
    expect(bannerCooldownRemaining(null, 6, Date.now())).toBe(0)
  })
  it('0 si cooldown écoulé', () => {
    const switched = new Date(Date.now() - 7 * H).toISOString()
    expect(bannerCooldownRemaining(switched, 6, Date.now())).toBe(0)
  })
  it('temps restant en secondes si dans la fenêtre', () => {
    const now = Date.now()
    const switched = new Date(now - 2 * H).toISOString()
    // 6h - 2h = 4h = 14400s
    expect(bannerCooldownRemaining(switched, 6, now)).toBe(14400)
  })
})
```

- [ ] **Step 2 : Run le test (échoue)** — Run : `pnpm --filter explore-web test companyStore` → Expected : FAIL.

- [ ] **Step 3 : Implémenter le sélecteur + le store** (calquer `crownsStore.ts` ; chaque action `await supabase.rpc(...)`, log `console.error('[company] ...', error.message)` ; relire `data.error` métier). Sélecteur pur :

```ts
export function bannerCooldownRemaining(switchedAt: string | null, cooldownHours: number, now: number): number {
  if (!switchedAt) return 0
  const next = new Date(switchedAt).getTime() + cooldownHours * 3600_000
  return Math.max(0, Math.ceil((next - now) / 1000))
}
```

> Types `MyCompany` / `CompanySummary` : refléter exactement les clés des RPC (`id,name,color,imageUrl,memberCount,isActive,isFounder` ; directory : `+description`). Pas de `any`.

- [ ] **Step 4 : Run le test (passe)** — Run : `pnpm --filter explore-web test companyStore` → Expected : PASS.
- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/stores/companyStore.ts apps/explore-web/src/stores/companyStore.test.ts
git commit -m "feat(web): companyStore (zustand) + sélecteur cooldown bannière"
```

---

## Task 8 : Front — hook `useCompanyChat` (réemploi de `useRealtimeChat`)

**Files:**
- Create: `apps/explore-web/src/hooks/useCompanyChat.ts`
- Reference (mirror) : `apps/explore-web/src/hooks/useExpeditionChat.ts` (usage de `useRealtimeChat`), `apps/explore-web/src/hooks/useRealtimeChat.ts` (générique `{ table, filterField, filterValue }`).

**Interfaces:**
- Consumes : `useRealtimeChat`, RPC `get_company_messages`, `send_company_message`.
- Produces : `export function useCompanyChat(companyId: string | null): { messages: ChatMessage[], send: (content: string) => Promise<void>, loading: boolean }`.

- [ ] **Step 1 : Implémenter** en calquant `useExpeditionChat.ts` : `useRealtimeChat({ table: 'company_messages', filterField: 'company_id', filterValue: companyId })` pour le live ; fetch initial via `supabase.rpc('get_company_messages', { p_company_id: companyId, p_limit: 50 })` ; `send` via `supabase.rpc('send_company_message', { p_user_id, p_company_id: companyId, p_content })`. Garde `if (!companyId) return ...` (bannière perso = pas de chat).

> Pas de test unitaire dédié (hook = effets/realtime ; validation au click-flow). Aligner le type `ChatMessage` sur celui exporté par `useRealtimeChat`.

- [ ] **Step 2 : Build gate** — Run : `pnpm --filter explore-web build` → Expected : `tsc` passe (pas d'erreur de type), build OK.
- [ ] **Step 3 : Commit**

```bash
git add apps/explore-web/src/hooks/useCompanyChat.ts
git commit -m "feat(web): hook useCompanyChat (réemploi useRealtimeChat)"
```

---

## Task 9 : Front — écran annuaire & création (`CompaniesPage`)

**Files:**
- Create: `apps/explore-web/src/pages/CompaniesPage.tsx`
- Create: `apps/explore-web/src/components/companies/CompanyCreateForm.tsx`
- Create: `apps/explore-web/src/components/companies/CompanyDirectoryList.tsx`
- Modify: `apps/explore-web/src/App.tsx` (ajouter la route `/compagnies`, lazy, sous `RequireAuth`)
- Reference (mirror) : une page existante lazy (ex. `ChatPage.tsx`) pour le squelette + le pattern de route.

**Interfaces:**
- Consumes : `companyStore` (`loadMine`, `loadDirectory`, `create`, `join`), `uploadCompanyImage`.
- Produces : route `/compagnies`.

- [ ] **Step 1 : `CompanyCreateForm`** — champs nom / couleur (palette sobre RdC, pas de blason RPG) / description (mission, textarea) / image (input file → `uploadCompanyImage` après création : créer d'abord via `create()` pour obtenir `companyId`, puis upload, puis `update_company_identity` avec l'`imageUrl`). Afficher le coût (`company_founding_cost`) et l'erreur `insufficient_crowns` lisiblement. Texte ≥ 15px (préférence Uriel).
- [ ] **Step 2 : `CompanyDirectoryList`** — liste depuis `loadDirectory()`, bouton « Rejoindre » par carte (désactivé si déjà 2 Compagnies → message), recherche par nom.
- [ ] **Step 3 : `CompaniesPage`** — compose : mes Compagnies (depuis `loadMine`) en haut, annuaire + bouton « Fonder une Compagnie » (ouvre le form). Empty state quand 0 Compagnie.
- [ ] **Step 4 : Route** — `App.tsx` : `const CompaniesPage = lazy(() => import('./pages/CompaniesPage'))` + `<Route path="/compagnies" element={<RequireAuth><CompaniesPage/></RequireAuth>} />` (calquer les routes mobiles existantes).
- [ ] **Step 5 : Build gate** — Run : `pnpm --filter explore-web build` → Expected : OK.
- [ ] **Step 6 : Commit**

```bash
git add apps/explore-web/src/pages/CompaniesPage.tsx apps/explore-web/src/components/companies/ apps/explore-web/src/App.tsx
git commit -m "feat(web): écran Compagnies — annuaire + création"
```

---

## Task 10 : Front — détail Compagnie (membres, bannière, chat, identité)

**Files:**
- Create: `apps/explore-web/src/components/companies/CompanyDetailPanel.tsx`
- Create: `apps/explore-web/src/components/companies/CompanyChatPanel.tsx`
- Create: `apps/explore-web/src/components/companies/CompanyBannerToggle.tsx`
- Modify: `apps/explore-web/src/pages/CompaniesPage.tsx` (router vers le détail d'une Compagnie sélectionnée)
- Reference (mirror) : `apps/explore-web/src/components/chat/ChatPanel.tsx` pour la liste de messages + saisie.

**Interfaces:**
- Consumes : `get_company`, `useCompanyChat`, `companyStore.switchBanner`, `bannerCooldownRemaining`, `update_company_identity`, `remove_company_member`, `leave_company`.

- [ ] **Step 1 : `CompanyChatPanel`** — calquer `ChatPanel.tsx` (rendu des messages, input 500 max) branché sur `useCompanyChat(companyId)`.
- [ ] **Step 2 : `CompanyBannerToggle`** — bouton « Porter ces couleurs » → `switchBanner(userId, companyId)` ; si `bannerCooldownRemaining > 0`, désactiver + afficher le compte à rebours ; gérer l'erreur `cooldown` renvoyée par la RPC (source de vérité serveur). Indiquer visuellement la Compagnie active.
- [ ] **Step 3 : `CompanyDetailPanel`** — en-tête (image/couleur/nom/description-mission), liste des membres (badge fondateur), `CompanyBannerToggle`, `CompanyChatPanel`, bouton « Quitter ». **Si `isFounder`** : bouton « Éditer l'identité » (réutilise le form) + actions « exclure » par membre (interim fondateur-admin). Masquer ces actions pour les non-fondateurs.
- [ ] **Step 4 : Build gate** — Run : `pnpm --filter explore-web build` → Expected : OK.
- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/components/companies/ apps/explore-web/src/pages/CompaniesPage.tsx
git commit -m "feat(web): détail Compagnie — membres, bannière, chat, édition (interim fondateur)"
```

---

## Task 11 : Front — points d'entrée dans les menus (desktop + mobile)

**Files:**
- Modify: `apps/explore-web/src/components/auth/ProfileMenu.tsx`
- Modify: `apps/explore-web/src/components/navigation/MobileTopBar.tsx` (et/ou `BottomTabbarPlusMenu.tsx`)
- Modify: `apps/explore-web/src/components/map/controls/MobileHeader.tsx`
- Reference : memory « toucher ProfileMenu (desktop) ↔ MobileHeader/MobileTopBar (mobile) ensemble ».

**Interfaces:**
- Consumes : route `/compagnies`, `companyStore` (badge bannière active : nom + pastille couleur).

- [ ] **Step 1 : Desktop** — `ProfileMenu.tsx` : ajouter une entrée « Mes Compagnies » → `navigate('/compagnies')`, et afficher la bannière active (pastille `color` + nom) si présente.
- [ ] **Step 2 : Mobile** — même entrée dans `MobileTopBar.tsx`/`BottomTabbarPlusMenu.tsx` ET `MobileHeader.tsx` (les trois points d'entrée distincts). Garder cohérent visuellement.
- [ ] **Step 3 : Build gate** — Run : `pnpm --filter explore-web build` → Expected : OK.
- [ ] **Step 4 : Commit**

```bash
git add apps/explore-web/src/components/auth/ProfileMenu.tsx apps/explore-web/src/components/navigation/ apps/explore-web/src/components/map/controls/MobileHeader.tsx
git commit -m "feat(web): entrées Compagnies dans les menus desktop + mobile"
```

---

## Task 12 : Validation end-to-end locale (click-flow) + push

**Files:** aucun (sauf correctifs éventuels).

> Pas d'e2e automatisé dans ce repo → validation manuelle obligatoire (cf. règle « jamais deploy sans test local »). Bucket `company-emblems` doit exister (Task 5) avant de tester l'upload.

- [ ] **Step 1 : `pnpm --filter explore-web dev`** et dérouler le flow avec un compte de test :
  - Fonder une Compagnie (vérifier le débit de 150 Couronnes ; tester le cas solde insuffisant).
  - Uploader une image, voir l'emblème/couleur.
  - Avec un 2ᵉ compte : rejoindre, poster dans le chat, voir le message arriver en **realtime** sur le 1ᵉʳ compte.
  - Basculer la bannière active ; vérifier le **cooldown** (2ᵉ bascule refusée avant 6h).
  - Fonder/rejoindre une 2ᵉ → la 3ᵉ tentative est bloquée (`too_many_companies`).
  - Fondateur : éditer l'identité, exclure un membre (vérifier le ban court : re-join immédiat refusé).
  - Quitter la dernière → la Compagnie s'éteint (`extinguished:true`), disparaît de l'annuaire.
- [ ] **Step 2 : `pnpm --filter explore-web build`** → Expected : OK.
- [ ] **Step 3 : Push du lot** (fin de Lot 1) :

```bash
git push origin v1-refonte-identite
```

- [ ] **Step 4 : Mettre à jour le suivi** — `docs/db/cleanup-v1-identity.md` : cocher l'avancement « Compagnies — Lot 1 livré » ; noter la dette restante (Dortoir à retirer, interim fondateur-admin à remplacer par échelons au Lot 2).

---

## Lots ultérieurs (hors de ce plan, déjà spécifiés)

- **Lot 2 — Moteur organique** : `service_value` par membre (territoire tenu + présence), érosion, échelons (Membre/Porte-voix/Capitaine) ⇒ remplace l'interim fondateur-admin de `update_company_identity` / `remove_company_member`. Avance de service du fondateur ∝ Couronnes investies.
- **Lot 3 — Pactes de lieu** : co-tenue via Expédition → bonus Couronnes (SPEC 3 Territoire/scoring : recoloration carte par Compagnie, normalisation du score, comptage des zones).
- **Cleanup** : retrait du Dortoir (chat de Maison) une fois le chat Compagnie adopté.

---

## Self-Review

- **Couverture spec (SPEC 2)** : Compagnies officielles (§1bis) ✅ (T1 `is_official` + founder nullable, T2 `admin_create_company`, T3 édition/exclusion admin, `leave_company` exempte les officielles d'extinction, `list_companies` les remonte/badge, T4 step 5 seed des 4) · appartenance exclusive→multi(2)+bannière active ✅ (T1 colonnes, T2 caps, T3 `set_active_banner`+cooldown) · fondation payante Couronnes ✅ (T2) · porte ouverte/rejoindre ✅ (T2) · quitter + extinction 0 membre ✅ (T2) · identité nom/image/couleur/description ✅ (T1 schéma, T3 update, T6 upload, T9/T10 UI) · chat remplace Dortoir (additif : ajouté à côté) ✅ (T1 table+realtime, T3 send/get, T8 hook, T10 UI) · exclusion = ban court ✅ (T3) · solo complet (bannière perso = `active_company_id NULL`) ✅ · garde-fou anti-bascule (cooldown) ✅ (T3) · pas de dissolution ✅ (aucun bouton ; extinction auto). **Différé explicitement** : échelons organiques, pactes de lieu, recoloration carte (lots 2/3, marqués).
- **Placeholders** : aucun « TBD » ; les seuls renvois « mirror X » pointent des fichiers réels existants à calquer (pattern codebase imposé), avec les signatures/clés fournies.
- **Cohérence des types** : clés JSON des RPC réutilisées telles quelles côté store (`imageUrl`, `isActive`, `isFounder`, `memberCount`, `secondsRemaining`, `activeCompanyId`). Signatures RPC alignées entre blocs « Produces » et `GRANT`.
- **Risques connus à confirmer en T0** : schéma réel d'`app_settings` (`value` text vs jsonb) et `user_crowns` ; nom exact de la fonction de compression d'image. Ces points sont listés comme vérifications préalables, pas comme placeholders.
