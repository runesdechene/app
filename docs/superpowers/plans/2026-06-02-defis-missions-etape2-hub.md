# Défis & Missions — Étape 2 (Hub) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Côté Hub + DB : pouvoir attribuer un butin > Couronnes (Gloire + titre + code promo) à la validation d'une contribution de Mission, livré par l'email d'acceptation existant, avec une modération « mission-aware » et une page d'authoring des Missions.

**Architecture:** Étend `moderate_submission` (mig 176) avec Gloire/titre/code (idempotence conservée). La **Gloire étant calculée** (`get_my_glory`, mig 024) et non stockée, on ajoute un **terme de bonus manuel** (`users.bonus_glory`) intégré à la formule ET à la source de la Coupe. Titres via nouvelle table `user_titles` (la table `titles` existe déjà). L'email Resend (`send-email`) est enrichi. Le Hub gagne une page CRUD `Missions` (pattern SaveBar) et un panneau de modération enrichi dans `SubmissionDetail` quand `quest_ref` est présent.

**Tech Stack:** Supabase (Postgres, RPC SECURITY DEFINER, edge function Deno + Resend), React 18 + Vite + TS strict, React Router, CSS parchemin. **Aucun runner de test** : vérifs par SQL d'assertion, `pnpm --filter hub build` (tsc strict), contrôle navigateur. **Dépend de l'Étape 1** (tables `missions`).

**Conventions :** prochaine migration après Étape 1 = **187+** ; déploiement Hub Netlify **manuel avec `--functions`** ; pattern Hub : `<SaveBar>`, deep copy compare (`JSON.parse(JSON.stringify())`), refetch après save, try/finally autour des fetch ; auth Hub par **email** (`users.role='admin'`).

---

## File Structure

**Migrations / DB :**
- Create: `supabase/migrations/187_ugc_reward_glory_title_code.sql` — `bonus_glory`, `user_titles`, `award_user_title`, extension `moderate_submission`, colonne `reward_promo_code`
- Create: `supabase/migrations/188_glory_includes_bonus.sql` — intègre `bonus_glory` à `get_my_glory` + à la source Coupe

**Edge function :**
- Modify: `supabase/functions/send-email/index.ts` — enrichir le rendu `contribution_approved` (Gloire/titre/code)

**Hub :**
- Create: `apps/hub/src/components/Missions.tsx` — page CRUD authoring des Missions (SaveBar)
- Create: `apps/hub/src/components/missions/MissionProductPicker.tsx` — champ produit Shopify (réutilise `searchShopifyProducts`)
- Modify: `apps/hub/src/App.tsx` — route `/carte/missions`
- Modify: `apps/hub/src/components/Sidebar.tsx` — entrée menu « Missions »
- Create: `apps/hub/src/components/photos/MissionRewardPanel.tsx` — panneau butin enrichi (Gloire/titre/code + aperçu email)
- Modify: `apps/hub/src/components/photos/SubmissionDetail.tsx` — afficher `MissionRewardPanel` si `quest_ref`
- Modify: `apps/hub/src/components/Photos.tsx` — fetch contexte mission + passer `p_glory/p_title/p_promo_code` à `moderate_submission`
- Modify: `apps/hub/src/components/photos/types.ts` — champs butin

---

## Task 1 — Migration `187_ugc_reward_glory_title_code.sql`

**Files:**
- Create: `supabase/migrations/187_ugc_reward_glory_title_code.sql`

- [ ] **Step 1 — Écrire la migration**

```sql
-- 187_ugc_reward_glory_title_code.sql
-- Butin enrichi à la validation UGC (Missions) : Gloire (manuelle), titre, code promo.
-- La Gloire est calculée (mig 024) → on stocke un bonus manuel (users.bonus_glory) intégré
-- à la formule en mig 188. D-REC-5 : Gloire créditable UNIQUEMENT par ce chemin manuel/humain.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bonus_glory integer NOT NULL DEFAULT 0;

ALTER TABLE public.hub_photo_submissions
  ADD COLUMN IF NOT EXISTS reward_glory      integer,
  ADD COLUMN IF NOT EXISTS reward_title_id   text,
  ADD COLUMN IF NOT EXISTS reward_promo_code text;

-- Titres gagnés (la table `titles` existe déjà — cf. Hub /carte/titres)
CREATE TABLE IF NOT EXISTS public.user_titles (
  user_id   text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title_id  text NOT NULL,                 -- FK logique vers titles.id
  earned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, title_id)
);
GRANT SELECT ON public.user_titles TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.award_user_title(p_user_id text, p_title_id text)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF p_title_id IS NULL OR btrim(p_title_id) = '' THEN RETURN; END IF;
  INSERT INTO public.user_titles (user_id, title_id)
    VALUES (p_user_id, p_title_id) ON CONFLICT DO NOTHING;
END; $$;
GRANT EXECUTE ON FUNCTION public.award_user_title(text, text) TO service_role, authenticated;

-- ── moderate_submission étendue (drop ancienne signature mig 176 puis recrée) ──
DROP FUNCTION IF EXISTS public.moderate_submission(uuid, text, int);
CREATE OR REPLACE FUNCTION public.moderate_submission(
  p_submission_id uuid, p_status text,
  p_crowns int DEFAULT NULL,
  p_glory int DEFAULT NULL,
  p_title_id text DEFAULT NULL,
  p_promo_code text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_user_id  text;
  v_rewarded timestamptz;
  v_crowns   int;
  v_glory    int;
BEGIN
  UPDATE public.hub_photo_submissions SET status = p_status, moderated_at = NOW()
  WHERE id = p_submission_id RETURNING user_id, rewarded_at INTO v_user_id, v_rewarded;

  IF p_status = 'approved' AND v_rewarded IS NULL AND v_user_id IS NOT NULL THEN
    v_crowns := GREATEST(0, COALESCE(p_crowns, 0));
    v_glory  := GREATEST(0, COALESCE(p_glory, 0));

    IF v_crowns > 0 THEN
      INSERT INTO public.user_crowns (user_id, balance, updated_at)
        VALUES (v_user_id, LEAST(500, v_crowns), now())
        ON CONFLICT (user_id) DO UPDATE SET
          balance = LEAST(500, public.user_crowns.balance + v_crowns), updated_at = now();
    END IF;

    -- Gloire : bonus manuel (intégré à get_my_glory + Coupe en mig 188)
    IF v_glory > 0 THEN
      UPDATE public.users SET bonus_glory = bonus_glory + v_glory WHERE id = v_user_id;
    END IF;

    -- Titre
    IF p_title_id IS NOT NULL AND btrim(p_title_id) <> '' THEN
      PERFORM public.award_user_title(v_user_id, p_title_id);
    END IF;

    UPDATE public.users SET contributions_count = contributions_count + 1 WHERE id = v_user_id;

    UPDATE public.hub_photo_submissions
       SET rewarded_at = now(), reward_crowns = v_crowns,
           reward_glory = v_glory,
           reward_title_id = NULLIF(btrim(p_title_id), ''),
           reward_promo_code = NULLIF(btrim(p_promo_code), '')
       WHERE id = p_submission_id;

    INSERT INTO public.notifications (recipient_id, type, data)
    VALUES (v_user_id, 'contribution_approved',
            jsonb_build_object(
              'kind','photo', 'submission_id', p_submission_id,
              'crowns', v_crowns, 'glory', v_glory,
              'title_id', NULLIF(btrim(p_title_id), ''),
              'promo_code', NULLIF(btrim(p_promo_code), '')));
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.moderate_submission(uuid, text, int, int, text, text)
  TO anon, authenticated, service_role;
```

- [ ] **Step 2 — Appliquer** (`apply_migration` name `187_ugc_reward_glory_title_code`). Expected: succès.

- [ ] **Step 3 — Test SQL : crédit + idempotence**

```sql
-- soumission approuvée avec butin complet (utiliser un submission_id + user réels en 'pending')
SELECT public.moderate_submission('SUBMISSION_UUID','approved', 30, 80, 'phalange_or', 'HOPLITE-100');
SELECT bonus_glory FROM public.users WHERE id = 'USER_ID';                 -- +80
SELECT * FROM public.user_titles WHERE user_id='USER_ID' AND title_id='phalange_or';  -- 1 ligne
SELECT reward_glory, reward_promo_code FROM public.hub_photo_submissions WHERE id='SUBMISSION_UUID';
-- re-valider ne re-paie pas (rewarded_at déjà set)
SELECT public.moderate_submission('SUBMISSION_UUID','approved', 30, 80, NULL, NULL);
SELECT bonus_glory FROM public.users WHERE id = 'USER_ID';                 -- toujours +80 (pas +160)
```
Expected: butin crédité une seule fois ; `title_id` doit exister dans `titles` (sinon FK logique orpheline — choisir un id réel via `SELECT id FROM titles`).

- [ ] **Step 4 — Commit**
```bash
git add supabase/migrations/187_ugc_reward_glory_title_code.sql
git commit -m "feat(db): butin UGC enrichi (Gloire/titre/code) + user_titles (mig 187)"
```

---

## Task 2 — Migration `188_glory_includes_bonus.sql` (intégrer le bonus à la Gloire calculée)

**Files:**
- Create: `supabase/migrations/188_glory_includes_bonus.sql`

> ⚠️ La Gloire est **calculée** dans `get_my_glory` (mig 024) et (probablement) ré-agrégée pour la Coupe.
> On doit ajouter `users.bonus_glory` aux DEUX endroits, sinon le butin Gloire serait invisible.

- [ ] **Step 1 — Localiser les sources de Gloire**

```sql
SELECT routine_name FROM information_schema.routines
 WHERE routine_definition ILIKE '%glory%' OR routine_name ILIKE '%glor%' OR routine_name ILIKE '%coupe%';
```
Expected: repérer `get_my_glory` (mig 024) et la/les RPC de la Coupe (ex. `get_coupe_state`). Lire leur définition exacte avant de patcher.

- [ ] **Step 2 — Écrire la migration** (recréer `get_my_glory` en ajoutant le terme `+ bonus_glory`)

```sql
-- 188_glory_includes_bonus.sql
-- Intègre users.bonus_glory (butin manuel mig 187) à la Gloire affichée et au classement Coupe.
-- ⚠️ Recopier le CORPS EXACT de get_my_glory (mig 024) et ajouter '+ COALESCE(u.bonus_glory,0)'
-- au total 'glory'. Idem pour la source de la Coupe.

CREATE OR REPLACE FUNCTION public.get_my_glory(p_user_id text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_glory int; /* … réutiliser les variables existantes mig 024 … */
BEGIN
  -- … CORPS EXISTANT (formule lieuxExplores*1 + ajoutes*7 + carnets*3 + photos*1 + plantages*5 + énigmes*1) …
  -- AJOUT : v_glory := v_glory + COALESCE((SELECT bonus_glory FROM public.users WHERE id = p_user_id), 0);
  -- … RETURN json_build_object('glory', v_glory, …) inchangé pour le reste …
  RETURN NULL; -- PLACEHOLDER À REMPLACER par le corps réel patché (voir Step 1)
END; $$;
GRANT EXECUTE ON FUNCTION public.get_my_glory(text) TO authenticated, service_role;

-- Si la Coupe agrège la Gloire via une autre RPC/vue (repérée Step 1), la recréer ici
-- en ajoutant le même terme + COALESCE(bonus_glory,0) par utilisateur.
```

> **Important pour l'exécutant :** ce Step exige de lire le corps réel de `get_my_glory` (et de la RPC Coupe)
> via `SELECT pg_get_functiondef('public.get_my_glory(text)'::regprocedure);` puis de le recopier intégralement
> en ajoutant le terme bonus. Le bloc ci-dessus est un gabarit — ne pas livrer le `RETURN NULL`.

- [ ] **Step 3 — Appliquer + tester**
```sql
-- avec un user ayant bonus_glory > 0
SELECT (public.get_my_glory('USER_ID')->>'glory')::int;   -- doit inclure le bonus
```
Expected: la Gloire renvoyée inclut `bonus_glory`. Vérifier aussi que la Coupe reflète le bonus.

- [ ] **Step 4 — Commit**
```bash
git add supabase/migrations/188_glory_includes_bonus.sql
git commit -m "feat(db): intègre bonus_glory manuel à la Gloire calculée + Coupe (mig 188)"
```

---

## Task 3 — Enrichir l'email d'acceptation

**Files:**
- Modify: `supabase/functions/send-email/index.ts`

- [ ] **Step 1 — Lire le rendu actuel** de `contribution_approved` dans `supabase/functions/send-email/index.ts` (template HTML parchemin, lecture du `data.crowns`). Repérer la fonction de rendu.

- [ ] **Step 2 — Enrichir le template** pour rendre conditionnellement Gloire/titre/code

```typescript
// dans le rendu de 'contribution_approved' :
const crowns = Number(data.crowns ?? 0)
const glory = Number(data.glory ?? 0)
const titleId = (data.title_id as string | null) ?? null
const promo = (data.promo_code as string | null) ?? null

const rewardRows = [
  crowns > 0 ? `<li>🪙 +${crowns} Couronnes</li>` : '',
  glory  > 0 ? `<li>🎖️ +${glory} Gloire</li>` : '',
  titleId   ? `<li>👑 Nouveau titre : <strong>${escapeHtml(titleId)}</strong></li>` : '',
  promo     ? `<li>🏷️ Ton code : <strong>${escapeHtml(promo)}</strong></li>` : '',
].filter(Boolean).join('')

// injecter `rewardRows` dans le corps HTML existant (liste <ul>…</ul>),
// formulation inclusive « tes récompenses sont créditées sur ton compte, connecte-toi à La Carte ».
```
> Réutiliser l'`escapeHtml` existant du fichier (ou en ajouter un minimal). Garder le template unique
> (pas de branchement new/returning — cf. spec UGC D5bis).

- [ ] **Step 3 — Déployer la fonction**

Run: `supabase functions deploy send-email` (ou via MCP `deploy_edge_function`).
Expected: déploiement OK.

- [ ] **Step 4 — Test bout-en-bout** : re-valider une soumission de test (Task 1) avec Gloire+titre+code → vérifier l'email reçu (ou les logs `get_logs` de la fonction) contient les 4 lignes.

- [ ] **Step 5 — Commit**
```bash
git add supabase/functions/send-email/index.ts
git commit -m "feat(email): butin enrichi (Gloire/titre/code) dans l'email d'acceptation UGC"
```

---

## Task 4 — Page Hub d'authoring des Missions

**Files:**
- Create: `apps/hub/src/components/missions/MissionProductPicker.tsx`
- Create: `apps/hub/src/components/Missions.tsx`
- Modify: `apps/hub/src/App.tsx`
- Modify: `apps/hub/src/components/Sidebar.tsx`

- [ ] **Step 1 — `MissionProductPicker.tsx`** (réutilise `searchShopifyProducts` de `apps/hub/src/lib/shopifyProducts.ts`)

```tsx
import { useState } from 'react'
import { searchShopifyProducts, type ShopifyProductHit } from '../../lib/shopifyProducts'

export function MissionProductPicker({ value, onChange }: { value: string | null; onChange: (handle: string | null) => void }) {
  const [hits, setHits] = useState<ShopifyProductHit[]>([])
  const [term, setTerm] = useState('')
  const [error, setError] = useState<string | null>(null)
  async function search() {
    try { setError(null); setHits(await searchShopifyProducts(term)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Erreur recherche') }
  }
  return (
    <div className="mission-product-picker">
      <div className="mpp-current">{value ? `Produit lié : ${value}` : 'Aucun produit (mission sans produit)'}
        {value && <button onClick={() => onChange(null)}>retirer</button>}</div>
      <div className="mpp-search">
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Rechercher un produit Shopify…" />
        <button onClick={search}>🔍</button>
      </div>
      {error && <div className="mpp-error">{error}</div>}
      <ul className="mpp-hits">
        {hits.map((h) => (
          <li key={h.productId}><button onClick={() => { onChange(h.handle); setHits([]) }}>{h.title} <small>{h.handle}</small></button></li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2 — `Missions.tsx`** (pattern SaveBar : fetch/edit/deep-copy compare/save/refetch — calqué sur `Factions.tsx`)

```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SaveBar } from './SaveBar'
import { MissionProductPicker } from './missions/MissionProductPicker'

interface Mission {
  slug: string; title: string; eyebrow: string | null; call: string | null; brief: string | null
  emblem: string | null; cover_image_url: string | null; deliverable_kind: string
  product_handle: string | null; cta_label: string | null; cta_url: string | null
  starts_at: string | null; ends_at: string | null
  floor_glory: number; floor_crowns: number; reward_hint: string | null
  salon_intro: string | null; notify_on_launch: boolean; featured_on_home: boolean; status: string
}

const BLANK: Mission = {
  slug: '', title: '', eyebrow: 'Mission à thème', call: '', brief: '', emblem: '🎯',
  cover_image_url: '', deliverable_kind: 'photo', product_handle: null, cta_label: 'Rejoindre la boutique',
  cta_url: '', starts_at: null, ends_at: null, floor_glory: 0, floor_crowns: 0, reward_hint: '+ titre & code possibles',
  salon_intro: '', notify_on_launch: true, featured_on_home: false, status: 'draft',
}

export function Missions() {
  const [data, setData] = useState<Mission[]>([])
  const [saved, setSaved] = useState<Mission[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasChanges = JSON.stringify(data) !== JSON.stringify(saved)

  useEffect(() => { fetchMissions() }, [])
  async function fetchMissions() {
    try {
      const { data: rows } = await supabase.from('missions').select('*').order('created_at', { ascending: false })
      if (rows) { setData(rows as Mission[]); setSaved(JSON.parse(JSON.stringify(rows))) }
    } finally { /* no-op */ }
  }
  const current = data.find((m) => m.slug === selected) ?? null
  function update(field: keyof Mission, value: unknown) {
    setData((prev) => prev.map((m) => (m.slug === selected ? { ...m, [field]: value } : m)))
  }
  function addNew() {
    const slug = prompt('Slug de la mission (ex. hoplite) ?')?.trim()
    if (!slug) return
    setData((prev) => [{ ...BLANK, slug }, ...prev]); setSelected(slug)
  }
  async function handleSave() {
    setSaving(true); setError(null)
    try {
      // upsert tous les modifiés
      const dirty = data.filter((m) => JSON.stringify(m) !== JSON.stringify(saved.find((s) => s.slug === m.slug)))
      const { error: upErr } = await supabase.from('missions').upsert(dirty)
      if (upErr) { setError(upErr.message) } else { await fetchMissions() }
    } finally { setSaving(false) }
  }
  function handleCancel() { setData(JSON.parse(JSON.stringify(saved))); setError(null) }

  return (
    <div className="missions-page" style={{ paddingBottom: hasChanges ? 70 : 0 }}>
      <SaveBar hasChanges={hasChanges} saving={saving} error={error} onSave={handleSave} onCancel={handleCancel} />
      <div className="missions-layout">
        <aside className="missions-list">
          <button onClick={addNew}>+ Nouvelle Mission</button>
          {data.map((m) => (
            <button key={m.slug} className={m.slug === selected ? 'active' : ''} onClick={() => setSelected(m.slug)}>
              {m.title || m.slug} <span className={`st st-${m.status}`}>{m.status}</span>
            </button>
          ))}
        </aside>
        {current && (
          <div className="missions-form">
            {/* Identité */}
            <label>Titre<input value={current.title} onChange={(e) => update('title', e.target.value)} /></label>
            <label>Emblème<input value={current.emblem ?? ''} onChange={(e) => update('emblem', e.target.value)} /></label>
            <label>Eyebrow<input value={current.eyebrow ?? ''} onChange={(e) => update('eyebrow', e.target.value)} /></label>
            <label>Call<input value={current.call ?? ''} onChange={(e) => update('call', e.target.value)} /></label>
            <label>Cover URL<input value={current.cover_image_url ?? ''} onChange={(e) => update('cover_image_url', e.target.value)} /></label>
            {/* Brief & livrable */}
            <label>Brief<textarea value={current.brief ?? ''} onChange={(e) => update('brief', e.target.value)} /></label>
            <label>Livrable
              <select value={current.deliverable_kind} onChange={(e) => update('deliverable_kind', e.target.value)}>
                <option value="photo">photo</option><option value="video">vidéo</option><option value="other">autre</option>
              </select></label>
            {/* Produit + CTA */}
            <MissionProductPicker value={current.product_handle} onChange={(h) => update('product_handle', h)} />
            <label>CTA libellé<input value={current.cta_label ?? ''} onChange={(e) => update('cta_label', e.target.value)} /></label>
            <label>CTA URL<input value={current.cta_url ?? ''} onChange={(e) => update('cta_url', e.target.value)} /></label>
            {/* Fenêtre */}
            <label>Début<input type="datetime-local" value={current.starts_at ?? ''} onChange={(e) => update('starts_at', e.target.value)} /></label>
            <label>Fin<input type="datetime-local" value={current.ends_at ?? ''} onChange={(e) => update('ends_at', e.target.value)} /></label>
            {/* Butin plancher */}
            <label>🪙 Couronnes min<input type="number" value={current.floor_crowns} onChange={(e) => update('floor_crowns', Number(e.target.value))} /></label>
            <label>🎖️ Gloire min<input type="number" value={current.floor_glory} onChange={(e) => update('floor_glory', Number(e.target.value))} /></label>
            <label>Mention récompense<input value={current.reward_hint ?? ''} onChange={(e) => update('reward_hint', e.target.value)} /></label>
            {/* Salon & diffusion */}
            <label>Mot d'accueil salon<textarea value={current.salon_intro ?? ''} onChange={(e) => update('salon_intro', e.target.value)} /></label>
            <label><input type="checkbox" checked={current.notify_on_launch} onChange={(e) => update('notify_on_launch', e.target.checked)} /> Notifier au lancement</label>
            <label><input type="checkbox" checked={current.featured_on_home} onChange={(e) => update('featured_on_home', e.target.checked)} /> Mettre en avant sur l'accueil</label>
            <label>Statut
              <select value={current.status} onChange={(e) => update('status', e.target.value)}>
                <option value="draft">brouillon</option><option value="published">publiée</option>
                <option value="passed">passée</option><option value="archived">archivée</option>
              </select></label>
          </div>
        )}
      </div>
    </div>
  )
}
```
> `missions` doit avoir `GRANT INSERT/UPDATE` pour le rôle Hub. Ajouter au besoin dans une micro-migration :
> `GRANT INSERT, UPDATE ON public.missions TO authenticated;` (le Hub agit en authenticated admin) — ou
> passer par des RPC `upsert_mission` SECURITY DEFINER si on veut verrouiller (recommandé si RLS stricte).
> **Décision d'exécution :** vérifier la politique RLS de `missions` ; si RLS activée, créer `upsert_mission`
> RPC admin-only plutôt qu'un GRANT direct.

- [ ] **Step 3 — Router + menu**

`apps/hub/src/App.tsx` : importer `Missions` et ajouter `<Route path="/carte/missions" element={<Missions />} />` dans la section `/carte/`.
`apps/hub/src/components/Sidebar.tsx` : ajouter dans la section « La Carte » :
```tsx
<NavLink to="/carte/missions" className={({ isActive }) => (isActive ? 'active' : '')}>Missions</NavLink>
```

- [ ] **Step 4 — Build**

Run: `pnpm --filter hub build`
Expected: PASS.

- [ ] **Step 5 — Vérif navigateur** : `pnpm --filter hub dev`, `/carte/missions` → créer une mission, la passer en `published`, recharger → persistance OK (refetch).

- [ ] **Step 6 — Commit**
```bash
git add apps/hub/src/components/Missions.tsx apps/hub/src/components/missions/ apps/hub/src/App.tsx apps/hub/src/components/Sidebar.tsx
git commit -m "feat(hub): page d'authoring des Missions (CRUD SaveBar + picker produit Shopify)"
```

---

## Task 5 — Modération « mission-aware » + panneau butin

**Files:**
- Modify: `apps/hub/src/components/photos/types.ts`
- Create: `apps/hub/src/components/photos/MissionRewardPanel.tsx`
- Modify: `apps/hub/src/components/photos/SubmissionDetail.tsx`
- Modify: `apps/hub/src/components/Photos.tsx`

- [ ] **Step 1 — Étendre les types** (`apps/hub/src/components/photos/types.ts`)

```typescript
// Ajouter au type PhotoSubmission (déjà : quest_ref: string | null) :
//   reward_glory?: number | null
//   reward_title_id?: string | null
//   reward_promo_code?: string | null
// Nouveau type contexte mission (chargé via les missions du Hub) :
export interface MissionContext {
  slug: string; title: string; floor_glory: number; floor_crowns: number; product_handle: string | null
}
```

- [ ] **Step 2 — `MissionRewardPanel.tsx`** (champs butin pré-remplis au plancher + aperçu email)

```tsx
import { useState } from 'react'
import type { MissionContext } from './types'

export interface RewardDraft { crowns: number; glory: number; titleId: string; promoCode: string }

export function MissionRewardPanel({ ctx, onApprove }: {
  ctx: MissionContext
  onApprove: (r: RewardDraft) => void
}) {
  const [r, setR] = useState<RewardDraft>({ crowns: ctx.floor_crowns, glory: ctx.floor_glory, titleId: '', promoCode: '' })
  const set = (k: keyof RewardDraft, v: string | number) => setR((p) => ({ ...p, [k]: v }))
  return (
    <div className="mission-reward-panel">
      <div className="mrp-ctx">🎭 Mission : <strong>{ctx.title}</strong> <span>(plancher 🪙 {ctx.floor_crowns} · 🎖️ {ctx.floor_glory})</span></div>
      <div className="mrp-fields">
        <label>🪙 Couronnes<input type="number" value={r.crowns} onChange={(e) => set('crowns', Number(e.target.value))} /></label>
        <label>🎖️ Gloire<input type="number" value={r.glory} onChange={(e) => set('glory', Number(e.target.value))} /></label>
        <label>👑 Titre (id)<input value={r.titleId} onChange={(e) => set('titleId', e.target.value)} placeholder="ex. phalange_or" /></label>
        <label>🏷️ Code promo<input value={r.promoCode} onChange={(e) => set('promoCode', e.target.value)} placeholder="HOPLITE-100" /></label>
      </div>
      <div className="mrp-email-preview">
        📧 Email : {[r.crowns > 0 && `🪙 +${r.crowns}`, r.glory > 0 && `🎖️ +${r.glory}`, r.titleId && `👑 ${r.titleId}`, r.promoCode && `🏷️ ${r.promoCode}`].filter(Boolean).join(' · ') || '(aucun butin)'}
      </div>
      <button className="mrp-approve" onClick={() => onApprove(r)}>✓ Approuver &amp; envoyer le butin</button>
    </div>
  )
}
```

- [ ] **Step 3 — Brancher dans `SubmissionDetail.tsx`** (après `.mod-detail__contact`, ~ligne 64)

```tsx
{sub.quest_ref && missionCtx && (
  <MissionRewardPanel ctx={missionCtx} onApprove={(r) => onApproveWithReward(sub.id, r)} />
)}
```
Ajouter aux props de `SubmissionDetail` : `missionCtx: MissionContext | null` et `onApproveWithReward: (id, r: RewardDraft) => void`. Conserver le bouton d'approbation simple existant quand `quest_ref` est absent.

- [ ] **Step 4 — `Photos.tsx`** : charger les missions + mapper le contexte par `quest_ref`, et étendre l'appel de modération

```tsx
// fetch missions (une fois) :
const { data: missions } = await supabase.from('missions').select('slug, title, floor_glory, floor_crowns, product_handle')
const missionBySlug = new Map((missions ?? []).map((m) => [m.slug, m as MissionContext]))
// contexte pour la soumission ouverte :
const missionCtx = sub.quest_ref ? missionBySlug.get(sub.quest_ref) ?? null : null
// approbation enrichie :
async function onApproveWithReward(id: string, r: RewardDraft) {
  await supabase.rpc('moderate_submission', {
    p_submission_id: id, p_status: 'approved',
    p_crowns: r.crowns, p_glory: r.glory,
    p_title_id: r.titleId || null, p_promo_code: r.promoCode || null,
  })
  await refetch()   // pattern existant
}
```
> Le chemin d'approbation **sans** `quest_ref` continue d'appeler `moderate_submission(id, 'approved', p_crowns)`
> (les nouveaux params ont des DEFAULT NULL → rétro-compatible).

- [ ] **Step 5 — Build**

Run: `pnpm --filter hub build`
Expected: PASS.

- [ ] **Step 6 — Vérif navigateur (bout-en-bout Étape 1+2)**

1. Hub : créer mission `hoplite` (published). 2. App : ouvrir la mission, « Présenter mon livrable » → studio `/soumettre-contenu?quete=hoplite`, soumettre une photo. 3. Hub `/carte/contenu` (Photos) : la soumission montre le panneau Mission → renseigner Couronnes/Gloire/titre/code → Approuver. 4. Vérifier : `users.bonus_glory` crédité, `user_titles` ligne, email reçu avec les 4 lignes, et la photo apparaît `✓ validé` dans la galerie de la fenêtre Mission (app).

- [ ] **Step 7 — Commit**
```bash
git add apps/hub/src/components/photos/ apps/hub/src/components/Photos.tsx
git commit -m "feat(hub): modération mission-aware + panneau butin (Gloire/titre/code) sur quest_ref"
```

---

## Self-review (couverture spec Étape 2)

- Butin > Couronnes (Gloire/titre/code) à la validation, discrétionnaire, pré-rempli au plancher → Tasks 1, 5 ✅
- Gloire manuelle intégrée à la Gloire calculée + Coupe (D-REC-5) → Tasks 1, 2 ✅
- Livraison par l'email d'acceptation existant enrichi → Task 3 ✅
- Titres : `user_titles` + `award_user_title` (table `titles` réutilisée) → Task 1 ✅
- Authoring Missions (tous les réglages verrouillés du mockup) → Task 4 ✅
- Modération mission-aware (panneau enrichi si `quest_ref`, simple sinon) → Task 5 ✅
- Idempotence (`rewarded_at`), cap Couronnes 500, code promo non crédité en DB jeu → Tasks 1, 5 ✅

## Points à valider pendant l'exécution
- **Task 2 est critique et non mécanique** : recopier le corps réel de `get_my_glory` (et de la RPC Coupe) — ne pas livrer le gabarit `RETURN NULL`.
- RLS de `missions` : GRANT direct vs RPC `upsert_mission` admin-only (Task 4 Step 2).
- `title_id` saisi au Hub doit exister dans `titles` (proposer un select des titres existants plutôt qu'un champ libre en itération UI).
- Déploiement Hub avec `--functions` ; déploiement `send-email` séparé.
```
