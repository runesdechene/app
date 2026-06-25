# Compteur collectif « Ensemble contre l'Oubli » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher un compteur agrégé des actions de la saison (toutes Compagnies confondues) au-dessus des classements, pour recadrer la Coupe comme reliée aux actions réelles — sans toucher au calcul de la Coupe.

**Architecture:** `get_coupe_state` (déjà appelée par les 3 vues) renvoie un nouveau bloc `collective`. Un composant `CollectiveCounter` (variantes full/compact) le rend dans la modale Coupe, la section Coupe de l'accueil, et le scoreboard carte.

**Tech Stack:** Postgres RPC (Supabase), React 18 + TS strict, CSS par composant.

## Global Constraints

- **Aucun changement du calcul de la Coupe** — purement additif/lecture (Modèle B intact).
- TS strict : pas de `any`, pas de `// @ts-ignore`.
- Vérif de ce repo (pas de test-runner) : `npx tsc --noEmit` + `npx vite build` + contrôle SQL en prod + preview `pnpm dev`.
- Migrations appliquées en prod via `apply_migration` (projet `ukpapqssgsxirsgmcvof`), additives.
- DA sobre parchemin/sépia (pas RPG). Langage de marque : « sortis de l'Oubli ».

---

### Task 1: Backend — `get_coupe_state` renvoie le bloc `collective`

**Files:**
- Create: `supabase/migrations/301_coupe_state_collective_counter.sql`

**Interfaces:**
- Produces: `get_coupe_state(...)` JSON gagne une clé `collective` :
  `{ "lieuxSortisOubli": int, "lieuxVisites": int, "enigmesPercees": int }` (totaux de la saison active).

- [ ] **Step 1: Récupérer la baseline courante (discipline B1 — ne pas réécrire de mémoire)**

Run (MCP supabase execute_sql, projet `ukpapqssgsxirsgmcvof`) :
```sql
SELECT pg_get_functiondef('public.get_coupe_state(text,bigint)'::regprocedure);
```
Copier le corps **intégral** dans le fichier de migration (c'est la version mig 298, in-company).

- [ ] **Step 2: Ajouter la variable + le calcul + la clé JSON (3 deltas)**

Dans le `DECLARE`, ajouter :
```sql
  v_collective jsonb;
```
Après le calcul de `v_window_end := COALESCE(v_season.ended_at, now());` (et le guard `no_season`), ajouter :
```sql
  -- Compteur collectif (toute la communauté, fenêtre de la saison). Lecture seule.
  SELECT jsonb_build_object(
    'lieuxSortisOubli', (SELECT count(*) FROM public.places
        WHERE created_at >= v_season.started_at AND created_at < v_window_end),
    'lieuxVisites', (SELECT count(*) FROM public.place_explorers
        WHERE visited_at >= v_season.started_at AND visited_at < v_window_end),
    'enigmesPercees', (SELECT count(*) FROM public.enigma_responses
        WHERE correct = TRUE AND responded_at >= v_season.started_at AND responded_at < v_window_end)
  ) INTO v_collective;
```
Dans le `RETURN json_build_object(...)` final, ajouter la clé :
```sql
    'collective', v_collective,
```

- [ ] **Step 3: Appliquer en prod**

Via MCP `apply_migration` (name `301_coupe_state_collective_counter`, projet `ukpapqssgsxirsgmcvof`) avec le contenu complet du fichier.
Expected: `{"success":true}`.

- [ ] **Step 4: Vérifier en prod (contrôle croisé des counts)**

Run (execute_sql) :
```sql
WITH s AS (SELECT started_at, COALESCE(ended_at,now()) e FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1)
SELECT
  (public.get_coupe_state(NULL)->'collective') AS via_rpc,
  (SELECT count(*) FROM places p, s WHERE p.created_at>=s.started_at AND p.created_at<s.e) AS lieux_attendu,
  (SELECT count(*) FROM place_explorers pe, s WHERE pe.visited_at>=s.started_at AND pe.visited_at<s.e) AS visites_attendu,
  (SELECT count(*) FROM enigma_responses er, s WHERE er.correct AND er.responded_at>=s.started_at AND er.responded_at<s.e) AS enigmes_attendu;
```
Expected: les 3 valeurs de `via_rpc` == les 3 colonnes attendues.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/301_coupe_state_collective_counter.sql
git commit -m "feat(coupe): get_coupe_state renvoie le compteur collectif (saison)"
```

---

### Task 2: Type — `CoupeState.collective`

**Files:**
- Modify: `apps/explore-web/src/types/coupe.ts`

**Interfaces:**
- Produces: `CoupeCollective` + `CoupeState.collective: CoupeCollective`.

- [ ] **Step 1: Ajouter le type**

Dans `types/coupe.ts`, avant `export interface CoupeState {` :
```ts
export interface CoupeCollective {
  lieuxSortisOubli: number
  lieuxVisites: number
  enigmesPercees: number
}
```
Et dans `CoupeState`, ajouter la propriété :
```ts
  collective: CoupeCollective
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/explore-web && npx tsc --noEmit`
Expected: EXIT 0 (les consommateurs ne lisent pas encore `collective`, donc pas d'erreur).

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/src/types/coupe.ts
git commit -m "feat(coupe): type CoupeCollective"
```

---

### Task 3: Composant `CollectiveCounter` (full + compact)

**Files:**
- Create: `apps/explore-web/src/components/map/badges/CollectiveCounter.tsx`
- Create: `apps/explore-web/src/components/map/badges/CollectiveCounter.css`

**Interfaces:**
- Consumes: `CoupeCollective` (Task 2).
- Produces: `<CollectiveCounter lieuxSortisOubli lieuxVisites enigmesPercees variant?='full'|'compact' />`.

- [ ] **Step 1: Écrire le composant**

`CollectiveCounter.tsx` :
```tsx
import './CollectiveCounter.css'

interface Props {
  lieuxSortisOubli: number
  lieuxVisites: number
  enigmesPercees: number
  /** 'full' = bandeau (modale/home) ; 'compact' = 1 ligne (scoreboard carte). */
  variant?: 'full' | 'compact'
}

const fmt = (n: number) => n.toLocaleString('fr-FR')

/**
 * Compteur collectif « Ensemble contre l'Oubli » — actions agrégées de la saison.
 * Purement informatif : recadre la Coupe comme reliée aux actions réelles.
 */
export function CollectiveCounter({ lieuxSortisOubli, lieuxVisites, enigmesPercees, variant = 'full' }: Props) {
  if (variant === 'compact') {
    if (lieuxSortisOubli + lieuxVisites + enigmesPercees === 0) return null
    return (
      <div className="collective-counter collective-counter-compact" title="Cette saison, ensemble contre l'Oubli">
        <span>🏛️ {fmt(lieuxSortisOubli)}</span>
        <span>📍 {fmt(lieuxVisites)}</span>
        <span>📜 {fmt(enigmesPercees)}</span>
      </div>
    )
  }
  return (
    <div className="collective-counter collective-counter-full">
      <div className="collective-counter-title">⚜ Cette saison, ensemble</div>
      <div className="collective-counter-metrics">
        <span>🏛️ <b>{fmt(lieuxSortisOubli)}</b> lieux sortis de l'Oubli</span>
        <span>📍 <b>{fmt(lieuxVisites)}</b> visités</span>
        <span>📜 <b>{fmt(enigmesPercees)}</b> énigmes percées</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Écrire le CSS (DA parchemin sobre)**

`CollectiveCounter.css` :
```css
.collective-counter { font-family: var(--font-accent, 'Cinzel', serif); color: #4a3728; }

/* Bandeau complet (modale / home) */
.collective-counter-full {
  background: rgba(245, 230, 211, 0.75);
  border: 1px solid rgba(184, 154, 106, 0.45);
  border-radius: 10px;
  padding: 8px 12px;
  text-align: center;
}
.collective-counter-title {
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  color: rgba(74, 55, 40, 0.7); margin-bottom: 4px;
}
.collective-counter-metrics {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 14px;
  font-size: 12px; color: #5a4636;
}
.collective-counter-metrics b { color: #8a5a22; font-variant-numeric: tabular-nums; }

/* Compact (scoreboard carte) : 1 ligne dense */
.collective-counter-compact {
  display: flex; gap: 8px; justify-content: flex-end;
  font-size: 10px; font-weight: 700; color: rgba(74, 55, 40, 0.75);
  font-variant-numeric: tabular-nums;
  background: rgba(245, 230, 211, 0.7);
  border: 1px solid rgba(0,0,0,0.06); border-radius: 8px;
  padding: 3px 8px;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/explore-web && npx tsc --noEmit`
Expected: EXIT 0.

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/components/map/badges/CollectiveCounter.tsx apps/explore-web/src/components/map/badges/CollectiveCounter.css
git commit -m "feat(coupe): composant CollectiveCounter (full + compact)"
```

---

### Task 4: Intégration — Modale Coupe (variante full)

**Files:**
- Modify: `apps/explore-web/src/components/map/modals/CoupeModal.tsx`

**Interfaces:**
- Consumes: `CollectiveCounter` (Task 3), `state.collective` (Tasks 1-2).

- [ ] **Step 1: Importer le composant**

En tête de `CoupeModal.tsx`, après l'import de `CompanyEmblem` :
```tsx
import { CollectiveCounter } from '../badges/CollectiveCounter'
```

- [ ] **Step 2: Rendre le bandeau au-dessus des onglets/classement**

Juste après le bloc `coupe-season-label` / `coupe-rules-btn` (avant `<div className="leaderboard-tabs">`), insérer :
```tsx
          {state.collective && (
            <CollectiveCounter
              lieuxSortisOubli={state.collective.lieuxSortisOubli}
              lieuxVisites={state.collective.lieuxVisites}
              enigmesPercees={state.collective.enigmesPercees}
              variant="full"
            />
          )}
```
*(Si la position exacte diffère, le poser entre l'en-tête de saison et la première rangée d'onglets.)*

- [ ] **Step 3: Typecheck + build**

Run: `cd apps/explore-web && npx tsc --noEmit && npx vite build`
Expected: EXIT 0.

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/components/map/modals/CoupeModal.tsx
git commit -m "feat(coupe): compteur collectif dans la modale Coupe"
```

---

### Task 5: Intégration — Accueil, section Coupe (variante full)

**Files:**
- Modify: `apps/explore-web/src/components/home/coupe/CoupeHeritagesSection.tsx`

**Interfaces:**
- Consumes: `CollectiveCounter` (Task 3), `state.collective`.

- [ ] **Step 1: Importer**

```tsx
import { CollectiveCounter } from '../../map/badges/CollectiveCounter'
```

- [ ] **Step 2: Rendre le bandeau dans la branche « user dans une Maison »**

Dans le `return (` de la branche `if (userFactionId) {`, à l'intérieur du `<>`, **avant** `<CoupePodium`, insérer :
```tsx
        {state.collective && (
          <CollectiveCounter
            lieuxSortisOubli={state.collective.lieuxSortisOubli}
            lieuxVisites={state.collective.lieuxVisites}
            enigmesPercees={state.collective.enigmesPercees}
            variant="full"
          />
        )}
```

- [ ] **Step 3: Typecheck + build**

Run: `cd apps/explore-web && npx tsc --noEmit && npx vite build`
Expected: EXIT 0.

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/components/home/coupe/CoupeHeritagesSection.tsx
git commit -m "feat(coupe): compteur collectif en tête de la section Coupe (accueil)"
```

---

### Task 6: Intégration — Scoreboard carte (variante compact)

**Files:**
- Modify: `apps/explore-web/src/components/map/badges/FactionBar.tsx`

**Interfaces:**
- Consumes: `CollectiveCounter` (Task 3). Lit `state.collective` depuis le `get_coupe_state` déjà appelé par FactionBar.

- [ ] **Step 1: Importer + état local**

Import :
```tsx
import { CollectiveCounter } from './CollectiveCounter'
import type { CoupeCollective } from '../../../types/coupe'
```
Ajouter l'état (près de `const [stats, setStats] = ...`) :
```tsx
  const [collective, setCollective] = useState<CoupeCollective | null>(null)
```

- [ ] **Step 2: Capturer `collective` dans le `load()`**

Dans le `useEffect`/`load()`, après `setStats(enriched)` (où `state` est le résultat de `get_coupe_state`) :
```tsx
      setCollective(state.collective ?? null)
```

- [ ] **Step 3: Rendre la variante compacte au-dessus du rail**

Dans le `<div className="faction-scoreboard">`, juste après le bouton `faction-scoreboard-live` (avant `<div className="faction-scoreboard-chips">`), insérer :
```tsx
        {collective && (
          <CollectiveCounter
            lieuxSortisOubli={collective.lieuxSortisOubli}
            lieuxVisites={collective.lieuxVisites}
            enigmesPercees={collective.enigmesPercees}
            variant="compact"
          />
        )}
```

- [ ] **Step 4: Typecheck + build**

Run: `cd apps/explore-web && npx tsc --noEmit && npx vite build`
Expected: EXIT 0.

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/components/map/badges/FactionBar.tsx
git commit -m "feat(coupe): compteur collectif compact sur le scoreboard carte"
```

---

### Task 7: Vérification finale (live)

- [ ] **Step 1: Preview** — `pnpm dev` (déjà sur :3000), recharger fort.
- [ ] **Step 2: Modale Coupe** — bandeau « ⚜ Cette saison, ensemble : 🏛️ X · 📍 Y · 📜 Z » au-dessus du classement, chiffres = ceux du contrôle SQL (Task 1 Step 4).
- [ ] **Step 3: Accueil** — même bandeau en tête de la section Coupe (compte connecté à une Compagnie).
- [ ] **Step 4: Carte (mobile)** — ligne compacte au-dessus du scoreboard, sobre, ne re-déborde pas (masquée si tous les counts = 0).
- [ ] **Step 5: Non-régression** — le calcul de la Coupe et le classement sont inchangés.

---

## Notes de déploiement

- La migration 301 est **déjà en prod** dès Task 1 (additive, backward-compatible : l'ancien front ignore la clé `collective`).
- Le front nécessite un **build + deploy Netlify** (`--prod --dir <abs>/apps/explore-web/dist`) + bump CHANGELOG (entrée user-facing courte) — à faire en fin d'implémentation, sur GO d'Uriel.
