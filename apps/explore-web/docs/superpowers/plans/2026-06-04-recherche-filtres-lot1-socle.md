# Recherche & Filtres — Lot 1 (Socle) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser le socle de la fonction Recherche & Filtres : barre flottante + overlay de recherche de **lieux** (client-side), panneau de filtres **Tags / Progression / Époque** combinables avec filtrage live, le tout câblé sur la carte.

**Architecture:** Tout est client-side. Une migration étend `get_map_places` (`eraId`, `tagIds[]`, `address`). `usePlaces` mappe ces champs et **publie** une liste légère de lieux dans un nouveau store Zustand `searchFilterStore`. La recherche (overlay) et le compteur (panneau) lisent cette liste ; `ExploreMap` applique **le même prédicat pur** (`placeMatchesFilters`) sur son GeoJSON pour masquer/afficher les marqueurs. Navigation via `mapStore.requestFlyTo`.

**Tech Stack:** React 18 + TypeScript strict, Zustand v5, MapLibre (via `@vis.gl/react-maplibre`), Supabase RPC, Vitest (logique pure uniquement).

**Spec :** `docs/superpowers/specs/2026-06-04-recherche-et-filtres-design.md`

**Hors périmètre Lot 1 (lots suivants) :** recherche Villes (Nominatim) + Joueurs (RPC), famille gated « Factions & territoire », toggle Événements, partage des filtres avec les listes home.

---

## File Structure

```
supabase/migrations/
└─ 212_map_places_facets.sql                 CREATE: get_map_places + eraId/tagIds/address

apps/explore-web/
├─ vitest.config.ts                          CREATE: config test (jsdom non requis — logique pure)
├─ package.json                              MODIFY: devDep vitest + script "test"
├─ src/lib/placeSearch.ts                    CREATE: normalize() + searchPlaces()
├─ src/lib/placeSearch.test.ts               CREATE: tests
├─ src/stores/searchFilterStore.ts           CREATE: state + placeMatchesFilters() + taxonomies
├─ src/stores/searchFilterStore.test.ts      CREATE: tests du prédicat + activeFilterCount
├─ src/hooks/usePlaces.ts                     MODIFY: MapPlace + PlaceProperties + publication store
├─ src/components/map/search/
│  ├─ SearchBar.tsx                           CREATE: barre flottante + bouton entonnoir (badge)
│  ├─ SearchBar.css                           CREATE
│  ├─ SearchOverlay.tsx                       CREATE: plein écran, résultats Lieux
│  └─ SearchOverlay.css                       CREATE
├─ src/components/map/filters/
│  ├─ FilterSheet.tsx                         CREATE: Tags / Progression / Époque + compteur + reset
│  └─ FilterSheet.css                         CREATE
├─ src/components/map/core/ExploreMap.tsx     MODIFY: filteredGeojson → MapMarkers
└─ src/pages/MapPage.tsx                      MODIFY: monter <SearchBar/>
```

---

## Task 1: Setup Vitest (logique pure)

**Files:**
- Modify: `apps/explore-web/package.json`
- Create: `apps/explore-web/vitest.config.ts`

- [ ] **Step 1: Ajouter vitest en devDependency**

Run (depuis `apps/explore-web/`) :
```bash
pnpm add -D vitest@^2
```
Expected: `vitest` apparaît dans `devDependencies` de `apps/explore-web/package.json`.

- [ ] **Step 2: Ajouter le script de test**

Dans `apps/explore-web/package.json`, ajouter au bloc `"scripts"` :
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Créer `vitest.config.ts`**

Create `apps/explore-web/vitest.config.ts` :
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 4: Vérifier que le runner démarre (0 test pour l'instant)**

Run: `pnpm test`
Expected: vitest démarre et affiche « No test files found » (ou 0 fichiers) sans erreur de config.

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/package.json apps/explore-web/vitest.config.ts
git commit -m "chore(explore-web): setup vitest pour la logique pure"
```

---

## Task 2: Migration — étendre `get_map_places`

**Files:**
- Create: `supabase/migrations/212_map_places_facets.sql`

Ajoute `eraId`, `address` et `tagIds` (tableau de TOUS les tags du lieu) au payload, dans les 3 branches. Le reste de la fonction est inchangé.

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/212_map_places_facets.sql` :
```sql
-- 212_map_places_facets.sql
-- Étend get_map_places : eraId + address + tagIds[] (tous les tags, pas que le primaire).
-- Support du filtrage client-side (Recherche & Filtres — Lot 1).
-- Idempotent : CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.get_map_places(
  p_type text DEFAULT 'all'::text,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_latitude_delta double precision DEFAULT NULL,
  p_longitude_delta double precision DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_user_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'address', p.address,
        'eraId', p.era_id,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE WHEN t.id IS NOT NULL THEN json_build_object(
          'id', t.id, 'title', t.title, 'color', t.color, 'background', t.background) ELSE NULL END,
        'tagIds', COALESCE((SELECT array_agg(pt2.tag_id) FROM place_tags pt2 WHERE pt2.place_id = p.id), ARRAY[]::text[]),
        'faction', NULL,
        'claimedByName', NULL,
        'claimedById', NULL,
        'fortificationLevel', 0,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(COALESCE(lk.likes_count, 0) + COALESCE(vw.views_count, 0) * 0.1 + COALESCE(ex.explored_count, 0) * 2)::int,
        'totalInfluence', 0,
        'influenceByFaction', '{}'::json
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN (SELECT place_id, COUNT(*)::int AS likes_count FROM places_liked GROUP BY place_id) lk ON lk.place_id = p.id
      LEFT JOIN (SELECT place_id, COUNT(*)::int AS views_count FROM places_viewed GROUP BY place_id) vw ON vw.place_id = p.id
      LEFT JOIN (SELECT place_id, COUNT(*)::int AS explored_count FROM places_explored GROUP BY place_id) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      GROUP BY p.id, pt.id, t.id, lk.likes_count, vw.views_count, ex.explored_count
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_limit
    ) sub;
  ELSE
    -- 'all' (et fallback) : tri par date de création
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'address', p.address,
        'eraId', p.era_id,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE WHEN t.id IS NOT NULL THEN json_build_object(
          'id', t.id, 'title', t.title, 'color', t.color, 'background', t.background) ELSE NULL END,
        'tagIds', COALESCE((SELECT array_agg(pt2.tag_id) FROM place_tags pt2 WHERE pt2.place_id = p.id), ARRAY[]::text[]),
        'faction', NULL,
        'claimedByName', NULL,
        'claimedById', NULL,
        'fortificationLevel', 0,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(COALESCE(lk.likes_count, 0) + COALESCE(vw.views_count, 0) * 0.1 + COALESCE(ex.explored_count, 0) * 2)::int,
        'totalInfluence', 0,
        'influenceByFaction', '{}'::json
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN (SELECT place_id, COUNT(*)::int AS likes_count FROM places_liked GROUP BY place_id) lk ON lk.place_id = p.id
      LEFT JOIN (SELECT place_id, COUNT(*)::int AS views_count FROM places_viewed GROUP BY place_id) vw ON vw.place_id = p.id
      LEFT JOIN (SELECT place_id, COUNT(*)::int AS explored_count FROM places_explored GROUP BY place_id) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$function$;
```

> Note : la fonction d'origine avait des branches `all` et `else` identiques ; on les fusionne ici (même résultat). Seul `popular` diffère (tri vues). L'app n'appelle que `'all'`.

- [ ] **Step 2: Appliquer la migration (MCP Supabase, projet `app`)**

Appliquer via l'outil `apply_migration` (project_id `ukpapqssgsxirsgmcvof`, name `map_places_facets`) avec le SQL ci-dessus.

- [ ] **Step 3: Vérifier le payload**

Run (execute_sql) :
```sql
select (get_map_places('all', null,null,null,null, 1))::text;
```
Expected : l'objet contient `"address"`, `"eraId"` et un tableau `"tagIds"` (ex. `["EaeTGcHV2"]`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/212_map_places_facets.sql
git commit -m "feat(db): get_map_places expose eraId, address, tagIds[] (mig 212)"
```

---

## Task 3: `lib/placeSearch.ts` + tests (logique pure)

**Files:**
- Create: `apps/explore-web/src/lib/placeSearch.ts`
- Test: `apps/explore-web/src/lib/placeSearch.test.ts`

- [ ] **Step 1: Écrire les tests (échec attendu)**

Create `apps/explore-web/src/lib/placeSearch.test.ts` :
```ts
import { describe, it, expect } from 'vitest'
import { normalize, searchPlaces } from './placeSearch'

const items = [
  { id: '1', title: 'Dolmen de Crucuno', address: 'Plouharnel' },
  { id: '2', title: 'Alignements du Ménec', address: 'Carnac' },
  { id: '3', title: 'Source Saint-Gildas', address: 'Carnac' },
]

describe('normalize', () => {
  it('retire accents et casse', () => {
    expect(normalize('Ménec')).toBe('menec')
    expect(normalize('  CRUCUNO ')).toBe('crucuno')
  })
})

describe('searchPlaces', () => {
  it('matche le titre, accent-insensible', () => {
    expect(searchPlaces(items, 'menec').map(i => i.id)).toEqual(['2'])
  })
  it('matche aussi l’adresse', () => {
    expect(searchPlaces(items, 'carnac').map(i => i.id)).toEqual(['2', '3'])
  })
  it('renvoie [] sur requête vide', () => {
    expect(searchPlaces(items, '   ')).toEqual([])
  })
  it('respecte la limite', () => {
    expect(searchPlaces(items, 'a', 1)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Lancer les tests → échec**

Run: `pnpm test`
Expected: FAIL (`Cannot find module './placeSearch'` ou export manquant).

- [ ] **Step 3: Implémenter `placeSearch.ts`**

Create `apps/explore-web/src/lib/placeSearch.ts` :
```ts
export interface SearchableLike {
  id: string
  title: string
  address: string
}

/** NFD + suppression diacritiques + minuscules + trim. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Match sous-chaîne accent-insensible sur titre puis adresse. Ordre d'entrée préservé. */
export function searchPlaces<T extends SearchableLike>(items: T[], query: string, limit = 20): T[] {
  const q = normalize(query)
  if (!q) return []
  const out: T[] = []
  for (const it of items) {
    if (normalize(it.title).includes(q) || normalize(it.address).includes(q)) {
      out.push(it)
      if (out.length >= limit) break
    }
  }
  return out
}
```

- [ ] **Step 4: Lancer les tests → succès**

Run: `pnpm test`
Expected: PASS (5 tests verts).

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/lib/placeSearch.ts apps/explore-web/src/lib/placeSearch.test.ts
git commit -m "feat(search): lib placeSearch (normalize + fuzzy titre/adresse) + tests"
```

---

## Task 4: `searchFilterStore` + prédicat + tests

**Files:**
- Create: `apps/explore-web/src/stores/searchFilterStore.ts`
- Test: `apps/explore-web/src/stores/searchFilterStore.test.ts`

- [ ] **Step 1: Écrire les tests du prédicat (échec attendu)**

Create `apps/explore-web/src/stores/searchFilterStore.test.ts` :
```ts
import { describe, it, expect } from 'vitest'
import { placeMatchesFilters, type FilterCriteria } from './searchFilterStore'

const base = (over: Partial<{ tagIds: string[]; eraId: string | null; discovered: boolean }> = {}) => ({
  tagIds: ['mega'], eraId: 'iron-age', discovered: false, ...over,
})
const crit = (over: Partial<FilterCriteria> = {}): FilterCriteria => ({
  tagIds: new Set(), eraIds: new Set(), progress: 'all', ...over,
})

describe('placeMatchesFilters', () => {
  it('aucun filtre → tout passe', () => {
    expect(placeMatchesFilters(base(), crit())).toBe(true)
  })
  it('tags = OU (un tag suffit)', () => {
    expect(placeMatchesFilters(base({ tagIds: ['mega'] }), crit({ tagIds: new Set(['mega', 'source']) }))).toBe(true)
    expect(placeMatchesFilters(base({ tagIds: ['ruine'] }), crit({ tagIds: new Set(['mega', 'source']) }))).toBe(false)
  })
  it('époque = OU', () => {
    expect(placeMatchesFilters(base({ eraId: 'iron-age' }), crit({ eraIds: new Set(['iron-age']) }))).toBe(true)
    expect(placeMatchesFilters(base({ eraId: 'renaissance' }), crit({ eraIds: new Set(['iron-age']) }))).toBe(false)
    expect(placeMatchesFilters(base({ eraId: null }), crit({ eraIds: new Set(['iron-age']) }))).toBe(false)
  })
  it('familles = ET', () => {
    const c = crit({ tagIds: new Set(['mega']), eraIds: new Set(['renaissance']) })
    expect(placeMatchesFilters(base({ tagIds: ['mega'], eraId: 'iron-age' }), c)).toBe(false)
  })
  it('progression', () => {
    expect(placeMatchesFilters(base({ discovered: false }), crit({ progress: 'undiscovered' }))).toBe(true)
    expect(placeMatchesFilters(base({ discovered: true }), crit({ progress: 'undiscovered' }))).toBe(false)
    expect(placeMatchesFilters(base({ discovered: true }), crit({ progress: 'discovered' }))).toBe(true)
  })
})
```

- [ ] **Step 2: Lancer → échec**

Run: `pnpm test`
Expected: FAIL (module/​export manquant).

- [ ] **Step 3: Implémenter le store**

Create `apps/explore-web/src/stores/searchFilterStore.ts` :
```ts
import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export type ProgressFilter = 'all' | 'undiscovered' | 'discovered'

export interface SearchablePlace {
  id: string
  title: string
  address: string
  lng: number
  lat: number
  eraId: string | null
  tagIds: string[]
  discovered: boolean
}

export interface FilterCriteria {
  tagIds: Set<string>
  eraIds: Set<string>
  progress: ProgressFilter
}

export interface TagMeta {
  id: string; title: string; color: string; background: string; icon: string | null; order: number
}
export interface EraMeta { id: string; name: string; sortOrder: number }

/** Prédicat pur (testé) : OU dans une famille, ET entre familles. */
export function placeMatchesFilters(
  p: { tagIds: string[]; eraId: string | null; discovered: boolean },
  f: FilterCriteria,
): boolean {
  if (f.tagIds.size > 0 && !p.tagIds.some(t => f.tagIds.has(t))) return false
  if (f.eraIds.size > 0 && (p.eraId === null || !f.eraIds.has(p.eraId))) return false
  if (f.progress === 'undiscovered' && p.discovered) return false
  if (f.progress === 'discovered' && !p.discovered) return false
  return true
}

interface SearchFilterState {
  // Taxonomies (chips)
  tags: TagMeta[]
  eras: EraMeta[]
  taxonomiesLoaded: boolean
  loadTaxonomies: () => Promise<void>

  // Liste publiée par usePlaces
  places: SearchablePlace[]
  setPlaces: (p: SearchablePlace[]) => void

  // Critères de filtre
  tagIds: Set<string>
  eraIds: Set<string>
  progress: ProgressFilter
  toggleTag: (id: string) => void
  toggleEra: (id: string) => void
  setProgress: (p: ProgressFilter) => void
  resetFilters: () => void

  // UI
  overlayOpen: boolean
  sheetOpen: boolean
  openOverlay: () => void
  closeOverlay: () => void
  openSheet: () => void
  closeSheet: () => void
}

function toggleInSet(set: Set<string>, id: string): Set<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id); else next.add(id)
  return next
}

export const useSearchFilterStore = create<SearchFilterState>((set, get) => ({
  tags: [],
  eras: [],
  taxonomiesLoaded: false,
  loadTaxonomies: async () => {
    if (get().taxonomiesLoaded) return
    const [tagsRes, erasRes] = await Promise.all([
      supabase.from('tags').select('id, title, color, background, icon, order').order('order'),
      supabase.from('eras').select('id, name, sort_order').order('sort_order'),
    ])
    set({
      tags: (tagsRes.data ?? []).map(t => ({
        id: t.id, title: t.title, color: t.color, background: t.background, icon: t.icon, order: t.order ?? 0,
      })),
      eras: (erasRes.data ?? [])
        .filter(e => e.id !== 'unknown')
        .map(e => ({ id: e.id, name: e.name, sortOrder: e.sort_order ?? 0 })),
      taxonomiesLoaded: true,
    })
  },

  places: [],
  setPlaces: (p) => set({ places: p }),

  tagIds: new Set(),
  eraIds: new Set(),
  progress: 'all',
  toggleTag: (id) => set(s => ({ tagIds: toggleInSet(s.tagIds, id) })),
  toggleEra: (id) => set(s => ({ eraIds: toggleInSet(s.eraIds, id) })),
  setProgress: (p) => set({ progress: p }),
  resetFilters: () => set({ tagIds: new Set(), eraIds: new Set(), progress: 'all' }),

  overlayOpen: false,
  sheetOpen: false,
  openOverlay: () => set({ overlayOpen: true }),
  closeOverlay: () => set({ overlayOpen: false }),
  openSheet: () => set({ sheetOpen: true }),
  closeSheet: () => set({ sheetOpen: false }),
}))
```

- [ ] **Step 4: Lancer → succès**

Run: `pnpm test`
Expected: PASS (tous les tests du prédicat verts).

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/stores/searchFilterStore.ts apps/explore-web/src/stores/searchFilterStore.test.ts
git commit -m "feat(search): searchFilterStore (critères + placeMatchesFilters + taxonomies) + tests"
```

---

## Task 5: `usePlaces` — types étendus + publication dans le store

**Files:**
- Modify: `apps/explore-web/src/hooks/usePlaces.ts`

- [ ] **Step 1: Étendre l'interface `MapPlace`**

Dans `usePlaces.ts`, dans `interface MapPlace`, ajouter après `title` :
```ts
  address: string | null
  eraId: string | null
  tagIds: string[]
```

- [ ] **Step 2: Étendre `PlaceProperties`**

Dans `interface PlaceProperties`, ajouter après `title: string` :
```ts
  address: string
  eraId: string | null
  tagIds: string[]
```

- [ ] **Step 3: Mapper les nouveaux champs dans les `properties`**

Dans le `.map(place => ({ ... properties: { ... } }))`, ajouter (après `title: place.title,`) :
```ts
              address: place.address ?? '',
              eraId: place.eraId ?? null,
              tagIds: Array.isArray(place.tagIds) ? place.tagIds : [],
```

- [ ] **Step 4: Publier la liste légère dans `searchFilterStore`**

En tête de fichier, ajouter l'import :
```ts
import { useSearchFilterStore } from '../stores/searchFilterStore'
```
Puis, juste avant le `return { geojson, rawGeojson, ... }`, ajouter un effet qui publie la projection (à partir du `geojson` enrichi — déjà sans lieux supprimés et avec `discovered`) :
```ts
  useEffect(() => {
    const features = geojson?.features ?? []
    useSearchFilterStore.getState().setPlaces(
      features.map(f => ({
        id: f.properties.id,
        title: f.properties.title,
        address: f.properties.address,
        lng: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        eraId: f.properties.eraId,
        tagIds: f.properties.tagIds,
        discovered: f.properties.discovered,
      })),
    )
  }, [geojson])
```

- [ ] **Step 5: Vérifier le build**

Run (depuis `apps/explore-web/`): `pnpm build`
Expected: `tsc` passe sans erreur (types cohérents, pas de `any`).

- [ ] **Step 6: Commit**

```bash
git add apps/explore-web/src/hooks/usePlaces.ts
git commit -m "feat(search): usePlaces mappe eraId/tagIds/address et publie la liste recherchable"
```

---

## Task 6: `SearchOverlay` (recherche de lieux)

**Files:**
- Create: `apps/explore-web/src/components/map/search/SearchOverlay.tsx`
- Create: `apps/explore-web/src/components/map/search/SearchOverlay.css`

- [ ] **Step 1: Implémenter `SearchOverlay.tsx`**

Create `apps/explore-web/src/components/map/search/SearchOverlay.tsx` :
```tsx
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchFilterStore, type SearchablePlace } from '../../../stores/searchFilterStore'
import { useMapStore } from '../../../stores/mapStore'
import { searchPlaces } from '../../../lib/placeSearch'
import './SearchOverlay.css'

export function SearchOverlay() {
  const open = useSearchFilterStore(s => s.overlayOpen)
  const close = useSearchFilterStore(s => s.closeOverlay)
  const places = useSearchFilterStore(s => s.places)
  const [query, setQuery] = useState('')

  if (!open) return null

  const results = searchPlaces(places, query, 20)

  function pick(p: SearchablePlace) {
    useMapStore.getState().requestFlyTo({ lng: p.lng, lat: p.lat, placeId: p.id })
    useMapStore.getState().setSelectedPlaceId(p.id)
    setQuery('')
    close()
  }

  return createPortal(
    <div className="search-overlay">
      <div className="search-overlay-top">
        <input
          className="search-overlay-input"
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher un lieu…"
          aria-label="Rechercher un lieu"
        />
        <button className="search-overlay-cancel" onClick={() => { setQuery(''); close() }}>
          Annuler
        </button>
      </div>

      <div className="search-overlay-results">
        {query.trim() && results.length === 0 && (
          <p className="search-overlay-empty">Aucun lieu trouvé.</p>
        )}
        {results.length > 0 && (
          <>
            <div className="search-overlay-group">Lieux · {results.length}</div>
            {results.map(p => (
              <button key={p.id} className="search-overlay-row" onClick={() => pick(p)}>
                <span className="search-overlay-ico">📍</span>
                <span className="search-overlay-text">
                  <span className="search-overlay-title">{p.title}</span>
                  {p.address && <span className="search-overlay-sub">{p.address}</span>}
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 2: Styles `SearchOverlay.css`**

Create `apps/explore-web/src/components/map/search/SearchOverlay.css` :
```css
.search-overlay {
  position: fixed; inset: 0; z-index: 1200;
  background: #f7f1e4; display: flex; flex-direction: column;
  padding-top: env(safe-area-inset-top, 0px);
}
.search-overlay-top { display: flex; gap: 8px; align-items: center; padding: 10px 12px; border-bottom: 1px solid #e0d0b0; }
.search-overlay-input { flex: 1; background: #fff; border: 1px solid #b9956a; border-radius: 20px; padding: 9px 14px; font-size: 15px; color: #3f3326; }
.search-overlay-cancel { background: none; border: none; color: #84352f; font-size: 14px; padding: 4px 6px; }
.search-overlay-results { flex: 1; overflow-y: auto; }
.search-overlay-group { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #a98a5f; font-weight: 700; padding: 12px 16px 4px; }
.search-overlay-row { display: flex; gap: 10px; align-items: center; width: 100%; text-align: left; background: none; border: none; border-bottom: 1px solid #ece0c6; padding: 11px 16px; color: #4f3c28; }
.search-overlay-ico { width: 26px; height: 26px; border-radius: 7px; background: #e7d6b4; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.search-overlay-text { display: flex; flex-direction: column; }
.search-overlay-title { font-size: 14px; }
.search-overlay-sub { font-size: 12px; color: #a08a66; }
.search-overlay-empty { color: #a08a66; text-align: center; padding: 30px 16px; }
```

- [ ] **Step 3: Vérifier le build**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/components/map/search/SearchOverlay.tsx apps/explore-web/src/components/map/search/SearchOverlay.css
git commit -m "feat(search): SearchOverlay — recherche de lieux client-side"
```

---

## Task 7: `FilterSheet` (Tags / Progression / Époque + compteur live)

**Files:**
- Create: `apps/explore-web/src/components/map/filters/FilterSheet.tsx`
- Create: `apps/explore-web/src/components/map/filters/FilterSheet.css`

- [ ] **Step 1: Implémenter `FilterSheet.tsx`**

Create `apps/explore-web/src/components/map/filters/FilterSheet.tsx` :
```tsx
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  useSearchFilterStore, placeMatchesFilters, type ProgressFilter,
} from '../../../stores/searchFilterStore'
import './FilterSheet.css'

const PROGRESS_OPTIONS: { value: ProgressFilter; label: string }[] = [
  { value: 'all', label: 'Tout' },
  { value: 'undiscovered', label: '✨ À explorer' },
  { value: 'discovered', label: '✓ Découverts' },
]

export function FilterSheet() {
  const open = useSearchFilterStore(s => s.sheetOpen)
  const close = useSearchFilterStore(s => s.closeSheet)
  const loadTaxonomies = useSearchFilterStore(s => s.loadTaxonomies)
  const tags = useSearchFilterStore(s => s.tags)
  const eras = useSearchFilterStore(s => s.eras)
  const places = useSearchFilterStore(s => s.places)
  const tagIds = useSearchFilterStore(s => s.tagIds)
  const eraIds = useSearchFilterStore(s => s.eraIds)
  const progress = useSearchFilterStore(s => s.progress)
  const toggleTag = useSearchFilterStore(s => s.toggleTag)
  const toggleEra = useSearchFilterStore(s => s.toggleEra)
  const setProgress = useSearchFilterStore(s => s.setProgress)
  const resetFilters = useSearchFilterStore(s => s.resetFilters)

  useEffect(() => { if (open) void loadTaxonomies() }, [open, loadTaxonomies])

  if (!open) return null

  const criteria = { tagIds, eraIds, progress }
  const matchCount = places.filter(p => placeMatchesFilters(p, criteria)).length

  return createPortal(
    <div className="filter-sheet-backdrop" onClick={close}>
      <div className="filter-sheet" onClick={e => e.stopPropagation()}>
        <div className="filter-sheet-grab" />
        <div className="filter-sheet-head">
          <h4>Filtrer la carte</h4>
          <button className="filter-sheet-reset" onClick={resetFilters}>Réinitialiser</button>
        </div>

        <div className="filter-sheet-body">
          <div className="filter-fam">🏷️ Tags · {tags.length}</div>
          <div className="filter-row">
            {tags.map(t => {
              const on = tagIds.has(t.id)
              return (
                <button
                  key={t.id}
                  className={`filter-chip${on ? ' on' : ''}`}
                  style={on
                    ? { background: t.color, color: '#fff', borderColor: t.color }
                    : { background: t.background, color: t.color, borderColor: t.color }}
                  onClick={() => toggleTag(t.id)}
                >
                  {t.title}
                </button>
              )
            })}
          </div>

          <div className="filter-fam">✨ Ma progression</div>
          <div className="filter-row">
            {PROGRESS_OPTIONS.map(o => (
              <button
                key={o.value}
                className={`filter-toggle${progress === o.value ? ' on' : ''}`}
                onClick={() => setProgress(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="filter-fam">⏳ Époque · {eras.length}</div>
          <div className="filter-row">
            {eras.map(e => {
              const on = eraIds.has(e.id)
              return (
                <button
                  key={e.id}
                  className={`filter-chip era${on ? ' on' : ''}`}
                  onClick={() => toggleEra(e.id)}
                >
                  {e.name}
                </button>
              )
            })}
          </div>
        </div>

        <div className="filter-sheet-foot">
          <button className="filter-sheet-cta" onClick={close}>Voir les {matchCount} lieux</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 2: Styles `FilterSheet.css`**

Create `apps/explore-web/src/components/map/filters/FilterSheet.css` :
```css
.filter-sheet-backdrop { position: fixed; inset: 0; z-index: 1200; background: rgba(0,0,0,.35); display: flex; align-items: flex-end; }
.filter-sheet { width: 100%; max-height: 82vh; background: #f7f1e4; border-radius: 18px 18px 0 0; box-shadow: 0 -6px 18px rgba(0,0,0,.25); display: flex; flex-direction: column; }
.filter-sheet-grab { width: 38px; height: 4px; background: #cbb48c; border-radius: 2px; margin: 8px auto 4px; }
.filter-sheet-head { display: flex; justify-content: space-between; align-items: center; padding: 2px 16px 8px; border-bottom: 1px solid #e4d6bc; }
.filter-sheet-head h4 { margin: 0; color: #84352f; font-size: 15px; }
.filter-sheet-reset { background: none; border: none; color: #a9260f; font-size: 12px; }
.filter-sheet-body { flex: 1; overflow-y: auto; padding: 4px 14px 12px; }
.filter-fam { font-size: 10px; text-transform: uppercase; letter-spacing: .5px; color: #a98a5f; font-weight: 700; margin: 14px 0 6px; }
.filter-row { display: flex; flex-wrap: wrap; gap: 6px; }
.filter-chip { font-size: 12px; padding: 6px 11px; border-radius: 13px; border: 1px solid #cbb48c; background: #fff; color: #6b4f33; }
.filter-chip.era.on { background: #84352f; color: #fff; border-color: #84352f; }
.filter-toggle { font-size: 12px; padding: 6px 11px; border-radius: 13px; border: 1px solid #cbb48c; background: #fff; color: #6b4f33; }
.filter-toggle.on { background: #2b211a; color: #e8c87a; border-color: #2b211a; }
.filter-sheet-foot { padding: 10px 14px calc(10px + env(safe-area-inset-bottom)); border-top: 1px solid #e4d6bc; }
.filter-sheet-cta { width: 100%; background: #84352f; color: #fff; border: none; border-radius: 14px; padding: 12px; font-weight: 700; font-size: 14px; }
```

- [ ] **Step 3: Vérifier le build**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/components/map/filters/FilterSheet.tsx apps/explore-web/src/components/map/filters/FilterSheet.css
git commit -m "feat(filters): FilterSheet — Tags/Progression/Époque + compteur live + reset"
```

---

## Task 8: `SearchBar` (barre flottante + entonnoir) + montage

**Files:**
- Create: `apps/explore-web/src/components/map/search/SearchBar.tsx`
- Create: `apps/explore-web/src/components/map/search/SearchBar.css`
- Modify: `apps/explore-web/src/pages/MapPage.tsx`

- [ ] **Step 1: Implémenter `SearchBar.tsx`**

Create `apps/explore-web/src/components/map/search/SearchBar.tsx` :
```tsx
import { useSearchFilterStore } from '../../../stores/searchFilterStore'
import { SearchOverlay } from './SearchOverlay'
import { FilterSheet } from '../filters/FilterSheet'
import './SearchBar.css'

export function SearchBar() {
  const openOverlay = useSearchFilterStore(s => s.openOverlay)
  const openSheet = useSearchFilterStore(s => s.openSheet)
  const tagIds = useSearchFilterStore(s => s.tagIds)
  const eraIds = useSearchFilterStore(s => s.eraIds)
  const progress = useSearchFilterStore(s => s.progress)

  const activeCount = tagIds.size + eraIds.size + (progress !== 'all' ? 1 : 0)

  return (
    <>
      <div className="map-search-bar">
        <button className="map-search-pill" onClick={openOverlay}>
          <span aria-hidden>🔍</span> Rechercher un lieu…
        </button>
        <button className="map-search-funnel" onClick={openSheet} aria-label="Filtres">
          <span aria-hidden>⚙︎</span>
          {activeCount > 0 && <span className="map-search-funnel-badge">{activeCount}</span>}
        </button>
      </div>
      <SearchOverlay />
      <FilterSheet />
    </>
  )
}
```

- [ ] **Step 2: Styles `SearchBar.css`**

Create `apps/explore-web/src/components/map/search/SearchBar.css` :
```css
/* Barre flottante sous le header fixe mobile (.map-mobile-header-fixed). */
.map-search-bar {
  position: absolute; left: 10px; right: 10px; z-index: 5;
  top: calc(env(safe-area-inset-top, 0px) + 96px);
  display: flex; gap: 8px;
}
.map-search-pill {
  flex: 1; display: flex; align-items: center; gap: 8px;
  background: #fbf6ea; border: 1px solid #b9956a; border-radius: 22px;
  padding: 10px 16px; color: #9c805d; font-size: 14px; text-align: left;
  box-shadow: 0 3px 8px rgba(0,0,0,.18);
}
.map-search-funnel {
  position: relative; width: 44px; height: 44px; border-radius: 22px;
  background: #fbf6ea; border: 1px solid #b9956a; color: #84352f; font-size: 18px;
  box-shadow: 0 3px 8px rgba(0,0,0,.18); flex-shrink: 0;
}
.map-search-funnel-badge {
  position: absolute; top: -5px; right: -5px; min-width: 18px; height: 18px;
  background: #84352f; color: #fff; font-size: 10px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center; padding: 0 4px;
}
/* Desktop : barre ancrée en haut-centre, largeur contenue. */
@media (min-width: 768px) {
  .map-search-bar { top: 16px; left: 50%; right: auto; transform: translateX(-50%); width: 460px; max-width: 90vw; }
}
```

> **Note de placement** : le `top: …96px` mobile suppose la hauteur cumulée `MobileTopBar`+`MobileStatsBar`. À ajuster d'un coup d'œil en `pnpm dev` (Step 4) si la barre chevauche ou flotte trop bas.

- [ ] **Step 3: Monter `<SearchBar/>` dans `MapPage.tsx`**

Dans `apps/explore-web/src/pages/MapPage.tsx`, ajouter l'import en tête (près des autres imports de `components/map`) :
```tsx
import { SearchBar } from '../components/map/search/SearchBar'
```
Puis, juste après le bloc `<div className="hud-left-stack"> … </div>` (la fermeture du bloc `GameToast`/`ExpeditionsHud`), ajouter :
```tsx
      {!addPlaceMode && !authLoading && isAuthenticated && <SearchBar />}
```

- [ ] **Step 4: Build + vérif visuelle rapide**

Run: `pnpm build` → PASS.
Run: `pnpm dev`, ouvrir `localhost:3000`. Vérifier : barre flottante visible sous le header ; tap → overlay plein écran ; taper « carnac » → résultats lieux ; tap résultat → la carte vole + ouvre la fiche ; bouton entonnoir → feuille de filtres.
Ajuster le `top` de `.map-search-bar` si besoin.

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/components/map/search/SearchBar.tsx apps/explore-web/src/components/map/search/SearchBar.css apps/explore-web/src/pages/MapPage.tsx
git commit -m "feat(search): SearchBar flottante (recherche + entonnoir) montée sur la carte"
```

---

## Task 9: Câbler le filtrage des marqueurs dans `ExploreMap`

**Files:**
- Modify: `apps/explore-web/src/components/map/core/ExploreMap.tsx`

- [ ] **Step 1: Importer le store + le prédicat**

En tête de `ExploreMap.tsx`, ajouter :
```tsx
import { useSearchFilterStore, placeMatchesFilters } from '../../../stores/searchFilterStore'
```

- [ ] **Step 2: Lire les critères + dériver le GeoJSON filtré**

Juste après le `useMemo` qui calcule `enrichedGeojson` (vers la ligne 772), ajouter :
```tsx
  const filterTagIds = useSearchFilterStore(s => s.tagIds)
  const filterEraIds = useSearchFilterStore(s => s.eraIds)
  const filterProgress = useSearchFilterStore(s => s.progress)

  const filteredGeojson = useMemo(() => {
    if (!enrichedGeojson) return enrichedGeojson
    const criteria = { tagIds: filterTagIds, eraIds: filterEraIds, progress: filterProgress }
    if (filterTagIds.size === 0 && filterEraIds.size === 0 && filterProgress === 'all') {
      return enrichedGeojson
    }
    return {
      ...enrichedGeojson,
      features: enrichedGeojson.features.filter(f => placeMatchesFilters(f.properties, criteria)),
    }
  }, [enrichedGeojson, filterTagIds, filterEraIds, filterProgress])
```

- [ ] **Step 3: Alimenter les marqueurs avec le GeoJSON filtré**

Remplacer, à la ligne du composant de marqueurs (≈ ligne 875), `geojson={enrichedGeojson}` par `geojson={filteredGeojson}` **uniquement pour le calque des marqueurs de lieux** (laisser `HarvestableChests` et `Minimap` sur `enrichedGeojson`/`geojson` — ils ne sont pas concernés par le filtre Lot 1).

- [ ] **Step 4: Build + vérif manuelle**

Run: `pnpm build` → PASS.
Run: `pnpm dev`. Cocher un tag (ex. « Sources, lacs & rivières ») → les marqueurs hors-tag disparaissent ; le compteur du CTA reflète le nombre ; « Réinitialiser » réaffiche tout ; combiner tag + époque réduit encore (logique ET).

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/components/map/core/ExploreMap.tsx
git commit -m "feat(filters): ExploreMap masque les marqueurs hors filtre (prédicat partagé)"
```

---

## Task 10: Vérification finale du Lot 1

- [ ] **Step 1: Suite de tests verte**

Run: `pnpm test`
Expected: PASS (placeSearch + searchFilterStore).

- [ ] **Step 2: Build de production**

Run: `pnpm build`
Expected: `tsc && vite build` PASS, aucun `any`, aucun import inutilisé.

- [ ] **Step 3: Checklist manuelle (`pnpm dev`)**

- [ ] Barre flottante bien placée sous le header (mobile) et centrée (desktop ≥768px).
- [ ] Overlay : « carnac » remonte les lieux des deux taxonomies (titre + adresse), accent-insensible.
- [ ] Clic résultat → vol caméra + fiche ouverte ; « Annuler » ferme l'overlay.
- [ ] Feuille de filtres : pastilles tags aux bonnes couleurs ; tri-état progression ; pastilles époques.
- [ ] Filtrage live : marqueurs + compteur CTA bougent à chaque coche ; OU intra-famille, ET inter-familles.
- [ ] Badge entonnoir = nb de filtres actifs ; « Réinitialiser » remet à zéro.

- [ ] **Step 4: Bump version (process projet) + commit final**

Depuis `apps/explore-web/`, lancer le script de release existant qui bumpe `APP_VERSION` (patch) :
```bash
pnpm release
```
Puis committer ce qui reste non commité :
```bash
git add -A
git commit -m "chore(release): Recherche & Filtres Lot 1 — socle (recherche lieux + filtres tags/progression/époque)"
```

---

## Notes pour les lots suivants (hors périmètre Lot 1)
- **Lot 2** — famille gated « Factions & territoire » : lire `playerStore.factionColorMode` (afficher la famille), `veille` store (Maison qui contrôle + Libre), `siegeStore.statusByPlaceId` (`siege` / `critical`). Étendre `FilterCriteria` + `placeMatchesFilters` (avec neutralisation hors mode faction) + tests.
- **Lot 3** — recherche Villes (`lib/geocode.ts` Nominatim forward, débouncé, + tests parsing) et Joueurs (RPC `search_players`, fiche-seule). Ajouter les groupes dans `SearchOverlay`.
- **Lot 4** — toggle « Événements » : afficher/masquer la couche bannières (`expeditionsStore.mapBanners`).
- **Lot 5** — brancher `searchFilterStore` sur les listes de la home.
```
