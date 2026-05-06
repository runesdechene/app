# V0.7+ Expeditions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le sous-système Expéditions joueur-joueur (bannière sur la carte, chef d'expédition, slots, validation, chat privé, comptes rendus opt-in avec galerie, archives) en suivant la spec `docs/superpowers/specs/2026-05-06-v07-expeditions-design.md`.

**Architecture:** Backend Supabase (7 tables + 1 bucket + ~17 RPCs SECURITY DEFINER + 1 trigger XP + 1 cron archivage). Frontend React + Zustand sur explore-web (~6 nouveaux composants dans `apps/explore-web/src/components/expeditions/` + extension du système notifications + onglet profil).

**Tech Stack:** PostgreSQL/PL-pgSQL (Supabase), Supabase Storage, Supabase Realtime, React 18 + Vite 5 + TypeScript strict, Zustand, MapLibre GL JS, `pg_cron`. Convention monorepo : pnpm, conventional commits, migrations SQL numérotées.

**Repo:** `C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/` (machine FONDATION)
**Branch:** `main` (Uriel a confirmé pas de branche dédiée pour cette feature — push par lots cohérents en fin de session uniquement)

---

## Phase 0 — Cleanup naming (préalable obligatoire)

Le composant existant `ExpeditionOptInModal` (Plantage V0.7) collisionne sémantiquement avec la nouvelle feature. On le renomme avant tout dev pour éviter la confusion.

### Task 0.1: Renommer `ExpeditionOptInModal` → `VeillePartageeModal`

**Files:**
- Rename: `apps/explore-web/src/components/places/modals/ExpeditionOptInModal.tsx` → `apps/explore-web/src/components/places/modals/VeillePartageeModal.tsx`
- Modify: `apps/explore-web/src/components/places/views/VeilleFrame.tsx` (import + usage)
- Modify: `apps/explore-web/src/components/places/views/VeilleFrame.css` (classes `expedition-modal*` → `veille-partagee-modal*`)

- [ ] **Step 1: Renommer le fichier composant**

```bash
git mv "apps/explore-web/src/components/places/modals/ExpeditionOptInModal.tsx" "apps/explore-web/src/components/places/modals/VeillePartageeModal.tsx"
```

- [ ] **Step 2: Renommer la fonction exportée + classes CSS dans le composant**

Dans `VeillePartageeModal.tsx`, remplacer :
- `export function ExpeditionOptInModal` → `export function VeillePartageeModal`
- `className="expedition-modal-overlay"` → `className="veille-partagee-modal-overlay"`
- `className="expedition-modal"` → `className="veille-partagee-modal"`
- `className="expedition-modal-list"` → `className="veille-partagee-modal-list"`
- `className="expedition-modal-name"` → `className="veille-partagee-modal-name"`
- `className="expedition-modal-faction"` → `className="veille-partagee-modal-faction"`
- `className="expedition-modal-actions"` → `className="veille-partagee-modal-actions"`
- `className="expedition-modal-secondary"` → `className="veille-partagee-modal-secondary"`

Utiliser `Edit` avec `replace_all: true` sur chaque token, ou un Edit global sur le fichier.

- [ ] **Step 3: Mettre à jour l'import dans VeilleFrame.tsx**

Dans `apps/explore-web/src/components/places/views/VeilleFrame.tsx`, remplacer :
- `import { ExpeditionOptInModal } from '../modals/ExpeditionOptInModal'` → `import { VeillePartageeModal } from '../modals/VeillePartageeModal'`
- Toutes les utilisations JSX `<ExpeditionOptInModal ` → `<VeillePartageeModal `

- [ ] **Step 4: Mettre à jour les classes CSS dans VeilleFrame.css**

Dans `apps/explore-web/src/components/places/views/VeilleFrame.css`, remplacer (replace_all) :
- `.expedition-modal-overlay` → `.veille-partagee-modal-overlay`
- `.expedition-modal-list` → `.veille-partagee-modal-list`
- `.expedition-modal-name` → `.veille-partagee-modal-name`
- `.expedition-modal-faction` → `.veille-partagee-modal-faction`
- `.expedition-modal-actions` → `.veille-partagee-modal-actions`
- `.expedition-modal-secondary` → `.veille-partagee-modal-secondary`
- `.expedition-modal` (sans suffixe — careful, faire un Edit ciblé pour ne pas attraper les variantes ci-dessus avant qu'elles aient été renommées) → `.veille-partagee-modal`

**IMPORTANT** : remplacer les variantes plus longues d'abord (`expedition-modal-actions` etc.) pour ne pas casser leur match.

- [ ] **Step 5: Build OK**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/explore-web" && pnpm build
```

Expected: build OK, 0 TypeScript errors, 0 références orphelines.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)" && git add -A && git commit -m "refactor: rename ExpeditionOptInModal to VeillePartageeModal

Le terme 'Expedition' est désormais réservé au sous-système des
expéditions joueur-joueur (V0.7+). Le modale de plantage collectif
qui propose d'associer des veilleurs présents devient
VeillePartageeModal pour clarifier sa fonction réelle."
```

---

## Phase 1 — Migrations SQL (DB schema)

Toute la phase tient dans **une seule migration** numérotée 104, parce que les tables sont liées par FK et qu'on veut un déploiement atomique. La migration suivante (105) ajoute le trigger XP. Le pattern repo : `supabase/migrations/<NNN>_<snake_name>.sql` avec un commentaire WHY en tête.

### Task 1.1: Migration 104 — Tables expeditions + participants + messages

**Files:**
- Create: `supabase/migrations/104_v07_expeditions_schema.sql`

- [ ] **Step 1: Créer le fichier de migration avec le schéma complet**

```sql
-- 104_v07_expeditions_schema.sql
-- WHY : sous-système Expéditions joueur-joueur (spec 2026-05-06).
-- Bannière temporaire sur la carte, chef d'expédition unique, inscription
-- manuelle ou libre, chat privé, comptes rendus avec galerie, archives
-- consultables. Aucune dépendance directe avec le système Plantage/Veille
-- (cohabitation propre via naming distinct ; cf. refacto VeillePartageeModal).

-- ============================================================
-- TABLE : expeditions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expeditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chief_user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 3 AND 80),
  description text CHECK (description IS NULL OR length(description) <= 1000),
  rdv_at timestamptz NOT NULL,
  rdv_lat double precision NOT NULL,
  rdv_lng double precision NOT NULL,
  rdv_label text CHECK (rdv_label IS NULL OR length(rdv_label) <= 120),
  slots_max integer CHECK (slots_max IS NULL OR slots_max BETWEEN 2 AND 50),
  slots_open boolean NOT NULL DEFAULT false,
  validation_mode text NOT NULL CHECK (validation_mode IN ('manual','free')),
  status text NOT NULL CHECK (status IN ('published','passed','archived','cancelled')) DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  CONSTRAINT slots_consistency CHECK (
    (slots_open = true  AND slots_max IS NULL)
    OR (slots_open = false AND slots_max IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_expeditions_status_rdv ON public.expeditions(status, rdv_at);
CREATE INDEX IF NOT EXISTS idx_expeditions_chief     ON public.expeditions(chief_user_id);

-- ============================================================
-- TABLE : expedition_participants
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expedition_participants (
  expedition_id uuid NOT NULL REFERENCES public.expeditions(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending','validated','rejected','withdrawn')),
  request_message text CHECK (request_message IS NULL OR length(request_message) <= 280),
  joined_at timestamptz NOT NULL DEFAULT now(),
  validated_at timestamptz,
  PRIMARY KEY (expedition_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_expedition_participants_user ON public.expedition_participants(user_id, status);

-- ============================================================
-- TABLE : expedition_messages (chat privé)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expedition_messages (
  id bigserial PRIMARY KEY,
  expedition_id uuid NOT NULL REFERENCES public.expeditions(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expedition_messages_expe ON public.expedition_messages(expedition_id, created_at);

CREATE TABLE IF NOT EXISTS public.expedition_message_reads (
  expedition_id uuid NOT NULL REFERENCES public.expeditions(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (expedition_id, user_id)
);
```

**Note importante** : `users.id` est `text` dans la baseline RdC (à confirmer en lisant `001_baseline_2026-04-22.sql` ; si c'est `uuid`, ajuster les FK). Les RPCs côté repo prennent `p_user_id text`, ce plan suit cette convention.

- [ ] **Step 2: Vérifier le type `users.id` dans la baseline**

```bash
grep -n "CREATE TABLE.*users" "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/supabase/migrations/001_baseline_2026-04-22.sql" | head -3
grep -n "id text PRIMARY KEY\|id uuid PRIMARY KEY" "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/supabase/migrations/001_baseline_2026-04-22.sql" | head -10
```

Si `users.id` est `uuid`, remplacer dans le SQL ci-dessus toutes les occurrences `user_id text` et `chief_user_id text` par `... uuid`.

- [ ] **Step 3: Pas de commit isolé** — on ajoute les autres tables d'abord (1.2)

### Task 1.2: Migration 104 — Tables reports + medias + flags + trigger XP

**Files:**
- Modify: `supabase/migrations/104_v07_expeditions_schema.sql` (append)

- [ ] **Step 1: Ajouter les tables comptes rendus / médias / flags**

Append à `104_v07_expeditions_schema.sql` :

```sql
-- ============================================================
-- TABLE : expedition_reports (1 par participant après date passée)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expedition_reports (
  expedition_id uuid NOT NULL REFERENCES public.expeditions(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  text_content text CHECK (text_content IS NULL OR length(text_content) <= 1000),
  is_public boolean NOT NULL DEFAULT false,
  cover_media_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  xp_awarded boolean NOT NULL DEFAULT false,
  PRIMARY KEY (expedition_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.expedition_report_medias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expedition_id uuid NOT NULL REFERENCES public.expeditions(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('photo','video')),
  size_bytes integer,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (expedition_id, user_id)
    REFERENCES public.expedition_reports(expedition_id, user_id)
    ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_expedition_medias_gallery
  ON public.expedition_report_medias(expedition_id, created_at);

-- ============================================================
-- TABLE : expedition_flags (signalements)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expedition_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expedition_id uuid NOT NULL REFERENCES public.expeditions(id) ON DELETE CASCADE,
  reporter_user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam','inappropriate','other')),
  comment text CHECK (comment IS NULL OR length(comment) <= 500),
  resolved_at timestamptz,
  resolved_by text REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expedition_flags_unresolved
  ON public.expedition_flags(resolved_at) WHERE resolved_at IS NULL;
```

- [ ] **Step 2: Ajouter le trigger XP au compte rendu**

Append au même fichier :

```sql
-- ============================================================
-- TRIGGER XP : +10 XP au PREMIER compte rendu posté (par participant)
-- Pattern aligné sur les triggers _trg_xp_* existants (cf. mig 042).
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_xp_expedition_report_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(NEW.created_at, now()) >= public._xp_epoch() AND NEW.xp_awarded = false THEN
    UPDATE public.users SET xp_total = xp_total + 10 WHERE id = NEW.user_id;
    NEW.xp_awarded := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_xp_expedition_report_ins ON public.expedition_reports;
CREATE TRIGGER trg_xp_expedition_report_ins
  BEFORE INSERT ON public.expedition_reports
  FOR EACH ROW EXECUTE FUNCTION public._trg_xp_expedition_report_insert();
```

**Note** : `BEFORE INSERT` (pas AFTER) pour pouvoir muter `NEW.xp_awarded` au passage.

- [ ] **Step 3: Activer Realtime sur les 2 tables qui en ont besoin**

Append :

```sql
-- Realtime pour le chat live et les notifications de complétion
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'expedition_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expedition_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'expedition_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expedition_participants;
  END IF;
END $$;
```

- [ ] **Step 4: Appliquer la migration**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)" && pnpm dlx supabase db push
```

Expected: "Applied migration 104_v07_expeditions_schema.sql".

- [ ] **Step 5: Vérifier en prod (psql)**

Vérifier les 7 tables créées + le trigger :

```sql
SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'expedition%' ORDER BY tablename;
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_xp_expedition_report_ins';
```

Expected: 7 tables (`expedition_flags`, `expedition_message_reads`, `expedition_messages`, `expedition_participants`, `expedition_report_medias`, `expedition_reports`, `expeditions`) + 1 trigger.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)" && git add supabase/migrations/104_v07_expeditions_schema.sql && git commit -m "feat(db): expeditions schema — 7 tables + trigger XP +10 pour comptes rendus"
```

---

### Task 1.3: Bucket Storage `expedition-medias` + RLS

**Files:**
- Create: `supabase/migrations/105_v07_expedition_storage_rls.sql` (RLS policies, le bucket lui-même se crée via le dashboard)

- [ ] **Step 1: Créer le bucket via le Supabase Dashboard**

Aller sur `https://supabase.com/dashboard` → projet RdC → Storage → New bucket :
- **Name** : `expedition-medias`
- **Public** : ❌ NO (RLS gère la visibilité)
- **File size limit** : `52428800` (50 MB)
- **Allowed MIME types** : `image/jpeg,image/png,image/webp,video/mp4,video/webm`

⚠️ Si Uriel préfère scripter, voir alternative avec `supabase storage create-bucket` CLI (à valider dispo).

- [ ] **Step 2: Créer le fichier de migration RLS**

```sql
-- 105_v07_expedition_storage_rls.sql
-- WHY : politiques RLS pour le bucket expedition-medias.
-- INSERT : participant validé / chef de l'expé visée (path = expedition_id/user_id/...)
-- SELECT : participants validés OU médias publics (cover_media_id avec is_public=true)
-- DELETE : auteur du média ou chef d'expédition (modération)
--
-- Convention de path : `<expedition_id>/<user_id>/<filename>`
-- Le storage_path est validé par la RPC register_expedition_media (cf. mig 106).

-- INSERT : auth + (chef OR participant validé)
CREATE POLICY "expedition_medias_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expedition-medias'
  AND (
    EXISTS (
      SELECT 1 FROM public.expeditions e
      WHERE e.id::text = split_part(name, '/', 1)
        AND e.chief_user_id = auth.uid()::text
    )
    OR EXISTS (
      SELECT 1 FROM public.expedition_participants p
      WHERE p.expedition_id::text = split_part(name, '/', 1)
        AND p.user_id = auth.uid()::text
        AND p.status = 'validated'
    )
  )
);

-- SELECT : participants validés / chef OU média marqué public via cover
CREATE POLICY "expedition_medias_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'expedition-medias'
  AND (
    -- Chef de l'expédition
    EXISTS (
      SELECT 1 FROM public.expeditions e
      WHERE e.id::text = split_part(name, '/', 1)
        AND e.chief_user_id = auth.uid()::text
    )
    -- Participant validé
    OR EXISTS (
      SELECT 1 FROM public.expedition_participants p
      WHERE p.expedition_id::text = split_part(name, '/', 1)
        AND p.user_id = auth.uid()::text
        AND p.status = 'validated'
    )
    -- Média rendu public via cover
    OR EXISTS (
      SELECT 1 FROM public.expedition_report_medias m
      JOIN public.expedition_reports r
        ON r.expedition_id = m.expedition_id AND r.user_id = m.user_id
      WHERE m.storage_path = name
        AND r.is_public = true
        AND r.cover_media_id = m.id
    )
  )
);

-- DELETE : auteur du média ou chef d'expé
CREATE POLICY "expedition_medias_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'expedition-medias'
  AND (
    -- Auteur (le chemin contient son user_id en 2e segment)
    split_part(name, '/', 2) = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.expeditions e
      WHERE e.id::text = split_part(name, '/', 1)
        AND e.chief_user_id = auth.uid()::text
    )
  )
);
```

- [ ] **Step 3: Appliquer + vérifier**

```bash
pnpm dlx supabase db push
```

Vérifier en SQL :

```sql
SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'expedition_medias%';
```

Expected: 3 policies (insert, select, delete).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/105_v07_expedition_storage_rls.sql && git commit -m "feat(storage): RLS expedition-medias bucket"
```

---

## Phase 2 — RPCs CRUD expéditions (création / lecture)

Toutes les RPCs sont en `SECURITY DEFINER` pour appliquer la logique métier côté serveur (cf. règle inviolable `apps/explore-web/CLAUDE.md`).

**Convention :** chaque RPC dans une migration séparée, numérotée. Pattern reproduit de la baseline existante. Les paramètres sont préfixés `p_`. Les retours sont `json` ou `jsonb` (idem repo).

### Task 2.1: RPC `create_expedition`

**Files:**
- Create: `supabase/migrations/106_v07_rpc_create_expedition.sql`

- [ ] **Step 1: Écrire la RPC**

```sql
-- 106_v07_rpc_create_expedition.sql
-- WHY : RPC d'entrée du flux Expéditions. Limite 3 expés actives par chef
--       (anti-spam léger). Retourne l'expé créée pour pré-remplir l'UI.

CREATE OR REPLACE FUNCTION public.create_expedition(
  p_user_id text,
  p_name text,
  p_description text,
  p_rdv_at timestamptz,
  p_rdv_lat double precision,
  p_rdv_lng double precision,
  p_rdv_label text,
  p_slots_max integer,
  p_slots_open boolean,
  p_validation_mode text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_active_count integer;
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  IF p_rdv_at <= now() THEN
    RETURN json_build_object('success', false, 'error', 'rdv_must_be_in_future');
  END IF;

  IF p_validation_mode NOT IN ('manual','free') THEN
    RETURN json_build_object('success', false, 'error', 'invalid_validation_mode');
  END IF;

  -- Anti-spam : limite 3 expés actives en tant que chef
  SELECT count(*) INTO v_active_count
  FROM public.expeditions
  WHERE chief_user_id = p_user_id AND status = 'published';

  IF v_active_count >= 3 THEN
    RETURN json_build_object('success', false, 'error', 'max_active_expeditions_reached');
  END IF;

  INSERT INTO public.expeditions(
    chief_user_id, name, description, rdv_at, rdv_lat, rdv_lng, rdv_label,
    slots_max, slots_open, validation_mode
  ) VALUES (
    p_user_id, p_name, p_description, p_rdv_at, p_rdv_lat, p_rdv_lng, p_rdv_label,
    p_slots_max, p_slots_open, p_validation_mode
  ) RETURNING id INTO v_id;

  RETURN json_build_object(
    'success', true,
    'expedition_id', v_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_expedition(text,text,text,timestamptz,double precision,double precision,text,integer,boolean,text) TO authenticated;
```

- [ ] **Step 2: Appliquer + smoke test**

```bash
pnpm dlx supabase db push
```

Test en SQL (avec un user_id réel, ex via `SELECT id FROM users LIMIT 1`) :

```sql
SELECT public.create_expedition(
  'USER_ID_HERE',
  'Test Marche du Vercors',
  'Test description',
  now() + interval '7 days',
  45.0, 5.5, 'Parking du Mont',
  5, false, 'manual'
);
```

Expected: `{"success": true, "expedition_id": "<uuid>"}`.

- [ ] **Step 3: Cleanup test row + commit**

```sql
DELETE FROM public.expeditions WHERE name = 'Test Marche du Vercors';
```

```bash
git add supabase/migrations/106_v07_rpc_create_expedition.sql && git commit -m "feat(rpc): create_expedition with 3-active-max guard"
```

### Task 2.2: RPC `update_expedition`

**Files:**
- Create: `supabase/migrations/107_v07_rpc_update_expedition.sql`

- [ ] **Step 1: Écrire la RPC**

```sql
-- 107_v07_rpc_update_expedition.sql
-- WHY : Le chef peut modifier titre/description/lieu/date/slots tant que
-- l'expé n'est pas passée. Les modifs "sensibles" (rdv_at, lat/lng, slots)
-- déclenchent une notif aux validés (insertion via la RPC notif générique).

CREATE OR REPLACE FUNCTION public.update_expedition(
  p_user_id text,
  p_expedition_id uuid,
  p_name text,
  p_description text,
  p_rdv_at timestamptz,
  p_rdv_lat double precision,
  p_rdv_lng double precision,
  p_rdv_label text,
  p_slots_max integer,
  p_slots_open boolean
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_expe public.expeditions%ROWTYPE;
  v_changed_fields text[] := ARRAY[]::text[];
  v_validated_count integer;
BEGIN
  SELECT * INTO v_expe FROM public.expeditions WHERE id = p_expedition_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'expedition_not_found');
  END IF;
  IF v_expe.chief_user_id <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'not_chief');
  END IF;
  IF v_expe.status <> 'published' THEN
    RETURN json_build_object('success', false, 'error', 'expedition_not_editable');
  END IF;

  -- Track sensible field changes
  IF v_expe.rdv_at IS DISTINCT FROM p_rdv_at THEN
    v_changed_fields := array_append(v_changed_fields, 'rdv_at');
  END IF;
  IF v_expe.rdv_lat IS DISTINCT FROM p_rdv_lat OR v_expe.rdv_lng IS DISTINCT FROM p_rdv_lng THEN
    v_changed_fields := array_append(v_changed_fields, 'location');
  END IF;
  IF (v_expe.slots_max IS DISTINCT FROM p_slots_max) OR (v_expe.slots_open IS DISTINCT FROM p_slots_open) THEN
    -- Refus si réduction sous le nb de validés
    SELECT count(*) INTO v_validated_count
      FROM public.expedition_participants
      WHERE expedition_id = p_expedition_id AND status = 'validated';
    -- chief compte dans les slots → +1
    IF p_slots_open = false AND p_slots_max IS NOT NULL AND p_slots_max < (v_validated_count + 1) THEN
      RETURN json_build_object('success', false, 'error', 'slots_below_validated_count');
    END IF;
    v_changed_fields := array_append(v_changed_fields, 'slots');
  END IF;

  UPDATE public.expeditions SET
    name = p_name,
    description = p_description,
    rdv_at = p_rdv_at,
    rdv_lat = p_rdv_lat,
    rdv_lng = p_rdv_lng,
    rdv_label = p_rdv_label,
    slots_max = p_slots_max,
    slots_open = p_slots_open,
    updated_at = now()
  WHERE id = p_expedition_id;

  RETURN json_build_object(
    'success', true,
    'changed_fields', v_changed_fields
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_expedition(text,uuid,text,text,timestamptz,double precision,double precision,text,integer,boolean) TO authenticated;
```

- [ ] **Step 2: Appliquer + smoke test + commit** (même pattern que 2.1)

### Task 2.3: RPC `cancel_expedition`

**Files:**
- Create: `supabase/migrations/108_v07_rpc_cancel_expedition.sql`

- [ ] **Step 1: Écrire la RPC**

```sql
-- 108_v07_rpc_cancel_expedition.sql
-- WHY : annulation par le chef. Ne supprime pas (suppression dure J+30 par
-- le job d'archivage). Trigger les notifs aux validés côté front (la RPC
-- retourne la liste des user_id validés pour que le client pose les notifs).

CREATE OR REPLACE FUNCTION public.cancel_expedition(
  p_user_id text,
  p_expedition_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_chief text;
  v_status text;
  v_name text;
  v_validated_user_ids text[];
BEGIN
  SELECT chief_user_id, status, name INTO v_chief, v_status, v_name
    FROM public.expeditions WHERE id = p_expedition_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'expedition_not_found');
  END IF;
  IF v_chief <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'not_chief');
  END IF;
  IF v_status NOT IN ('published','passed') THEN
    RETURN json_build_object('success', false, 'error', 'expedition_not_cancellable');
  END IF;

  SELECT array_agg(user_id) INTO v_validated_user_ids
    FROM public.expedition_participants
    WHERE expedition_id = p_expedition_id AND status = 'validated';

  UPDATE public.expeditions
    SET status = 'cancelled', cancelled_at = now(), updated_at = now()
    WHERE id = p_expedition_id;

  RETURN json_build_object(
    'success', true,
    'expedition_name', v_name,
    'notify_user_ids', COALESCE(v_validated_user_ids, ARRAY[]::text[])
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_expedition(text,uuid) TO authenticated;
```

- [ ] **Step 2: Appliquer + commit**

### Task 2.4: RPC `get_expedition` (visibilité publique vs cœur privé)

**Files:**
- Create: `supabase/migrations/109_v07_rpc_get_expedition.sql`

- [ ] **Step 1: Écrire la RPC**

```sql
-- 109_v07_rpc_get_expedition.sql
-- WHY : Détail complet d'une expédition. Le retour s'adapte au caller :
-- - Chef OU participant validé → coque + cœur (chat, comptes rendus complets, médias privés)
-- - Sinon → coque publique seule (nom, date, lieu, chef, participants, comptes rendus opt-in)

CREATE OR REPLACE FUNCTION public.get_expedition(
  p_user_id text,
  p_expedition_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_expe public.expeditions%ROWTYPE;
  v_is_member boolean;
  v_validated_participants json;
  v_pending_participants json;
  v_reports json;
  v_my_status text;
BEGIN
  SELECT * INTO v_expe FROM public.expeditions WHERE id = p_expedition_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'expedition_not_found');
  END IF;

  -- Ne montrer ni cancelled ni archived avant 30j de date passée à un public hors-membre
  IF v_expe.status = 'cancelled' THEN
    -- Visible 30j seulement
    IF v_expe.cancelled_at + interval '30 days' < now() THEN
      RETURN json_build_object('success', false, 'error', 'expedition_not_found');
    END IF;
  END IF;

  v_is_member := v_expe.chief_user_id = p_user_id OR EXISTS (
    SELECT 1 FROM public.expedition_participants
    WHERE expedition_id = p_expedition_id
      AND user_id = p_user_id AND status = 'validated'
  );

  -- Liste des validés (publique : avatars + prénoms)
  SELECT json_agg(json_build_object(
    'user_id', u.id,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'level', u.level,
    'faction_id', u.faction_id
  )) INTO v_validated_participants
  FROM public.expedition_participants ep
  JOIN public.users u ON u.id = ep.user_id
  WHERE ep.expedition_id = p_expedition_id AND ep.status = 'validated'
  ORDER BY ep.validated_at;

  -- Pending (chef seulement)
  IF v_expe.chief_user_id = p_user_id THEN
    SELECT json_agg(json_build_object(
      'user_id', u.id,
      'display_name', u.display_name,
      'avatar_url', u.avatar_url,
      'level', u.level,
      'faction_id', u.faction_id,
      'request_message', ep.request_message,
      'joined_at', ep.joined_at
    )) INTO v_pending_participants
    FROM public.expedition_participants ep
    JOIN public.users u ON u.id = ep.user_id
    WHERE ep.expedition_id = p_expedition_id AND ep.status = 'pending'
    ORDER BY ep.joined_at;
  END IF;

  -- Comptes rendus : tous si membre, sinon seulement is_public=true
  SELECT json_agg(json_build_object(
    'user_id', r.user_id,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'text_content', r.text_content,
    'is_public', r.is_public,
    'cover_media_id', r.cover_media_id,
    'created_at', r.created_at,
    'updated_at', r.updated_at,
    'medias', (
      SELECT json_agg(json_build_object(
        'id', m.id,
        'storage_path', m.storage_path,
        'kind', m.kind
      ) ORDER BY m.created_at)
      FROM public.expedition_report_medias m
      WHERE m.expedition_id = r.expedition_id AND m.user_id = r.user_id
    )
  )) INTO v_reports
  FROM public.expedition_reports r
  JOIN public.users u ON u.id = r.user_id
  WHERE r.expedition_id = p_expedition_id
    AND (v_is_member OR r.is_public = true);

  -- Mon propre statut
  IF v_expe.chief_user_id = p_user_id THEN
    v_my_status := 'chief';
  ELSE
    SELECT status INTO v_my_status FROM public.expedition_participants
      WHERE expedition_id = p_expedition_id AND user_id = p_user_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'is_member', v_is_member,
    'my_status', v_my_status,
    'expedition', json_build_object(
      'id', v_expe.id,
      'chief_user_id', v_expe.chief_user_id,
      'name', v_expe.name,
      'description', v_expe.description,
      'rdv_at', v_expe.rdv_at,
      'rdv_lat', v_expe.rdv_lat,
      'rdv_lng', v_expe.rdv_lng,
      'rdv_label', v_expe.rdv_label,
      'slots_max', v_expe.slots_max,
      'slots_open', v_expe.slots_open,
      'validation_mode', v_expe.validation_mode,
      'status', v_expe.status,
      'created_at', v_expe.created_at,
      'cancelled_at', v_expe.cancelled_at
    ),
    'validated_participants', COALESCE(v_validated_participants, '[]'::json),
    'pending_participants', COALESCE(v_pending_participants, '[]'::json),
    'reports', COALESCE(v_reports, '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_expedition(text,uuid) TO authenticated;
```

- [ ] **Step 2: Appliquer + commit**

### Task 2.5: RPCs de listing (`upcoming` / `archives` / `my`)

**Files:**
- Create: `supabase/migrations/110_v07_rpc_list_expeditions.sql`

- [ ] **Step 1: Écrire les 3 RPCs de listing**

```sql
-- 110_v07_rpc_list_expeditions.sql
-- WHY : alimente le Tableau de Quêtes (À venir + Archives) et la section
-- "Mes expéditions" du profil.

-- À venir : public, status published
CREATE OR REPLACE FUNCTION public.list_expeditions_upcoming()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_agg(row_to_json(t) ORDER BY t.rdv_at ASC) INTO v_result FROM (
    SELECT
      e.id, e.name, e.rdv_at, e.rdv_lat, e.rdv_lng, e.rdv_label,
      e.slots_max, e.slots_open, e.validation_mode, e.status,
      json_build_object(
        'user_id', u.id,
        'display_name', u.display_name,
        'avatar_url', u.avatar_url,
        'faction_id', u.faction_id
      ) AS chief,
      (SELECT count(*) FROM public.expedition_participants p
       WHERE p.expedition_id = e.id AND p.status = 'validated') AS validated_count
    FROM public.expeditions e
    JOIN public.users u ON u.id = e.chief_user_id
    WHERE e.status = 'published'
  ) t;
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_expeditions_upcoming() TO authenticated;

-- Archives : status archived, tri date desc + pagination
CREATE OR REPLACE FUNCTION public.list_expeditions_archives(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  IF p_limit > 100 THEN p_limit := 100; END IF;
  SELECT json_agg(row_to_json(t) ORDER BY t.rdv_at DESC) INTO v_result FROM (
    SELECT
      e.id, e.name, e.rdv_at, e.rdv_lat, e.rdv_lng, e.rdv_label, e.status,
      json_build_object(
        'user_id', u.id,
        'display_name', u.display_name,
        'avatar_url', u.avatar_url,
        'faction_id', u.faction_id
      ) AS chief,
      (SELECT count(*) FROM public.expedition_participants p
       WHERE p.expedition_id = e.id AND p.status = 'validated') AS validated_count,
      (SELECT count(*) FROM public.expedition_reports r
       WHERE r.expedition_id = e.id AND r.is_public = true) AS public_reports_count
    FROM public.expeditions e
    JOIN public.users u ON u.id = e.chief_user_id
    WHERE e.status = 'archived'
    ORDER BY e.rdv_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_expeditions_archives(integer,integer) TO authenticated;

-- Mes expéditions : créées + rejointes (3 sections : à venir, passées, annulées)
CREATE OR REPLACE FUNCTION public.list_my_expeditions(p_user_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN json_build_object(
    'upcoming', COALESCE((
      SELECT json_agg(row_to_json(t) ORDER BY t.rdv_at ASC) FROM (
        SELECT e.id, e.name, e.rdv_at, e.rdv_lat, e.rdv_lng, e.status,
               (e.chief_user_id = p_user_id) AS i_am_chief
        FROM public.expeditions e
        LEFT JOIN public.expedition_participants p
          ON p.expedition_id = e.id AND p.user_id = p_user_id
        WHERE e.status = 'published'
          AND (e.chief_user_id = p_user_id OR p.status = 'validated')
      ) t
    ), '[]'::json),
    'past', COALESCE((
      SELECT json_agg(row_to_json(t) ORDER BY t.rdv_at DESC) FROM (
        SELECT e.id, e.name, e.rdv_at, e.rdv_lat, e.rdv_lng, e.status,
               (e.chief_user_id = p_user_id) AS i_am_chief
        FROM public.expeditions e
        LEFT JOIN public.expedition_participants p
          ON p.expedition_id = e.id AND p.user_id = p_user_id
        WHERE e.status IN ('passed','archived')
          AND (e.chief_user_id = p_user_id OR p.status = 'validated')
      ) t
    ), '[]'::json),
    'cancelled', COALESCE((
      SELECT json_agg(row_to_json(t) ORDER BY t.cancelled_at DESC) FROM (
        SELECT e.id, e.name, e.rdv_at, e.cancelled_at,
               (e.chief_user_id = p_user_id) AS i_am_chief
        FROM public.expeditions e
        LEFT JOIN public.expedition_participants p
          ON p.expedition_id = e.id AND p.user_id = p_user_id
        WHERE e.status = 'cancelled'
          AND e.cancelled_at + interval '30 days' >= now()
          AND (e.chief_user_id = p_user_id OR p.status = 'validated')
      ) t
    ), '[]'::json)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_my_expeditions(text) TO authenticated;
```

- [ ] **Step 2: Appliquer + smoke tests + commit**

---

## Phase 3 — RPCs Participation

### Task 3.1: RPC `request_join_expedition`

**Files:**
- Create: `supabase/migrations/111_v07_rpc_request_join_expedition.sql`

- [ ] **Step 1: Écrire la RPC**

```sql
-- 111_v07_rpc_request_join_expedition.sql
-- WHY : un user demande à rejoindre. Si validation_mode = 'free' ET (slot libre OU slots_open),
-- bascule en validated direct. Sinon, reste pending (file d'attente).

CREATE OR REPLACE FUNCTION public.request_join_expedition(
  p_user_id text,
  p_expedition_id uuid,
  p_message text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_expe public.expeditions%ROWTYPE;
  v_existing_status text;
  v_validated_count integer;
  v_target_status text;
BEGIN
  SELECT * INTO v_expe FROM public.expeditions WHERE id = p_expedition_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'expedition_not_found');
  END IF;
  IF v_expe.status <> 'published' THEN
    RETURN json_build_object('success', false, 'error', 'expedition_closed');
  END IF;
  IF v_expe.chief_user_id = p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'is_chief');
  END IF;

  -- Si déjà validated/pending → refus, si rejected/withdrawn → autorisé à re-demander
  SELECT status INTO v_existing_status
    FROM public.expedition_participants
    WHERE expedition_id = p_expedition_id AND user_id = p_user_id;

  IF v_existing_status IN ('pending','validated') THEN
    RETURN json_build_object('success', false, 'error', 'already_pending_or_validated');
  END IF;

  -- Décide auto-validate ou pending
  IF v_expe.validation_mode = 'free' THEN
    SELECT count(*) INTO v_validated_count
      FROM public.expedition_participants
      WHERE expedition_id = p_expedition_id AND status = 'validated';
    -- chef compte dans les slots → +1
    IF v_expe.slots_open = true OR v_validated_count + 1 < COALESCE(v_expe.slots_max, 0) THEN
      v_target_status := 'validated';
    ELSE
      v_target_status := 'pending';
    END IF;
  ELSE
    v_target_status := 'pending';
  END IF;

  -- Upsert (si rejected/withdrawn → on update)
  INSERT INTO public.expedition_participants(expedition_id, user_id, status, request_message, validated_at)
  VALUES (p_expedition_id, p_user_id, v_target_status, p_message,
          CASE WHEN v_target_status = 'validated' THEN now() ELSE NULL END)
  ON CONFLICT (expedition_id, user_id) DO UPDATE SET
    status = EXCLUDED.status,
    request_message = EXCLUDED.request_message,
    joined_at = now(),
    validated_at = EXCLUDED.validated_at;

  RETURN json_build_object(
    'success', true,
    'status', v_target_status,
    'chief_user_id', v_expe.chief_user_id,
    'expedition_name', v_expe.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_join_expedition(text,uuid,text) TO authenticated;
```

- [ ] **Step 2: Appliquer + commit**

### Task 3.2: RPC `respond_join_request`

**Files:**
- Create: `supabase/migrations/112_v07_rpc_respond_join_request.sql`

- [ ] **Step 1: Écrire la RPC**

```sql
-- 112_v07_rpc_respond_join_request.sql
-- WHY : le chef accepte ou refuse une demande pending. Si accepte, vérifie
-- que les slots ne sont pas déjà pleins (un éjecté + accept => OK).

CREATE OR REPLACE FUNCTION public.respond_join_request(
  p_chief_user_id text,
  p_expedition_id uuid,
  p_target_user_id text,
  p_decision text  -- 'accept' | 'reject'
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_expe public.expeditions%ROWTYPE;
  v_validated_count integer;
BEGIN
  IF p_decision NOT IN ('accept','reject') THEN
    RETURN json_build_object('success', false, 'error', 'invalid_decision');
  END IF;

  SELECT * INTO v_expe FROM public.expeditions WHERE id = p_expedition_id;
  IF NOT FOUND OR v_expe.chief_user_id <> p_chief_user_id THEN
    RETURN json_build_object('success', false, 'error', 'not_chief_or_not_found');
  END IF;
  IF v_expe.status NOT IN ('published','passed') THEN
    RETURN json_build_object('success', false, 'error', 'expedition_closed');
  END IF;

  IF p_decision = 'accept' THEN
    SELECT count(*) INTO v_validated_count
      FROM public.expedition_participants
      WHERE expedition_id = p_expedition_id AND status = 'validated';
    IF v_expe.slots_open = false AND v_validated_count + 1 >= COALESCE(v_expe.slots_max, 0) THEN
      RETURN json_build_object('success', false, 'error', 'slots_full');
    END IF;

    UPDATE public.expedition_participants
      SET status = 'validated', validated_at = now()
      WHERE expedition_id = p_expedition_id
        AND user_id = p_target_user_id
        AND status = 'pending';
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'no_pending_request');
    END IF;
  ELSE
    UPDATE public.expedition_participants
      SET status = 'rejected'
      WHERE expedition_id = p_expedition_id
        AND user_id = p_target_user_id
        AND status = 'pending';
    IF NOT FOUND THEN
      RETURN json_build_object('success', false, 'error', 'no_pending_request');
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'expedition_name', v_expe.name,
    'decision', p_decision
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_join_request(text,uuid,text,text) TO authenticated;
```

- [ ] **Step 2: Appliquer + commit**

### Task 3.3: RPC `withdraw_from_expedition` & `eject_participant`

**Files:**
- Create: `supabase/migrations/113_v07_rpc_withdraw_eject.sql`

- [ ] **Step 1: Écrire les 2 RPCs**

```sql
-- 113_v07_rpc_withdraw_eject.sql
-- WHY : retraits volontaires (par le user) et éjections (par le chef).

CREATE OR REPLACE FUNCTION public.withdraw_from_expedition(
  p_user_id text,
  p_expedition_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_expe public.expeditions%ROWTYPE;
BEGIN
  SELECT * INTO v_expe FROM public.expeditions WHERE id = p_expedition_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'expedition_not_found');
  END IF;
  IF v_expe.status <> 'published' THEN
    RETURN json_build_object('success', false, 'error', 'expedition_closed');
  END IF;

  UPDATE public.expedition_participants
    SET status = 'withdrawn'
    WHERE expedition_id = p_expedition_id
      AND user_id = p_user_id
      AND status IN ('pending','validated');
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'not_a_participant');
  END IF;
  RETURN json_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.withdraw_from_expedition(text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.eject_participant(
  p_chief_user_id text,
  p_expedition_id uuid,
  p_target_user_id text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_expe public.expeditions%ROWTYPE;
BEGIN
  SELECT * INTO v_expe FROM public.expeditions WHERE id = p_expedition_id;
  IF NOT FOUND OR v_expe.chief_user_id <> p_chief_user_id THEN
    RETURN json_build_object('success', false, 'error', 'not_chief_or_not_found');
  END IF;

  UPDATE public.expedition_participants
    SET status = 'rejected'
    WHERE expedition_id = p_expedition_id
      AND user_id = p_target_user_id
      AND status = 'validated';
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'not_a_validated_participant');
  END IF;
  RETURN json_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.eject_participant(text,uuid,text) TO authenticated;
```

- [ ] **Step 2: Appliquer + commit**

---

## Phase 4 — RPCs Messagerie

### Task 4.1: RPCs `send_expedition_message` + `mark_expedition_messages_read`

**Files:**
- Create: `supabase/migrations/114_v07_rpc_expedition_messages.sql`

- [ ] **Step 1: Écrire les 2 RPCs**

```sql
-- 114_v07_rpc_expedition_messages.sql
-- WHY : chat privé. Réservé chef + validés. Pattern aligné sur le système
-- chat global (cf. apps/explore-web/src/hooks/useChat.ts).

CREATE OR REPLACE FUNCTION public.send_expedition_message(
  p_user_id text,
  p_expedition_id uuid,
  p_content text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_authorized boolean;
  v_status text;
  v_id bigint;
BEGIN
  IF length(coalesce(p_content,'')) NOT BETWEEN 1 AND 500 THEN
    RETURN json_build_object('success', false, 'error', 'invalid_content_length');
  END IF;

  SELECT status INTO v_status FROM public.expeditions WHERE id = p_expedition_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'expedition_not_found');
  END IF;
  IF v_status NOT IN ('published','passed') THEN
    RETURN json_build_object('success', false, 'error', 'chat_closed');
  END IF;

  v_authorized := EXISTS (
    SELECT 1 FROM public.expeditions WHERE id = p_expedition_id AND chief_user_id = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.expedition_participants
    WHERE expedition_id = p_expedition_id AND user_id = p_user_id AND status = 'validated'
  );
  IF NOT v_authorized THEN
    RETURN json_build_object('success', false, 'error', 'not_authorized');
  END IF;

  INSERT INTO public.expedition_messages(expedition_id, user_id, content)
  VALUES (p_expedition_id, p_user_id, p_content)
  RETURNING id INTO v_id;

  RETURN json_build_object('success', true, 'message_id', v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.send_expedition_message(text,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_expedition_messages_read(
  p_user_id text,
  p_expedition_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.expedition_message_reads(expedition_id, user_id, last_read_at)
  VALUES (p_expedition_id, p_user_id, now())
  ON CONFLICT (expedition_id, user_id) DO UPDATE SET last_read_at = now();
  RETURN json_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_expedition_messages_read(text,uuid) TO authenticated;
```

- [ ] **Step 2: Appliquer + commit**

---

## Phase 5 — RPCs Comptes rendus

### Task 5.1: RPC `upsert_expedition_report`

**Files:**
- Create: `supabase/migrations/115_v07_rpc_upsert_expedition_report.sql`

- [ ] **Step 1: Écrire la RPC**

```sql
-- 115_v07_rpc_upsert_expedition_report.sql
-- WHY : crée ou met à jour le compte rendu d'un participant. Refuse si la
-- date n'est pas encore passée. Le trigger XP gère le +10 XP au PREMIER insert.

CREATE OR REPLACE FUNCTION public.upsert_expedition_report(
  p_user_id text,
  p_expedition_id uuid,
  p_text_content text,
  p_is_public boolean,
  p_cover_media_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_expe public.expeditions%ROWTYPE;
  v_authorized boolean;
  v_existed boolean;
BEGIN
  IF coalesce(length(p_text_content),0) > 1000 THEN
    RETURN json_build_object('success', false, 'error', 'text_too_long');
  END IF;

  SELECT * INTO v_expe FROM public.expeditions WHERE id = p_expedition_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'expedition_not_found');
  END IF;
  IF v_expe.status NOT IN ('passed','archived') THEN
    RETURN json_build_object('success', false, 'error', 'reports_not_open_yet');
  END IF;

  v_authorized := v_expe.chief_user_id = p_user_id OR EXISTS (
    SELECT 1 FROM public.expedition_participants
    WHERE expedition_id = p_expedition_id AND user_id = p_user_id AND status = 'validated'
  );
  IF NOT v_authorized THEN
    RETURN json_build_object('success', false, 'error', 'not_authorized');
  END IF;

  SELECT TRUE INTO v_existed FROM public.expedition_reports
    WHERE expedition_id = p_expedition_id AND user_id = p_user_id;

  INSERT INTO public.expedition_reports(
    expedition_id, user_id, text_content, is_public, cover_media_id, updated_at
  ) VALUES (
    p_expedition_id, p_user_id, p_text_content, p_is_public, p_cover_media_id, now()
  )
  ON CONFLICT (expedition_id, user_id) DO UPDATE SET
    text_content = EXCLUDED.text_content,
    is_public = EXCLUDED.is_public,
    cover_media_id = EXCLUDED.cover_media_id,
    updated_at = now();

  RETURN json_build_object('success', true, 'first_post', NOT COALESCE(v_existed, false));
END;
$$;
GRANT EXECUTE ON FUNCTION public.upsert_expedition_report(text,uuid,text,boolean,uuid) TO authenticated;
```

- [ ] **Step 2: Appliquer + commit**

### Task 5.2: RPC `register_expedition_media` & `delete_expedition_media`

**Files:**
- Create: `supabase/migrations/116_v07_rpc_expedition_medias.sql`

- [ ] **Step 1: Écrire les 2 RPCs**

```sql
-- 116_v07_rpc_expedition_medias.sql
-- WHY : registre les blobs uploadés au bucket dans la table relationnelle
-- pour qu'ils apparaissent dans la galerie agrégée. Le client uploade
-- d'abord vers Storage (via le SDK Supabase), puis appelle cette RPC.

CREATE OR REPLACE FUNCTION public.register_expedition_media(
  p_user_id text,
  p_expedition_id uuid,
  p_storage_path text,
  p_kind text,
  p_size_bytes integer,
  p_duration_seconds integer
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_expe public.expeditions%ROWTYPE;
  v_report_exists boolean;
  v_id uuid;
BEGIN
  IF p_kind NOT IN ('photo','video') THEN
    RETURN json_build_object('success', false, 'error', 'invalid_kind');
  END IF;
  IF p_kind = 'video' AND coalesce(p_duration_seconds,0) > 30 THEN
    RETURN json_build_object('success', false, 'error', 'video_too_long');
  END IF;

  SELECT * INTO v_expe FROM public.expeditions WHERE id = p_expedition_id;
  IF NOT FOUND OR v_expe.status NOT IN ('passed','archived') THEN
    RETURN json_build_object('success', false, 'error', 'expedition_not_open_for_media');
  END IF;

  -- Le compte rendu doit pré-exister (la FK composite l'exige)
  SELECT TRUE INTO v_report_exists FROM public.expedition_reports
    WHERE expedition_id = p_expedition_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    -- Auto-create report skeleton pour autoriser l'attachement
    INSERT INTO public.expedition_reports(expedition_id, user_id, text_content, is_public)
    VALUES (p_expedition_id, p_user_id, NULL, false);
  END IF;

  INSERT INTO public.expedition_report_medias(
    expedition_id, user_id, storage_path, kind, size_bytes, duration_seconds
  ) VALUES (
    p_expedition_id, p_user_id, p_storage_path, p_kind, p_size_bytes, p_duration_seconds
  ) RETURNING id INTO v_id;

  RETURN json_build_object('success', true, 'media_id', v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.register_expedition_media(text,uuid,text,text,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_expedition_media(
  p_user_id text,
  p_media_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_media public.expedition_report_medias%ROWTYPE;
  v_chief text;
BEGIN
  SELECT * INTO v_media FROM public.expedition_report_medias WHERE id = p_media_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'media_not_found');
  END IF;
  SELECT chief_user_id INTO v_chief FROM public.expeditions WHERE id = v_media.expedition_id;
  IF v_media.user_id <> p_user_id AND v_chief <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'not_authorized');
  END IF;
  -- Cleanup éventuel cover_media_id
  UPDATE public.expedition_reports SET cover_media_id = NULL
    WHERE expedition_id = v_media.expedition_id
      AND user_id = v_media.user_id
      AND cover_media_id = p_media_id;
  DELETE FROM public.expedition_report_medias WHERE id = p_media_id;
  RETURN json_build_object('success', true, 'storage_path', v_media.storage_path);
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_expedition_media(text,uuid) TO authenticated;
```

**Note** : `register_expedition_media` retourne `success` mais ne supprime PAS le blob storage en cas d'erreur — le client est responsable d'appeler `supabase.storage.from('expedition-medias').remove()` si l'enregistrement échoue.
`delete_expedition_media` retourne le `storage_path` pour que le client supprime le blob côté Storage.

- [ ] **Step 2: Appliquer + commit**

---

## Phase 6 — RPCs Modération

### Task 6.1: RPCs `flag_expedition` + `admin_delete_expedition`

**Files:**
- Create: `supabase/migrations/117_v07_rpc_expedition_moderation.sql`

- [ ] **Step 1: Écrire les RPCs**

```sql
-- 117_v07_rpc_expedition_moderation.sql
-- WHY : signalement public + suppression admin (Hub).

CREATE OR REPLACE FUNCTION public.flag_expedition(
  p_user_id text,
  p_expedition_id uuid,
  p_reason text,
  p_comment text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF p_reason NOT IN ('spam','inappropriate','other') THEN
    RETURN json_build_object('success', false, 'error', 'invalid_reason');
  END IF;
  INSERT INTO public.expedition_flags(expedition_id, reporter_user_id, reason, comment)
  VALUES (p_expedition_id, p_user_id, p_reason, p_comment);
  RETURN json_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.flag_expedition(text,uuid,text,text) TO authenticated;

-- Admin delete : à appeler depuis le Hub uniquement (à terme via JWT claim).
-- En V1 : protection minimale via vérification d'un user_id dans une whitelist
-- maintenue dans une table dédiée (à créer si nécessaire ; pour V1, on liste
-- en dur les admins ID Uriel + Mathéo via une fonction `_is_admin`).
CREATE OR REPLACE FUNCTION public._is_admin(p_user_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT p_user_id = ANY(string_to_array(
    coalesce(current_setting('app.admin_user_ids', true), ''), ','
  ));
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_expedition(
  p_admin_user_id text,
  p_expedition_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT public._is_admin(p_admin_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'not_admin');
  END IF;
  DELETE FROM public.expeditions WHERE id = p_expedition_id;
  RETURN json_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_delete_expedition(text,uuid) TO authenticated;
```

**Note** : la liste des admins est portée par un GUC `app.admin_user_ids` à configurer côté Supabase (`ALTER DATABASE postgres SET app.admin_user_ids = 'uriel_id,matheo_id';`). À aligner avec le plan Hub V2 quand il existera. **Action requise** : demander à Uriel les user_ids de Uriel + Mathéo et les setter avant de pousser cette migration en prod.

- [ ] **Step 2: Appliquer + commit**

---

## Phase 7 — Job d'archivage

### Task 7.1: RPC + cron `archive_passed_expeditions`

**Files:**
- Create: `supabase/migrations/118_v07_rpc_archive_passed_expeditions.sql`

- [ ] **Step 1: Écrire la RPC + setup cron**

```sql
-- 118_v07_rpc_archive_passed_expeditions.sql
-- WHY : transitions automatiques 'published' → 'passed' (à H+RDV) et
-- 'passed' → 'archived' (à RDV+30j). Suppression dure des cancelled à
-- cancelled_at + 30j.
-- Exécuté via pg_cron toutes les heures.

CREATE OR REPLACE FUNCTION public.archive_passed_expeditions()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_passed integer;
  v_archived integer;
  v_deleted integer;
  v_deleted_paths text[];
  r RECORD;
BEGIN
  -- 1. published → passed
  UPDATE public.expeditions
    SET status = 'passed', updated_at = now()
    WHERE status = 'published' AND rdv_at <= now();
  GET DIAGNOSTICS v_passed = ROW_COUNT;

  -- 2. passed → archived (30j après rdv_at)
  UPDATE public.expeditions
    SET status = 'archived', updated_at = now()
    WHERE status = 'passed' AND rdv_at + interval '30 days' <= now();
  GET DIAGNOSTICS v_archived = ROW_COUNT;

  -- 3. cancelled → suppression dure (30j après cancelled_at)
  -- Récupérer les storage_paths à purger côté bucket avant DELETE
  SELECT array_agg(m.storage_path) INTO v_deleted_paths
    FROM public.expedition_report_medias m
    JOIN public.expeditions e ON e.id = m.expedition_id
    WHERE e.status = 'cancelled' AND e.cancelled_at + interval '30 days' <= now();

  DELETE FROM public.expeditions
    WHERE status = 'cancelled' AND cancelled_at + interval '30 days' <= now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN json_build_object(
    'passed', v_passed,
    'archived', v_archived,
    'deleted', v_deleted,
    'orphan_storage_paths', COALESCE(v_deleted_paths, ARRAY[]::text[])
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.archive_passed_expeditions() TO service_role;

-- Schedule pg_cron : toutes les heures pile.
-- Nécessite pg_cron extension activée (vérifier : CREATE EXTENSION IF NOT EXISTS pg_cron;)
SELECT cron.schedule(
  'archive_expeditions_hourly',
  '0 * * * *',
  $$ SELECT public.archive_passed_expeditions(); $$
);
```

**Note** : `pg_cron` doit être activé dans le projet Supabase. Si ce n'est pas le cas → activer via Dashboard → Database → Extensions. Si l'activation est refusée pour le plan Supabase actuel → fallback en Edge Function Scheduled.

⚠️ Le storage path orphelin reste — la purge des blobs Storage doit être faite par un client appelant l'API Storage. Pour V1, on accepte un léger orphelin si toutes les annulations cohabitent ; un cron mensuel ou Edge Function dédiée pourra purger plus tard. À noter dans `apps/explore-web/CLAUDE.md` comme dette technique acceptable.

- [ ] **Step 2: Appliquer + smoke test**

```sql
SELECT * FROM cron.job WHERE jobname = 'archive_expeditions_hourly';
SELECT public.archive_passed_expeditions();
```

Expected: 1 ligne dans `cron.job`, JSON retourné avec compteurs à 0 (rien à archiver tant qu'aucune expé n'a sa date passée).

- [ ] **Step 3: Commit**

---

## Phase 8 — Extension du système notifications

Le repo a déjà un système de notifications avec types + payload `data`. On étend le composant frontend pour reconnaître les nouveaux types. Aucune nouvelle table SQL n'est requise (la table `notifications` existante suffit).

### Task 8.1: Types + wordings dans NotificationPanel.tsx

**Files:**
- Modify: `apps/explore-web/src/stores/notificationStore.ts` (ajout des types dans le union `Notification['type']`)
- Modify: `apps/explore-web/src/components/notifications/NotificationPanel.tsx` (TYPE_ICONS + formatMessage cases)

- [ ] **Step 1: Étendre le union de type Notification dans le store**

Lire d'abord `notificationStore.ts` pour identifier où est défini `Notification['type']`. Puis ajouter au union :

```typescript
| 'expedition_join_request'
| 'expedition_validated'
| 'expedition_rejected'
| 'expedition_modified'
| 'expedition_cancelled'
| 'expedition_reminder'
| 'expedition_report_posted'
```

- [ ] **Step 2: Ajouter les icons + wordings**

Dans `NotificationPanel.tsx`, étendre `TYPE_ICONS` :

```typescript
expedition_join_request:    '👋',  // 👋
expedition_validated:       '✅',         // ✅
expedition_rejected:        '❌',         // ❌
expedition_modified:        '✏️',   // ✏️
expedition_cancelled:       '🚫',   // 🚫
expedition_reminder:        '⏰',         // ⏰
expedition_report_posted:   '📜',   // 📜
```

Étendre `formatMessage()` switch :

```typescript
case 'expedition_join_request':
  return `${d.requesterName || 'Quelqu\'un'} demande à rejoindre ${d.expeditionName || 'ton expédition'}`
case 'expedition_validated':
  return `Le chef a validé ta participation à ${d.expeditionName || 'l\'expédition'}`
case 'expedition_rejected':
  return `Le chef n'a pas retenu ta demande pour ${d.expeditionName || 'l\'expédition'}`
case 'expedition_modified':
  return `${d.expeditionName || 'Une expédition'} a été modifiée`
case 'expedition_cancelled':
  return `${d.expeditionName || 'Une expédition'} a été annulée`
case 'expedition_reminder':
  return `Rappel : ton expédition ${d.expeditionName || ''} est demain`
case 'expedition_report_posted':
  return `${d.authorName || 'Un compagnon'} a laissé un compte rendu sur ${d.expeditionName || 'l\'expédition'}`
```

- [ ] **Step 3: Build OK + commit**

```bash
cd apps/explore-web && pnpm build
git add apps/explore-web/src/stores/notificationStore.ts apps/explore-web/src/components/notifications/NotificationPanel.tsx
git commit -m "feat(notifications): add expedition_* notification types"
```

**Note** : l'envoi des notifications est porté côté serveur (insert dans la table `notifications` depuis chaque RPC concernée — ex `respond_join_request` doit insérer une notif après accept/reject). La discipline §B3 interdit `PERFORM` cross-RPCs ; donc les RPCs Phase 2-6 doivent inclure leur INSERT dans `notifications` directement (à patcher dans une mig 119 dédiée si pas fait).

- [ ] **Step 4: Mig 119 — INSERT notifications dans les RPCs**

**Files:**
- Create: `supabase/migrations/119_v07_expedition_rpc_notifications.sql`

Réécriture (CREATE OR REPLACE) des RPCs concernées avec ajout d'`INSERT INTO public.notifications(...)` à la fin :
- `request_join_expedition` → notif `expedition_join_request` au chef
- `respond_join_request` → notif `expedition_validated` ou `expedition_rejected` au demandeur
- `update_expedition` → notif `expedition_modified` à chaque validé (boucle)
- `cancel_expedition` → notif `expedition_cancelled` à chaque validé (boucle)
- `upsert_expedition_report` → notif `expedition_report_posted` aux autres validés (boucle)

**IMPORTANT** : copier-coller la baseline de chaque RPC depuis ses migrations Phase 2-5, ne pas redéfinir de mémoire (discipline §B1).

⚠️ Pour les rappels J-1 (`expedition_reminder`), c'est le job `archive_passed_expeditions` qu'il faut étendre OU un nouveau job dédié `notify_expedition_reminders()` qui scan les expés à `rdv_at - 1 day` et insère les notifs. Choix recommandé : étendre `archive_passed_expeditions` pour économiser un cron, en s'assurant qu'il tourne toutes les heures (donc fenêtre J-1 ±1h acceptable).

```sql
-- Append à la mig 118 (ou nouveau fichier 119_*.sql) :
-- À la fin de archive_passed_expeditions, avant le RETURN :
-- INSERT INTO public.notifications(user_id, type, data)
-- SELECT p.user_id, 'expedition_reminder',
--   jsonb_build_object('expeditionId', e.id, 'expeditionName', e.name, 'rdvAt', e.rdv_at)
-- FROM public.expeditions e
-- JOIN public.expedition_participants p ON p.expedition_id = e.id AND p.status='validated'
-- WHERE e.status = 'published'
--   AND e.rdv_at BETWEEN now() + interval '23 hours' AND now() + interval '24 hours';
```

(Forme exacte : adapter à la signature de la table `notifications` du repo — lire `apps/explore-web/src/stores/notificationStore.ts` pour le shape de `data`.)

- [ ] **Step 5: Appliquer + commit**

---

## Phase 9 — Frontend foundation (types + hook)

À partir d'ici, on construit le frontend. Sub-folder dès la création (discipline §C1).

### Task 9.1: Création du sous-dossier + types TS

**Files:**
- Create: `apps/explore-web/src/types/expedition.ts`
- Create: `apps/explore-web/src/components/expeditions/.gitkeep` (placeholder, rempli aux tâches suivantes)

- [ ] **Step 1: Créer les types TS**

```typescript
// apps/explore-web/src/types/expedition.ts

export type ExpeditionStatus = 'published' | 'passed' | 'archived' | 'cancelled'
export type ExpeditionValidationMode = 'manual' | 'free'
export type ParticipantStatus = 'pending' | 'validated' | 'rejected' | 'withdrawn'
export type MediaKind = 'photo' | 'video'

export interface ExpeditionChief {
  user_id: string
  display_name: string
  avatar_url: string | null
  faction_id: string | null
}

export interface ExpeditionListItem {
  id: string
  name: string
  rdv_at: string
  rdv_lat: number
  rdv_lng: number
  rdv_label: string | null
  status: ExpeditionStatus
  slots_max: number | null
  slots_open: boolean
  validation_mode: ExpeditionValidationMode
  chief: ExpeditionChief
  validated_count: number
  public_reports_count?: number
  i_am_chief?: boolean
  cancelled_at?: string | null
}

export interface ExpeditionDetail {
  id: string
  chief_user_id: string
  name: string
  description: string | null
  rdv_at: string
  rdv_lat: number
  rdv_lng: number
  rdv_label: string | null
  slots_max: number | null
  slots_open: boolean
  validation_mode: ExpeditionValidationMode
  status: ExpeditionStatus
  created_at: string
  cancelled_at: string | null
}

export interface ExpeditionParticipantSummary {
  user_id: string
  display_name: string
  avatar_url: string | null
  level: number
  faction_id: string | null
  request_message?: string | null
  joined_at?: string
}

export interface ExpeditionReportMedia {
  id: string
  storage_path: string
  kind: MediaKind
}

export interface ExpeditionReport {
  user_id: string
  display_name: string
  avatar_url: string | null
  text_content: string | null
  is_public: boolean
  cover_media_id: string | null
  created_at: string
  updated_at: string
  medias: ExpeditionReportMedia[]
}

export interface ExpeditionFullPayload {
  is_member: boolean
  my_status: 'chief' | ParticipantStatus | null
  expedition: ExpeditionDetail
  validated_participants: ExpeditionParticipantSummary[]
  pending_participants: ExpeditionParticipantSummary[]
  reports: ExpeditionReport[]
}

export interface ExpeditionMessage {
  id: number
  expedition_id: string
  user_id: string
  content: string
  created_at: string
}
```

- [ ] **Step 2: Créer le sous-dossier components/expeditions**

```bash
mkdir -p "apps/explore-web/src/components/expeditions"
touch "apps/explore-web/src/components/expeditions/.gitkeep"
```

- [ ] **Step 3: Build OK + commit**

```bash
cd apps/explore-web && pnpm build
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)" && git add apps/explore-web/src/types/expedition.ts apps/explore-web/src/components/expeditions/.gitkeep && git commit -m "feat(expeditions): add TypeScript types + components folder"
```

### Task 9.2: Hook `useExpeditions` (lib + état)

**Files:**
- Create: `apps/explore-web/src/lib/expeditionsApi.ts` (calls Supabase RPC, standalone, lit le store via getState)
- Create: `apps/explore-web/src/stores/expeditionsStore.ts` (Zustand state pour le tableau)

- [ ] **Step 1: Créer `expeditionsApi.ts`**

```typescript
// apps/explore-web/src/lib/expeditionsApi.ts
import { supabase } from './supabase'
import { usePlayerStore } from '../stores/playerStore'
import type {
  ExpeditionListItem,
  ExpeditionFullPayload,
  ExpeditionValidationMode,
} from '../types/expedition'

function userIdOrThrow(): string {
  const id = usePlayerStore.getState().userId
  if (!id) throw new Error('not_authenticated')
  return id
}

export async function createExpedition(input: {
  name: string
  description: string | null
  rdv_at: string
  rdv_lat: number
  rdv_lng: number
  rdv_label: string | null
  slots_max: number | null
  slots_open: boolean
  validation_mode: ExpeditionValidationMode
}): Promise<{ success: boolean; expedition_id?: string; error?: string }> {
  const { data, error } = await supabase.rpc('create_expedition', {
    p_user_id: userIdOrThrow(),
    p_name: input.name,
    p_description: input.description,
    p_rdv_at: input.rdv_at,
    p_rdv_lat: input.rdv_lat,
    p_rdv_lng: input.rdv_lng,
    p_rdv_label: input.rdv_label,
    p_slots_max: input.slots_max,
    p_slots_open: input.slots_open,
    p_validation_mode: input.validation_mode,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; expedition_id?: string; error?: string }
}

export async function listUpcomingExpeditions(): Promise<ExpeditionListItem[]> {
  const { data, error } = await supabase.rpc('list_expeditions_upcoming')
  if (error) throw error
  return (data as ExpeditionListItem[]) ?? []
}

export async function listArchivedExpeditions(limit = 50, offset = 0): Promise<ExpeditionListItem[]> {
  const { data, error } = await supabase.rpc('list_expeditions_archives', {
    p_limit: limit, p_offset: offset
  })
  if (error) throw error
  return (data as ExpeditionListItem[]) ?? []
}

export async function listMyExpeditions(): Promise<{
  upcoming: ExpeditionListItem[]
  past: ExpeditionListItem[]
  cancelled: ExpeditionListItem[]
}> {
  const { data, error } = await supabase.rpc('list_my_expeditions', { p_user_id: userIdOrThrow() })
  if (error) throw error
  return data as { upcoming: ExpeditionListItem[]; past: ExpeditionListItem[]; cancelled: ExpeditionListItem[] }
}

export async function getExpedition(expeditionId: string): Promise<ExpeditionFullPayload> {
  const { data, error } = await supabase.rpc('get_expedition', {
    p_user_id: userIdOrThrow(),
    p_expedition_id: expeditionId,
  })
  if (error) throw error
  if (!(data as { success: boolean }).success) {
    throw new Error((data as { error: string }).error)
  }
  return data as unknown as ExpeditionFullPayload
}

export async function requestJoinExpedition(expeditionId: string, message: string | null) {
  const { data, error } = await supabase.rpc('request_join_expedition', {
    p_user_id: userIdOrThrow(),
    p_expedition_id: expeditionId,
    p_message: message,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; status?: string; error?: string }
}

export async function respondJoinRequest(expeditionId: string, targetUserId: string, decision: 'accept' | 'reject') {
  const { data, error } = await supabase.rpc('respond_join_request', {
    p_chief_user_id: userIdOrThrow(),
    p_expedition_id: expeditionId,
    p_target_user_id: targetUserId,
    p_decision: decision,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; error?: string }
}

export async function cancelExpedition(expeditionId: string) {
  const { data, error } = await supabase.rpc('cancel_expedition', {
    p_user_id: userIdOrThrow(),
    p_expedition_id: expeditionId,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; error?: string }
}

export async function updateExpedition(expeditionId: string, patches: {
  name: string
  description: string | null
  rdv_at: string
  rdv_lat: number
  rdv_lng: number
  rdv_label: string | null
  slots_max: number | null
  slots_open: boolean
}) {
  const { data, error } = await supabase.rpc('update_expedition', {
    p_user_id: userIdOrThrow(),
    p_expedition_id: expeditionId,
    p_name: patches.name,
    p_description: patches.description,
    p_rdv_at: patches.rdv_at,
    p_rdv_lat: patches.rdv_lat,
    p_rdv_lng: patches.rdv_lng,
    p_rdv_label: patches.rdv_label,
    p_slots_max: patches.slots_max,
    p_slots_open: patches.slots_open,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; error?: string }
}

export async function withdrawFromExpedition(expeditionId: string) {
  const { data, error } = await supabase.rpc('withdraw_from_expedition', {
    p_user_id: userIdOrThrow(),
    p_expedition_id: expeditionId,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; error?: string }
}

export async function ejectParticipant(expeditionId: string, targetUserId: string) {
  const { data, error } = await supabase.rpc('eject_participant', {
    p_chief_user_id: userIdOrThrow(),
    p_expedition_id: expeditionId,
    p_target_user_id: targetUserId,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; error?: string }
}

export async function sendExpeditionMessage(expeditionId: string, content: string) {
  const { data, error } = await supabase.rpc('send_expedition_message', {
    p_user_id: userIdOrThrow(),
    p_expedition_id: expeditionId,
    p_content: content,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; error?: string }
}

export async function markExpeditionMessagesRead(expeditionId: string) {
  await supabase.rpc('mark_expedition_messages_read', {
    p_user_id: userIdOrThrow(),
    p_expedition_id: expeditionId,
  })
}

export async function upsertExpeditionReport(input: {
  expedition_id: string
  text_content: string | null
  is_public: boolean
  cover_media_id: string | null
}) {
  const { data, error } = await supabase.rpc('upsert_expedition_report', {
    p_user_id: userIdOrThrow(),
    p_expedition_id: input.expedition_id,
    p_text_content: input.text_content,
    p_is_public: input.is_public,
    p_cover_media_id: input.cover_media_id,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean; first_post?: boolean; error?: string }
}

export async function flagExpedition(expeditionId: string, reason: 'spam' | 'inappropriate' | 'other', comment: string | null) {
  const { data, error } = await supabase.rpc('flag_expedition', {
    p_user_id: userIdOrThrow(),
    p_expedition_id: expeditionId,
    p_reason: reason,
    p_comment: comment,
  })
  if (error) return { success: false, error: error.message }
  return data as { success: boolean }
}
```

- [ ] **Step 2: Créer le store Zustand `expeditionsStore.ts`**

```typescript
// apps/explore-web/src/stores/expeditionsStore.ts
import { create } from 'zustand'
import type { ExpeditionListItem, ExpeditionFullPayload, ExpeditionMessage } from '../types/expedition'

interface ExpeditionsState {
  upcoming: ExpeditionListItem[]
  archives: ExpeditionListItem[]
  current: ExpeditionFullPayload | null
  messagesByExpedition: Record<string, ExpeditionMessage[]>
  setUpcoming: (l: ExpeditionListItem[]) => void
  setArchives: (l: ExpeditionListItem[]) => void
  setCurrent: (p: ExpeditionFullPayload | null) => void
  setMessages: (expeditionId: string, m: ExpeditionMessage[]) => void
  addMessage: (expeditionId: string, m: ExpeditionMessage) => void
}

export const useExpeditionsStore = create<ExpeditionsState>((set) => ({
  upcoming: [],
  archives: [],
  current: null,
  messagesByExpedition: {},
  setUpcoming: (l) => set({ upcoming: l }),
  setArchives: (l) => set({ archives: l }),
  setCurrent: (p) => set({ current: p }),
  setMessages: (expeditionId, m) => set((s) => ({
    messagesByExpedition: { ...s.messagesByExpedition, [expeditionId]: m }
  })),
  addMessage: (expeditionId, m) => set((s) => ({
    messagesByExpedition: {
      ...s.messagesByExpedition,
      [expeditionId]: [...(s.messagesByExpedition[expeditionId] ?? []), m]
    }
  })),
}))
```

- [ ] **Step 3: Build OK + commit**

```bash
cd apps/explore-web && pnpm build
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)" && git add apps/explore-web/src/lib/expeditionsApi.ts apps/explore-web/src/stores/expeditionsStore.ts && git commit -m "feat(expeditions): API wrapper + Zustand store"
```

---

## Phase 10 — Tableau de Quêtes & marker carte

### Task 10.1: `QuestsBoard` (afficheur unifié)

**Files:**
- Create: `apps/explore-web/src/components/quests/QuestsBoard.tsx` (sous-dossier à créer)
- Create: `apps/explore-web/src/components/quests/QuestsBoard.css`

- [ ] **Step 1: Créer le squelette**

```typescript
// apps/explore-web/src/components/quests/QuestsBoard.tsx
import { useState, useEffect } from 'react'
import { ExpeditionsTab } from '../expeditions/ExpeditionsTab'
import './QuestsBoard.css'

type QuestsTab = 'daily' | 'expeditions' | 'missions'

interface Props {
  onClose: () => void
}

export function QuestsBoard({ onClose }: Props) {
  const [tab, setTab] = useState<QuestsTab>('expeditions')

  return (
    <div className="quests-board-overlay" onClick={onClose}>
      <div className="quests-board" onClick={(e) => e.stopPropagation()}>
        <header className="quests-board-header">
          <h2>Tableau de Quêtes</h2>
          <button onClick={onClose}>×</button>
        </header>
        <nav className="quests-board-tabs">
          <button onClick={() => setTab('daily')}     className={tab === 'daily' ? 'active' : ''}>Quêtes du jour</button>
          <button onClick={() => setTab('expeditions')} className={tab === 'expeditions' ? 'active' : ''}>Expéditions</button>
          <button onClick={() => setTab('missions')}  className={tab === 'missions' ? 'active' : ''}>Missions</button>
        </nav>
        <div className="quests-board-content">
          {tab === 'daily' && <div className="quests-board-placeholder">Quêtes du jour — voir spec mini-quêtes</div>}
          {tab === 'expeditions' && <ExpeditionsTab />}
          {tab === 'missions' && <div className="quests-board-placeholder">Missions — bientôt</div>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: CSS basique** (style "logiciel sobre", pas RPG, cf. discipline §C5 + feedback UI sobre)

```css
/* QuestsBoard.css — styles minimaux, à enrichir au polish */
.quests-board-overlay { position:fixed; inset:0; background:rgba(40,30,20,0.5); display:flex; align-items:center; justify-content:center; z-index:1000; }
.quests-board { background:#f5e9d4; border:1px solid #b89a6a; border-radius:6px; width:min(720px,95vw); max-height:90vh; display:flex; flex-direction:column; overflow:hidden; }
.quests-board-header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid #c8b380; }
.quests-board-header h2 { margin:0; font-family:'Cormorant Garamond', serif; font-size:24px; font-weight:600; color:#3a2c18; }
.quests-board-header button { background:none; border:none; font-size:24px; cursor:pointer; color:#6a4f2c; }
.quests-board-tabs { display:flex; border-bottom:1px solid #c8b380; }
.quests-board-tabs button { flex:1; padding:12px 16px; background:none; border:none; cursor:pointer; font-size:16px; color:#6a4f2c; border-bottom:2px solid transparent; }
.quests-board-tabs button.active { color:#3a2c18; border-bottom-color:#8a6f4a; font-weight:600; }
.quests-board-content { flex:1; overflow-y:auto; padding:20px; }
.quests-board-placeholder { text-align:center; color:#8a7050; padding:40px 20px; font-style:italic; }
```

- [ ] **Step 3: Créer `ExpeditionsTab` placeholder pour ne pas casser le build**

```typescript
// apps/explore-web/src/components/expeditions/ExpeditionsTab.tsx
export function ExpeditionsTab() {
  return <div>Expéditions — chargement...</div>
}
```

- [ ] **Step 4: Build OK + commit**

```bash
cd apps/explore-web && pnpm build
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)" && git add apps/explore-web/src/components/quests/ apps/explore-web/src/components/expeditions/ExpeditionsTab.tsx && git commit -m "feat(quests): QuestsBoard scaffold with tabs (daily/expeditions/missions)"
```

### Task 10.2: `ExpeditionsTab` — sous-onglets À venir / Archives

**Files:**
- Modify: `apps/explore-web/src/components/expeditions/ExpeditionsTab.tsx`
- Create: `apps/explore-web/src/components/expeditions/ExpeditionCard.tsx`
- Create: `apps/explore-web/src/components/expeditions/ExpeditionsTab.css`

- [ ] **Step 1: Implémentation `ExpeditionsTab`**

```typescript
// apps/explore-web/src/components/expeditions/ExpeditionsTab.tsx
import { useState, useEffect } from 'react'
import { listUpcomingExpeditions, listArchivedExpeditions } from '../../lib/expeditionsApi'
import { useExpeditionsStore } from '../../stores/expeditionsStore'
import { ExpeditionCard } from './ExpeditionCard'
import './ExpeditionsTab.css'

type Subtab = 'upcoming' | 'archives'

export function ExpeditionsTab() {
  const [subtab, setSubtab] = useState<Subtab>('upcoming')
  const [loading, setLoading] = useState(false)
  const upcoming = useExpeditionsStore((s) => s.upcoming)
  const archives = useExpeditionsStore((s) => s.archives)
  const setUpcoming = useExpeditionsStore((s) => s.setUpcoming)
  const setArchives = useExpeditionsStore((s) => s.setArchives)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const loader = subtab === 'upcoming' ? listUpcomingExpeditions() : listArchivedExpeditions(50, 0)
    loader.then((list) => {
      if (cancelled) return
      if (subtab === 'upcoming') setUpcoming(list)
      else setArchives(list)
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [subtab, setUpcoming, setArchives])

  const list = subtab === 'upcoming' ? upcoming : archives

  return (
    <div className="expeditions-tab">
      <header className="expeditions-tab-header">
        <button
          className="expeditions-tab-cta"
          onClick={() => { /* open creator — Task 11.1 */ }}
        >
          + Créer une expédition
        </button>
      </header>

      <nav className="expeditions-tab-subnav">
        <button onClick={() => setSubtab('upcoming')}  className={subtab === 'upcoming' ? 'active' : ''}>À venir</button>
        <button onClick={() => setSubtab('archives')} className={subtab === 'archives' ? 'active' : ''}>Archives</button>
      </nav>

      {loading ? (
        <div className="expeditions-tab-loading">Chargement...</div>
      ) : list.length === 0 ? (
        <div className="expeditions-tab-empty">
          {subtab === 'upcoming' ? 'Aucune expédition à venir. Crée la première.' : 'Pas encore d\'expéditions archivées.'}
        </div>
      ) : (
        <ul className="expeditions-tab-list">
          {list.map((e) => <ExpeditionCard key={e.id} item={e} />)}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `ExpeditionCard` minimal**

```typescript
// apps/explore-web/src/components/expeditions/ExpeditionCard.tsx
import type { ExpeditionListItem } from '../../types/expedition'

function formatRelativeDate(rdvAt: string): string {
  const rdv = new Date(rdvAt).getTime()
  const now = Date.now()
  const diffMs = rdv - now
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Aujourd\'hui'
  if (diffDays === 1) return 'Demain'
  if (diffDays > 0 && diffDays < 7) return `Dans ${diffDays} jours`
  if (diffDays < 0) {
    const ago = Math.abs(diffDays)
    if (ago < 7) return `Il y a ${ago}j`
    return new Date(rdvAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  return new Date(rdvAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface Props { item: ExpeditionListItem }

export function ExpeditionCard({ item }: Props) {
  const slotsLabel = item.slots_open
    ? `Ouvert · ${item.validated_count} inscrits`
    : `${item.validated_count + 1}/${item.slots_max} places`

  return (
    <li className="expedition-card" onClick={() => { /* open modal — Task 11.2 */ }}>
      <div className="expedition-card-flag">🚩</div>
      <div className="expedition-card-body">
        <h3 className="expedition-card-name">{item.name}</h3>
        <div className="expedition-card-date">{formatRelativeDate(item.rdv_at)}</div>
        {item.rdv_label && <div className="expedition-card-label">{item.rdv_label}</div>}
        <div className="expedition-card-meta">
          <img src={item.chief.avatar_url ?? '/res/default-avatar.png'} alt="" />
          <span>{item.chief.display_name}</span>
          <span className="expedition-card-slots">{slotsLabel}</span>
        </div>
      </div>
    </li>
  )
}
```

- [ ] **Step 3: CSS basique pour `ExpeditionsTab` + `ExpeditionCard`**

```css
/* ExpeditionsTab.css */
.expeditions-tab { display:flex; flex-direction:column; gap:16px; }
.expeditions-tab-header { display:flex; }
.expeditions-tab-cta { background:#8a6f4a; color:#fff; border:none; padding:12px 20px; border-radius:4px; font-size:16px; cursor:pointer; }
.expeditions-tab-cta:hover { background:#7a5e3a; }
.expeditions-tab-subnav { display:flex; gap:8px; border-bottom:1px solid #c8b380; }
.expeditions-tab-subnav button { padding:8px 16px; background:none; border:none; cursor:pointer; color:#6a4f2c; border-bottom:2px solid transparent; font-size:15px; }
.expeditions-tab-subnav button.active { color:#3a2c18; border-bottom-color:#8a6f4a; font-weight:600; }
.expeditions-tab-loading,
.expeditions-tab-empty { text-align:center; color:#8a7050; padding:32px; font-style:italic; }
.expeditions-tab-list { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px; }
.expedition-card { display:flex; gap:12px; padding:12px; background:#fff8eb; border:1px solid #c8b380; border-radius:4px; cursor:pointer; transition:background 0.2s; }
.expedition-card:hover { background:#fef0d4; }
.expedition-card-flag { font-size:24px; }
.expedition-card-body { flex:1; }
.expedition-card-name { margin:0 0 4px 0; font-size:18px; color:#3a2c18; font-family:'Cormorant Garamond', serif; }
.expedition-card-date { font-size:14px; color:#8a6f4a; font-weight:600; }
.expedition-card-label { font-size:14px; color:#6a4f2c; }
.expedition-card-meta { display:flex; align-items:center; gap:8px; margin-top:8px; font-size:14px; color:#6a4f2c; }
.expedition-card-meta img { width:24px; height:24px; border-radius:50%; }
.expedition-card-slots { margin-left:auto; font-weight:600; }
```

- [ ] **Step 4: Build OK + commit**

```bash
cd apps/explore-web && pnpm build
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)" && git add apps/explore-web/src/components/expeditions/ && git commit -m "feat(expeditions): ExpeditionsTab with upcoming/archives subtabs + ExpeditionCard"
```

### Task 10.3: `ExpeditionBanner` marker sur la carte

**Files:**
- Create: `apps/explore-web/src/components/map/markers/ExpeditionBanner.tsx`
- Create: `apps/explore-web/src/components/map/markers/ExpeditionBanner.css`
- Modify: `apps/explore-web/src/components/map/core/ExploreMap.tsx` (intégrer le marker)

- [ ] **Step 1: Créer le composant marker**

```typescript
// apps/explore-web/src/components/map/markers/ExpeditionBanner.tsx
import type { ExpeditionListItem } from '../../../types/expedition'
import './ExpeditionBanner.css'

interface Props {
  expedition: ExpeditionListItem
  onClick: () => void
}

export function ExpeditionBanner({ expedition, onClick }: Props) {
  const rdv = new Date(expedition.rdv_at).getTime()
  const now = Date.now()
  const diffMs = rdv - now
  const isToday = diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000
  const isTomorrow = diffMs >= 24 * 60 * 60 * 1000 && diffMs < 48 * 60 * 60 * 1000
  const isSoon = diffMs >= 48 * 60 * 60 * 1000 && diffMs < 7 * 24 * 60 * 60 * 1000

  const className = [
    'expedition-banner',
    isToday && 'expedition-banner-today',
    isTomorrow && 'expedition-banner-tomorrow',
    isSoon && 'expedition-banner-soon',
  ].filter(Boolean).join(' ')

  const badge = isToday ? 'Aujourd\'hui' : isTomorrow ? 'Demain' : isSoon ? 'Bientôt' : null

  return (
    <button className={className} onClick={onClick} aria-label={`Expédition ${expedition.name}`}>
      <span className="expedition-banner-flag" aria-hidden>🚩</span>
      <span className="expedition-banner-name">{expedition.name}</span>
      {badge && <span className="expedition-banner-badge">{badge}</span>}
    </button>
  )
}
```

- [ ] **Step 2: CSS + halo pulsant**

```css
/* ExpeditionBanner.css */
.expedition-banner {
  display:inline-flex; align-items:center; gap:6px;
  background:#fff8eb; border:1px solid #b89a6a; border-radius:14px;
  padding:4px 10px; cursor:pointer; box-shadow:0 1px 3px rgba(0,0,0,0.18);
  font-size:13px; color:#3a2c18; font-family:inherit;
}
.expedition-banner-flag { font-size:14px; }
.expedition-banner-name { font-weight:600; max-width:140px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.expedition-banner-badge { background:#8a6f4a; color:#fff; padding:1px 6px; border-radius:8px; font-size:11px; font-weight:600; }
.expedition-banner-today { box-shadow:0 0 12px 3px rgba(212,170,90,0.7); animation:expedition-banner-pulse 1.6s infinite; }
.expedition-banner-tomorrow { box-shadow:0 0 8px 2px rgba(212,170,90,0.45); }
.expedition-banner-soon { opacity:0.85; }
@keyframes expedition-banner-pulse {
  0%, 100% { box-shadow:0 0 12px 3px rgba(212,170,90,0.7); }
  50%      { box-shadow:0 0 18px 6px rgba(212,170,90,0.9); }
}
```

- [ ] **Step 3: Intégration dans `ExploreMap.tsx`**

Lire d'abord `ExploreMap.tsx` pour identifier comment les autres markers (Veilleurs) sont posés sur la carte. Reproduire le pattern : load la liste via `listUpcomingExpeditions()` au mount + subscribe Realtime sur `expeditions` (changes filtrés `status=eq.published`), créer un `Marker` MapLibre avec le composant React rendu via `ReactDOM.createRoot`. Le clic ouvre `ExpeditionModal` (Task 11.2).

**Pattern de référence** : `apps/explore-web/src/components/map/markers/VeilleurNamePills.tsx` (à lire avant d'implémenter).

⚠️ Pour le LOD au dézoom, V1 garde le marker HTML (pas de switch WebGL). Le LOD WebGL est différable post-V1 — à noter dans les hors-scope respectés.

- [ ] **Step 4: Build OK + tests manuels (créer une expé via SQL, vérifier la bannière apparait)**

```bash
cd apps/explore-web && pnpm build
```

Test manuel : créer une expé en SQL (`SELECT public.create_expedition(...)`), refresh l'app, vérifier que la bannière apparait sur la carte aux coordonnées GPS données.

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/components/map/markers/ExpeditionBanner.* apps/explore-web/src/components/map/core/ExploreMap.tsx && git commit -m "feat(map): expedition banners on map with state-based visual"
```

---

## Phase 11 — Modale & création

### Task 11.1: `ExpeditionCreator` (formulaire stepper)

**Files:**
- Create: `apps/explore-web/src/components/expeditions/ExpeditionCreator.tsx`
- Create: `apps/explore-web/src/components/expeditions/ExpeditionCreator.css`
- Modify: `apps/explore-web/src/components/expeditions/ExpeditionsTab.tsx` (câbler le bouton "+")

- [ ] **Step 1: Implémentation du stepper en 5 étapes**

Le composant prend en props `onClose` et `onCreated(expeditionId: string)`. Étapes :
1. Lieu : tap sur la carte (mode "création active" — émet un event vers `mapStore`)
2. Détails : nom (3-80 char) + description (≤1000 char)
3. Date+heure : datetime-local input, futur seulement
4. Slots : radio "Nombre" (slider 2-50) ou "Ouvert"
5. Validation : toggle "Validation manuelle" (défaut ON) ou "Inscription libre"

À la confirmation : appel `createExpedition()`, toast succès, fermeture modale, `onCreated(expedition_id)` qui ouvre `ExpeditionModal` sur la nouvelle expé.

⚠️ Pour la sélection sur la carte : utiliser un `mapStore` flag `expeditionCreationMode: { active: boolean; lat?: number; lng?: number }` que `ExpeditionCreator` toggle. La carte écoute le flag et affiche un crosshair + intercepte le prochain clic carte pour poser les coords.

Code complet (~120 lignes, pas inclus ici pour rester lisible — utiliser le pattern de `AddPlace` existant comme référence : `apps/explore-web/src/components/places/actions/AddPlaceModal.tsx`).

- [ ] **Step 2: Câbler le bouton "+ Créer une expédition" dans `ExpeditionsTab`**

Remplacer le `onClick` placeholder par un `setCreatorOpen(true)` + render conditionnel `<ExpeditionCreator onClose={...} onCreated={...} />`.

- [ ] **Step 3: Build OK + test manuel (créer une expé via UI, vérifier qu'elle apparait dans le tableau + sur la carte)**

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/components/expeditions/ExpeditionCreator.* apps/explore-web/src/components/expeditions/ExpeditionsTab.tsx && git commit -m "feat(expeditions): ExpeditionCreator stepper (location → details → date → slots → validation)"
```

### Task 11.2: `ExpeditionModal` — header + info + section participants

**Files:**
- Create: `apps/explore-web/src/components/expeditions/ExpeditionModal.tsx`
- Create: `apps/explore-web/src/components/expeditions/ExpeditionModal.css`

- [ ] **Step 1: Squelette du composant**

```typescript
// apps/explore-web/src/components/expeditions/ExpeditionModal.tsx
import { useEffect, useState } from 'react'
import { getExpedition, requestJoinExpedition, respondJoinRequest, withdrawFromExpedition, ejectParticipant, cancelExpedition } from '../../lib/expeditionsApi'
import { usePlayerStore } from '../../stores/playerStore'
import { useExpeditionsStore } from '../../stores/expeditionsStore'
import type { ExpeditionFullPayload } from '../../types/expedition'
import './ExpeditionModal.css'

interface Props {
  expeditionId: string
  onClose: () => void
}

export function ExpeditionModal({ expeditionId, onClose }: Props) {
  const userId = usePlayerStore((s) => s.userId)
  const current = useExpeditionsStore((s) => s.current)
  const setCurrent = useExpeditionsStore((s) => s.setCurrent)
  const [loading, setLoading] = useState(true)
  const [requestMessage, setRequestMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getExpedition(expeditionId).then((p) => {
      if (!cancelled) { setCurrent(p); setLoading(false) }
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [expeditionId, setCurrent])

  if (loading || !current) return <div className="expedition-modal-loading">Chargement...</div>

  const isChief = current.my_status === 'chief'
  const isValidated = current.my_status === 'validated'
  const isPending = current.my_status === 'pending'
  const canRequest = !isChief && current.my_status !== 'pending' && current.my_status !== 'validated' && current.expedition.status === 'published'

  return (
    <div className="expedition-modal-overlay" onClick={onClose}>
      <div className="expedition-modal" onClick={(e) => e.stopPropagation()}>
        <header className="expedition-modal-header">
          <h2>{current.expedition.name}</h2>
          <button onClick={onClose}>×</button>
        </header>

        {/* Bloc info */}
        <section className="expedition-modal-info">
          <div>📅 {new Date(current.expedition.rdv_at).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</div>
          <div>📍 {current.expedition.rdv_label ?? `${current.expedition.rdv_lat.toFixed(4)}, ${current.expedition.rdv_lng.toFixed(4)}`}</div>
          <div>👥 {current.validated_participants.length + 1}{current.expedition.slots_open ? ' inscrits (ouvert)' : ` / ${current.expedition.slots_max} places`}</div>
          {current.expedition.description && <p className="expedition-modal-description">{current.expedition.description}</p>}
        </section>

        {/* Section participants */}
        <section className="expedition-modal-participants">
          <h3>Compagnons validés</h3>
          <ul>
            {current.validated_participants.map((p) => (
              <li key={p.user_id}>
                <img src={p.avatar_url ?? '/res/default-avatar.png'} alt="" />
                {p.display_name}
                {isChief && p.user_id !== userId && (
                  <button onClick={() => ejectParticipant(expeditionId, p.user_id).then(() => getExpedition(expeditionId).then(setCurrent))}>Éjecter</button>
                )}
              </li>
            ))}
          </ul>

          {isChief && current.pending_participants.length > 0 && (
            <>
              <h3>Demandes en attente ({current.pending_participants.length})</h3>
              <ul>
                {current.pending_participants.map((p) => (
                  <li key={p.user_id}>
                    <img src={p.avatar_url ?? '/res/default-avatar.png'} alt="" />
                    <div>
                      <strong>{p.display_name}</strong>
                      {p.request_message && <p>« {p.request_message} »</p>}
                    </div>
                    <button onClick={() => respondJoinRequest(expeditionId, p.user_id, 'accept').then(() => getExpedition(expeditionId).then(setCurrent))}>Accepter</button>
                    <button onClick={() => respondJoinRequest(expeditionId, p.user_id, 'reject').then(() => getExpedition(expeditionId).then(setCurrent))}>Décliner</button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Action button */}
          {canRequest && (
            <div className="expedition-modal-request">
              <textarea value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} placeholder="Un mot pour le chef (optionnel, max 280 caractères)" maxLength={280} />
              <button onClick={() => requestJoinExpedition(expeditionId, requestMessage || null).then(() => getExpedition(expeditionId).then(setCurrent))}>
                {current.expedition.validation_mode === 'free' ? 'Rejoindre' : 'Demander à rejoindre'}
              </button>
            </div>
          )}
          {isPending && <div className="expedition-modal-status">Demande envoyée — en attente du chef</div>}
          {isValidated && !isChief && (
            <button onClick={() => withdrawFromExpedition(expeditionId).then(onClose)}>Se retirer</button>
          )}
          {isChief && current.expedition.status === 'published' && (
            <button onClick={() => { if (confirm('Annuler l\'expédition ?')) cancelExpedition(expeditionId).then(onClose) }}>Annuler l'expédition</button>
          )}
        </section>

        {/* Sections Chat / Galerie / Comptes rendus — Tasks 11.3 et 11.4 */}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: CSS basique (placeholder à raffiner)** + build OK + commit

### Task 11.3: Section Chat dans `ExpeditionModal`

**Files:**
- Modify: `apps/explore-web/src/components/expeditions/ExpeditionModal.tsx` (ajout d'une sub-section)
- Create: `apps/explore-web/src/components/expeditions/ExpeditionChat.tsx`
- Create: `apps/explore-web/src/hooks/useExpeditionChat.ts`

- [ ] **Step 1: Hook `useExpeditionChat`** — pattern aligné sur `useChat.ts` mais filtré sur `expedition_messages` filtré par `expedition_id`

Lire `apps/explore-web/src/hooks/useChat.ts` comme baseline. Ajuster :
- Table : `expedition_messages`
- Filtre Realtime : `expedition_id=eq.<expeditionId>`
- Store : `useExpeditionsStore.messagesByExpedition[id]`
- Charge initial : 50 derniers messages, tri créé asc

- [ ] **Step 2: Composant `ExpeditionChat`** — input + liste de messages, similar à `ChatPanel.tsx`

- [ ] **Step 3: Intégration dans `ExpeditionModal`** — visible uniquement si `current.is_member` ET status ∈ `published`/`passed` (read-only si `passed`/`archived`/`cancelled`)

- [ ] **Step 4: Build OK + commit**

### Task 11.4: Sections Galerie + Comptes rendus dans `ExpeditionModal`

**Files:**
- Modify: `apps/explore-web/src/components/expeditions/ExpeditionModal.tsx`
- Create: `apps/explore-web/src/components/expeditions/ExpeditionGallery.tsx`
- Create: `apps/explore-web/src/components/expeditions/ExpeditionReportsList.tsx`

- [ ] **Step 1: `ExpeditionGallery`** — grille mosaïque agrégée à partir de `current.reports[].medias[]`, photo OU video, tap → fullscreen

- [ ] **Step 2: `ExpeditionReportsList`** — liste de cards (auteur + texte + médias + badge Public)
  - Filtrer côté caller : si non-membre, seulement `is_public=true`
  - Si membre n'ayant pas posté → CTA "Laisser mon compte rendu" qui ouvre `ReportEditor` (Task 11.5)

- [ ] **Step 3: Intégration dans `ExpeditionModal`** — visible si statut ∈ `passed`/`archived`

- [ ] **Step 4: Build OK + commit**

### Task 11.5: `ReportEditor`

**Files:**
- Create: `apps/explore-web/src/components/expeditions/ReportEditor.tsx`
- Create: `apps/explore-web/src/components/expeditions/ReportEditor.css`
- Modify: `apps/explore-web/src/lib/expeditionsApi.ts` (ajout `uploadExpeditionMedia`)

- [ ] **Step 1: Helper `uploadExpeditionMedia` dans expeditionsApi.ts**

```typescript
export async function uploadExpeditionMedia(
  expeditionId: string,
  file: File,
  kind: 'photo' | 'video',
  durationSeconds: number | null
): Promise<{ success: boolean; media_id?: string; error?: string }> {
  const userId = usePlayerStore.getState().userId
  if (!userId) return { success: false, error: 'not_authenticated' }

  // Validation client-side
  if (kind === 'photo' && file.size > 10 * 1024 * 1024) return { success: false, error: 'photo_too_large' }
  if (kind === 'video' && file.size > 50 * 1024 * 1024) return { success: false, error: 'video_too_large' }
  if (kind === 'video' && (durationSeconds ?? 0) > 30) return { success: false, error: 'video_too_long' }

  const ext = file.name.split('.').pop() ?? (kind === 'photo' ? 'jpg' : 'mp4')
  const path = `${expeditionId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error: uploadError } = await supabase.storage.from('expedition-medias').upload(path, file)
  if (uploadError) return { success: false, error: uploadError.message }

  const { data, error: rpcError } = await supabase.rpc('register_expedition_media', {
    p_user_id: userId,
    p_expedition_id: expeditionId,
    p_storage_path: path,
    p_kind: kind,
    p_size_bytes: file.size,
    p_duration_seconds: durationSeconds,
  })
  if (rpcError) {
    // Cleanup blob if registration failed
    await supabase.storage.from('expedition-medias').remove([path])
    return { success: false, error: rpcError.message }
  }
  return data as { success: boolean; media_id?: string; error?: string }
}
```

- [ ] **Step 2: Composant `ReportEditor`**

Le composant prend `expeditionId` + `onClose`. Contenu :
- Textarea (1000 char max, compteur)
- File input multiple pour photos + vidéos avec preview thumbnails
- Pour les vidéos : lire la durée via `<video>` côté client avant upload (`video.duration`)
- Toggle **"Rendre public"** (défaut OFF)
- Si public : sélecteur de cover photo (radio sur la liste de photos uploadées)
- CTA "Enregistrer mon compte rendu" → call `upsertExpeditionReport` puis upload des médias en parallèle

- [ ] **Step 3: Intégration dans `ExpeditionModal`** + bouton "Laisser mon compte rendu" / "Modifier mon compte rendu"

- [ ] **Step 4: Build OK + test manuel (poster un CR avec photo + vidéo, vérifier la galerie, vérifier le +10 XP via UI niveau)**

- [ ] **Step 5: Commit**

---

## Phase 12 — Profil & Notifications UI

### Task 12.1: Onglet "Mes expéditions" dans `PlayerProfileModal`

**Files:**
- Modify: `apps/explore-web/src/components/profile/PlayerProfileModal.tsx` (ajout d'un onglet)
- Reuse: `ExpeditionCard` de Task 10.2

- [ ] **Step 1: Lire `PlayerProfileModal.tsx` pour comprendre le pattern d'onglets existant** + ajouter l'onglet "Mes expéditions"

- [ ] **Step 2: Sous-sections** : À venir / Passées / Annulées (3 listes via `listMyExpeditions()`)

- [ ] **Step 3: Vue tierce** (profil d'un autre user) → seulement les passées+archivées avec `is_public=true` opt-in de ce user. La RPC `list_my_expeditions` actuelle est own-only ; **créer** `list_user_public_expeditions(p_target_user_id text)` ou étendre la RPC existante en passant le user_id en paramètre. **Décision** : ajouter une variante `list_user_expeditions_public(p_target_user_id text)` dans une mig 120.

- [ ] **Step 4: Build OK + commit**

### Task 12.2: Bouton "Signaler" dans `ExpeditionModal`

**Files:**
- Create: `apps/explore-web/src/components/expeditions/FlagExpeditionMenu.tsx`
- Modify: `apps/explore-web/src/components/expeditions/ExpeditionModal.tsx` (ajout bouton dans le footer)

- [ ] **Step 1: Petit popover avec radio (3 raisons) + textarea optionnel + CTA "Envoyer le signalement"** → call `flagExpedition()`

- [ ] **Step 2: Build OK + commit**

### Task 12.3: Intégration toasts realtime sur les notifications expedition_*

**Files:**
- Modify: hook existant qui écoute `notifications` (probable `useNotifications.ts` ou équivalent — à identifier)

- [ ] **Step 1: Identifier le hook qui subscribe à `notifications` Realtime**

```bash
grep -rn "from.*notifications.*type.*expedition" apps/explore-web/src/
grep -rn "useNotifications\|notificationsRealtime" apps/explore-web/src/hooks/
```

- [ ] **Step 2: Étendre la liste des types qui déclenchent un toast** — le pattern doit déjà permettre l'extension via la map `TYPE_ICONS` étendue en Task 8.1. Vérifier qu'aucune liste hardcodée de types n'exclue les nouveaux `expedition_*`.

- [ ] **Step 3: Tester manuellement** — depuis un compte A, créer une expé. Depuis B, demander à rejoindre. Vérifier que A reçoit le toast "X demande à rejoindre" en temps réel.

- [ ] **Step 4: Commit**

---

## Phase 13 — Polish & livraison

### Task 13.1: Tests manuels — flux complet

- [ ] **Step 1: Préparer 2 comptes user A (chef) + B (participant)**

- [ ] **Step 2: Flux nominal**
  - A crée une expédition (rdv dans 7 jours, slots 5, validation manuelle)
  - Vérifier la bannière sur la carte + dans le Tableau
  - B demande à rejoindre avec un mot
  - A reçoit toast + notif → accepte
  - B reçoit toast "validé"
  - Les deux échangent dans le chat
  - A modifie la date (notif à B)
  - On simule la date passée (`UPDATE expeditions SET status='passed' WHERE id=...`)
  - B poste un CR avec 2 photos + 1 vidéo, en privé
  - Vérifier +10 XP côté B (lvl)
  - A poste son CR en public
  - Vérifier que la galerie agrège les 3 photos + 1 vidéo
  - Vérifier que la coque publique de l'archive ne montre que le CR de A

- [ ] **Step 3: Flux d'erreur**
  - A tente de créer une 4ème expé active → erreur `max_active_expeditions_reached`
  - B tente de rejoindre 2 fois → erreur `already_pending_or_validated`
  - C non-participant tente d'envoyer un message → erreur `not_authorized`

- [ ] **Step 4: Si bug → fix + nouveau test cycle**

### Task 13.2: Mise à jour `apps/explore-web/CLAUDE.md`

- [ ] **Step 1: Ajouter à la section "Spécificités cette app"**

```markdown
- V0.7+ (mai 2026) : système **Expéditions joueur-joueur**. Bannière temporaire sur la carte (point GPS libre), chef d'expédition, slots fixes/ouverts, validation manuelle/libre, chat privé (table dédiée `expedition_messages`), comptes rendus opt-in (texte + photos + vidéos), galerie agrégée, archives consultables. Composants `components/expeditions/`. Bucket Storage `expedition-medias`. Cron horaire `archive_passed_expeditions`. +10 XP au premier compte rendu via trigger SQL.
```

- [ ] **Step 2: Ajouter à la section "Structure components/"**

```markdown
├─ expeditions/   ExpeditionsTab, ExpeditionCard, ExpeditionCreator, ExpeditionModal, ExpeditionChat, ExpeditionGallery, ExpeditionReportsList, ReportEditor, FlagExpeditionMenu
├─ quests/        QuestsBoard (afficheur unifié quêtes/expéditions/missions)
```

- [ ] **Step 3: Ajouter store `expeditionsStore` à la liste**

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/CLAUDE.md && git commit -m "docs(claude): add expeditions structure and store"
```

### Task 13.3: Build final + cleanup

- [ ] **Step 1: Build complet sans warning**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/explore-web" && pnpm build
```

Expected: 0 erreur TS, 0 warning bloquant.

- [ ] **Step 2: Grep `console.log` ajoutés**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)" && grep -rn "console.log" apps/explore-web/src/components/expeditions/ apps/explore-web/src/lib/expeditionsApi.ts apps/explore-web/src/stores/expeditionsStore.ts apps/explore-web/src/hooks/useExpeditionChat.ts
```

Si trouvés → supprimer.

- [ ] **Step 3: Push lot complet**

```bash
git push origin main
```

(Aligné règle XO §E4 : push en fin de session uniquement, jamais à chaque commit.)

- [ ] **Step 4: Bump version (préférence globale Uriel)**

Si `apps/explore-web/src/version.ts` existe : bumper le patch. Sinon, omettre. Commit séparé.

- [ ] **Step 5: Mémoire**

Mettre à jour `MEMORY.md` (Citadelle) :
- Marquer le project_v07_expeditions comme déployé
- Ajouter retour d'expérience si pertinent

---

## Notes finales

- **Total tâches** : 30 tasks réparties sur 13 phases. Effort estimé total ~5-7 jours en travail concentré.
- **Réversibilité** : chaque migration SQL est numérotée, idempotente (`IF NOT EXISTS`). En cas de rollback nécessaire, les DROP correspondants peuvent être emballés dans une migration de retour.
- **Tests automatisés** : non couverts dans ce plan (le repo ne dispose pas d'une infra de tests automatisés stable). Tests manuels rigoureux en Task 13.1 + suivi prod post-launch.
- **Hub V2** : la suppression admin d'expéditions et le traitement des signalements demandent un Hub admin (V0.7+ séparé). Pour V1 expéditions, l'accès admin via `_is_admin()` + GUC `app.admin_user_ids` suffit.
- **Risques connus** :
  - `pg_cron` doit être activé côté Supabase. Si refusé → fallback Edge Function Scheduled.
  - Storage orphans à la suppression dure d'expé annulée — accepté en V1, à purger via cron mensuel future.
  - LOD WebGL au dézoom non implémenté en V1 — différé.

