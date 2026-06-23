# Flyer QR → Cadeau → Code promo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une page publique du Hub, atteinte par un QR de flyer, qui crée un compte app transparent à partir d'un email et affiche un code promo boutique.

**Architecture :** On calque le pattern existant `stand-create-account.ts` (compte fantôme festival) dans une nouvelle Netlify function **publique** `flyer-create-account.ts`, plus une page React publique `FlyerGift.tsx` montée sur la route `/flyer`. Une migration SQL ajoute `'flyer'` au CHECK `account_source` et crée une table de rate-limit par IP.

**Tech Stack :** React + react-router-dom (apps/hub), Netlify Functions (Web `Request`/`Response` API), Supabase REST (service role), Shopify Admin API 2026-01, Postgres (Supabase).

## Global Constraints

- **But = vente boutique.** L'app n'est pas un tunnel : email → code promo, aucune étape mot de passe/onboarding.
- **1 email = 1 compte** (socle existant). Le flow est idempotent : un email déjà connu réaffiche le code, ne crée aucun doublon.
- **`account_source = 'flyer'`** (Supabase) et tag **`source:flyer`** (Shopify) — segmentation obligatoire.
- **Opt-in newsletter d'office** : `email_marketing_consent: { state: 'subscribed' }` sur le customer Shopify (c'est ce qui rend l'email joignable, pas le user Supabase).
- **Code promo générique**, fourni côté serveur (env var), jamais codé en dur dans la page front.
- **Flow public** → garde-fous : idempotence email + rate-limit par IP. Pas de token secret (URL statique = faux garde-fou).
- **Pas de test unitaire dans ce repo** : la vérification se fait par `pnpm build` (TypeScript strict) + click-flow local `pnpm dev`. Aucun deploy sans click-flow (règle Uriel).
- **Numéro de migration : 270** (la dernière est `269_cap_place_position_move.sql`).
- Migrations appliquées via `pnpm dlx supabase db push` depuis la racine du repo.

---

## File Structure

- **Create** `supabase/migrations/270_flyer_account_source_and_rate_limit.sql` — étend le CHECK `account_source` + table `flyer_signup_log`.
- **Create** `apps/hub/netlify/functions/flyer-create-account.ts` — endpoint public idempotent + rate-limit + Shopify + user fantôme + renvoie le code promo.
- **Create** `apps/hub/src/components/FlyerGift.tsx` — page publique « Bienvenue dans la Confrérie ».
- **Modify** `apps/hub/src/App.tsx` — ajoute `/flyer` aux routes publiques.

---

## Task 1: Migration SQL — source `flyer` + table rate-limit

**Files:**
- Create: `supabase/migrations/270_flyer_account_source_and_rate_limit.sql`

**Interfaces:**
- Produces: la valeur `'flyer'` acceptée par `users.account_source` ; la table `public.flyer_signup_log(id, ip, email, created_at)` avec index `(ip, created_at)`, lisible/écrivable par le service role.

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/270_flyer_account_source_and_rate_limit.sql`:

```sql
-- 270_flyer_account_source_and_rate_limit.sql
-- WHY : feature « Flyer QR → cadeau » (2026-06-23). 4ème voie d'inscription, née
-- d'un QR code sur les flyers papier, distincte de 'app' / 'shopify' / 'stand'.
-- Permet de segmenter le funnel flyer → vente (tag Shopify source:flyer en miroir).
-- Ajoute aussi une table de rate-limit par IP, car l'endpoint est PUBLIC (pas admin).

-- 1. Élargit la CHECK constraint pour accepter 'flyer'.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_account_source_check;

ALTER TABLE public.users ADD CONSTRAINT users_account_source_check
  CHECK ((account_source)::text = ANY (ARRAY['app'::varchar, 'shopify'::varchar, 'stand'::varchar, 'flyer'::varchar]::text[]));

-- 2. Journal des tentatives flyer, pour rate-limiter par IP.
CREATE TABLE IF NOT EXISTS public.flyer_signup_log (
  id         bigserial PRIMARY KEY,
  ip         text NOT NULL,
  email      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flyer_signup_log_ip_created_idx
  ON public.flyer_signup_log (ip, created_at);

-- Pas de policy : seul le service role (Netlify function) y accède. RLS activé,
-- aucune policy = anon/authenticated n'y touchent pas.
ALTER TABLE public.flyer_signup_log ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Appliquer la migration**

Run (depuis la racine du repo) : `pnpm dlx supabase db push`
Expected : la migration `270_...` est listée comme appliquée, sans erreur.

- [ ] **Step 3: Vérifier en base**

Run :
```bash
pnpm dlx supabase db execute --query "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'users_account_source_check';"
```
Expected : la définition du CHECK contient `'flyer'`.

Run :
```bash
pnpm dlx supabase db execute --query "SELECT to_regclass('public.flyer_signup_log');"
```
Expected : retourne `flyer_signup_log` (table existe).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/270_flyer_account_source_and_rate_limit.sql
git commit -m "feat(db): account_source 'flyer' + table rate-limit flyer_signup_log"
```

---

## Task 2: Netlify function publique `flyer-create-account.ts`

**Files:**
- Create: `apps/hub/netlify/functions/flyer-create-account.ts`
- Reference (pattern à calquer, ne pas modifier) : `apps/hub/netlify/functions/stand-create-account.ts`

**Interfaces:**
- Consumes : table `flyer_signup_log` (Task 1) ; valeur `account_source = 'flyer'` (Task 1) ; env vars `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SHOPIFY_ACCESS_TOKEN` (ou `app_settings.shopify_access_token`), `FLYER_PROMO_CODE`.
- Produces : endpoint `POST /.netlify/functions/flyer-create-account`. Body : `{ "email": string }`. Réponse succès : `{ "success": true, "action": "created" | "already_exists", "promoCode": string }`. Erreurs : `{ "error": string }` avec status 400 (email invalide) / 429 (rate-limit) / 500.

- [ ] **Step 1: Écrire la function**

Create `apps/hub/netlify/functions/flyer-create-account.ts`:

```ts
// Endpoint PUBLIC (pas d'auth) atteint par le QR code des flyers.
// Crée un compte fantôme à partir d'un email et renvoie un code promo boutique.
// Calqué sur stand-create-account.ts, MAIS public → garde-fous : idempotence email
// + rate-limit par IP (table flyer_signup_log). Code promo générique via env FLYER_PROMO_CODE.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const PROMO_CODE = process.env.FLYER_PROMO_CODE || 'CONFRERIE'

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 heure
const RATE_LIMIT_MAX = 15 // tentatives max par IP et par fenêtre

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}

function clientIp(request: Request): string {
  const nf = request.headers.get('x-nf-client-connection-ip')
  if (nf) return nf
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return 'unknown'
}

function buildTags(existing: string): string {
  const tags = existing.split(',').map(t => t.trim()).filter(Boolean)
  const filtered = tags.filter(t => !t.startsWith('source:'))
  const tagSet = new Set(filtered)
  tagSet.add('app-player')
  tagSet.add('source:flyer')
  return Array.from(tagSet).join(', ')
}

export default async function handler(request: Request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!SUPABASE_URL || !SUPABASE_KEY) return json({ error: 'Missing Supabase env vars' }, 500)

  let email: string
  try {
    const body = await request.json()
    email = String(body.email || '').trim().toLowerCase()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  if (!email || !email.includes('@')) return json({ error: 'Invalid email' }, 400)

  const ip = clientIp(request)

  // 0. Rate-limit par IP : compte les tentatives de la dernière heure.
  const sinceIso = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const rlResp = await fetch(
    `${SUPABASE_URL}/rest/v1/flyer_signup_log?ip=eq.${encodeURIComponent(ip)}&created_at=gte.${encodeURIComponent(sinceIso)}&select=id`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  )
  if (rlResp.ok) {
    const rows = await rlResp.json() as Array<{ id: number }>
    if (Array.isArray(rows) && rows.length >= RATE_LIMIT_MAX) {
      return json({ error: 'Trop de tentatives, réessaie dans un moment.' }, 429)
    }
  }

  // Journalise la tentative (best-effort, ne bloque pas le flow).
  await fetch(`${SUPABASE_URL}/rest/v1/flyer_signup_log`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ip, email }),
  })

  // 1. Idempotence : email déjà connu côté Supabase → on réaffiche le code, pas de doublon.
  const existingResp = await fetch(
    `${SUPABASE_URL}/rest/v1/users?email_address=eq.${encodeURIComponent(email)}&select=id&limit=1`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  )
  const existingRows = await existingResp.json() as Array<{ id: string }>
  if (existingRows.length > 0) {
    return json({ success: true, action: 'already_exists', promoCode: PROMO_CODE })
  }

  // 2. Token Shopify (env ou app_settings).
  let shopifyToken: string | null = process.env.SHOPIFY_ACCESS_TOKEN || null
  if (!shopifyToken) {
    const settingsResp = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?key=eq.shopify_access_token&select=value&limit=1`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
    })
    const settings = await settingsResp.json()
    shopifyToken = Array.isArray(settings) && settings.length > 0 ? settings[0].value : null
  }
  if (!shopifyToken) return json({ error: 'Shopify not connected' }, 500)

  const shop = 'runes-de-chene.myshopify.com'

  try {
    // 3. Customer Shopify existant ? (achat antérieur sans inscription app)
    let customerId: number | null = null
    const searchResp = await fetch(
      `https://${shop}/admin/api/2026-01/customers/search.json?query=email:${encodeURIComponent(email)}&fields=id,email,tags`,
      { headers: { 'X-Shopify-Access-Token': shopifyToken } }
    )
    if (searchResp.ok) {
      const searchData = await searchResp.json() as { customers?: Array<{ id: number; tags: string }> }
      if (searchData.customers && searchData.customers.length > 0) {
        const existing = searchData.customers[0]
        customerId = existing.id
        await fetch(`https://${shop}/admin/api/2026-01/customers/${customerId}.json`, {
          method: 'PUT',
          headers: { 'X-Shopify-Access-Token': shopifyToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer: {
              id: customerId,
              tags: buildTags(existing.tags || ''),
              email_marketing_consent: {
                state: 'subscribed',
                opt_in_level: 'single_opt_in',
                consent_updated_at: new Date().toISOString(),
              },
            },
          }),
        })
      }
    }

    // 4. Sinon création du customer Shopify.
    if (customerId === null) {
      const createResp = await fetch(`https://${shop}/admin/api/2026-01/customers.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': shopifyToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            email,
            tags: buildTags(''),
            email_marketing_consent: {
              state: 'subscribed',
              opt_in_level: 'single_opt_in',
              consent_updated_at: new Date().toISOString(),
            },
          },
        }),
      })
      if (!createResp.ok) {
        const err = await createResp.text()
        return json({ error: `Shopify create failed: ${err.slice(0, 300)}` }, 500)
      }
      const createData = await createResp.json() as { customer?: { id: number } }
      customerId = createData.customer?.id ?? null
      if (!customerId) return json({ error: 'Shopify customer created but no id returned' }, 500)
    }

    // 5. Insert user Supabase fantôme — pattern shopify-sync : id = "shopify-{customer.id}".
    const newUser = {
      id: `shopify-${customerId}`,
      email_address: email,
      first_name: 'Pionnier',
      shopify_customer_id: customerId,
      account_source: 'flyer',
      is_active: true,
      role: 'user',
      rank: '',
      biography: '',
      created_at: new Date().toISOString(),
    }
    const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(newUser),
    })
    if (!insertResp.ok) {
      const err = await insertResp.text()
      return json({ error: `Supabase insert failed: ${err.slice(0, 300)}`, customerId }, 500)
    }

    return json({ success: true, action: 'created', promoCode: PROMO_CODE })
  } catch (error) {
    return json({ error: `${error}` }, 500)
  }
}

export const config = {
  path: '/.netlify/functions/flyer-create-account',
}
```

- [ ] **Step 2: Vérifier la compilation TypeScript**

Run : `cd apps/hub && pnpm build`
Expected : build OK, aucune erreur TS sur `flyer-create-account.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/hub/netlify/functions/flyer-create-account.ts
git commit -m "feat(hub): endpoint public flyer-create-account (idempotent + rate-limit IP)"
```

---

## Task 3: Page publique `FlyerGift.tsx` + route `/flyer`

**Files:**
- Create: `apps/hub/src/components/FlyerGift.tsx`
- Modify: `apps/hub/src/App.tsx` (lignes 49-58 : tableau `publicRoutes` + bloc `isPublicRoute`)

**Interfaces:**
- Consumes : `POST /.netlify/functions/flyer-create-account` (Task 2), réponse `{ success, action, promoCode }`.
- Produces : route publique `/flyer` rendant `<FlyerGift />`.

- [ ] **Step 1: Écrire la page**

Create `apps/hub/src/components/FlyerGift.tsx`:

```tsx
import { useState } from 'react'

type Phase = 'form' | 'done'

export function FlyerGift() {
  const [email, setEmail] = useState('')
  const [phase, setPhase] = useState<Phase>('form')
  const [promoCode, setPromoCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const value = email.trim().toLowerCase()
    if (!value || !value.includes('@') || !value.includes('.')) {
      setError('Entre une adresse email valide.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const resp = await fetch('/.netlify/functions/flyer-create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      })
      const data = await resp.json()
      if (!resp.ok || !data.success) {
        setError(data.error || 'Une erreur est survenue, réessaie.')
        return
      }
      setPromoCode(data.promoCode)
      setPhase('done')
    } catch {
      setError('Connexion impossible, réessaie.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={wrap}>
      <div style={card}>
        {phase === 'form' ? (
          <>
            <p style={kicker}>Bienvenue dans la Confrérie</p>
            <h1 style={title}>Voici ton cadeau</h1>
            <p style={body}>
              Laisse ton email : on t'offre un code promo pour la boutique, et tu rejoins
              le Mouvement. Pas de mot de passe, rien à installer.
            </p>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="ton@email.fr"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              style={input}
              disabled={submitting}
              autoFocus
            />
            {error && <p style={errorText}>{error}</p>}
            <button onClick={submit} disabled={submitting} style={button}>
              {submitting ? 'Un instant…' : 'Recevoir mon cadeau'}
            </button>
          </>
        ) : (
          <>
            <p style={kicker}>Ton cadeau</p>
            <h1 style={title}>Code promo boutique</h1>
            <p style={body}>Utilise ce code à la boutique en ligne :</p>
            <div style={codeBox}>{promoCode}</div>
            <p style={{ ...body, fontSize: 15, opacity: 0.7 }}>
              On te l'a aussi envoyé par email. À bientôt, Confrère.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

const wrap: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#1c1814',
  padding: 24,
  boxSizing: 'border-box',
}
const card: React.CSSProperties = {
  width: '100%',
  maxWidth: 420,
  background: '#262019',
  border: '1px solid #3a3026',
  borderRadius: 16,
  padding: 32,
  color: '#f0e9dd',
  textAlign: 'center',
}
const kicker: React.CSSProperties = {
  textTransform: 'uppercase',
  letterSpacing: 2,
  fontSize: 13,
  color: '#c9a24b',
  margin: '0 0 8px',
}
const title: React.CSSProperties = { fontSize: 28, margin: '0 0 16px', fontWeight: 700 }
const body: React.CSSProperties = { fontSize: 18, lineHeight: 1.5, margin: '0 0 20px' }
const input: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '14px 16px',
  fontSize: 18,
  borderRadius: 10,
  border: '1px solid #4a3e30',
  background: '#1c1814',
  color: '#f0e9dd',
  marginBottom: 12,
}
const button: React.CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  fontSize: 18,
  fontWeight: 600,
  borderRadius: 10,
  border: 'none',
  background: '#c9a24b',
  color: '#1c1814',
  cursor: 'pointer',
}
const codeBox: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  letterSpacing: 3,
  padding: '16px 12px',
  borderRadius: 10,
  border: '1px dashed #c9a24b',
  background: '#1c1814',
  color: '#c9a24b',
  margin: '0 0 16px',
}
const errorText: React.CSSProperties = { color: '#e08a7a', fontSize: 15, margin: '0 0 12px' }
```

- [ ] **Step 2: Brancher la route publique dans `App.tsx`**

In `apps/hub/src/App.tsx`, add the import near the other component imports (after line 7, `import { StudioSubmit }`):

```tsx
import { FlyerGift } from './components/FlyerGift'
```

Then replace the public-routes block (current lines 48-58):

```tsx
  // Routes publiques (pas besoin d'auth)
  const publicRoutes = ['/soumettre-contenu']
  const isPublicRoute = publicRoutes.includes(location.pathname)

  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/soumettre-contenu" element={<StudioSubmit />} />
      </Routes>
    )
  }
```

with:

```tsx
  // Routes publiques (pas besoin d'auth)
  const publicRoutes = ['/soumettre-contenu', '/flyer']
  const isPublicRoute = publicRoutes.includes(location.pathname)

  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/soumettre-contenu" element={<StudioSubmit />} />
        <Route path="/flyer" element={<FlyerGift />} />
      </Routes>
    )
  }
```

- [ ] **Step 3: Vérifier le build**

Run : `cd apps/hub && pnpm build`
Expected : build OK, aucune erreur TS.

- [ ] **Step 4: Commit**

```bash
git add apps/hub/src/components/FlyerGift.tsx apps/hub/src/App.tsx
git commit -m "feat(hub): page publique /flyer (flyer QR → email → code promo)"
```

---

## Task 4: Env var, click-flow local et vérification finale

**Files:** (aucun fichier code — configuration + vérification manuelle)

**Interfaces:**
- Consumes : tout ce qui précède.
- Produces : env var `FLYER_PROMO_CODE` configurée sur Netlify (site du hub) ; preuve que le flow marche bout en bout.

- [ ] **Step 1: Définir le code promo (env var Netlify)**

Sur Netlify (site du hub) → Site settings → Environment variables → ajouter :
`FLYER_PROMO_CODE = CONFRERIE10` (ou la valeur voulue par Uriel).
Note : le code doit exister comme **discount code** dans Shopify pour être valide au checkout — à créer côté Shopify Admin (hors code).

- [ ] **Step 2: Click-flow local**

Run : `cd apps/hub && pnpm dev`
Dans le navigateur, ouvrir `http://localhost:<port>/flyer`.
Vérifier dans l'ordre :
1. La page « Bienvenue dans la Confrérie / Voici ton cadeau » s'affiche, lisible (textes ≥ 18px).
2. Email vide ou invalide → message d'erreur, pas d'appel réseau réussi.
3. Email neuf valide → bouton « Un instant… » puis écran code promo affichant la valeur de `FLYER_PROMO_CODE`.
4. Re-soumettre le **même** email → toujours l'écran code promo (action `already_exists`), aucun doublon créé.

Expected : les 4 points passent.

- [ ] **Step 3: Vérifier les effets de bord en base et Shopify**

Run :
```bash
pnpm dlx supabase db execute --query "SELECT id, email_address, account_source FROM public.users WHERE account_source = 'flyer' ORDER BY created_at DESC LIMIT 3;"
```
Expected : le user de test apparaît, `account_source = 'flyer'`, `id` en `shopify-...`.

Dans Shopify Admin → Customers → chercher l'email de test : le client existe, **subscribed** à la newsletter, tag `source:flyer` présent.

- [ ] **Step 4: Vérifier le rate-limit**

Soumettre > 15 emails différents depuis la même machine en moins d'une heure (script ou manuel) → la requête suivante renvoie 429 « Trop de tentatives ». 
Expected : 429 au-delà du seuil ; les soumissions sous le seuil passent.

- [ ] **Step 5: Nettoyer les données de test**

Run :
```bash
pnpm dlx supabase db execute --query "DELETE FROM public.flyer_signup_log WHERE email LIKE '%test%';"
```
Et supprimer les users/customers de test créés pendant le click-flow (Hub → Users, et Shopify Admin).
⚠️ Vérifier manuellement chaque ligne avant suppression (règle : pas de DROP/DELETE en prod sur la seule foi d'un rapport).

- [ ] **Step 6: Déployer**

Déployer le hub selon le protocole habituel (Netlify). Re-tester `/flyer` en prod (un email réel jetable) avant d'imprimer le QR sur les flyers.

---

## QR code du flyer

L'URL à encoder dans le QR : `https://hub.runesdechene.com/flyer` (confirmé : domaine de prod du hub, même host/route publique que `/soumettre-contenu`).

---

## Self-Review

- **Spec coverage :** QR→page publique (Task 3, `/flyer`) ; écran « Bienvenue dans la Confrérie » (Task 3) ; email→compte transparent (Task 2, user fantôme) ; idempotence (Task 2, branche `already_exists`) ; Shopify customer + consent subscribed + tag `source:flyer` (Task 2, `buildTags`) ; `account_source='flyer'` + CHECK (Task 1) ; rate-limit IP (Task 1 table + Task 2 logique) ; code promo générique côté serveur (Task 2 env `FLYER_PROMO_CODE`, jamais en dur côté front) ; pas de token secret (respecté — aucun token). Tous les points de spec sont couverts.
- **Placeholders :** aucun — tout le code est complet.
- **Type consistency :** la function renvoie `{ success, action, promoCode }` (Task 2), consommé tel quel par `FlyerGift.tsx` (Task 3). Route `/flyer` ajoutée à `publicRoutes` ET au `<Routes>` (Task 3). Numéro de migration 270 cohérent (dernière = 269).
- **Hors scope (non traité, noté dans la spec) :** code promo unique par personne ; tunnel d'onboarding ; nettoyage des points exploration/érudition morts depuis 0.6 ; filtrage du compteur public `movement_stats`. `computeSourceTag` (shopifyTags.ts) ne mappe pas `flyer`→`source:flyer`, mais ce chemin (`syncUserTagsToShopify`) n'est pas utilisé par ce flow ; la function a son propre `buildTags`. Idem `stand` n'y est pas mappé — comportement préexistant inchangé.
```
