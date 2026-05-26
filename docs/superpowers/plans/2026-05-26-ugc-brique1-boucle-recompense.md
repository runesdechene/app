# Brique 1 — Boucle de récompense UGC + glow-up formulaire + email d'acceptation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Récompenser chaque contribution UGC validée (Couronnes + compteur Contributions), offrir un bonus de bienvenue unique à la création de compte, prévenir le contributeur par email d'acceptation (Resend), et refondre l'écran de fin des formulaires en CTA de conversion.

**Architecture:** Tout passe par la DB. Le crédit Couronnes + l'incrément du compteur + l'insertion d'une notif `contribution_approved` se font **dans les RPC de modération** (`moderate_submission`, `moderate_review`), de façon **idempotente** (champ `rewarded_at` — re-valider un archivé ne re-paie pas). Le bonus de bienvenue est crédité dans `create_user_from_submission` (appelée uniquement pour un compte neuf → unique par construction). La notif déclenche le pipeline existant : trigger `push_on_notification` (existant, no-op gracieux pour ce type) **+** nouveau trigger `email_on_notification` → nouvelle edge function `send-email` (Resend). Les montants vivent dans `app_settings` (tunables, jamais codés en dur). L'écran de fin lit les montants via une RPC publique et affiche un message honnête (bonus offert + validation en attente + CTA appli).

**Tech Stack:** PostgreSQL/plpgsql (Supabase), edge function Deno + API REST Resend, React 18 + Vite + TS strict (hub), `pg_net` (déjà installé), table KV `app_settings`.

---

## Référence — états actuels (verbatim baseline, à étendre)

`moderate_submission` (baseline 001, ligne 4754) :
```sql
CREATE OR REPLACE FUNCTION "public"."moderate_submission"("p_submission_id" "uuid", "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE hub_photo_submissions SET status = p_status, moderated_at = NOW() WHERE id = p_submission_id;
END;
$$;
```

`moderate_review` (baseline 001, ligne 4737) :
```sql
CREATE OR REPLACE FUNCTION "public"."moderate_review"("p_review_id" "uuid", "p_status" "text", "p_rejection_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE hub_review_submissions SET status = p_status, moderated_at = NOW(), rejection_reason = p_rejection_reason WHERE id = p_review_id;
END;
$$;
```

`create_user_from_submission` (baseline 001, ligne 1858) :
```sql
CREATE OR REPLACE FUNCTION "public"."create_user_from_submission"("p_id" character varying, "p_email" "text", "p_first_name" "text", "p_instagram" "text", "p_location_name" "text" DEFAULT NULL::"text", "p_location_zip" "text" DEFAULT NULL::"text") RETURNS character varying
    LANGUAGE "plpgsql" SECURITY DEFINER SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO users (id, email_address, first_name, instagram, location_name, location_zip, role, is_active, rank, biography)
  VALUES (p_id, p_email, p_first_name, p_instagram, p_location_name, p_location_zip, 'user', true, 0, '');
  RETURN p_id;
END;
$$;
```

Faits vérifiés : `user_crowns(user_id text PK, balance int CHECK 0..500, updated_at)` — crédit via UPSERT `LEAST(500, balance + gain)` (pattern mig 080). `notifications(id serial, recipient_id text, type text, data jsonb, read, created_at)` — INSERT sans `id` OK (mig 097). `app_settings(key, value)` PK `key`. Trigger push : `trigger_push_on_notification()` POST vers `edge_function_send_push_url` avec `X-Push-Secret` (mig 142).

## File Structure

- **Create** `supabase/migrations/175_ugc_reward_loop.sql` — colonnes, seeds app_settings, redéf des 3 RPC, nouvelle RPC `get_ugc_reward_config`, trigger email.
- **Create** `supabase/functions/send-email/index.ts` — edge function Resend (miroir de `send-push`).
- **Modify** `apps/hub/src/components/PhotoSubmit.tsx` — fetch config + écran de fin refondu.
- **Modify** `apps/hub/src/components/ReviewSubmit.tsx` — fetch config + écran de fin refondu.
- **Modify** `apps/hub/src/components/PublicForm.css` — styles de l'écran de fin (badge Couronnes, CTA).

**Note testing** : ce repo n'a pas de runner de tests TS frontend. La vérification SQL se fait via le MCP Supabase (`execute_sql` sur une branche de dev) ; l'edge function via `supabase functions serve` + curl ; le frontend via `pnpm --filter hub build` (tsc strict) + checklist manuelle. C'est la discipline du projet (xo-discipline E1).

---

### Task 1 : Migration — schéma, seeds, RPC, trigger email

**Files:**
- Create: `supabase/migrations/175_ugc_reward_loop.sql`

> **MAJ 2026-05-26 (décision D5bis)** : la migration livrée inclut en plus un **bonus « première contribution »** (`app_settings.ugc_first_contribution_crowns`, défaut 100). Les RPC `moderate_submission`/`moderate_review` lisent `contributions_count` avant l'incrément : si `= 0`, elles ajoutent ce bonus à `v_reward`. La notif `data.crowns` reflète le **total** crédité (pour que l'email affiche le bon montant). Le fichier `175_ugc_reward_loop.sql` réel est la source de vérité.

- [ ] **Step 1 : Écrire la migration complète**

```sql
-- 175_ugc_reward_loop.sql
-- WHY : Brique 1 du modèle UGC "Le Mouvement" (spec 2026-05-26-ugc-mouvement-model-design).
-- Récompense la contribution validée : Couronnes (cap 500) + compteur Contributions,
-- crédités À LA VALIDATION et de façon IDEMPOTENTE (rewarded_at). Bonus de bienvenue
-- unique à la création de compte. Notif contribution_approved → push (existant) + email.
-- Gloire volontairement EXCLUE (anti-triche, mig 024). Montants pilotés par app_settings.

-- ============================================================
-- SCHÉMA
-- ============================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS contributions_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.hub_photo_submissions
  ADD COLUMN IF NOT EXISTS rewarded_at timestamptz;
ALTER TABLE public.hub_review_submissions
  ADD COLUMN IF NOT EXISTS rewarded_at timestamptz;

-- ============================================================
-- CONFIG (montants tunables + secrets email ; PLACEHOLDER = renseignés post-deploy)
-- Montants de départ (50 / 20) — à ajuster par Uriel.
-- ============================================================
INSERT INTO public.app_settings (key, value) VALUES
  ('ugc_welcome_crowns',          '50'),
  ('ugc_reward_crowns',           '20'),
  ('email_from',                  'Runes de Chêne <communaute@runesdechene.com>'),
  ('email_trigger_secret',        'PLACEHOLDER_set_after_deploy'),
  ('edge_function_send_email_url','PLACEHOLDER_set_after_deploy'),
  ('resend_api_key',              'PLACEHOLDER_set_in_dashboard')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- RPC : bonus de bienvenue (copie baseline + crédit unique)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_user_from_submission(p_id character varying, p_email text, p_first_name text, p_instagram text, p_location_name text DEFAULT NULL, p_location_zip text DEFAULT NULL)
RETURNS character varying
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_welcome int;
BEGIN
  INSERT INTO users (id, email_address, first_name, instagram, location_name, location_zip, role, is_active, rank, biography)
  VALUES (p_id, p_email, p_first_name, p_instagram, p_location_name, p_location_zip, 'user', true, 0, '');

  SELECT COALESCE(value::int, 0) INTO v_welcome FROM app_settings WHERE key = 'ugc_welcome_crowns';
  IF v_welcome > 0 THEN
    INSERT INTO public.user_crowns (user_id, balance, updated_at)
    VALUES (p_id, LEAST(500, v_welcome), now())
    ON CONFLICT (user_id) DO UPDATE SET
      balance = LEAST(500, public.user_crowns.balance + v_welcome),
      updated_at = now();
  END IF;

  RETURN p_id;
END;
$$;

-- ============================================================
-- RPC : modération photos (copie baseline + récompense idempotente à l'approbation)
-- ============================================================
CREATE OR REPLACE FUNCTION public.moderate_submission(p_submission_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id  text;
  v_rewarded timestamptz;
  v_reward   int;
BEGIN
  UPDATE hub_photo_submissions
  SET status = p_status, moderated_at = NOW()
  WHERE id = p_submission_id
  RETURNING user_id, rewarded_at INTO v_user_id, v_rewarded;

  IF p_status = 'approved' AND v_rewarded IS NULL AND v_user_id IS NOT NULL THEN
    SELECT COALESCE(value::int, 0) INTO v_reward FROM app_settings WHERE key = 'ugc_reward_crowns';
    IF v_reward > 0 THEN
      INSERT INTO public.user_crowns (user_id, balance, updated_at)
      VALUES (v_user_id, LEAST(500, v_reward), now())
      ON CONFLICT (user_id) DO UPDATE SET
        balance = LEAST(500, public.user_crowns.balance + v_reward),
        updated_at = now();
    END IF;
    UPDATE users SET contributions_count = contributions_count + 1 WHERE id = v_user_id;
    UPDATE hub_photo_submissions SET rewarded_at = now() WHERE id = p_submission_id;
    INSERT INTO notifications (recipient_id, type, data)
    VALUES (v_user_id, 'contribution_approved',
            jsonb_build_object('kind','photo','submission_id',p_submission_id,'crowns',v_reward));
  END IF;
END;
$$;

-- ============================================================
-- RPC : modération avis (copie baseline + même récompense idempotente)
-- ============================================================
CREATE OR REPLACE FUNCTION public.moderate_review(p_review_id uuid, p_status text, p_rejection_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id  text;
  v_rewarded timestamptz;
  v_reward   int;
BEGIN
  UPDATE hub_review_submissions
  SET status = p_status, moderated_at = NOW(), rejection_reason = p_rejection_reason
  WHERE id = p_review_id
  RETURNING user_id, rewarded_at INTO v_user_id, v_rewarded;

  IF p_status = 'approved' AND v_rewarded IS NULL AND v_user_id IS NOT NULL THEN
    SELECT COALESCE(value::int, 0) INTO v_reward FROM app_settings WHERE key = 'ugc_reward_crowns';
    IF v_reward > 0 THEN
      INSERT INTO public.user_crowns (user_id, balance, updated_at)
      VALUES (v_user_id, LEAST(500, v_reward), now())
      ON CONFLICT (user_id) DO UPDATE SET
        balance = LEAST(500, public.user_crowns.balance + v_reward),
        updated_at = now();
    END IF;
    UPDATE users SET contributions_count = contributions_count + 1 WHERE id = v_user_id;
    UPDATE hub_review_submissions SET rewarded_at = now() WHERE id = p_review_id;
    INSERT INTO notifications (recipient_id, type, data)
    VALUES (v_user_id, 'contribution_approved',
            jsonb_build_object('kind','review','submission_id',p_review_id,'crowns',v_reward));
  END IF;
END;
$$;

-- ============================================================
-- RPC publique : config récompense (lue par les formulaires pour afficher les vrais montants)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_ugc_reward_config()
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'welcome_crowns', COALESCE((SELECT value::int FROM app_settings WHERE key = 'ugc_welcome_crowns'), 0),
    'reward_crowns',  COALESCE((SELECT value::int FROM app_settings WHERE key = 'ugc_reward_crowns'), 0)
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_ugc_reward_config() TO anon, authenticated, service_role;

-- ============================================================
-- TRIGGER EMAIL (miroir du trigger push mig 142, canal indépendant)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_email_on_notification()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, net, extensions
AS $$
DECLARE
  v_url    text;
  v_secret text;
BEGIN
  SELECT value INTO v_url    FROM public.app_settings WHERE key = 'edge_function_send_email_url';
  SELECT value INTO v_secret FROM public.app_settings WHERE key = 'email_trigger_secret';

  IF v_url IS NULL OR v_secret IS NULL OR v_url LIKE 'PLACEHOLDER%' OR v_secret LIKE 'PLACEHOLDER%' THEN
    RAISE WARNING 'email trigger: config missing or placeholder, skipping email for notification %', NEW.id;
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type','application/json','X-Email-Secret',v_secret),
    body    := jsonb_build_object('notification_id',NEW.id,'recipient_id',NEW.recipient_id,'type',NEW.type,'data',NEW.data)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_on_notification ON public.notifications;
CREATE TRIGGER email_on_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_email_on_notification();
```

- [ ] **Step 2 : Appliquer sur une branche de dev Supabase**

Via le MCP Supabase : `create_branch` (si pas déjà une branche de dev), puis `apply_migration` avec le contenu de `175_ugc_reward_loop.sql`.
Expected: succès, aucune erreur de syntaxe.

- [ ] **Step 3 : Tester le bonus de bienvenue (execute_sql sur la branche)**

```sql
SELECT public.create_user_from_submission('test-ugc-1','test-ugc-1@example.com','Testeur',NULL);
SELECT balance FROM public.user_crowns WHERE user_id = 'test-ugc-1';
```
Expected: `balance = 50`.

- [ ] **Step 4 : Tester la récompense à l'approbation + idempotence**

```sql
-- créer une soumission photo de test pour ce user
INSERT INTO public.hub_photo_submissions (user_id, submitter_name, submitter_email, status)
VALUES ('test-ugc-1','Testeur','test-ugc-1@example.com','pending') RETURNING id;
-- (remplacer <ID> par l'id retourné)
SELECT public.moderate_submission('<ID>','approved');
SELECT balance FROM public.user_crowns WHERE user_id='test-ugc-1';          -- attendu 170 (50 bienvenue + 20 reward + 100 1re contribution)
SELECT contributions_count FROM public.users WHERE id='test-ugc-1';          -- attendu 1
-- ré-approbation : ne doit PAS re-payer
SELECT public.moderate_submission('<ID>','archived');
SELECT public.moderate_submission('<ID>','approved');
SELECT balance, contributions_count FROM public.user_crowns c JOIN public.users u ON u.id=c.user_id WHERE c.user_id='test-ugc-1';
```
Expected: après ré-approbation, `balance` reste **170** et `contributions_count` reste **1** (idempotent via `rewarded_at`).

- [ ] **Step 5 : Vérifier la notif émise**

```sql
SELECT type, data FROM public.notifications WHERE recipient_id='test-ugc-1' ORDER BY id DESC LIMIT 1;
```
Expected: `type = 'contribution_approved'`, `data` contient `kind: photo`, `crowns: 20`.

- [ ] **Step 6 : Nettoyer les données de test**

```sql
DELETE FROM public.notifications WHERE recipient_id='test-ugc-1';
DELETE FROM public.hub_photo_submissions WHERE user_id='test-ugc-1';
DELETE FROM public.user_crowns WHERE user_id='test-ugc-1';
DELETE FROM public.users WHERE id='test-ugc-1';
```
Expected: 0 ligne restante.

- [ ] **Step 7 : Commit**

```bash
git add supabase/migrations/175_ugc_reward_loop.sql
git commit -m "feat(ugc): boucle recompense a la validation + bonus bienvenue (mig 175)"
```

---

### Task 2 : Edge function `send-email` (Resend)

**Files:**
- Create: `supabase/functions/send-email/index.ts`

- [ ] **Step 1 : Écrire l'edge function (miroir de send-push)**

```ts
// Supabase Edge Function : send-email
// POST appelé par le trigger SQL email_on_notification (after INSERT ON notifications).
// - Lit resend_api_key + email_from + email_trigger_secret depuis app_settings (tout en DB).
// - Vérifie X-Email-Secret. Brique 1 : ne gère que le type 'contribution_approved'.
// - Envoie via l'API REST Resend. Spec : docs/superpowers/specs/2026-05-26-ugc-mouvement-model-design.md
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

interface RequestBody {
  notification_id: number
  recipient_id:    string
  type:            string
  data:            Record<string, unknown>
}
interface EmailConfig {
  resend_api_key:       string
  email_from:           string
  email_trigger_secret: string
}

let cachedConfig: EmailConfig | null = null
async function loadConfig(): Promise<EmailConfig | null> {
  if (cachedConfig) return cachedConfig
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['resend_api_key', 'email_from', 'email_trigger_secret'])
  if (error || !data) { console.error('app_settings_lookup_failed', error); return null }
  const map = Object.fromEntries(data.map((r) => [r.key, r.value])) as Record<string, string>
  if (!map.resend_api_key || !map.email_from || !map.email_trigger_secret) {
    console.error('app_settings_missing_keys', Object.keys(map)); return null
  }
  cachedConfig = {
    resend_api_key:       map.resend_api_key,
    email_from:           map.email_from,
    email_trigger_secret: map.email_trigger_secret,
  }
  return cachedConfig
}

const ok = () => new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })

function renderContributionApproved(firstName: string, crowns: number): { subject: string; html: string } {
  const name = firstName?.trim() || 'Ami du Mouvement'
  return {
    subject: 'Ta contribution rejoint le Mouvement ⚜️',
    html: `<!doctype html><html><body style="margin:0;background:#f4efe6;font-family:Georgia,serif;color:#2b2218">
  <div style="max-width:560px;margin:0 auto;padding:40px 28px">
    <h1 style="font-size:24px;margin:0 0 8px">Merci, ${name}.</h1>
    <p style="font-size:16px;line-height:1.6">Ta contribution a été adoubée par notre équipe et rejoint <strong>Le Mouvement Runes de Chêne</strong>.</p>
    <div style="margin:24px 0;padding:18px 22px;background:#2b2218;color:#e9d9b6;border-radius:10px;text-align:center">
      <div style="font-size:14px;letter-spacing:.05em;text-transform:uppercase;opacity:.8">Récompense créditée</div>
      <div style="font-size:28px;font-weight:bold;margin-top:4px">+${crowns} Couronnes de Chêne</div>
    </div>
    <p style="font-size:16px;line-height:1.6">Elles t'attendent sur <strong>La Carte</strong>, notre application communautaire.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="https://app.runesdechene.com" style="display:inline-block;background:#8a6d3b;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:16px">Récupérer mes Couronnes →</a>
    </p>
    <p style="font-size:13px;color:#8a7d68;line-height:1.5">Tu reçois cet email parce que tu as partagé du contenu avec Runes de Chêne. À très vite sur les chemins.</p>
  </div></body></html>`,
  }
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })
  const config = await loadConfig()
  if (!config) return new Response('config not loaded', { status: 503 })

  const providedSecret = req.headers.get('x-email-secret')
  if (providedSecret !== config.email_trigger_secret) return new Response('unauthorized', { status: 401 })

  let body: RequestBody
  try { body = await req.json() as RequestBody } catch { return new Response('bad json', { status: 400 }) }

  if (body.type !== 'contribution_approved') return ok()

  const { data: user, error } = await supabase
    .from('users')
    .select('email_address, first_name')
    .eq('id', body.recipient_id)
    .single()
  if (error || !user?.email_address) { console.warn('user_lookup_failed', error); return ok() }

  const crowns = Number((body.data as { crowns?: number })?.crowns ?? 0)
  const { subject, html } = renderContributionApproved(user.first_name ?? '', crowns)

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${config.resend_api_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.email_from, to: user.email_address, subject, html }),
  })
  if (!resp.ok) {
    console.error('resend_failed', resp.status, await resp.text())
    return ok()
  }
  console.log('email_sent_ok', { recipient_id: body.recipient_id })
  return ok()
})
```

- [ ] **Step 2 : Déployer l'edge function**

Run: `npx supabase functions deploy send-email --no-verify-jwt`
Expected: déploiement OK, l'URL de la fonction est affichée (forme `https://<ref>.supabase.co/functions/v1/send-email`).

- [ ] **Step 3 : Renseigner la config post-deploy dans app_settings**

Prérequis manuel : générer une clé API Resend (`re_...`) dans le compte Resend (domaine déjà vérifié via la connexion Supabase). Choisir un secret partagé fort pour `email_trigger_secret`.
```sql
UPDATE public.app_settings SET value = '<URL de send-email>'        WHERE key = 'edge_function_send_email_url';
UPDATE public.app_settings SET value = '<secret partagé fort>'      WHERE key = 'email_trigger_secret';
UPDATE public.app_settings SET value = 're_xxxxxxxxxxxx'            WHERE key = 'resend_api_key';
```
Expected: 3 lignes mises à jour.

- [ ] **Step 4 : Tester l'envoi en direct (curl)**

```bash
curl -i -X POST "<URL de send-email>" \
  -H "Content-Type: application/json" \
  -H "X-Email-Secret: <secret partagé fort>" \
  -d '{"notification_id":1,"recipient_id":"<un user_id réel avec email>","type":"contribution_approved","data":{"kind":"photo","crowns":20}}'
```
Expected: HTTP 200 `{"ok":true}` ; l'email arrive dans la boîte de l'utilisateur ; log `email_sent_ok` côté Supabase (`get_logs`).
Test négatif : même appel avec un mauvais `X-Email-Secret` → HTTP 401.

- [ ] **Step 5 : Commit**

```bash
git add supabase/functions/send-email/index.ts
git commit -m "feat(ugc): edge function send-email (Resend) pour email d'acceptation"
```

---

### Task 3 : Glow-up écran de fin — PhotoSubmit

**Files:**
- Modify: `apps/hub/src/components/PhotoSubmit.tsx`
- Modify: `apps/hub/src/components/PublicForm.css`

- [ ] **Step 1 : Charger la config de récompense au montage**

Dans `PhotoSubmit`, après la déclaration des `useState` existants (vers la ligne 119, après `fileInputRef`), ajouter l'état + le fetch. Ajouter `useEffect` à l'import React ligne 1 (`import { useState, useRef, useEffect } from "react";`).
```tsx
  const [rewardConfig, setRewardConfig] = useState<{ welcome_crowns: number; reward_crowns: number }>({ welcome_crowns: 0, reward_crowns: 0 });

  useEffect(() => {
    supabase.rpc("get_ugc_reward_config").then(({ data }) => {
      if (data) setRewardConfig(data as { welcome_crowns: number; reward_crowns: number });
    });
  }, []);
```

- [ ] **Step 2 : Remplacer le bloc `if (step === "success")` (lignes 317-350)**

```tsx
  if (step === "success") {
    return (
      <div className="submit-page">
        <div className="submit-card success-card">
          <div className="success-icon">⚜️</div>
          <h2>Bienvenue dans le Mouvement !</h2>
          <p>
            Vos photos partent en validation. Dès qu'elles sont adoubées par notre équipe,
            <strong> {rewardConfig.reward_crowns} Couronnes de Chêne</strong> atterrissent dans votre compte —
            on vous prévient par email.
          </p>
          {isNewAccount && rewardConfig.welcome_crowns > 0 && (
            <div className="reward-badge">
              <span className="reward-badge-label">Cadeau de bienvenue</span>
              <span className="reward-badge-amount">+{rewardConfig.welcome_crowns} Couronnes</span>
            </div>
          )}
          <div className="account-info-box">
            {isNewAccount ? (
              <p>
                Votre compte <strong>Runes de Chêne</strong> ({form.email}) vient d'être créé.
                Retrouvez vos Couronnes et la communauté sur l'application <strong>La Carte</strong>.
              </p>
            ) : (
              <p>
                Vos photos sont rattachées à votre compte <strong>Runes de Chêne</strong> ({form.email}).
                Retrouvez vos Couronnes et la communauté sur l'application <strong>La Carte</strong>.
              </p>
            )}
          </div>
          <a href="https://app.runesdechene.com" target="_blank" rel="noopener noreferrer" className="btn-primary">
            Découvrir La Carte →
          </a>
          <button onClick={resetForm} className="btn-secondary">
            Envoyer d'autres photos
          </button>
        </div>
      </div>
    );
  }
```

- [ ] **Step 3 : Ajouter les styles du badge + bouton secondaire**

À la fin de `apps/hub/src/components/PublicForm.css`, ajouter :
```css
.reward-badge {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  margin: 18px auto; padding: 16px 24px; max-width: 320px;
  background: #2b2218; color: #e9d9b6; border-radius: 12px;
}
.reward-badge-label { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; opacity: .8; }
.reward-badge-amount { font-size: 24px; font-weight: 700; }
.btn-secondary {
  display: inline-block; margin-top: 12px; background: transparent;
  border: 1px solid #8a6d3b; color: #8a6d3b; padding: 10px 20px;
  border-radius: 8px; cursor: pointer; font-size: 14px;
}
```

- [ ] **Step 4 : Vérifier le build**

Run: `pnpm --filter hub build`
Expected: build OK, aucune erreur TS strict.

- [ ] **Step 5 : Vérification manuelle**

Run: `pnpm --filter hub dev` → ouvrir `/soumettre-contenu` → soumettre une photo avec un email neuf.
Expected: écran de fin affiche le badge « +50 Couronnes » (compte neuf), le message de validation en attente, et le CTA « Découvrir La Carte ».

- [ ] **Step 6 : Commit**

```bash
git add apps/hub/src/components/PhotoSubmit.tsx apps/hub/src/components/PublicForm.css
git commit -m "feat(ugc): ecran de fin PhotoSubmit en CTA conversion + badge Couronnes"
```

---

### Task 4 : Glow-up écran de fin — ReviewSubmit

**Files:**
- Modify: `apps/hub/src/components/ReviewSubmit.tsx`

- [ ] **Step 1 : Charger la config (import + état + effet)**

Ligne 1 : `import { useState, useRef, useEffect } from 'react'`.
Après les `useState` existants (vers ligne 49, après `fileInputRef`) :
```tsx
  const [rewardConfig, setRewardConfig] = useState<{ welcome_crowns: number; reward_crowns: number }>({ welcome_crowns: 0, reward_crowns: 0 })

  useEffect(() => {
    supabase.rpc('get_ugc_reward_config').then(({ data }) => {
      if (data) setRewardConfig(data as { welcome_crowns: number; reward_crowns: number })
    })
  }, [])
```

- [ ] **Step 2 : Remplacer le bloc `if (step === 'success')` (lignes 180-199)**

```tsx
  if (step === 'success') {
    return (
      <div className="submit-page">
        <div className="submit-card success-card">
          <div className="success-icon">⚜️</div>
          <h2>Merci pour votre avis !</h2>
          <p>
            Votre avis part en validation. Dès qu'il est adoubé par notre équipe,
            <strong> {rewardConfig.reward_crowns} Couronnes de Chêne</strong> atterrissent dans votre compte —
            on vous prévient par email.
          </p>
          {isNewAccount && rewardConfig.welcome_crowns > 0 && (
            <div className="reward-badge">
              <span className="reward-badge-label">Cadeau de bienvenue</span>
              <span className="reward-badge-amount">+{rewardConfig.welcome_crowns} Couronnes</span>
            </div>
          )}
          <div className="account-info-box">
            {isNewAccount
              ? <p>Votre compte <strong>Runes de Chêne</strong> ({form.email}) vient d'être créé. Retrouvez vos Couronnes et la communauté sur l'application <strong>La Carte</strong>.</p>
              : <p>Votre avis est rattaché à votre compte <strong>Runes de Chêne</strong> ({form.email}). Retrouvez vos Couronnes et la communauté sur l'application <strong>La Carte</strong>.</p>
            }
          </div>
          <a href="https://app.runesdechene.com" target="_blank" rel="noopener noreferrer" className="btn-primary">
            Découvrir La Carte →
          </a>
        </div>
      </div>
    )
  }
```

- [ ] **Step 3 : Vérifier le build**

Run: `pnpm --filter hub build`
Expected: build OK, aucune erreur TS strict.

- [ ] **Step 4 : Commit**

```bash
git add apps/hub/src/components/ReviewSubmit.tsx
git commit -m "feat(ugc): ecran de fin ReviewSubmit en CTA conversion + badge Couronnes"
```

---

### Task 5 : Vérification end-to-end + bascule prod

**Files:** (aucun — vérification + déploiement)

- [ ] **Step 1 : Appliquer la migration en prod**

Run: `npx supabase db push` (xo-discipline B5 : appliquer soi-même).
Expected: migration 175 appliquée sans erreur.

- [ ] **Step 2 : Renseigner la config prod**

Refaire le Step 3 de la Task 2 (URL send-email prod, secret, clé Resend) en prod via `execute_sql`.
Expected: les 3 valeurs PLACEHOLDER remplacées.

- [ ] **Step 3 : Déployer le hub**

Run: `cd apps/hub && netlify deploy --prod --dir "$PWD/dist" --functions "$PWD/netlify/functions" --no-build` (après `pnpm --filter hub build`).
Expected: déploiement prod OK.

- [ ] **Step 4 : Parcours réel de bout en bout**

Soumettre une vraie photo via `https://hub.runesdechene.com/soumettre-contenu` (email réel neuf) → vérifier l'écran de fin (badge +50) → valider la soumission dans le hub (`Photos.tsx` → Valider) → vérifier :
- `user_crowns.balance` = welcome + reward
- `users.contributions_count` = 1
- réception de l'email d'acceptation
- log `email_sent_ok` (`get_logs`)
Expected: tous verts.

- [ ] **Step 5 : Mettre à jour la doc de la sous-app (xo-discipline E3)**

Ajouter dans `apps/hub/CLAUDE.md` une note : « Modération (Photos/Reviews) crédite Couronnes + compteur Contributions à la 1re validation (idempotent via `rewarded_at`) et envoie un email d'acceptation (notif `contribution_approved` → edge `send-email`/Resend). Montants dans `app_settings` (`ugc_welcome_crowns`, `ugc_reward_crowns`). »
```bash
git add apps/hub/CLAUDE.md
git commit -m "docs(hub): note boucle recompense UGC (brique 1)"
```

---

### Task 6 : Audit & drop du code mort post-Brique 1 (xo-discipline D1)

**Files:** (déterminés par l'audit — front hub + éventuelle migration 176 de drop)

> À faire **après** la Task 5 validée, dans le même lot. Objectif : « rien de bancal ».
> On ne supprime que ce qui est **prouvé** non référencé.

- [ ] **Step 1 : Rebuild du graph + liste des orphelins**

Run: `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` puis lire `graphify-out/GRAPH_REPORT.md` (section communautés à 0 nœud / nœuds sans backlink).
Expected: une liste de candidats orphelins à confronter au code.

- [ ] **Step 2 : Vérifier les candidats concrets identifiés**

Pour chacun, confirmer qu'il n'est **plus référencé nulle part** (`Grep` global) avant tout drop :
- RPC `get_submission_images` (version non-batch) — `Photos.tsx` n'utilise que `get_submission_images_batch`. Vérifier qu'aucun appel `rpc('get_submission_images'` ne subsiste.
- Imports / `useState` devenus inutilisés dans `PhotoSubmit.tsx` / `ReviewSubmit.tsx` après le glow-up (ex: `progress`/`setProgress` si plus affichés). S'appuyer sur `pnpm --filter hub build` (TS strict `noUnusedLocals` remonte les morts).
- Incohérence de nommage `consent_brand_usage` / `consent_account_creation` (colonnes) vs `p_consent_brand` / `p_consent_account` (RPC) : vérifier qu'aucune colonne n'est orpheline.
```bash
# exemple de confirmation pour une RPC candidate
grep -rn "get_submission_images\b" apps/ supabase/ --include=*.ts --include=*.tsx --include=*.sql
```
Expected: pour chaque candidat, soit des références (→ on garde), soit zéro (→ drop autorisé).

- [ ] **Step 3 : Dropper le mort confirmé**

- Front : retirer le code mort, `pnpm --filter hub build` (doit rester vert).
- SQL : si des RPC/colonnes sont confirmées mortes, créer `supabase/migrations/176_ugc_cleanup_dead_code.sql` avec un `-- WHY` clair et les `DROP FUNCTION IF EXISTS` / `DROP COLUMN IF EXISTS` correspondants, puis `npx supabase db push`.
Expected: build vert, migration appliquée, aucune régression sur le parcours de la Task 5.

- [ ] **Step 4 : Commit**

```bash
git add -A
git commit -m "refactor(ugc): drop code mort post-brique 1 (audit D1)"
```

---

## Self-Review

**Spec coverage** (vs 2026-05-26-ugc-mouvement-model-design) :
- D3 Couronnes + compteur Contributions, Gloire exclue → Task 1 (colonne `contributions_count`, crédit `user_crowns`, aucune touche à la Gloire). ✅
- D4 récompense à la validation → Task 1 (RPC moderate_*). ✅
- D5 bonus bienvenue unique + reste à la validation → Task 1 (`create_user_from_submission` + moderate_*). ✅
- D6 email primaire + push bonus → Task 2 (send-email) + notif sur pipeline existant ; push no-op gracieux pour le type inconnu (formatPayload renvoie null). ✅
- Cap journalier (mig 029) → contourné : crédit direct sur `user_crowns` (cap *balance* 500 respecté via LEAST), pas via la mécanique de récolte plafonnée. ✅
- Glow-up écran de fin / CTA → Tasks 3-4. ✅
- §7 barème non figé → montants dans `app_settings`, tunables (50/20 de départ). ✅

**Placeholder scan** : les `PLACEHOLDER_*` dans `app_settings` sont **intentionnels** (valeurs renseignées post-deploy, Task 2 Step 3 / Task 5 Step 2) et le trigger les détecte pour ne pas envoyer — ce ne sont pas des trous de plan. Aucun « TODO/TBD » dans le code livré.

**Type consistency** : `get_ugc_reward_config` renvoie `{welcome_crowns, reward_crowns}` (Task 1) — mêmes noms côté front (Tasks 3-4). Notif `type='contribution_approved'`, header `X-Email-Secret`, clés `app_settings` (`resend_api_key`, `email_from`, `email_trigger_secret`, `edge_function_send_email_url`) cohérents entre Task 1 (trigger), Task 2 (edge function) et la config. ✅

**Point d'attention exécution** : vérifier que `send-push/categories.ts` ne lève pas sur un `type` inconnu (`contribution_approved`). Le trigger push étant fire-and-forget, une erreur côté send-push n'empêche ni le commit de la notif ni l'email. Optionnel : ajouter `case 'contribution_approved': return 'silent'` dans `categories.ts` pour un skip propre (lire le fichier avant d'éditer).
