# Mode Démo Borne — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une version démo de l'app, déployée sur une borne tactile au stand, où le visiteur joue avec énergie/Couronnes infinies et énigmes en boucle, sans jamais écrire dans le vrai jeu.

**Architecture:** Un build dédié activé par `VITE_DEMO_MODE=true`. Le client Supabase singleton est enveloppé par un **proxy** qui trie les `.rpc()` : lectures réelles (vrai compte démo), écritures « faked » (réponse optimiste synthétique + store mémoire), autres écritures bloquées (no-op). Un `demoStore` Zustand porte l'état éphémère de session (énergie ∞, Couronnes ∞, découvertes, Gloire), remis à zéro entre visiteurs. Une coque kiosk (écran d'intro + timer d'inactivité) encadre la session.

**Tech Stack:** React + TypeScript, Vite, Zustand, supabase-js, react-router-dom, Vitest, Netlify.

## Global Constraints

- **Zéro écriture en base** : aucune action de la démo ne doit atteindre le réseau en écriture. Garde-fou principal = le proxy client (les RPC sont `SECURITY DEFINER`, donc les grants Postgres ne protègent pas).
- **Inerte en prod** : si `VITE_DEMO_MODE` est absent/`false`, aucun code démo ne s'exécute (proxy, coque, demoStore tous court-circuités).
- **Compte démo** : `demo@runesdechene.com` / id `7ccc2025-2f3b-4252-9d3b-0de3e4a8835f` (déjà créé, email confirmé, profil vierge). Mot de passe détenu par Uriel (jamais en git).
- **GPS** : aucune simulation de position. Tout est « à distance ».
- **Compagnies** : hors-démo, panneau bloquant. Aucun faking social.
- **Profil de départ** : vierge à chaque session (niveau 1, pas de compagnie, 0 découverte).
- **Reset** : écran d'intro après **10 min** d'inactivité ; tap « Entrer sur la carte » → reset → popup de bienvenue courte → jeu.
- **Énergie infinie** : jauge toujours pleine, affichage « ∞ ». **Couronnes infinies** : balance « ∞ », `capped=false` (les coffres restent visibles).
- **Textes user-facing** : body ≥ 18px ; pas de spoilers d'énigmes ; pas de jargon technique.

---

## File Structure

**Créés :**
- `src/lib/demo/isDemoMode.ts` — source unique de vérité du flag.
- `src/lib/demo/demoSupabase.ts` — proxy `.rpc()` (cœur du zéro-écriture).
- `src/lib/demo/demoSupabase.test.ts` — tests du proxy.
- `src/lib/demo/demoReadCache.ts` — cache des lectures pour résilience wifi.
- `src/stores/demoStore.ts` — état de session en mémoire (∞, découvertes, Gloire, reset).
- `src/stores/demoStore.test.ts` — tests du store.
- `src/components/demo/DemoKioskShell.tsx` — écran d'intro + timer d'inactivité + popup bienvenue.
- `src/components/demo/DemoKioskShell.css`
- `src/components/demo/DemoBlockedPanel.tsx` — panneau « non accessible en mode démo ».
- `src/components/demo/DemoBlockedPanel.css`
- `src/hooks/useDemoBootstrap.ts` — auto-login compte démo + préchargement carte.
- `.env.demo.example` — gabarit d'env pour le build démo.

**Modifiés :**
- `src/lib/supabase.ts` — wrapper conditionnel du client.
- `src/stores/crownsStore.ts` — lecture balance ∞ en démo.
- `src/pages/CompaniesPage.tsx` — panneau bloquant en démo.
- `src/pages/MobileLayout.tsx` — onglet Compagnies → panneau bloquant en démo.
- `src/App.tsx` — montage de `DemoKioskShell` quand démo.
- `src/components/map/badges/EnergyIndicator.tsx` — affichage « ∞ » en démo.

---

## Task 1: Helper `isDemoMode()`

**Files:**
- Create: `src/lib/demo/isDemoMode.ts`
- Test: `src/lib/demo/isDemoMode.test.ts`

**Interfaces:**
- Produces: `export function isDemoMode(): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/demo/isDemoMode.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { isDemoMode } from './isDemoMode'

describe('isDemoMode', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('returns true when VITE_DEMO_MODE is "true"', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    expect(isDemoMode()).toBe(true)
  })

  it('returns false when VITE_DEMO_MODE is absent', () => {
    vi.stubEnv('VITE_DEMO_MODE', '')
    expect(isDemoMode()).toBe(false)
  })

  it('returns false for any non-"true" value', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    expect(isDemoMode()).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter explore-web exec vitest run src/lib/demo/isDemoMode.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/demo/isDemoMode.ts
/** Source unique de vérité du mode démo. Lu depuis le flag de build. */
export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter explore-web exec vitest run src/lib/demo/isDemoMode.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/demo/isDemoMode.ts src/lib/demo/isDemoMode.test.ts
git commit -m "feat(demo): helper isDemoMode() derrière VITE_DEMO_MODE"
```

---

## Task 2: `demoStore` — état de session en mémoire

**Files:**
- Create: `src/stores/demoStore.ts`
- Test: `src/stores/demoStore.test.ts`

**Interfaces:**
- Produces:
  - `useDemoStore` (Zustand store) avec state :
    - `energy: number` (toujours = `maxEnergy`), `maxEnergy: number` (défaut 9)
    - `crownsBalance: number` (défaut `Infinity`)
    - `discoveredIds: Set<string>`
    - `glory: number` (défaut 0)
  - actions :
    - `addDiscovered(placeId: string): void`
    - `addGlory(amount: number): void`
    - `reset(): void` — remet `discoveredIds` vide, `glory` 0, énergie pleine.

- [ ] **Step 1: Write the failing test**

```ts
// src/stores/demoStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useDemoStore } from './demoStore'

describe('demoStore', () => {
  beforeEach(() => { useDemoStore.getState().reset() })

  it('démarre vierge : énergie pleine, Gloire 0, 0 découverte, Couronnes infinies', () => {
    const s = useDemoStore.getState()
    expect(s.energy).toBe(s.maxEnergy)
    expect(s.glory).toBe(0)
    expect(s.discoveredIds.size).toBe(0)
    expect(s.crownsBalance).toBe(Infinity)
  })

  it('addDiscovered ajoute un id sans toucher à l’énergie', () => {
    useDemoStore.getState().addDiscovered('place-1')
    const s = useDemoStore.getState()
    expect(s.discoveredIds.has('place-1')).toBe(true)
    expect(s.energy).toBe(s.maxEnergy)
  })

  it('addGlory accumule', () => {
    useDemoStore.getState().addGlory(1)
    useDemoStore.getState().addGlory(2)
    expect(useDemoStore.getState().glory).toBe(3)
  })

  it('reset efface découvertes et Gloire', () => {
    useDemoStore.getState().addDiscovered('p')
    useDemoStore.getState().addGlory(5)
    useDemoStore.getState().reset()
    const s = useDemoStore.getState()
    expect(s.discoveredIds.size).toBe(0)
    expect(s.glory).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter explore-web exec vitest run src/stores/demoStore.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/stores/demoStore.ts
import { create } from 'zustand'

const DEFAULT_MAX_ENERGY = 9

interface DemoStoreState {
  energy: number
  maxEnergy: number
  crownsBalance: number
  discoveredIds: Set<string>
  glory: number
  addDiscovered: (placeId: string) => void
  addGlory: (amount: number) => void
  reset: () => void
}

export const useDemoStore = create<DemoStoreState>((set, get) => ({
  energy: DEFAULT_MAX_ENERGY,
  maxEnergy: DEFAULT_MAX_ENERGY,
  crownsBalance: Infinity,
  discoveredIds: new Set<string>(),
  glory: 0,

  addDiscovered: (placeId) => {
    const next = new Set(get().discoveredIds)
    next.add(placeId)
    set({ discoveredIds: next })
  },

  addGlory: (amount) => set({ glory: get().glory + amount }),

  reset: () => set({
    energy: DEFAULT_MAX_ENERGY,
    maxEnergy: DEFAULT_MAX_ENERGY,
    crownsBalance: Infinity,
    discoveredIds: new Set<string>(),
    glory: 0,
  }),
}))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter explore-web exec vitest run src/stores/demoStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/demoStore.ts src/stores/demoStore.test.ts
git commit -m "feat(demo): demoStore (énergie/Couronnes ∞, découvertes, Gloire, reset)"
```

---

## Task 3: Cache de lecture (résilience wifi)

**Files:**
- Create: `src/lib/demo/demoReadCache.ts`
- Test: `src/lib/demo/demoReadCache.test.ts`

**Interfaces:**
- Produces:
  - `cacheKey(rpcName: string, args: unknown): string`
  - `getCached(rpcName: string, args: unknown): unknown | undefined`
  - `setCached(rpcName: string, args: unknown, data: unknown): void`
  - `CACHEABLE_READS: ReadonlySet<string>` = `{ 'get_map_places', 'get_map_veilles', 'get_daily_enigma' }`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/demo/demoReadCache.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { getCached, setCached, cacheKey, CACHEABLE_READS } from './demoReadCache'

describe('demoReadCache', () => {
  beforeEach(() => { setCached('__reset__', null, undefined as unknown) })

  it('cacheKey est stable pour les mêmes args', () => {
    expect(cacheKey('get_map_places', { p_type: 'all' }))
      .toBe(cacheKey('get_map_places', { p_type: 'all' }))
  })

  it('setCached puis getCached renvoie la donnée', () => {
    setCached('get_map_places', { p_type: 'all' }, [{ id: 1 }])
    expect(getCached('get_map_places', { p_type: 'all' })).toEqual([{ id: 1 }])
  })

  it('getCached renvoie undefined si absent', () => {
    expect(getCached('get_map_veilles', { x: 9 })).toBeUndefined()
  })

  it('CACHEABLE_READS contient les lectures carte/énigme', () => {
    expect(CACHEABLE_READS.has('get_map_places')).toBe(true)
    expect(CACHEABLE_READS.has('get_map_veilles')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter explore-web exec vitest run src/lib/demo/demoReadCache.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/demo/demoReadCache.ts
const cache = new Map<string, unknown>()

export const CACHEABLE_READS: ReadonlySet<string> = new Set([
  'get_map_places',
  'get_map_veilles',
  'get_daily_enigma',
])

export function cacheKey(rpcName: string, args: unknown): string {
  return `${rpcName}:${JSON.stringify(args ?? null)}`
}

export function getCached(rpcName: string, args: unknown): unknown | undefined {
  return cache.get(cacheKey(rpcName, args))
}

export function setCached(rpcName: string, args: unknown, data: unknown): void {
  if (data === undefined) { cache.clear(); return } // sentinelle de reset pour les tests
  cache.set(cacheKey(rpcName, args), data)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter explore-web exec vitest run src/lib/demo/demoReadCache.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/demo/demoReadCache.ts src/lib/demo/demoReadCache.test.ts
git commit -m "feat(demo): cache de lecture pour résilience wifi"
```

---

## Task 4: Proxy Supabase — routeur `.rpc()`

C'est le cœur du « zéro écriture ». Fonction pure et testable : on lui passe l'objet client réel et elle renvoie un client dont `.rpc()` trie.

**Files:**
- Create: `src/lib/demo/demoSupabase.ts`
- Test: `src/lib/demo/demoSupabase.test.ts`

**Interfaces:**
- Consumes: `useDemoStore` (Task 2), `getCached`/`setCached`/`CACHEABLE_READS` (Task 3).
- Produces:
  - `FAKED_WRITES: ReadonlySet<string>` = `{ 'discover_place', 'answer_enigma', 'answer_fragment_enigma', 'invest_crowns', 'harvest_crown' }`
  - `classifyRpc(name: string): 'read' | 'faked' | 'blocked'`
    - `faked` si dans `FAKED_WRITES`
    - `read` si dans `FAKED_WRITES`… non : `read` si le nom commence par `get_`/`list_`/`fetch_` OU est une lecture connue
    - `blocked` sinon (écriture inconnue)
  - `fakeResponse(name: string, args: Record<string, unknown>): { data: unknown; error: null }` — réponse synthétique optimiste, met aussi à jour `useDemoStore`.
  - `wrapSupabaseForDemo<T extends { rpc: Function }>(client: T): T` — renvoie un proxy dont `.rpc()` applique le tri ; tout le reste du client est inchangé.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/demo/demoSupabase.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { classifyRpc, fakeResponse, wrapSupabaseForDemo, FAKED_WRITES } from './demoSupabase'
import { useDemoStore } from '../../stores/demoStore'

describe('classifyRpc', () => {
  it('classe les écritures faked', () => {
    expect(classifyRpc('discover_place')).toBe('faked')
    expect(classifyRpc('answer_enigma')).toBe('faked')
    expect(classifyRpc('invest_crowns')).toBe('faked')
  })
  it('classe les lectures', () => {
    expect(classifyRpc('get_user_energy')).toBe('read')
    expect(classifyRpc('get_map_places')).toBe('read')
    expect(classifyRpc('list_something')).toBe('read')
  })
  it('classe toute écriture inconnue comme blocked', () => {
    expect(classifyRpc('plant_flag')).toBe('blocked')
    expect(classifyRpc('mute_user')).toBe('blocked')
    expect(classifyRpc('send_chat_message')).toBe('blocked')
  })
})

describe('fakeResponse', () => {
  beforeEach(() => { useDemoStore.getState().reset() })

  it('discover_place ajoute la découverte et renvoie un succès sans error', () => {
    const r = fakeResponse('discover_place', { p_place_id: 'place-9' })
    expect(r.error).toBeNull()
    expect(useDemoStore.getState().discoveredIds.has('place-9')).toBe(true)
  })

  it('answer_enigma renvoie toujours un succès (pas de champ error)', () => {
    const r = fakeResponse('answer_enigma', { p_enigma_id: 'e1' }) as { data: any }
    expect(r.data.error).toBeUndefined()
    expect(r.data.correct).toBe(true)
  })
})

describe('wrapSupabaseForDemo', () => {
  beforeEach(() => { useDemoStore.getState().reset() })

  it('une écriture faked ne touche jamais le client réel', async () => {
    const realRpc = vi.fn()
    const client = { rpc: realRpc, from: vi.fn() }
    const wrapped = wrapSupabaseForDemo(client)
    const { error } = await wrapped.rpc('discover_place', { p_place_id: 'x' })
    expect(error).toBeNull()
    expect(realRpc).not.toHaveBeenCalled()
  })

  it('une écriture bloquée ne touche jamais le client réel', async () => {
    const realRpc = vi.fn()
    const wrapped = wrapSupabaseForDemo({ rpc: realRpc })
    await wrapped.rpc('plant_flag', {})
    expect(realRpc).not.toHaveBeenCalled()
  })

  it('une lecture passe au client réel', () => {
    const builder = {}
    const realRpc = vi.fn().mockReturnValue(builder)
    const wrapped = wrapSupabaseForDemo({ rpc: realRpc })
    const out = wrapped.rpc('get_map_places', { p_type: 'all' })
    expect(realRpc).toHaveBeenCalledWith('get_map_places', { p_type: 'all' })
    expect(out).toBe(builder)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter explore-web exec vitest run src/lib/demo/demoSupabase.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/demo/demoSupabase.ts
import { useDemoStore } from '../../stores/demoStore'

export const FAKED_WRITES: ReadonlySet<string> = new Set([
  'discover_place',
  'answer_enigma',
  'answer_fragment_enigma',
  'invest_crowns',
  'harvest_crown',
])

const READ_PREFIXES = ['get_', 'list_', 'fetch_']

export function classifyRpc(name: string): 'read' | 'faked' | 'blocked' {
  if (FAKED_WRITES.has(name)) return 'faked'
  if (READ_PREFIXES.some((p) => name.startsWith(p))) return 'read'
  return 'blocked'
}

export function fakeResponse(
  name: string,
  args: Record<string, unknown>,
): { data: unknown; error: null } {
  const demo = useDemoStore.getState()
  switch (name) {
    case 'discover_place': {
      const placeId = String(args.p_place_id ?? '')
      if (placeId) demo.addDiscovered(placeId)
      demo.addGlory(1)
      return {
        data: { crownsGain: 0, questBonus: 0, newCrownsBalance: Infinity },
        error: null,
      }
    }
    case 'answer_enigma':
    case 'answer_fragment_enigma':
      demo.addGlory(1)
      return {
        data: { correct: true, influenceGain: 1, eruditionGain: 1, newCrownsBalance: Infinity },
        error: null,
      }
    case 'invest_crowns':
      return { data: { success: true, newCrownsBalance: Infinity }, error: null }
    case 'harvest_crown':
      return { data: { success: true, balance: Infinity }, error: null }
    default:
      return { data: { success: true }, error: null }
  }
}

/** No-op pour les écritures bloquées : rien ne part au réseau. */
function blockedResponse(name: string): { data: null; error: null } {
  if (import.meta.env.DEV) console.info(`[demo] écriture bloquée (no-op) : ${name}`)
  return { data: null, error: null }
}

export function wrapSupabaseForDemo<T extends { rpc: (...a: any[]) => any }>(client: T): T {
  const realRpc = client.rpc.bind(client)
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'rpc') {
        return (name: string, args: Record<string, unknown> = {}) => {
          const kind = classifyRpc(name)
          if (kind === 'read') return realRpc(name, args)
          if (kind === 'faked') return Promise.resolve(fakeResponse(name, args))
          return Promise.resolve(blockedResponse(name))
        }
      }
      return Reflect.get(target, prop, receiver)
    },
  }) as T
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter explore-web exec vitest run src/lib/demo/demoSupabase.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/demo/demoSupabase.ts src/lib/demo/demoSupabase.test.ts
git commit -m "feat(demo): proxy Supabase (read passthrough / faked / blocked)"
```

---

## Task 5: Override des lectures ∞ (énergie / Couronnes / profil)

Le proxy de Task 4 laisse passer les lectures. Pour l'énergie/Couronnes/Gloire infinies, on intercepte aussi trois **lectures** spécifiques et on renvoie une réponse dérivée du `demoStore` au lieu du réseau.

**Files:**
- Modify: `src/lib/demo/demoSupabase.ts`
- Modify: `src/lib/demo/demoSupabase.test.ts`

**Interfaces:**
- Produces: `OVERRIDDEN_READS: ReadonlySet<string>` = `{ 'get_user_energy', 'get_my_crowns_state', 'get_player_profile' }` ; `classifyRpc` renvoie `'faked'` pour ces noms ; `fakeResponse` gère ces trois cas.

- [ ] **Step 1: Write the failing test (ajouter au fichier existant)**

```ts
// dans demoSupabase.test.ts
describe('lectures ∞ overridées', () => {
  beforeEach(() => { useDemoStore.getState().reset() })

  it('get_user_energy renvoie une jauge pleine', () => {
    const { data } = fakeResponse('get_user_energy', {}) as { data: any }
    expect(data.energy).toBe(data.maxEnergy)
    expect(data.nextPointIn).toBe(0)
  })

  it('get_my_crowns_state renvoie balance infinie et capped=false', () => {
    const { data } = fakeResponse('get_my_crowns_state', {}) as { data: any }
    expect(data.balance).toBe(Infinity)
    expect(data.capped).toBe(false)
    expect(Array.isArray(data.harvestable)).toBe(true)
  })

  it('get_user_energy est classé faked (pas read)', () => {
    expect(classifyRpc('get_user_energy')).toBe('faked')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter explore-web exec vitest run src/lib/demo/demoSupabase.test.ts`
Expected: FAIL (get_user_energy classé `read`, pas de cas dans fakeResponse).

- [ ] **Step 3: Modifier l'implémentation**

Dans `demoSupabase.ts` :

```ts
export const OVERRIDDEN_READS: ReadonlySet<string> = new Set([
  'get_user_energy',
  'get_my_crowns_state',
  'get_player_profile',
])
```

Modifier `classifyRpc` pour traiter ces lectures comme `faked` AVANT le test de préfixe :

```ts
export function classifyRpc(name: string): 'read' | 'faked' | 'blocked' {
  if (FAKED_WRITES.has(name) || OVERRIDDEN_READS.has(name)) return 'faked'
  if (READ_PREFIXES.some((p) => name.startsWith(p))) return 'read'
  return 'blocked'
}
```

Ajouter les cas dans `fakeResponse` (avant le `default`) :

```ts
    case 'get_user_energy': {
      const { energy, maxEnergy } = useDemoStore.getState()
      return { data: { energy, maxEnergy, nextPointIn: 0, energyCycle: 0 }, error: null }
    }
    case 'get_my_crowns_state':
      return { data: { balance: Infinity, capped: false, harvestable: [] }, error: null }
    case 'get_player_profile': {
      const { glory } = useDemoStore.getState()
      return {
        data: { level: 1, xp_total: glory, glory, conquest_points: glory, veteran_first_era: false },
        error: null,
      }
    }
```

> Note : `get_player_profile` renvoie un profil vierge (niveau 1) avec la Gloire de session. Le niveau ne se recalcule pas finement en démo (simplification assumée) ; c'est la Gloire et les toasts qui donnent le feedback de progression.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter explore-web exec vitest run src/lib/demo/demoSupabase.test.ts`
Expected: PASS (toute la suite).

- [ ] **Step 5: Commit**

```bash
git add src/lib/demo/demoSupabase.ts src/lib/demo/demoSupabase.test.ts
git commit -m "feat(demo): override lectures énergie/Couronnes/profil pour l'∞"
```

---

## Task 6: Brancher le proxy dans le client Supabase

**Files:**
- Modify: `src/lib/supabase.ts`

**Interfaces:**
- Consumes: `isDemoMode` (Task 1), `wrapSupabaseForDemo` (Task 4).
- Produces: `supabase` est le client wrappé quand `isDemoMode()`, sinon inchangé.

- [ ] **Step 1: Modifier `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js'
import { isDemoMode } from './demo/isDemoMode'
import { wrapSupabaseForDemo } from './demo/demoSupabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Configuration Supabase manquante. Vérifiez votre fichier .env')
}

const realClient = createClient(supabaseUrl, supabaseAnonKey)

export const supabase = isDemoMode() ? wrapSupabaseForDemo(realClient) : realClient
```

- [ ] **Step 2: Vérifier le build prod (mode normal inerte)**

Run: `pnpm --filter explore-web build`
Expected: build OK, aucune régression de types.

- [ ] **Step 3: Vérifier les tests existants**

Run: `pnpm --filter explore-web test`
Expected: toute la suite PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat(demo): wrapper conditionnel du client Supabase"
```

---

## Task 7: Affichage « ∞ » de l'énergie

**Files:**
- Modify: `src/components/map/badges/EnergyIndicator.tsx`

**Interfaces:**
- Consumes: `isDemoMode` (Task 1).

- [ ] **Step 1: Localiser le rendu du chiffre d'énergie**

Lire `src/components/map/badges/EnergyIndicator.tsx` et repérer où `energy`/`maxEnergy` sont rendus (ex. `{Math.floor(energy)}`).

- [ ] **Step 2: Remplacer par « ∞ » en démo**

Importer `isDemoMode` et remplacer l'affichage numérique :

```tsx
import { isDemoMode } from '../../../lib/demo/isDemoMode'
// ...
{isDemoMode() ? '∞' : Math.floor(energy)}
```

(Adapter au JSX réel : si la jauge affiche un ratio `energy/maxEnergy`, afficher `∞` à la place du compteur, jauge visuellement pleine.)

- [ ] **Step 3: Vérifier en local (mode démo)**

Run: `VITE_DEMO_MODE=true pnpm --filter explore-web dev`
Vérifier visuellement : l'indicateur d'énergie affiche « ∞ », découvrir un lieu ne le décrémente pas.

- [ ] **Step 4: Commit**

```bash
git add src/components/map/badges/EnergyIndicator.tsx
git commit -m "feat(demo): affichage ∞ pour l'énergie"
```

---

## Task 8: Couronnes ∞ dans le store

`crownsStore.refresh` lit `get_my_crowns_state` — déjà overridé par le proxy (Task 5) qui renvoie `balance: Infinity`. Mais `setBalance`/`harvest` réécrivent `safeStorage` avec `String(Infinity)` = `"Infinity"`, et le badge affiche `Infinity`. On veut afficher « ∞ ».

**Files:**
- Modify: `src/stores/crownsStore.ts`
- Modify: composant d'affichage de la balance (repérer via grep `balance` dans `components/`)

**Interfaces:**
- Consumes: `isDemoMode`.

- [ ] **Step 1: Court-circuiter la persistance en démo dans `crownsStore`**

Dans `crownsStore.ts`, en tête de `refresh`, `harvest` et `setBalance`, si `isDemoMode()` est vrai, forcer `set({ balance: Infinity, capped: false })` et retourner tôt (ne pas écrire `safeStorage` avec `"Infinity"`). Importer `isDemoMode`.

```ts
import { isDemoMode } from '../lib/demo/isDemoMode'
// refresh:
refresh: async (userId) => {
  if (isDemoMode()) { set({ balance: Infinity, capped: false }); return }
  // ... corps existant
}
// setBalance:
setBalance: (newBalance) => {
  if (isDemoMode()) { set({ balance: Infinity, capped: false }); return }
  // ... corps existant
}
```

- [ ] **Step 2: Afficher « ∞ » dans le badge Couronnes**

Repérer le composant qui rend `balance` (ex. `CrownsInfoModal` / badge HUD via grep) et afficher `isDemoMode() ? '∞' : balance`.

Run: `grep -rn "balance" src/components/ | grep -iE "crown|couronne"`

- [ ] **Step 3: Vérifier en local**

Run: `VITE_DEMO_MODE=true pnpm --filter explore-web dev`
Vérifier : balance Couronnes affiche « ∞ », dépenser via `invest_crowns` ne débite pas.

- [ ] **Step 4: Commit**

```bash
git add src/stores/crownsStore.ts src/components/
git commit -m "feat(demo): Couronnes ∞ (store + affichage)"
```

---

## Task 9: Panneau bloquant Compagnies

**Files:**
- Create: `src/components/demo/DemoBlockedPanel.tsx`
- Create: `src/components/demo/DemoBlockedPanel.css`
- Modify: `src/pages/CompaniesPage.tsx`

**Interfaces:**
- Produces: `export function DemoBlockedPanel({ feature }: { feature: string }): JSX.Element`

- [ ] **Step 1: Créer le composant**

```tsx
// src/components/demo/DemoBlockedPanel.tsx
import './DemoBlockedPanel.css'

export function DemoBlockedPanel({ feature }: { feature: string }) {
  return (
    <div className="demo-blocked">
      <div className="demo-blocked-card">
        <h2 className="demo-blocked-title">Fonction réservée</h2>
        <p className="demo-blocked-text">
          {feature} ne sont pas accessibles en mode démo.
        </p>
        <p className="demo-blocked-hint">
          Crée ton compte pour rejoindre une Compagnie et jouer pour de vrai.
        </p>
      </div>
    </div>
  )
}
```

```css
/* src/components/demo/DemoBlockedPanel.css */
.demo-blocked { display: flex; align-items: center; justify-content: center; min-height: 60vh; padding: 2rem; }
.demo-blocked-card { max-width: 420px; text-align: center; background: var(--color-surface, #fff); border-radius: 16px; padding: 2rem; box-shadow: 0 8px 30px rgba(0,0,0,.12); }
.demo-blocked-title { font-size: 22px; margin: 0 0 .75rem; color: var(--color-ink, #4A3728); }
.demo-blocked-text { font-size: 18px; margin: 0 0 .5rem; }
.demo-blocked-hint { font-size: 16px; opacity: .7; margin: 0; }
```

- [ ] **Step 2: Brancher dans `CompaniesPage.tsx`**

En tête du composant `CompaniesPage`, court-circuiter en démo :

```tsx
import { isDemoMode } from '../lib/demo/isDemoMode'
import { DemoBlockedPanel } from '../components/demo/DemoBlockedPanel'
// dans le rendu :
if (isDemoMode()) return <DemoBlockedPanel feature="Les Compagnies" />
```

- [ ] **Step 3: Vérifier en local**

Run: `VITE_DEMO_MODE=true pnpm --filter explore-web dev`
Naviguer vers Compagnies → le panneau bloquant s'affiche.

- [ ] **Step 4: Commit**

```bash
git add src/components/demo/DemoBlockedPanel.tsx src/components/demo/DemoBlockedPanel.css src/pages/CompaniesPage.tsx
git commit -m "feat(demo): panneau bloquant Compagnies"
```

---

## Task 10: Bootstrap démo — auto-login + préchargement carte

**Files:**
- Create: `src/hooks/useDemoBootstrap.ts`

**Interfaces:**
- Consumes: `isDemoMode`, `supabase`, `setCached`/`CACHEABLE_READS` (Task 3).
- Produces: `export function useDemoBootstrap(): { ready: boolean }` — au montage : si pas de session, `signInWithPassword` sur le compte démo (identifiants depuis env), puis précharge la carte en cache.

- [ ] **Step 1: Créer le hook**

```ts
// src/hooks/useDemoBootstrap.ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isDemoMode } from '../lib/demo/isDemoMode'
import { setCached } from '../lib/demo/demoReadCache'

const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL as string | undefined
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD as string | undefined

export function useDemoBootstrap(): { ready: boolean } {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isDemoMode()) { setReady(true); return }
    let cancelled = false

    async function boot() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session && DEMO_EMAIL && DEMO_PASSWORD) {
        await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD })
      }
      // Préchargement carte (réchauffe le cache de résilience)
      const places = await supabase.rpc('get_map_places', { p_type: 'all', p_limit: 5000 })
      if (places?.data) setCached('get_map_places', { p_type: 'all', p_limit: 5000 }, places.data)
      const veilles = await supabase.rpc('get_map_veilles', {})
      if (veilles?.data) setCached('get_map_veilles', {}, veilles.data)
      if (!cancelled) setReady(true)
    }
    void boot()
    return () => { cancelled = true }
  }, [])

  return { ready }
}
```

> Les identifiants démo viennent de `VITE_DEMO_EMAIL` / `VITE_DEMO_PASSWORD` (injectés au build Netlify démo uniquement, jamais committés).

- [ ] **Step 2: Vérifier le build**

Run: `pnpm --filter explore-web build`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDemoBootstrap.ts
git commit -m "feat(demo): bootstrap auto-login + préchargement carte"
```

---

## Task 11: Coque kiosk — écran d'intro + timer d'inactivité + popup bienvenue

**Files:**
- Create: `src/components/demo/DemoKioskShell.tsx`
- Create: `src/components/demo/DemoKioskShell.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `isDemoMode`, `useDemoStore` (`reset`), `useDemoBootstrap`.
- Produces: `export function DemoKioskShell({ children }: { children: React.ReactNode }): JSX.Element` — affiche l'écran d'intro au boot et après 10 min d'inactivité ; « Entrer sur la carte » → `reset()` + popup bienvenue courte → enfants.

- [ ] **Step 1: Créer la coque**

```tsx
// src/components/demo/DemoKioskShell.tsx
import { useEffect, useRef, useState, useCallback } from 'react'
import { useDemoStore } from '../../stores/demoStore'
import './DemoKioskShell.css'

const IDLE_MS = 10 * 60 * 1000 // 10 minutes

export function DemoKioskShell({ children }: { children: React.ReactNode }) {
  const [showIntro, setShowIntro] = useState(true)
  const [showWelcome, setShowWelcome] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  const armIdle = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setShowIntro(true), IDLE_MS)
  }, [])

  useEffect(() => {
    if (showIntro) { window.clearTimeout(timer.current); return }
    const onActivity = () => armIdle()
    armIdle()
    window.addEventListener('pointerdown', onActivity)
    window.addEventListener('scroll', onActivity, true)
    return () => {
      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('scroll', onActivity, true)
      window.clearTimeout(timer.current)
    }
  }, [showIntro, armIdle])

  function enter() {
    useDemoStore.getState().reset()
    setShowIntro(false)
    setShowWelcome(true)
  }

  return (
    <>
      {children}
      {showWelcome && (
        <div className="demo-welcome" onClick={() => setShowWelcome(false)}>
          <div className="demo-welcome-card" onClick={(e) => e.stopPropagation()}>
            <h2>Bienvenue dans le mouvement Runes de Chêne</h2>
            <p>Explore la carte, découvre des lieux, résous des énigmes. Amuse-toi !</p>
            <button onClick={() => setShowWelcome(false)}>Commencer</button>
          </div>
        </div>
      )}
      {showIntro && (
        <div className="demo-intro">
          <div className="demo-intro-veil" />
          <div className="demo-intro-content">
            <h1>Runes de Chêne</h1>
            <button className="demo-intro-cta" onClick={enter}>Entrer sur la carte</button>
          </div>
        </div>
      )}
    </>
  )
}
```

```css
/* src/components/demo/DemoKioskShell.css */
.demo-intro { position: fixed; inset: 0; z-index: 9999; background-image: url('/demo-intro.jpg'); background-size: cover; background-position: center; display: flex; align-items: center; justify-content: center; }
.demo-intro-veil { position: absolute; inset: 0; background: rgba(20,15,10,.55); }
.demo-intro-content { position: relative; text-align: center; color: #fff; }
.demo-intro-content h1 { font-size: 48px; margin-bottom: 2rem; letter-spacing: .04em; }
.demo-intro-cta { font-size: 22px; padding: 1rem 2.5rem; border-radius: 999px; border: none; background: var(--color-accent, #C8A24B); color: #1a1208; cursor: pointer; }
.demo-welcome { position: fixed; inset: 0; z-index: 10000; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; padding: 1.5rem; }
.demo-welcome-card { max-width: 460px; background: var(--color-surface, #fff); border-radius: 16px; padding: 2rem; text-align: center; }
.demo-welcome-card h2 { font-size: 22px; margin: 0 0 1rem; }
.demo-welcome-card p { font-size: 18px; margin: 0 0 1.5rem; }
.demo-welcome-card button { font-size: 18px; padding: .75rem 2rem; border-radius: 999px; border: none; background: var(--color-accent, #C8A24B); cursor: pointer; }
```

> Déposer une image `apps/explore-web/public/demo-intro.jpg` (visuel du stand). À fournir par Uriel.

- [ ] **Step 2: Monter la coque dans `App.tsx` en mode démo**

Dans `App.tsx`, envelopper le `<BrowserRouter>` (ou son contenu) : en démo, wrapper avec `<DemoKioskShell>` et déclencher `useDemoBootstrap()`. Garder le rendu normal hors démo.

```tsx
import { isDemoMode } from './lib/demo/isDemoMode'
import { DemoKioskShell } from './components/demo/DemoKioskShell'
import { useDemoBootstrap } from './hooks/useDemoBootstrap'
// dans App() :
const demo = isDemoMode()
useDemoBootstrap()
// rendu :
const tree = (<BrowserRouter>{/* ...routes existantes... */}</BrowserRouter>)
return demo ? <DemoKioskShell>{tree}</DemoKioskShell> : tree
```

- [ ] **Step 3: Vérifier en local (flux complet)**

Run: `VITE_DEMO_MODE=true VITE_DEMO_EMAIL=demo@runesdechene.com VITE_DEMO_PASSWORD=... pnpm --filter explore-web dev`
Vérifier : écran d'intro au chargement → « Entrer sur la carte » → popup bienvenue → carte jouable (énergie ∞, Couronnes ∞, découvrir un lieu OK, énigme rejouable, Compagnies bloquées).

- [ ] **Step 4: Commit**

```bash
git add src/components/demo/DemoKioskShell.tsx src/components/demo/DemoKioskShell.css src/App.tsx
git commit -m "feat(demo): coque kiosk (intro + idle 10min + popup bienvenue)"
```

---

## Task 12: Gabarit d'env + doc de déploiement Netlify

**Files:**
- Create: `apps/explore-web/.env.demo.example`
- Modify: `apps/explore-web/CLAUDE.md` (section déploiement démo)

- [ ] **Step 1: Créer `.env.demo.example`**

```bash
# apps/explore-web/.env.demo.example
# Build démo borne (demo.runesdechene.com). NE PAS committer les vraies valeurs.
VITE_SUPABASE_URL=https://ukpapqssgsxirsgmcvof.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_DEMO_MODE=true
VITE_DEMO_EMAIL=demo@runesdechene.com
VITE_DEMO_PASSWORD=<mot de passe compte démo>
```

- [ ] **Step 2: Documenter le déploiement dans `apps/explore-web/CLAUDE.md`**

Ajouter une section « Déploiement borne démo » : site Netlify séparé pointant sur `demo.runesdechene.com`, variables d'env ci-dessus (dont `VITE_DEMO_MODE=true`), borne en mode kiosk plein écran sur cette URL.

- [ ] **Step 3: Vérifier le build démo**

Run: `cp apps/explore-web/.env.demo.example apps/explore-web/.env.demo` (remplir les valeurs) puis `pnpm --filter explore-web build`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/.env.demo.example apps/explore-web/CLAUDE.md
git commit -m "docs(demo): gabarit env + déploiement Netlify borne"
```

---

## Task 13: Vérification de bout en bout (manuelle)

**Files:** aucun (vérification).

- [ ] **Step 1: Suite de tests complète**

Run: `pnpm --filter explore-web test`
Expected: PASS.

- [ ] **Step 2: Build prod normal (inertie démo)**

Run: `pnpm --filter explore-web build` (sans `VITE_DEMO_MODE`)
Expected: build OK ; vérifier que `supabase` est le client réel (pas de proxy).

- [ ] **Step 3: Run démo local — checklist**

Run: `VITE_DEMO_MODE=true VITE_DEMO_EMAIL=... VITE_DEMO_PASSWORD=... pnpm --filter explore-web dev`
Vérifier chaque point :
  - [ ] Écran d'intro au boot, gros bouton « Entrer sur la carte ».
  - [ ] Popup de bienvenue courte, puis carte.
  - [ ] Énergie affiche « ∞ », découvrir un lieu n'décrémente pas.
  - [ ] Couronnes affiche « ∞ », dépenser ne débite pas.
  - [ ] Énigme : résolue → toast de réussite ; rejouable.
  - [ ] Compagnies → panneau bloquant.
  - [ ] Onglet réseau (DevTools) : **aucune requête POST d'écriture** vers Supabase pendant les actions (discover/answer/invest).
  - [ ] Inactivité 10 min (ou baisser `IDLE_MS` temporairement) → retour écran d'intro, session remise à zéro.

- [ ] **Step 4: Commit éventuel des ajustements**

```bash
git add -A
git commit -m "test(demo): vérification bout-en-bout borne"
```

---

## Notes de sécurité & dette

- Le « zéro écriture » repose **entièrement sur le proxy client**. Tout nouveau RPC d'écriture ajouté à l'app sera **bloqué par défaut** en démo (classifyRpc → `blocked`), ce qui est le comportement conservateur voulu. Si une future feature démo doit écrire un faux résultat, l'ajouter explicitement à `FAKED_WRITES` + un cas dans `fakeResponse`.
- Le mot de passe démo vit uniquement dans les variables d'env Netlify et la session de la borne. Jamais dans git.
- `get_player_profile` faked ne recalcule pas le niveau (reste 1). Si on veut une vraie montée de niveau visuelle plus tard, brancher les seuils de niveau côté client sur `demoStore.glory`.
