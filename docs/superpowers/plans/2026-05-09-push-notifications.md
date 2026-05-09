# Push Notifications V1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le système push notifications V1 RdC : 6 types pushés (énigme du jour, message expé, lieu pris/repris/réaffirmé, level-up imminent, récap hebdo nouveaux lieux), opt-in well-timed, mini-guide iOS, 2 toggles préférences.

**Architecture:** La table `notifications` reste source de vérité. Trigger SQL `AFTER INSERT` → `pg_net.http_post` → Supabase Edge Function `send-push` (Deno + npm:web-push) → Web Push API → navigateur via Service Worker custom. Deux crons `pg_cron` pour les triggers scheduled (énigme matinale, level-up imminent, récap hebdo).

**Tech Stack:** Supabase (Postgres + Edge Functions Deno + pg_cron + pg_net), web-push (npm), VAPID, vite-plugin-pwa mode `injectManifest`, React 18, Zustand, TypeScript strict.

**Spec source:** `docs/superpowers/specs/2026-05-09-push-notifications-design.md`

**Adjustements vs spec** (justifiés au check des sources DB) :
- `level_up_imminent` se calcule sur `users.xp_total` via `_xp_for_level()` (système Niveaux V0.7, pas "gloire"). Seuil "à portée" = 1-5 XP avant prochain niveau.
- "Lieu contesté/repris" → mapping vers types existants (`place_taken_remote`, `place_taken_back_gps`, `place_reaffirmed`). Pas de nouveau type DB.
- `daily_enigma_ready` est un **nouveau** type, INSÉRÉ par un cron matinal 8h UTC pour les users qui n'ont pas joué dans les 18 dernières heures.
- `users.id` est `character varying(255)` (text), donc FK `push_subscriptions.user_id` = `text`.

**Scope check:** UN seul plan, scope tient en un sprint mono-feature.

---

## Phase 1 — Setup VAPID & secrets

### Task 1: Générer VAPID keys + stockage secrets

**Files:**
- Create: `apps/explore-web/.env.local` (local dev only, gitignored déjà)
- Modify: `apps/explore-web/.env.example` (template)
- Reference (manual): Supabase Dashboard → Project Settings → Functions → Secrets

- [ ] **Step 1: Installer web-push CLI temporairement et générer la paire VAPID**

```bash
cd "/c/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/explore-web"
pnpm dlx web-push generate-vapid-keys --json
```
Expected: JSON `{ publicKey: "B...", privateKey: "..." }` affiché dans la console.

- [ ] **Step 2: Stocker la public key dans `.env.example` et `.env.local`**

```bash
# Dans .env.local (ne jamais commit)
VITE_VAPID_PUBLIC_KEY=<la public key copiée>

# Dans .env.example (commit, sans la vraie valeur)
VITE_VAPID_PUBLIC_KEY=
```

- [ ] **Step 3: Stocker public+private keys + subject dans Supabase secrets**

Via Supabase CLI (préféré) :
```bash
cd "/c/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
pnpm dlx supabase secrets set VAPID_PUBLIC_KEY=<public>
pnpm dlx supabase secrets set VAPID_PRIVATE_KEY=<private>
pnpm dlx supabase secrets set VAPID_SUBJECT=mailto:contact@runesdechene.com
pnpm dlx supabase secrets set EDGE_FUNCTION_URL=https://<project-ref>.supabase.co/functions/v1/send-push
```
*Récupérer le project-ref depuis le dashboard Supabase ou `supabase status`.*

- [ ] **Step 4: Vérifier que les secrets sont enregistrés**

```bash
pnpm dlx supabase secrets list
```
Expected: voit les 4 clés ci-dessus.

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/.env.example
git commit -m "feat(push): add VITE_VAPID_PUBLIC_KEY to env template"
```

---

## Phase 2 — Schéma DB (migrations SQL)

### Task 2: Migration push_subscriptions table + colonnes users

**Files:**
- Create: `supabase/migrations/141_push_subscriptions_table.sql`

- [ ] **Step 1: Créer la migration**

Fichier `supabase/migrations/141_push_subscriptions_table.sql` :

```sql
-- 141_push_subscriptions_table.sql
-- WHY : Système push notifications V1.
--   - push_subscriptions stocke les endpoints+keys par appareil/navigateur
--   - 2 colonnes users pour préférences "Important" / "Récap"
--   - Toutes les notifs partent de la table notifications (source unique de vérité).
-- Spec : docs/superpowers/specs/2026-05-09-push-notifications-design.md

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           serial PRIMARY KEY,
  user_id      text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint     text NOT NULL UNIQUE,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions(user_id);

-- RLS : un user voit/édite uniquement ses propres subs
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_push_subs" ON public.push_subscriptions;
CREATE POLICY "users_read_own_push_subs"
  ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = (auth.uid())::text);

DROP POLICY IF EXISTS "users_insert_own_push_subs" ON public.push_subscriptions;
CREATE POLICY "users_insert_own_push_subs"
  ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (auth.uid())::text);

DROP POLICY IF EXISTS "users_delete_own_push_subs" ON public.push_subscriptions;
CREATE POLICY "users_delete_own_push_subs"
  ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (user_id = (auth.uid())::text);

-- Préférences : 2 toggles
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS push_important_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS push_recap_enabled     boolean NOT NULL DEFAULT true;

COMMENT ON TABLE public.push_subscriptions IS 'Web Push API subscriptions (1 row par appareil/navigateur).';
COMMENT ON COLUMN public.users.push_important_enabled IS 'Énigme du jour, message expé, lieu contesté.';
COMMENT ON COLUMN public.users.push_recap_enabled     IS 'Level-up imminent, récap hebdo nouveaux lieux.';
```

- [ ] **Step 2: Appliquer la migration en prod**

```bash
cd "/c/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
pnpm dlx supabase db push
```
Expected: Migration appliquée sans erreur. Vérifier dans Supabase Dashboard → Tables que `push_subscriptions` existe.

- [ ] **Step 3: Vérifier RLS active**

```sql
-- Dans Supabase SQL Editor, vérifier :
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename = 'push_subscriptions';
```
Expected: `rowsecurity = true`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/141_push_subscriptions_table.sql
git commit -m "feat(push): add push_subscriptions table + user preference columns"
```

---

### Task 3: Migration trigger pg_net push_on_notification

**Files:**
- Create: `supabase/migrations/142_push_trigger_on_notification.sql`

**Pré-requis:** L'extension `pg_net` doit être activée. Si non:
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```
Inclure dans la migration au cas où.

- [ ] **Step 1: Créer la migration**

```sql
-- 142_push_trigger_on_notification.sql
-- WHY : Tout INSERT dans notifications → fire-and-forget POST vers Edge Function send-push.
-- L'Edge Function porte toute la logique (filtre catégorie, prefs user, format payload).
-- Le trigger reste minimal pour faciliter patch/test/debug.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
  v_key text;
BEGIN
  -- Lecture des secrets via app_config (à seeder via mig 143).
  SELECT value INTO v_url FROM public.app_config WHERE key = 'edge_function_send_push_url';
  SELECT value INTO v_key FROM public.app_config WHERE key = 'edge_function_service_key';

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'push trigger: missing edge_function config in app_config';
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_key,
      'Content-Type',  'application/json'
    ),
    body    := jsonb_build_object(
      'notification_id', NEW.id,
      'recipient_id',    NEW.recipient_id,
      'type',            NEW.type,
      'data',            NEW.data
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS push_on_notification ON public.notifications;
CREATE TRIGGER push_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_on_notification();
```

- [ ] **Step 2: Appliquer**

```bash
pnpm dlx supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/142_push_trigger_on_notification.sql
git commit -m "feat(push): add AFTER INSERT trigger on notifications -> send-push edge function"
```

---

### Task 4: Migration seed app_config secrets pour le trigger

**Files:**
- Create: `supabase/migrations/143_push_seed_app_config.sql`

- [ ] **Step 1: Créer la migration**

```sql
-- 143_push_seed_app_config.sql
-- WHY : seed les 2 valeurs lues par trigger_push_on_notification :
-- - edge_function_send_push_url : URL publique de la Edge Function send-push
-- - edge_function_service_key   : SERVICE_ROLE_KEY pour autoriser le call
--
-- Ces valeurs DOIVENT être remplacées en prod (via Dashboard SQL Editor) avec
-- les vraies valeurs. La migration insère des placeholders pour ne pas péter
-- le trigger en prod si la mig est appliquée avant la mise à jour manuelle.
-- (Cf. step manuel post-déploiement dans le plan.)

INSERT INTO public.app_config (key, value)
VALUES
  ('edge_function_send_push_url', 'PLACEHOLDER_REPLACE_IN_PROD'),
  ('edge_function_service_key',   'PLACEHOLDER_REPLACE_IN_PROD')
ON CONFLICT (key) DO NOTHING;

-- Note opérateur :
-- En prod, après deploy de l'Edge Function, exécuter dans SQL Editor :
--   UPDATE public.app_config SET value = '<vraie URL>'         WHERE key = 'edge_function_send_push_url';
--   UPDATE public.app_config SET value = '<vraie SERVICE_KEY>' WHERE key = 'edge_function_service_key';
```

- [ ] **Step 2: Appliquer + post-update manuel**

```bash
pnpm dlx supabase db push
```

Ensuite dans Supabase Dashboard → SQL Editor (manuel, **NE PAS commit ces valeurs**) :
```sql
UPDATE public.app_config SET value = 'https://<project-ref>.supabase.co/functions/v1/send-push' WHERE key = 'edge_function_send_push_url';
UPDATE public.app_config SET value = '<SERVICE_ROLE_KEY copiée du dashboard>' WHERE key = 'edge_function_service_key';
```

- [ ] **Step 3: Commit (uniquement le placeholder)**

```bash
git add supabase/migrations/143_push_seed_app_config.sql
git commit -m "feat(push): seed app_config keys for trigger (placeholders, replace in prod)"
```

---

## Phase 3 — Edge Function `send-push`

### Task 5: Créer le squelette Edge Function + payload formatting + tests

**Files:**
- Create: `supabase/functions/send-push/index.ts`
- Create: `supabase/functions/send-push/payloads.ts`
- Create: `supabase/functions/send-push/payloads.test.ts`
- Create: `supabase/functions/send-push/categories.ts`
- Create: `supabase/functions/send-push/deno.json`

- [ ] **Step 1: Créer `deno.json` pour le runtime Edge Function**

```json
{
  "imports": {
    "web-push": "npm:web-push@^3.6.7",
    "@supabase/supabase-js": "npm:@supabase/supabase-js@^2.39.3"
  },
  "tasks": {
    "test": "deno test --allow-env"
  }
}
```

- [ ] **Step 2: Créer `categories.ts` (mapping type → catégorie)**

```ts
// supabase/functions/send-push/categories.ts

export type Category = 'important' | 'recap' | 'silent'

// Mapping centralisé des types de notifications V1 push.
// Tout type non listé = 'silent' (in-app uniquement, pas de push).
export const CATEGORY_BY_TYPE: Record<string, Category> = {
  daily_enigma_ready:       'important',
  expedition_message:       'important',
  place_taken_remote:       'important',
  place_taken_back_gps:     'important',
  place_reaffirmed:         'important',
  level_up_imminent:        'recap',
  weekly_new_places_recap:  'recap',
}

export function categoryOf(type: string): Category {
  return CATEGORY_BY_TYPE[type] ?? 'silent'
}
```

- [ ] **Step 3: Créer `payloads.ts` (format par type)**

```ts
// supabase/functions/send-push/payloads.ts

export interface PushPayload {
  title: string
  body: string
  url: string
}

type Data = Record<string, unknown>

const fr = (s: unknown, fallback = ''): string =>
  s === undefined || s === null ? fallback : String(s)

export function formatPayload(type: string, data: Data): PushPayload | null {
  switch (type) {
    case 'daily_enigma_ready':
      return {
        title: 'Ton énigme du jour',
        body:  'Le coffre t’attend.',
        url:   '/?enigma=daily',
      }
    case 'expedition_message': {
      const author        = fr(data.author_name, 'Un compagnon')
      const expeditionId  = fr(data.expedition_id)
      const expeditionName = fr(data.expedition_name, 'l’expédition')
      const preview       = fr(data.preview, '').slice(0, 80)
      return {
        title: `Message — ${expeditionName}`,
        body:  preview ? `${author} : ${preview}` : `${author} a écrit.`,
        url:   expeditionId ? `/?expedition=${expeditionId}` : '/',
      }
    }
    case 'place_taken_remote':
    case 'place_taken_back_gps':
    case 'place_reaffirmed': {
      const placeId   = fr(data.place_id)
      const placeName = fr(data.place_name, 'Un de tes lieux')
      return {
        title: type === 'place_reaffirmed'
          ? `${placeName} t’a échappé`
          : `${placeName} a changé de mains`,
        body:  'Reviens jeter un œil sur la carte.',
        url:   placeId ? `/?placeId=${placeId}` : '/',
      }
    }
    case 'level_up_imminent': {
      const xpDiff   = Number(data.xp_diff ?? 0)
      const nextLevel = Number(data.next_level ?? 0)
      return {
        title: `Plus que ${xpDiff} XP avant niveau ${nextLevel}`,
        body:  'Reviens jouer une énigme.',
        url:   '/?enigma=daily',
      }
    }
    case 'weekly_new_places_recap': {
      const count   = Number(data.count ?? 0)
      const samples = fr(data.sample_names_csv, '')
      return {
        title: `${count} nouveaux lieux cette semaine`,
        body:  samples ? `${samples}…` : 'Découvre la nouvelle carte.',
        url:   '/?layer=new',
      }
    }
    default:
      return null
  }
}
```

- [ ] **Step 4: Tests unit `payloads.test.ts`**

```ts
// supabase/functions/send-push/payloads.test.ts
import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { formatPayload } from './payloads.ts'

Deno.test('daily_enigma_ready payload is constant', () => {
  const p = formatPayload('daily_enigma_ready', {})
  assertEquals(p?.title, 'Ton énigme du jour')
  assertEquals(p?.url,   '/?enigma=daily')
})

Deno.test('expedition_message uses author + expedition_name', () => {
  const p = formatPayload('expedition_message', {
    author_name: 'Marin',
    expedition_id: '42',
    expedition_name: 'Forêt de Brocéliande',
    preview: 'On part demain à 8h',
  })
  assertEquals(p?.title, 'Message — Forêt de Brocéliande')
  assertEquals(p?.body, 'Marin : On part demain à 8h')
  assertEquals(p?.url, '/?expedition=42')
})

Deno.test('expedition_message handles missing preview gracefully', () => {
  const p = formatPayload('expedition_message', {
    author_name: 'Marin',
    expedition_id: '42',
    expedition_name: 'Forêt',
  })
  assertEquals(p?.body, 'Marin a écrit.')
})

Deno.test('place_taken_remote vs place_reaffirmed have different titles', () => {
  const taken = formatPayload('place_taken_remote', { place_name: 'Pic du Midi', place_id: '1' })
  const reaff = formatPayload('place_reaffirmed', { place_name: 'Pic du Midi', place_id: '1' })
  assertNotEquals(taken?.title, reaff?.title)
})

Deno.test('level_up_imminent formats xp_diff and next_level', () => {
  const p = formatPayload('level_up_imminent', { xp_diff: 3, next_level: 12 })
  assertEquals(p?.title, 'Plus que 3 XP avant niveau 12')
})

Deno.test('weekly_new_places_recap with samples', () => {
  const p = formatPayload('weekly_new_places_recap', { count: 7, sample_names_csv: 'A, B, C' })
  assertEquals(p?.title, '7 nouveaux lieux cette semaine')
})

Deno.test('unknown type returns null', () => {
  assertEquals(formatPayload('court_attack', {}), null)
})
```

- [ ] **Step 5: Lancer les tests**

```bash
cd "/c/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/supabase/functions/send-push"
deno test --allow-env
```
Expected: 7 tests passent.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/send-push/
git commit -m "feat(push): edge function payloads + categories + unit tests"
```

---

### Task 6: Compléter Edge Function — envoi web-push + cleanup 410

**Files:**
- Modify: `supabase/functions/send-push/index.ts`

- [ ] **Step 1: Écrire `index.ts` complet**

```ts
// supabase/functions/send-push/index.ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { categoryOf } from './categories.ts'
import { formatPayload } from './payloads.ts'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY          = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY         = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT             = Deno.env.get('VAPID_SUBJECT')!

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

interface RequestBody {
  notification_id: number
  recipient_id:    string
  type:            string
  data:            Record<string, unknown>
}

const ok = () => new Response(JSON.stringify({ ok: true }), {
  headers: { 'Content-Type': 'application/json' },
})

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return new Response('bad json', { status: 400 })
  }

  const { recipient_id, type, data } = body

  // 1. Catégorisation
  const category = categoryOf(type)
  if (category === 'silent') return ok()

  // 2. Préférences user
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('push_important_enabled, push_recap_enabled')
    .eq('id', recipient_id)
    .single()
  if (userErr || !user) {
    console.warn('user_lookup_failed', userErr)
    return ok()
  }
  if (category === 'important' && !user.push_important_enabled) return ok()
  if (category === 'recap'     && !user.push_recap_enabled)     return ok()

  // 3. Subscriptions actives
  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', recipient_id)
  if (subsErr) {
    console.error('subs_lookup_failed', subsErr)
    return ok()
  }
  if (!subs || subs.length === 0) return ok()

  // 4. Format payload
  const payload = formatPayload(type, data)
  if (!payload) return ok()
  const payloadJson = JSON.stringify(payload)

  // 5. Envoi parallèle, cleanup 410
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payloadJson,
        {
          TTL: 86400,
          urgency: category === 'important' ? 'high' : 'normal',
        },
      )
      await supabase
        .from('push_subscriptions')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', sub.id)
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 410 || status === 404) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      } else if (status === 429) {
        console.warn('rate_limited', sub.id)
      } else {
        console.error('push_failed', sub.id, err)
      }
    }
  }))

  return ok()
})
```

- [ ] **Step 2: Vérifier que les tests Deno passent toujours**

```bash
cd "/c/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/supabase/functions/send-push"
deno test --allow-env
```
Expected: 7 tests passent.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/send-push/index.ts
git commit -m "feat(push): edge function send-push with web-push send + 410 cleanup"
```

---

### Task 7: Deploy Edge Function + intégration test

**Files:**
- (no file change — operational task)

- [ ] **Step 1: Deploy l'Edge Function**

```bash
cd "/c/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
pnpm dlx supabase functions deploy send-push --no-verify-jwt
```
Expected: "Deployed Function send-push" + URL.

`--no-verify-jwt` car le trigger SQL appelle avec un Bearer SERVICE_ROLE_KEY, on gère l'auth manuellement (header Authorization déjà posé par pg_net).

- [ ] **Step 2: Update app_config avec la vraie URL + service_key**

Récupérer l'URL exacte depuis l'output ou Supabase Dashboard. Récupérer SERVICE_ROLE_KEY depuis Project Settings → API.

Dans Supabase Dashboard → SQL Editor :
```sql
UPDATE public.app_config SET value = 'https://<ref>.supabase.co/functions/v1/send-push' WHERE key = 'edge_function_send_push_url';
UPDATE public.app_config SET value = '<service_role_key>' WHERE key = 'edge_function_service_key';
```

- [ ] **Step 3: Test smoke depuis SQL Editor**

```sql
-- Insert de test, devrait déclencher un POST vers l'Edge Function
INSERT INTO public.notifications (recipient_id, type, data)
VALUES (
  (SELECT id FROM users WHERE email_address = '<email d’un compte de test>'),
  'daily_enigma_ready',
  '{}'::jsonb
);
```
Expected dans les logs Edge Function (Dashboard → Logs → Functions) : ligne `200` avec `ok: true`. Si pas de sub, retour ok silencieux.

- [ ] **Step 4: Cleanup la notif de test**

```sql
DELETE FROM public.notifications WHERE type = 'daily_enigma_ready' AND created_at > now() - interval '5 minutes';
```

- [ ] **Step 5: Pas de commit (étape opérationnelle)**

---

## Phase 4 — Service Worker custom + lib pushNotifications

### Task 8: Bascule vite-plugin-pwa en mode injectManifest + sw.ts custom

**Files:**
- Modify: `apps/explore-web/vite.config.ts`
- Create: `apps/explore-web/src/sw.ts`

- [ ] **Step 1: Modifier `vite.config.ts` pour passer en `injectManifest`**

Remplacer la config `VitePWA({...})` actuelle par :

```ts
VitePWA({
  registerType: 'autoUpdate',
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
  manifest: {
    name: 'Runes de Chêne',
    short_name: 'Runes de Chêne',
    description: "App d'Aventure locale. 2 600+ lieux d'Histoire et de Nature à redécouvrir avec la Confrérie.",
    theme_color: '#f8f3e7',
    background_color: '#f8f3e7',
    display: 'standalone',
    orientation: 'portrait',
    lang: 'fr',
    start_url: '/carte',
    scope: '/',
    icons: [
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
  },
}),
```

- [ ] **Step 2: Créer `apps/explore-web/src/sw.ts`**

```ts
/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

// Précaching (équivalent générateurique pré-existant)
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// SPA fallback (sauf /lieu/* et /sitemap*)
const denylist: RegExp[] = [/^\/lieu\//, /^\/sitemap/]
registerRoute(new NavigationRoute(
  async ({ event }) => {
    const url = new URL((event as FetchEvent).request.url)
    if (denylist.some((re) => re.test(url.pathname))) {
      return fetch((event as FetchEvent).request)
    }
    const cache = await caches.open('workbox-precache-v2')
    const match = await cache.match('/index.html')
    return match ?? fetch((event as FetchEvent).request)
  },
))

// === Push notifications ===

interface PushPayload {
  title: string
  body: string
  url: string
}

self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return
  let payload: PushPayload
  try {
    payload = event.data.json() as PushPayload
  } catch {
    return
  }
  const { title, body, url } = payload
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data:  { url },
      tag:   url,             // dédup les notifs identiques (ex: même expé)
      renotify: false,
    }),
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const targetUrl = (event.notification.data as { url?: string })?.url ?? '/'
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of allClients) {
      const url = new URL(client.url)
      if (url.origin === self.location.origin) {
        await (client as WindowClient).focus()
        await (client as WindowClient).navigate(targetUrl)
        return
      }
    }
    await self.clients.openWindow(targetUrl)
  })())
})

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
```

- [ ] **Step 3: Installer `workbox-precaching` et `workbox-routing` (deps de l'injectManifest)**

```bash
cd "/c/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
pnpm --filter explore-web add -D workbox-precaching workbox-routing workbox-window
```

- [ ] **Step 4: Build pour vérifier que le SW compile**

```bash
cd "/c/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
pnpm --filter explore-web build
```
Expected: build OK, fichier `dist/sw.js` généré.

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/vite.config.ts apps/explore-web/src/sw.ts package.json pnpm-lock.yaml
git commit -m "feat(push): switch vite-plugin-pwa to injectManifest mode + custom sw.ts with push handlers"
```

---

### Task 9: Lib `pushNotifications.ts` — subscribe/unsubscribe/sync/support

**Files:**
- Create: `apps/explore-web/src/lib/pushNotifications.ts`
- Create: `apps/explore-web/src/lib/pushNotifications.test.ts`

- [ ] **Step 1: Créer la lib**

```ts
// apps/explore-web/src/lib/pushNotifications.ts
import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

export type PushSupportStatus = 'native' | 'ios-needs-install' | 'unsupported'

export function pushSupportStatus(): PushSupportStatus {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'unsupported'

  const ua = navigator.userAgent
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  if (isIOS) {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true
    if (!isStandalone) return 'ios-needs-install'
    if (!('PushManager' in window)) return 'unsupported'
    return 'native'
  }

  if ('PushManager' in window && 'Notification' in window && 'serviceWorker' in navigator) {
    return 'native'
  }
  return 'unsupported'
}

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4)
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return await navigator.serviceWorker.ready
}

export async function subscribeUser(userId: string): Promise<PushSubscription | null> {
  if (pushSupportStatus() !== 'native') return null

  const reg = await getRegistration()
  if (!reg) return null

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const json = sub.toJSON()
  const endpoint = json.endpoint!
  const p256dh   = json.keys?.p256dh ?? ''
  const auth     = json.keys?.auth ?? ''

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  )
  if (error) {
    console.error('[push] upsert sub failed', error)
    return null
  }
  return sub
}

export async function unsubscribeUser(): Promise<void> {
  const reg = await getRegistration()
  if (!reg) return
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

// Au boot après login : aligne la sub locale avec la DB.
// - Si une sub navigateur existe et n'est pas associée à ce user_id → upsert.
// - Si pas de sub navigateur mais user a permission granted → re-subscribe silencieusement.
export async function syncSubscription(userId: string): Promise<void> {
  if (pushSupportStatus() !== 'native') return
  const reg = await getRegistration()
  if (!reg) return

  const sub = await reg.pushManager.getSubscription()

  if (!sub) {
    if (Notification.permission === 'granted') {
      await subscribeUser(userId)
    }
    return
  }

  // Sub existe : s'assurer qu'elle est bien attribuée à ce user en DB
  const json = sub.toJSON()
  const endpoint = json.endpoint!
  await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth:   json.keys?.auth ?? '',
      user_agent: navigator.userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  )
}
```

- [ ] **Step 2: Test unit `pushSupportStatus`**

```ts
// apps/explore-web/src/lib/pushNotifications.test.ts
// Note : les vrais tests E2E sub/unsub se font manuellement (DOM browser API requis).
// Ce fichier contient un test minimal de pushSupportStatus en mock navigator.
// Cf. step Phase 8 pour la checklist E2E.

// Si vitest n'est pas en place dans le projet (pas de framework de test trouvé),
// ce fichier sert de DOC de comportement attendu, ré-utilisable plus tard.

export {}
```
*Note : explore-web n'a pas de framework de tests configuré actuellement (cf. package.json). On ne forge pas un setup vitest juste pour ça en V1 — la lib sera validée par le E2E manuel de Phase 8. Le fichier de test reste comme placeholder de doc.*

- [ ] **Step 3: Build pour s'assurer qu'aucun TS error**

```bash
pnpm --filter explore-web build
```
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/lib/pushNotifications.ts apps/explore-web/src/lib/pushNotifications.test.ts
git commit -m "feat(push): client lib subscribe/unsubscribe/sync + iOS support detection"
```

---

## Phase 5 — UI : modales + hook + settings

### Task 10: PushPermissionModal + IOSInstallGuideModal

**Files:**
- Create: `apps/explore-web/src/components/notifications/PushPermissionModal.tsx`
- Create: `apps/explore-web/src/components/notifications/PushPermissionModal.css`
- Create: `apps/explore-web/src/components/notifications/IOSInstallGuideModal.tsx`
- Create: `apps/explore-web/src/components/notifications/IOSInstallGuideModal.css`

- [ ] **Step 1: Créer `PushPermissionModal.tsx`**

```tsx
// apps/explore-web/src/components/notifications/PushPermissionModal.tsx
import { useEffect } from 'react'
import './PushPermissionModal.css'

interface Props {
  open: boolean
  title: string
  body: string
  onAccept: () => void
  onDismiss: () => void
}

export function PushPermissionModal({ open, title, body, onAccept, onDismiss }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onDismiss])

  if (!open) return null
  return (
    <div className="push-perm-backdrop" onClick={onDismiss}>
      <div className="push-perm-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="push-perm-title">{title}</h2>
        <p className="push-perm-body">{body}</p>
        <div className="push-perm-actions">
          <button className="push-perm-btn push-perm-btn--secondary" onClick={onDismiss}>
            Plus tard
          </button>
          <button className="push-perm-btn push-perm-btn--primary" onClick={onAccept}>
            Activer
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Créer `PushPermissionModal.css`** (style cohérent avec InfoModal/AuthModal du projet)

```css
/* apps/explore-web/src/components/notifications/PushPermissionModal.css */
.push-perm-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 9000;
}
.push-perm-modal {
  background: var(--color-parchment, #f7ede1);
  border: 1px solid var(--color-sepia-dark, #A0784C);
  border-radius: 12px;
  padding: 24px;
  max-width: 380px;
  width: calc(100% - 32px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}
.push-perm-title {
  font-family: var(--font-title, 'Bebas Neue'), serif;
  font-size: 22px;
  margin: 0 0 12px;
  color: var(--color-ink, #4A3728);
}
.push-perm-body {
  font-family: var(--font-body, 'Cabin'), sans-serif;
  font-size: 16px;
  color: var(--color-ink-light, #7D5A3C);
  margin: 0 0 20px;
  line-height: 1.5;
}
.push-perm-actions {
  display: flex; gap: 12px; justify-content: flex-end;
}
.push-perm-btn {
  padding: 10px 18px;
  border-radius: 8px;
  font-family: var(--font-accent, 'Cabin Condensed'), sans-serif;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--color-sepia-dark, #A0784C);
}
.push-perm-btn--secondary {
  background: transparent;
  color: var(--color-ink, #4A3728);
}
.push-perm-btn--primary {
  background: var(--color-sepia-dark, #A0784C);
  color: white;
}
```

- [ ] **Step 3: Créer `IOSInstallGuideModal.tsx`**

```tsx
// apps/explore-web/src/components/notifications/IOSInstallGuideModal.tsx
import './IOSInstallGuideModal.css'

interface Props {
  open: boolean
  onLater: () => void
  onUnderstood: () => void
}

export function IOSInstallGuideModal({ open, onLater, onUnderstood }: Props) {
  if (!open) return null
  return (
    <div className="ios-install-backdrop" onClick={onLater}>
      <div className="ios-install-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="ios-install-title">Sur iPhone : ajoute Runes de Chêne à ton écran d'accueil</h2>
        <p className="ios-install-intro">
          Pour recevoir tes notifications, l'app doit être lancée depuis l'écran d'accueil.
        </p>
        <ol className="ios-install-steps">
          <li><span className="ios-step-num">1</span>Touche le bouton <strong>Partager</strong> en bas de Safari (carré + flèche vers le haut).</li>
          <li><span className="ios-step-num">2</span>Choisis <strong>Sur l'écran d'accueil</strong>.</li>
          <li><span className="ios-step-num">3</span>Confirme avec <strong>Ajouter</strong> en haut à droite.</li>
          <li><span className="ios-step-num">4</span>Lance Runes de Chêne depuis ton écran d'accueil.</li>
        </ol>
        <div className="ios-install-actions">
          <button className="ios-install-btn ios-install-btn--secondary" onClick={onLater}>Plus tard</button>
          <button className="ios-install-btn ios-install-btn--primary" onClick={onUnderstood}>J'ai compris</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Créer `IOSInstallGuideModal.css`**

```css
/* apps/explore-web/src/components/notifications/IOSInstallGuideModal.css */
.ios-install-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 9000;
}
.ios-install-modal {
  background: var(--color-parchment, #f7ede1);
  border: 1px solid var(--color-sepia-dark, #A0784C);
  border-radius: 12px;
  padding: 24px;
  max-width: 420px;
  width: calc(100% - 32px);
  max-height: calc(100% - 64px);
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}
.ios-install-title {
  font-family: var(--font-title, 'Bebas Neue'), serif;
  font-size: 22px;
  margin: 0 0 8px;
  color: var(--color-ink, #4A3728);
}
.ios-install-intro {
  font-family: var(--font-body, 'Cabin'), sans-serif;
  font-size: 15px;
  color: var(--color-ink-light, #7D5A3C);
  margin: 0 0 16px;
}
.ios-install-steps {
  list-style: none; padding: 0; margin: 0 0 20px;
}
.ios-install-steps li {
  font-family: var(--font-body, 'Cabin'), sans-serif;
  font-size: 15px;
  color: var(--color-ink, #4A3728);
  display: flex; gap: 12px; align-items: flex-start;
  margin-bottom: 12px;
  line-height: 1.5;
}
.ios-step-num {
  flex: none;
  width: 28px; height: 28px;
  background: var(--color-sepia, #C19A6B);
  color: white;
  font-weight: 700;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px;
}
.ios-install-actions { display: flex; gap: 12px; justify-content: flex-end; }
.ios-install-btn {
  padding: 10px 18px;
  border-radius: 8px;
  font-family: var(--font-accent, 'Cabin Condensed'), sans-serif;
  font-size: 15px; font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--color-sepia-dark, #A0784C);
}
.ios-install-btn--secondary { background: transparent; color: var(--color-ink, #4A3728); }
.ios-install-btn--primary   { background: var(--color-sepia-dark, #A0784C); color: white; }
```

- [ ] **Step 5: Build pour vérifier**

```bash
pnpm --filter explore-web build
```
Expected: build OK.

- [ ] **Step 6: Commit**

```bash
git add apps/explore-web/src/components/notifications/PushPermissionModal.* apps/explore-web/src/components/notifications/IOSInstallGuideModal.*
git commit -m "feat(push): permission modal + ios install guide modal"
```

---

### Task 11: Hook `useEnsurePushPermission`

**Files:**
- Create: `apps/explore-web/src/hooks/useEnsurePushPermission.tsx`

- [ ] **Step 1: Créer le hook (provider + helper)**

Le hook expose une fonction `ensurePush({ reason, title, body })`. Pour gérer l'état modal globalement, on l'attache à un singleton store Zustand minimal (ou state local) — ici on choisit un small Zustand store dédié pour cohérence avec le reste du codebase.

```tsx
// apps/explore-web/src/hooks/useEnsurePushPermission.tsx
import { create } from 'zustand'
import { useCallback, useEffect } from 'react'
import { PushPermissionModal } from '../components/notifications/PushPermissionModal'
import { IOSInstallGuideModal } from '../components/notifications/IOSInstallGuideModal'
import { pushSupportStatus, subscribeUser } from '../lib/pushNotifications'
import { usePlayerStore } from '../stores/playerStore'

type ModalKind = 'none' | 'permission' | 'ios'

interface State {
  kind: ModalKind
  title: string
  body: string
  open: (kind: ModalKind, title?: string, body?: string) => void
  close: () => void
}

const usePushPromptStore = create<State>((set) => ({
  kind: 'none',
  title: '',
  body: '',
  open: (kind, title = '', body = '') => set({ kind, title, body }),
  close: () => set({ kind: 'none', title: '', body: '' }),
}))

const DENIED_KEY  = 'push_denied_at'
const IOS_DISMISS_KEY = 'ios_install_prompt_dismissed_at'

// 14 jours en ms
const IOS_DISMISS_COOLDOWN_MS = 14 * 24 * 3600 * 1000

interface EnsureArgs {
  reason: string
  title: string
  body: string
}

export function useEnsurePushPermission(): (args: EnsureArgs) => void {
  const userId = usePlayerStore((s) => s.userId)
  const open = usePushPromptStore((s) => s.open)

  return useCallback(
    (args: EnsureArgs) => {
      if (!userId) return
      const status = pushSupportStatus()

      if (status === 'unsupported') return

      if (status === 'ios-needs-install') {
        const dismissedAt = Number(localStorage.getItem(IOS_DISMISS_KEY) || 0)
        if (Date.now() - dismissedAt < IOS_DISMISS_COOLDOWN_MS) return
        open('ios')
        return
      }

      // status === 'native'
      if (typeof Notification === 'undefined') return
      if (Notification.permission === 'granted') {
        // déjà autorisé : on s'assure d'être bien subscribed (no-op si déjà OK)
        void subscribeUser(userId)
        return
      }
      if (Notification.permission === 'denied') return
      if (localStorage.getItem(DENIED_KEY)) return

      open('permission', args.title, args.body)
    },
    [userId, open],
  )
}

// Composant à mounter UNE FOIS au top de l'app (dans App.tsx ou MapPage)
export function PushPromptHost() {
  const { kind, title, body, close } = usePushPromptStore()
  const userId = usePlayerStore((s) => s.userId)

  const onAccept = useCallback(async () => {
    close()
    if (!userId) return
    try {
      const sub = await subscribeUser(userId)
      if (!sub) {
        localStorage.setItem(DENIED_KEY, String(Date.now()))
      }
    } catch {
      localStorage.setItem(DENIED_KEY, String(Date.now()))
    }
  }, [userId, close])

  const onDismiss = useCallback(() => {
    localStorage.setItem(DENIED_KEY, String(Date.now()))
    close()
  }, [close])

  const onIOSLater = useCallback(() => {
    localStorage.setItem(IOS_DISMISS_KEY, String(Date.now()))
    close()
  }, [close])

  const onIOSUnderstood = useCallback(() => {
    localStorage.setItem(IOS_DISMISS_KEY, String(Date.now()))
    close()
  }, [close])

  return (
    <>
      <PushPermissionModal
        open={kind === 'permission'}
        title={title}
        body={body}
        onAccept={onAccept}
        onDismiss={onDismiss}
      />
      <IOSInstallGuideModal
        open={kind === 'ios'}
        onLater={onIOSLater}
        onUnderstood={onIOSUnderstood}
      />
    </>
  )
}

// À monter aussi UNE FOIS — sync auto au login (pas de UI)
export function PushSubscriptionSync() {
  const userId = usePlayerStore((s) => s.userId)
  useEffect(() => {
    if (!userId) return
    void (async () => {
      const { syncSubscription } = await import('../lib/pushNotifications')
      await syncSubscription(userId)
    })()
  }, [userId])
  return null
}
```

- [ ] **Step 2: Build**

```bash
pnpm --filter explore-web build
```
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/hooks/useEnsurePushPermission.tsx
git commit -m "feat(push): useEnsurePushPermission hook + PushPromptHost + PushSubscriptionSync"
```

---

### Task 12: PushSettings (toggles dans menu profil)

**Files:**
- Create: `apps/explore-web/src/components/notifications/PushSettings.tsx`
- Create: `apps/explore-web/src/components/notifications/PushSettings.css`
- Modify: `apps/explore-web/src/components/auth/ProfileMenu.tsx` (insérer le bloc settings)

- [ ] **Step 1: Créer `PushSettings.tsx`**

```tsx
// apps/explore-web/src/components/notifications/PushSettings.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import {
  pushSupportStatus,
  subscribeUser,
  unsubscribeUser,
} from '../../lib/pushNotifications'
import './PushSettings.css'

export function PushSettings() {
  const userId = usePlayerStore((s) => s.userId)
  const [important, setImportant] = useState(true)
  const [recap, setRecap] = useState(true)
  const [granted, setGranted] = useState<boolean>(
    typeof Notification !== 'undefined' && Notification.permission === 'granted',
  )
  const [supported] = useState<boolean>(pushSupportStatus() === 'native')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('users')
        .select('push_important_enabled, push_recap_enabled')
        .eq('id', userId)
        .single()
      if (cancelled || !data) return
      setImportant(Boolean(data.push_important_enabled))
      setRecap(Boolean(data.push_recap_enabled))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [userId])

  async function persist(field: 'push_important_enabled' | 'push_recap_enabled', value: boolean) {
    if (!userId) return
    await supabase.from('users').update({ [field]: value }).eq('id', userId)
  }

  async function toggleMaster() {
    if (!userId) return
    if (granted) {
      await unsubscribeUser()
      setGranted(false)
    } else {
      const sub = await subscribeUser(userId)
      setGranted(Boolean(sub))
    }
  }

  if (!supported) {
    return (
      <div className="push-settings push-settings--unsupported">
        <h3>Notifications</h3>
        <p>Ton navigateur ne supporte pas les notifications push.</p>
      </div>
    )
  }

  if (loading) return <div className="push-settings"><h3>Notifications</h3></div>

  return (
    <div className="push-settings">
      <h3>Notifications</h3>

      <div className="push-settings-row">
        <label className="push-settings-label">
          <input
            type="checkbox"
            checked={granted}
            onChange={toggleMaster}
          />
          <span>Recevoir les notifications RdC</span>
        </label>
      </div>

      <div className={`push-settings-cats${granted ? '' : ' is-disabled'}`}>
        <label className="push-settings-cat">
          <input
            type="checkbox"
            checked={important}
            disabled={!granted}
            onChange={async (e) => {
              setImportant(e.target.checked)
              await persist('push_important_enabled', e.target.checked)
            }}
          />
          <div>
            <strong>Importantes</strong>
            <small>Énigme du jour, messages d'expédition, lieu contesté.</small>
          </div>
        </label>

        <label className="push-settings-cat">
          <input
            type="checkbox"
            checked={recap}
            disabled={!granted}
            onChange={async (e) => {
              setRecap(e.target.checked)
              await persist('push_recap_enabled', e.target.checked)
            }}
          />
          <div>
            <strong>Récap & moments</strong>
            <small>Avant un palier de niveau, nouveaux lieux de la semaine.</small>
          </div>
        </label>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Créer `PushSettings.css`**

```css
/* apps/explore-web/src/components/notifications/PushSettings.css */
.push-settings {
  padding: 16px;
  border-top: 1px solid var(--color-parchment-dark, #E8D5BE);
}
.push-settings h3 {
  font-family: var(--font-title, 'Bebas Neue'), serif;
  font-size: 18px;
  margin: 0 0 12px;
  color: var(--color-ink, #4A3728);
}
.push-settings-row { margin-bottom: 12px; }
.push-settings-label {
  display: flex; gap: 10px; align-items: center;
  font-family: var(--font-body, 'Cabin'), sans-serif;
  font-size: 16px;
  color: var(--color-ink, #4A3728);
  cursor: pointer;
}
.push-settings-cats { display: flex; flex-direction: column; gap: 12px; padding-left: 8px; }
.push-settings-cats.is-disabled { opacity: 0.4; pointer-events: none; }
.push-settings-cat {
  display: flex; gap: 12px; align-items: flex-start;
  cursor: pointer;
}
.push-settings-cat strong {
  font-family: var(--font-accent, 'Cabin Condensed'), sans-serif;
  font-size: 15px;
  color: var(--color-ink, #4A3728);
  display: block;
}
.push-settings-cat small {
  font-family: var(--font-body, 'Cabin'), sans-serif;
  font-size: 13px;
  color: var(--color-ink-light, #7D5A3C);
  display: block;
}
```

- [ ] **Step 3: Insérer `<PushSettings />` dans `ProfileMenu.tsx`**

Lire le fichier d'abord pour trouver le bon emplacement (probablement avant la fermeture du menu / juste avant le bouton "Déconnexion") :
```bash
grep -n "Déconnexion\|signOut\|logout" "apps/explore-web/src/components/auth/ProfileMenu.tsx" | head -5
```

Insérer juste avant ce bloc :
```tsx
import { PushSettings } from '../notifications/PushSettings'
// ...
<PushSettings />
```

- [ ] **Step 4: Build**

```bash
pnpm --filter explore-web build
```

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/components/notifications/PushSettings.* apps/explore-web/src/components/auth/ProfileMenu.tsx
git commit -m "feat(push): PushSettings with 2 toggles in profile menu"
```

---

### Task 13: Mount `PushPromptHost` + `PushSubscriptionSync` dans MapPage

**Files:**
- Modify: `apps/explore-web/src/pages/MapPage.tsx`

- [ ] **Step 1: Ajouter les imports**

```tsx
import { PushPromptHost, PushSubscriptionSync } from '../hooks/useEnsurePushPermission'
```

- [ ] **Step 2: Mounter les 2 composants au top du JSX retourné par `MapPage`**

Trouver le `return (` principal et ajouter en frère du root, avant les autres modales :
```tsx
return (
  <>
    <PushPromptHost />
    <PushSubscriptionSync />
    {/* ...reste du contenu MapPage... */}
  </>
)
```

- [ ] **Step 3: Build + smoke test local**

```bash
pnpm --filter explore-web dev
```
Ouvrir `http://localhost:3000`, login, ouvrir devtools → Application → Service Workers : vérifier que le SW custom est actif et qu'aucune erreur push n'est loguée. Vérifier dans Application → IndexedDB / Local Storage que rien d'anormal.

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/pages/MapPage.tsx
git commit -m "feat(push): mount PushPromptHost + PushSubscriptionSync in MapPage"
```

---

## Phase 6 — Intégration well-timed prompts

### Task 14: Trigger ensurePush après submit énigme du jour

**Files:**
- Modify: `apps/explore-web/src/components/enigma/DailyEnigma.tsx` (ou son handler de submit — à confirmer en lisant le fichier)

- [ ] **Step 1: Trouver le point exact d'appel**

```bash
grep -n "submit\|success\|onComplete" "apps/explore-web/src/components/enigma/DailyEnigma.tsx" | head
```
Identifier le moment où la résolution est validée côté client (callback `onSuccess` ou équivalent).

- [ ] **Step 2: Ajouter l'appel `ensurePush` après la résolution**

```tsx
// En haut du fichier
import { useEnsurePushPermission } from '../../hooks/useEnsurePushPermission'

// Dans le composant
const ensurePush = useEnsurePushPermission()

// Dans le callback de succès, après les toasts existants :
ensurePush({
  reason: 'daily_enigma',
  title: 'Veux-tu être prévenu chaque jour ?',
  body:  'On te ping quand ton énigme du jour est prête.',
})
```

- [ ] **Step 3: Build**

```bash
pnpm --filter explore-web build
```

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/components/enigma/DailyEnigma.tsx
git commit -m "feat(push): well-timed permission prompt after daily enigma submit"
```

---

### Task 15: Trigger ensurePush après création d'expédition

**Files:**
- Modify: `apps/explore-web/src/components/expeditions/ExpeditionCreator.tsx` (ou son handler)

- [ ] **Step 1: Trouver le point exact**

```bash
grep -n "onSubmit\|create_expedition\|handleCreate\|success" "apps/explore-web/src/components/expeditions/ExpeditionCreator.tsx" | head
```

- [ ] **Step 2: Ajouter l'appel après création réussie**

```tsx
import { useEnsurePushPermission } from '../../hooks/useEnsurePushPermission'

const ensurePush = useEnsurePushPermission()

// après que l'expé est créée avec succès (juste avant la fermeture du modal) :
ensurePush({
  reason: 'expedition_created',
  title: 'Reste connecté avec tes compagnons',
  body:  'On te ping quand un compagnon écrit dans l’expédition.',
})
```

- [ ] **Step 3: Build**

```bash
pnpm --filter explore-web build
```

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/components/expeditions/ExpeditionCreator.tsx
git commit -m "feat(push): well-timed permission prompt after expedition creation"
```

---

## Phase 7 — Crons SQL (3 jobs)

### Task 16: Cron énigme du jour (12h30 heure de Paris, cohérent été/hiver)

**Files:**
- Create: `supabase/migrations/144_push_cron_daily_enigma.sql`

- [ ] **Step 1: Vérifier si une table tracking d'énigme du jour existe**

```bash
cd "/c/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
grep -E "CREATE TABLE IF NOT EXISTS \"public\"\.\"(enigma_attempts|enigma_history|daily_enigma_results)" supabase/migrations/*.sql | head -3
```

Selon ce qu'on trouve, ajuster le `WHERE NOT EXISTS` dans la mig. Si rien de propre, on simplifie en `last_login_at` proxy (cf. Step 2).

- [ ] **Step 2: Créer la migration**

**Pourquoi cette structure :** pg_cron tourne en UTC. Pour viser 12h30 heure de Paris **toute l'année** (sans dérive été/hiver), on schedule le cron 4× dans la fenêtre 10h-11h30 UTC (couvre 12h-13h30 Paris CET et CEST), puis on filtre dans la requête sur `Europe/Paris`. Le `NOT EXISTS` garantit qu'on push 1×/jour max par user — donc même si le cron déclenche 4×, l'INSERT effectif n'arrive qu'à la première fenêtre où l'heure de Paris est 12:30.

```sql
-- 144_push_cron_daily_enigma.sql
-- WHY : push midi "ton énigme du jour t'attend" pour les users qui n'ont
-- pas ouvert l'app dans les dernières 18h. Cible 12h30 Europe/Paris (pause
-- repas du midi) toute l'année, robuste DST.
-- Garde-fous : push_important_enabled, is_active, 1×/user/jour max.

SELECT cron.unschedule('daily_enigma_lunch_push')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily_enigma_lunch_push');

-- Cron tourne 4× dans la fenêtre UTC 10h-11h30 (couvre 12h-13h30 Paris été+hiver).
-- Le filtre WHERE en time-of-day Europe/Paris cible précisément 12:30 ± 5 min.
SELECT cron.schedule(
  'daily_enigma_lunch_push',
  '0,30 10,11 * * *',
  $$
    INSERT INTO public.notifications (recipient_id, type, data)
    SELECT u.id, 'daily_enigma_ready', '{}'::jsonb
      FROM public.users u
     WHERE EXTRACT(HOUR   FROM (now() AT TIME ZONE 'Europe/Paris'))::int = 12
       AND EXTRACT(MINUTE FROM (now() AT TIME ZONE 'Europe/Paris'))::int BETWEEN 25 AND 35
       AND u.push_important_enabled = true
       AND u.is_active = true
       AND (u.last_login_at IS NULL OR u.last_login_at < now() - interval '18 hours')
       AND NOT EXISTS (
         SELECT 1 FROM public.notifications n
          WHERE n.recipient_id = u.id
            AND n.type = 'daily_enigma_ready'
            AND n.created_at::date
                = (now() AT TIME ZONE 'Europe/Paris')::date
       );
  $$
);
```

- [ ] **Step 3: Appliquer**

```bash
pnpm dlx supabase db push
```

- [ ] **Step 4: Vérifier le job en DB**

```sql
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'daily_enigma_morning_push';
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/144_push_cron_daily_enigma.sql
git commit -m "feat(push): pg_cron daily 8h UTC enigma morning push"
```

---

### Task 17: Cron level-up imminent (quotidien 17h UTC)

**Files:**
- Create: `supabase/migrations/145_push_cron_level_up_imminent.sql`

- [ ] **Step 1: Créer la migration**

```sql
-- 145_push_cron_level_up_imminent.sql
-- WHY : push quotidien 17h UTC (~18h-19h CET) pour les users à 1-5 XP du
-- prochain niveau, qui ne sont pas actifs depuis 24h. Système Niveaux V0.7
-- (xp_total + _xp_for_level helpers, cf. mig 040 et 047).
-- Garde-fous : 1×/7j max, niveau actuel < 50.

SELECT cron.unschedule('level_up_imminent_check')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'level_up_imminent_check');

SELECT cron.schedule(
  'level_up_imminent_check',
  '0 17 * * *',
  $$
    INSERT INTO public.notifications (recipient_id, type, data)
    SELECT u.id, 'level_up_imminent',
           jsonb_build_object(
             'xp_diff',    lv.next_xp - u.xp_total,
             'next_level', lv.cur_level + 1
           )
      FROM public.users u
      CROSS JOIN LATERAL (
        SELECT public._level_from_xp(COALESCE(u.xp_total, 0)) AS cur_level,
               public._xp_for_level(public._level_from_xp(COALESCE(u.xp_total, 0)) + 1) AS next_xp
      ) lv
     WHERE u.push_recap_enabled = true
       AND u.is_active = true
       AND lv.cur_level < 50
       AND (lv.next_xp - COALESCE(u.xp_total, 0)) BETWEEN 1 AND 5
       AND (u.last_login_at IS NULL OR u.last_login_at < now() - interval '24 hours')
       AND NOT EXISTS (
         SELECT 1 FROM public.notifications n
          WHERE n.recipient_id = u.id
            AND n.type = 'level_up_imminent'
            AND n.created_at > now() - interval '7 days'
       );
  $$
);
```

- [ ] **Step 2: Appliquer + vérif**

```bash
pnpm dlx supabase db push
```

```sql
SELECT jobname, schedule FROM cron.job WHERE jobname = 'level_up_imminent_check';
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/145_push_cron_level_up_imminent.sql
git commit -m "feat(push): pg_cron daily 17h UTC level-up imminent (xp-based)"
```

---

### Task 18: Cron récap hebdo nouveaux lieux (lundi 8h UTC)

**Files:**
- Create: `supabase/migrations/146_push_cron_weekly_new_places.sql`

- [ ] **Step 1: Créer la migration**

```sql
-- 146_push_cron_weekly_new_places.sql
-- WHY : push hebdomadaire lundi 8h UTC. Notifie les users push_recap_enabled
-- du nombre de nouveaux lieux ajoutés la semaine passée + sample de 3 noms.
-- Seuil min 3 nouveaux lieux pour éviter pings creux.

SELECT cron.unschedule('weekly_new_places_recap')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly_new_places_recap');

SELECT cron.schedule(
  'weekly_new_places_recap',
  '0 8 * * 1',
  $$
    WITH new_places AS (
      SELECT name FROM public.places
       WHERE created_at >= now() - interval '7 days'
         AND private = false AND masked = false
       ORDER BY created_at DESC
       LIMIT 100
    ),
    sample AS (
      SELECT (SELECT count(*) FROM new_places) AS n,
             (SELECT string_agg(name, ', ')
                FROM (SELECT name FROM new_places LIMIT 3) s) AS sample_names
    )
    INSERT INTO public.notifications (recipient_id, type, data)
    SELECT u.id, 'weekly_new_places_recap',
           jsonb_build_object('count', sample.n, 'sample_names_csv', sample.sample_names)
      FROM public.users u, sample
     WHERE sample.n >= 3
       AND u.push_recap_enabled = true
       AND u.is_active = true;
  $$
);
```

- [ ] **Step 2: Appliquer + vérif**

```bash
pnpm dlx supabase db push
```

```sql
SELECT jobname, schedule FROM cron.job WHERE jobname = 'weekly_new_places_recap';
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/146_push_cron_weekly_new_places.sql
git commit -m "feat(push): pg_cron weekly Monday 8h UTC new places recap"
```

---

## Phase 8 — Test E2E + déploiement + doc

### Task 19: Test E2E manuel desktop (Chrome)

**Files:** (no file change — manual test)

- [ ] **Step 1: Build + deploy front sur preview Netlify**

```bash
cd "/c/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/explore-web"
pnpm build
netlify deploy --dir "$PWD/dist" --no-build
```
Récupérer l'URL de preview.

- [ ] **Step 2: Smoke test desktop**

1. Ouvrir l'URL de preview dans Chrome (incognito).
2. Login avec compte de test.
3. Soumettre l'énigme du jour (ou créer une expé).
4. Vérifier que la modale `PushPermissionModal` apparaît.
5. Cliquer "Activer", autoriser dans le prompt navigateur.
6. Vérifier dans devtools → Application → Service Workers que le SW custom est actif.
7. Vérifier dans la table Supabase `push_subscriptions` qu'une row a été créée pour ce user.

- [ ] **Step 3: Trigger un push depuis Supabase SQL Editor**

```sql
INSERT INTO public.notifications (recipient_id, type, data)
VALUES ('<user_id_test>', 'daily_enigma_ready', '{}'::jsonb);
```
Expected: dans les ~5 secondes, une notification système apparaît avec le titre "Ton énigme du jour" et le body "Le coffre t'attend.". Cliquer dessus ouvre/focus la tab à `/?enigma=daily`.

- [ ] **Step 4: Vérifier les logs Edge Function**

Supabase Dashboard → Logs → Functions → send-push : ligne 200, pas d'erreur.

- [ ] **Step 5: Test cleanup 410**

Aller dans Chrome → Settings → Privacy → Site Settings → Notifications → trouver le site et révoquer.
Insérer une nouvelle notif :
```sql
INSERT INTO public.notifications (recipient_id, type, data)
VALUES ('<user_id_test>', 'daily_enigma_ready', '{}'::jsonb);
```
Expected: Edge Function loggue 410, la row dans `push_subscriptions` est supprimée. Vérifier :
```sql
SELECT count(*) FROM push_subscriptions WHERE user_id = '<user_id_test>';
```
→ devrait être 0.

- [ ] **Step 6: Pas de commit**

---

### Task 20: Test E2E manuel iOS Safari (si iPhone dispo)

**Files:** (no file change — manual test)

- [ ] **Step 1: Tester sur iPhone Safari (sans install)**

1. Ouvrir l'URL preview dans Safari iOS.
2. Login.
3. Soumettre énigme.
4. Vérifier que la modale `IOSInstallGuideModal` apparaît (pas la modale permission classique).
5. Cliquer "J'ai compris", vérifier qu'elle se ferme.

- [ ] **Step 2: Tester en mode standalone**

1. Sur Safari iOS : Partager → Sur l'écran d'accueil → Ajouter.
2. Lancer l'app depuis l'écran d'accueil.
3. Login, soumettre énigme.
4. Vérifier `PushPermissionModal` (mode native) apparaît.
5. Activer, vérifier que la sub apparaît en DB.
6. Trigger push depuis SQL Editor.
7. Notification iOS visible.

Si pas d'iPhone disponible : skip ce test et noter dans CHANGELOG. À retester avant deploy prod.

- [ ] **Step 3: Pas de commit**

---

### Task 21: Update CLAUDE.md explore-web + déploiement prod

**Files:**
- Modify: `apps/explore-web/CLAUDE.md`

- [ ] **Step 1: Ajouter section push notifications dans CLAUDE.md**

Insérer dans la section "Spécificités cette app" :

```md
- **V0.7.7 (mai 2026) : Push Notifications**. Système push V1 — 6 types
  pushés (énigme du jour, message expé, lieu pris/repris/réaffirmé, level-up
  imminent, récap hebdo). Edge Function `supabase/functions/send-push` (Deno
  + npm:web-push). Subscriptions stockées dans `push_subscriptions`. Trigger
  SQL `AFTER INSERT ON notifications` → `pg_net.http_post`. Cron jobs (mig
  144-146) pour les triggers scheduled. Hook `useEnsurePushPermission` +
  composant `PushPromptHost` (modal opt-in well-timed) + `IOSInstallGuideModal`
  (iOS standalone requirement). 2 toggles préférences dans
  `users.push_important_enabled` / `users.push_recap_enabled`. Service
  Worker custom `src/sw.ts` (vite-plugin-pwa mode `injectManifest`). Stack :
  VAPID keys dans Supabase secrets, public key exposée via
  `VITE_VAPID_PUBLIC_KEY`. Spec : `docs/superpowers/specs/2026-05-09-push-notifications-design.md`.
  Plan : `docs/superpowers/plans/2026-05-09-push-notifications.md`.
```

- [ ] **Step 2: Bump version frontend (préférence globale)**

Trouver `apps/explore-web/src/lib/version.ts` ou équivalent :
```bash
grep -rE "APP_VERSION\s*=|version:" apps/explore-web/src/lib/ | head -5
```
Bumper le patch (ex: `0.7.6` → `0.7.7`).

- [ ] **Step 3: Build + deploy prod**

```bash
cd "/c/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/apps/explore-web"
pnpm build
netlify deploy --prod --dir "$PWD/dist" --no-build
```

- [ ] **Step 4: Smoke test prod**

Ouvrir `https://carte.runesdechene.com`, login compte test, vérifier que tout marche end-to-end (énigme submit → modale → activation → push reçu).

- [ ] **Step 5: Commit final**

```bash
git add apps/explore-web/CLAUDE.md apps/explore-web/src/lib/version.ts
git commit -m "feat(push): V0.7.7 — push notifications V1 in production

- 6 types pushés (énigme du jour, message expé, lieu contesté/repris, level-up imminent, récap hebdo)
- Edge Function send-push (Deno + web-push)
- Crons matinal (énigme), 17h UTC (level-up), lundi (hebdo)
- Hook useEnsurePushPermission + modale opt-in well-timed
- iOS install guide pour Safari non-standalone
- 2 toggles préférences (Important / Récap)

Spec: docs/superpowers/specs/2026-05-09-push-notifications-design.md
Plan: docs/superpowers/plans/2026-05-09-push-notifications.md"
```

- [ ] **Step 6: Push**

```bash
git push origin main
```

---

## Récap des migrations SQL produites

| # | Fichier | Rôle |
|---|---|---|
| 141 | `141_push_subscriptions_table.sql` | Table push_subscriptions + RLS + 2 colonnes users |
| 142 | `142_push_trigger_on_notification.sql` | pg_net + trigger AFTER INSERT |
| 143 | `143_push_seed_app_config.sql` | Seed clés app_config (placeholders, replace en prod) |
| 144 | `144_push_cron_daily_enigma.sql` | Cron 12h30 Europe/Paris énigme du jour (DST-safe) |
| 145 | `145_push_cron_level_up_imminent.sql` | Cron 17h UTC level-up imminent (xp-based) |
| 146 | `146_push_cron_weekly_new_places.sql` | Cron lundi 8h UTC récap hebdo |

## Récap des fichiers TS/TSX produits

| Fichier | Rôle |
|---|---|
| `supabase/functions/send-push/index.ts` | Entry Edge Function |
| `supabase/functions/send-push/categories.ts` | Mapping type → catégorie |
| `supabase/functions/send-push/payloads.ts` | Format payload par type |
| `supabase/functions/send-push/payloads.test.ts` | Tests unit Deno |
| `supabase/functions/send-push/deno.json` | Deno deps |
| `apps/explore-web/src/sw.ts` | Service Worker custom (push + click) |
| `apps/explore-web/src/lib/pushNotifications.ts` | subscribe/unsubscribe/sync/support |
| `apps/explore-web/src/hooks/useEnsurePushPermission.tsx` | Hook + Host + Sync component |
| `apps/explore-web/src/components/notifications/PushPermissionModal.tsx` | Modale opt-in |
| `apps/explore-web/src/components/notifications/IOSInstallGuideModal.tsx` | Modale install iOS |
| `apps/explore-web/src/components/notifications/PushSettings.tsx` | 2 toggles + master toggle |

## Récap fichiers modifiés

- `apps/explore-web/vite.config.ts` (mode injectManifest)
- `apps/explore-web/.env.example` (VAPID public key)
- `apps/explore-web/package.json` + `pnpm-lock.yaml` (deps workbox-*)
- `apps/explore-web/src/pages/MapPage.tsx` (mount PushPromptHost + Sync)
- `apps/explore-web/src/components/auth/ProfileMenu.tsx` (insère PushSettings)
- `apps/explore-web/src/components/enigma/DailyEnigma.tsx` (ensurePush après submit)
- `apps/explore-web/src/components/expeditions/ExpeditionCreator.tsx` (ensurePush après création)
- `apps/explore-web/CLAUDE.md` (section push notifs + bump version)
- `apps/explore-web/src/lib/version.ts` (ou équivalent — bump patch)
