# Home Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot l'app Runes de Chêne de carte-first à home-first. Nouvelle page `/accueil` (feed communautaire) + tabbar bottom HOME ↔ CARTE avec (+) central. Carte reste cœur du gameplay mais devient destination, pas écran d'entrée.

**Architecture:** Nouvelle route `/accueil` avec un composant `HomePage` qui orchestre 7 sections empilées (StatsBar, DailyEnigma, QuestsBoard embed, FragmentsCarousel, PlacesSection, ActivityFeed) + une `BottomTabbar` fixed en bas. Réutilisation maximale des composants existants (MobileHeader, NotificationBell, ProfileMenu, EnergyIndicator, EnigmaChestButton, DailyQuestsList, ExpeditionsList). 3 nouvelles RPCs Supabase (mig 140) pour fragments récents, lieux récents, lieux proches.

**Tech Stack:** React 18 + Vite 5 + TypeScript strict, React Router DOM, Zustand (mapStore, playerStore, mobileNavStore), Supabase (PostgreSQL + RLS + Storage), Netlify Functions, pnpm workspaces.

---

## Phase 0 — Setup branche

### Task 0.1 — Créer la branche `home-pivot`

**Files:**
- Aucun fichier créé/modifié directement

- [ ] **Step 1: Vérifier qu'on est sur main à jour**

```bash
cd "/c/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
git status
git checkout main
git pull origin main
```

Expected: working tree clean, branch up-to-date.

- [ ] **Step 2: Créer et basculer sur la branche home-pivot**

```bash
git checkout -b home-pivot
```

Expected: `Switched to a new branch 'home-pivot'`

---

## Phase 1 — Backend (mig 140)

### Task 1.1 — Mig 140 : 3 nouvelles RPCs

**Files:**
- Create: `supabase/migrations/140_home_page_rpcs.sql`

- [ ] **Step 1: Vérifier les colonnes existantes des tables `fragments` et `places`**

Important : avant d'écrire les RPCs, requêter le schéma pour ne pas inventer de colonnes (cf. feedback XO `feedback_never_invent_db_columns_workflow.md`).

```bash
pnpm dlx supabase db diff --schema public --linked > /tmp/schema_check.sql
```

Ou consulter le graph indexé :

```bash
grep -A 30 '"label":\s*"fragments"' "graphify-out/graph.json" | head -50
grep -A 30 '"label":\s*"places"' "graphify-out/graph.json" | head -50
```

Noter les colonnes nécessaires : `fragments.id`, `fragments.name`, `fragments.icon_url`, `fragments.image_url`, `fragments.link_url`, `fragments.collection`, `fragments.created_at`. Pour `places` : `id`, `title`, `slug`, `lat`, `lng`, `created_at`, `cover_image_url`, statut (validé/non).

- [ ] **Step 2: Écrire la migration**

```sql
-- supabase/migrations/140_home_page_rpcs.sql
--
-- 3 RPCs pour la HomePage (pivot home-first, 9 mai 2026) :
--   - get_recent_fragments : carrousel "Fragments" sur la home
--   - get_recent_places    : tab "Nouveaux Lieux" de la section Places
--   - get_nearby_places    : tab "Proches" de la section Places (Haversine)
--
-- Toutes lectures auth-only (RLS via auth.uid() pour le marquage owned).

BEGIN;

-- ────────────────────────────────────────────────────────────────────
-- 1) get_recent_fragments
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_recent_fragments(
  p_user_id UUID,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id BIGINT,
  name TEXT,
  icon TEXT,
  icon_url TEXT,
  image_url TEXT,
  link_url TEXT,
  collection TEXT,
  owned BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id,
    f.name,
    f.icon,
    f.icon_url,
    f.image_url,
    f.link_url,
    f.collection,
    EXISTS (
      SELECT 1 FROM public.user_fragments uf
      WHERE uf.user_id = p_user_id AND uf.fragment_id = f.id
    ) AS owned
  FROM public.fragments f
  ORDER BY f.created_at DESC NULLS LAST
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_fragments(UUID, INT) TO authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 2) get_recent_places
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_recent_places(
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.title,
    p.slug,
    p.lat,
    p.lng,
    p.cover_image_url,
    p.created_at
  FROM public.places p
  WHERE p.validated_at IS NOT NULL
  ORDER BY p.created_at DESC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_places(INT) TO authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 3) get_nearby_places (Haversine inline, sans PostGIS)
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_nearby_places(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  cover_image_url TEXT,
  distance_km DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.title,
    p.slug,
    p.lat,
    p.lng,
    p.cover_image_url,
    -- Haversine en km, rayon Terre ≈ 6371 km
    (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(p_lat)) * cos(radians(p.lat))
          * cos(radians(p.lng) - radians(p_lng))
          + sin(radians(p_lat)) * sin(radians(p.lat))
        ))
      )
    ) AS distance_km
  FROM public.places p
  WHERE p.validated_at IS NOT NULL
  ORDER BY distance_km ASC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_places(DOUBLE PRECISION, DOUBLE PRECISION, INT) TO authenticated;

COMMIT;
```

⚠️ **À adapter selon le schéma réel** : si `fragments.created_at`, `places.validated_at`, `user_fragments.user_id/fragment_id`, ou `places.cover_image_url` ne portent pas ces noms exacts, adapter avant `pnpm dlx supabase db push`. **Ne JAMAIS deviner**.

- [ ] **Step 3: Apply migration locally puis distantes**

```bash
pnpm dlx supabase db push
```

Expected: `Applying migration 140_home_page_rpcs.sql... OK`

- [ ] **Step 4: Test manuel des 3 RPCs**

Via le SQL editor Supabase ou `psql` :

```sql
-- 1) Recent fragments
SELECT * FROM public.get_recent_fragments(
  (SELECT id FROM public.users LIMIT 1)::uuid,
  5
);

-- 2) Recent places
SELECT * FROM public.get_recent_places(5);

-- 3) Nearby places (test depuis Paris ~48.85, 2.35)
SELECT * FROM public.get_nearby_places(48.85, 2.35, 5);
```

Expected: 5 lignes par RPC, distance_km croissant pour la 3e.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/140_home_page_rpcs.sql
git commit -m "feat(db): mig 140 — RPCs pour la HomePage (recent_fragments, recent_places, nearby_places)"
```

---

## Phase 2 — Routing + skeleton HomePage

### Task 2.1 — Ajouter la route `/accueil` + redirect

**Files:**
- Modify: `apps/explore-web/src/App.tsx`
- Create: `apps/explore-web/src/pages/HomePage.tsx`

- [ ] **Step 1: Créer le squelette HomePage**

```tsx
// apps/explore-web/src/pages/HomePage.tsx
import { useEffect } from 'react'
import { usePlayer } from '../hooks/usePlayer'
import './HomePage.css'

export default function HomePage() {
  const { player } = usePlayer()

  useEffect(() => {
    document.title = 'Runes de Chêne — Accueil'
  }, [])

  if (!player) return null

  return (
    <div className="home-page">
      <p>HomePage skeleton — sections à venir</p>
    </div>
  )
}
```

```css
/* apps/explore-web/src/pages/HomePage.css */
.home-page {
  min-height: 100dvh;
  background: #eee8dc;
  padding-bottom: 80px; /* place pour la BottomTabbar */
}
```

- [ ] **Step 2: Ajouter la route + redirect dans App.tsx**

Modifier `apps/explore-web/src/App.tsx` :

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MapPage from './pages/MapPage'
import HomePage from './pages/HomePage'
import LandingPage from './components/landing/LandingPage'
import RequireAuth from './components/RequireAuth'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/accueil" element={<HomePage />} />
          <Route path="/carte" element={<MapPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

⚠️ **Auth flow** : le redirect après login se fait probablement dans `RequireAuth` ou la `LandingAuthForm`. Vérifier (grep "navigate.*carte") et changer la cible vers `/accueil`.

- [ ] **Step 3: Adapter le redirect post-login**

```bash
grep -rn "navigate.*\/carte\|location.href.*\/carte" apps/explore-web/src/components/landing/
```

Modifier le `navigate('/carte')` trouvé pour pointer sur `/accueil`. Garder un fallback `/carte` si certains flows externes l'attendent (deep links).

- [ ] **Step 4: Smoke test**

```bash
pnpm --filter explore-web dev
```

Ouvrir `http://localhost:5173/accueil` après login. Expected: voir "HomePage skeleton — sections à venir" sur fond ivoire.

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/pages/HomePage.tsx apps/explore-web/src/pages/HomePage.css apps/explore-web/src/App.tsx
git commit -m "feat(web): route /accueil + skeleton HomePage + redirect post-login"
```

---

## Phase 3 — BottomTabbar + Plus menu

### Task 3.1 — Composant `BottomTabbar`

**Files:**
- Create: `apps/explore-web/src/components/navigation/BottomTabbar.tsx`
- Create: `apps/explore-web/src/components/navigation/BottomTabbar.css`
- Modify: `apps/explore-web/src/pages/HomePage.tsx`
- Modify: `apps/explore-web/src/pages/MapPage.tsx`

- [ ] **Step 1: Écrire le composant**

```tsx
// apps/explore-web/src/components/navigation/BottomTabbar.tsx
import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { BottomTabbarPlusMenu } from './BottomTabbarPlusMenu'
import './BottomTabbar.css'

export function BottomTabbar() {
  const [plusOpen, setPlusOpen] = useState(false)

  return (
    <>
      <nav className="bottom-tabbar" aria-label="Navigation principale">
        <NavLink
          to="/accueil"
          className={({ isActive }) => `bottom-tabbar-cell${isActive ? ' active' : ''}`}
        >
          <span className="bottom-tabbar-icon" aria-hidden>🏠</span>
          <span className="bottom-tabbar-label">Accueil</span>
        </NavLink>

        <button
          type="button"
          className="bottom-tabbar-plus"
          onClick={() => setPlusOpen(true)}
          aria-label="Créer un élément"
        >
          +
        </button>

        <NavLink
          to="/carte"
          className={({ isActive }) => `bottom-tabbar-cell${isActive ? ' active' : ''}`}
        >
          <span className="bottom-tabbar-icon" aria-hidden>🗺️</span>
          <span className="bottom-tabbar-label">Carte</span>
        </NavLink>
      </nav>

      {plusOpen && <BottomTabbarPlusMenu onClose={() => setPlusOpen(false)} />}
    </>
  )
}
```

- [ ] **Step 2: Écrire le CSS (direction V3 parchemin patiné)**

```css
/* apps/explore-web/src/components/navigation/BottomTabbar.css */
.bottom-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0 calc(16px + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, #f4ecd8, #e6dcc4);
  border-top: 1px solid #8a6a3a;
  box-shadow: 0 -6px 20px rgba(42, 36, 24, 0.2);
  font-family: Georgia, serif;
}

.bottom-tabbar::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, #8a6a3a, transparent);
  pointer-events: none;
}

.bottom-tabbar-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
  text-decoration: none;
  color: #5a4a2a;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 12px;
  font-weight: 600;
  transition: color 0.2s ease;
}

.bottom-tabbar-cell.active {
  color: #2a1808;
}

.bottom-tabbar-icon {
  font-size: 22px;
  line-height: 1;
}

.bottom-tabbar-label {
  font-size: 11px;
  letter-spacing: 0.14em;
}

.bottom-tabbar-plus {
  position: absolute;
  left: 50%;
  top: -22px;
  transform: translateX(-50%);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff5d8, #d4a857 60%, #7a5a2a);
  border: 2px solid #f4ecd8;
  box-shadow: 0 0 0 1px #8a6a3a, 0 4px 12px rgba(42, 36, 24, 0.4);
  color: #5a3a18;
  font-size: 30px;
  font-weight: 300;
  font-family: Georgia, serif;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
}

.bottom-tabbar-plus:active {
  transform: translateX(-50%) scale(0.95);
}
```

- [ ] **Step 3: Stub temporaire BottomTabbarPlusMenu pour pouvoir builder**

```tsx
// apps/explore-web/src/components/navigation/BottomTabbarPlusMenu.tsx
interface Props { onClose: () => void }
export function BottomTabbarPlusMenu({ onClose }: Props) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)' }}>
      <p style={{ color: '#fff', padding: 32 }}>Menu (+) — TODO Task 3.2</p>
    </div>
  )
}
```

- [ ] **Step 4: Mount BottomTabbar dans HomePage et MapPage**

Dans `HomePage.tsx` :

```tsx
import { BottomTabbar } from '../components/navigation/BottomTabbar'

// dans le return :
<div className="home-page">
  <p>HomePage skeleton — sections à venir</p>
  <BottomTabbar />
</div>
```

Dans `MapPage.tsx` (juste avant la closing balise du wrapper de la page) : ajouter `<BottomTabbar />`.

- [ ] **Step 5: Smoke test live**

```bash
pnpm --filter explore-web dev
```

Naviguer entre `/accueil` et `/carte` via la tabbar. Expected:
- Tabbar visible en bas, fond parchemin
- (+) doré centré flottant au-dessus
- Tap "Accueil" / "Carte" navigue
- Tap (+) affiche stub overlay

- [ ] **Step 6: Commit**

```bash
git add apps/explore-web/src/components/navigation/
git commit -m "feat(web): BottomTabbar parcheminée + stub plus menu, mount dans HomePage et MapPage"
```

### Task 3.2 — `BottomTabbarPlusMenu` (vrai menu d'actions)

**Files:**
- Modify: `apps/explore-web/src/components/navigation/BottomTabbarPlusMenu.tsx`
- Create: `apps/explore-web/src/components/navigation/BottomTabbarPlusMenu.css`
- Modify: `apps/explore-web/src/components/expeditions/ExpeditionsHud.tsx` (désactiver l'ancien FAB)

- [ ] **Step 1: Identifier comment le FAB actuel ouvre l'`ExpeditionCreator`**

```bash
grep -n "requestOpenCreator\|requestOpenCreator\|setCreatorOpen" apps/explore-web/src/stores/expeditionsStore.ts apps/explore-web/src/components/expeditions/
```

Trouver la fonction du store qui demande l'ouverture (ex: `useExpeditionsStore.getState().requestOpenCreator(true)`).

Identifier aussi comment l'ajout de lieu est déclenché (probablement via `mapStore` ou un panneau dédié).

- [ ] **Step 2: Écrire le composant final**

```tsx
// apps/explore-web/src/components/navigation/BottomTabbarPlusMenu.tsx
import { useEffect } from 'react'
import { useExpeditionsStore } from '../../stores/expeditionsStore'
import { useMapStore } from '../../stores/mapStore'
import { useNavigate } from 'react-router-dom'
import './BottomTabbarPlusMenu.css'

interface Props {
  onClose: () => void
}

export function BottomTabbarPlusMenu({ onClose }: Props) {
  const navigate = useNavigate()
  const requestOpenCreator = useExpeditionsStore((s) => s.requestOpenCreator)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleCreateExpedition() {
    onClose()
    requestOpenCreator(true)
    // Si on n'est pas déjà sur la carte, y naviguer pour que l'orchestrateur ExpeditionsHud puisse afficher le creator
    if (!window.location.pathname.startsWith('/carte')) {
      navigate('/carte')
    }
  }

  function handleAddPlace() {
    onClose()
    // Le flow "Ajouter un lieu" existe sur la carte — grep préalable pour trouver la fonction réelle :
    //   grep -rn "addPlace\|setAddPlaceMode\|create_place_log\|ajouter un lieu" apps/explore-web/src
    // Patterns possibles :
    //  - useMapStore.getState().setAddPlaceMode(true)
    //  - useMapStore.getState().requestAddPlace()
    //  - un état dans un autre store (placesStore ?)
    // Câbler le déclencheur trouvé ici, puis si on n'est pas déjà sur la carte, naviguer.
    if (!window.location.pathname.startsWith('/carte')) {
      navigate('/carte?action=add-place')
    } else {
      // Déclencher directement le flow trouvé ci-dessus
      // useMapStore.getState().setAddPlaceMode(true)  // ← adapter selon grep
    }
  }

  return (
    <div className="plus-menu-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="plus-menu" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="plus-menu-item" onClick={handleCreateExpedition}>
          <span className="plus-menu-icon" aria-hidden>🚩</span>
          <span className="plus-menu-label">Ajouter un événement</span>
        </button>
        <button type="button" className="plus-menu-item" onClick={handleAddPlace}>
          <span className="plus-menu-icon" aria-hidden>📍</span>
          <span className="plus-menu-label">Ajouter un lieu</span>
        </button>
        <button type="button" className="plus-menu-cancel" onClick={onClose}>Annuler</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: CSS du menu**

```css
/* apps/explore-web/src/components/navigation/BottomTabbarPlusMenu.css */
.plus-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(42, 36, 24, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px;
  animation: plus-menu-fade-in 0.18s ease;
}

@keyframes plus-menu-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.plus-menu {
  width: 100%;
  max-width: 420px;
  background: linear-gradient(180deg, #f4ecd8, #e6dcc4);
  border: 1px solid #8a6a3a;
  border-radius: 16px;
  padding: 12px;
  margin-bottom: calc(96px + env(safe-area-inset-bottom));
  box-shadow: 0 12px 32px rgba(42, 36, 24, 0.5);
  font-family: Georgia, serif;
  animation: plus-menu-slide-up 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes plus-menu-slide-up {
  from { transform: translateY(20px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}

.plus-menu-item {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 16px;
  background: transparent;
  border: none;
  border-radius: 10px;
  color: #2a1808;
  font-size: 16px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;
}

.plus-menu-item:hover,
.plus-menu-item:active {
  background: rgba(122, 90, 42, 0.15);
}

.plus-menu-icon {
  font-size: 22px;
}

.plus-menu-cancel {
  display: block;
  width: 100%;
  margin-top: 8px;
  padding: 12px;
  background: rgba(42, 24, 8, 0.06);
  border: none;
  border-radius: 10px;
  color: #5a4a2a;
  font-size: 14px;
  font-style: italic;
  cursor: pointer;
}
```

- [ ] **Step 4: Désactiver l'ancien FAB de `ExpeditionsHud`**

Identifier dans `ExpeditionsHud.tsx` (ou son CSS) le composant FAB. S'il est rendu inline dans `ExpeditionsHud.tsx`, le commenter avec une note. S'il est dans un sous-composant, idem.

```tsx
// Dans ExpeditionsHud.tsx, retirer le FAB qui appelle setCreatorOpen / requestOpenCreator
// (déplacé dans BottomTabbar (+) menu — 9 mai 2026, pivot home-first)
```

- [ ] **Step 5: Smoke test**

```bash
pnpm --filter explore-web dev
```

Tester :
1. Tap (+) → menu s'ouvre, animation slide-up
2. Tap "Ajouter un événement" → ferme menu, navigue vers /carte (si pas déjà), `ExpeditionCreator` s'ouvre
3. Tap "Ajouter un lieu" → ferme menu, le flow d'ajout démarre
4. Tap outside / Escape → ferme menu
5. Plus de doublon : l'ancien FAB n'est plus visible

- [ ] **Step 6: Commit**

```bash
git add apps/explore-web/src/components/navigation/BottomTabbarPlusMenu.tsx apps/explore-web/src/components/navigation/BottomTabbarPlusMenu.css apps/explore-web/src/components/expeditions/ExpeditionsHud.tsx
git commit -m "feat(web): plus menu de la BottomTabbar (créer expé / ajouter lieu) + désactivation FAB legacy"
```

---

## Phase 4 — Top bar adaptations

### Task 4.1 — `StatsBar` (Niv+Gloire / Couronnes / Énergie)

**Files:**
- Create: `apps/explore-web/src/components/home/StatsBar.tsx`
- Create: `apps/explore-web/src/components/home/StatsBar.css`
- Modify: `apps/explore-web/src/pages/HomePage.tsx`

- [ ] **Step 1: Identifier les composants existants pour Niv+Gloire et Couronnes**

```bash
grep -rn "GloryIndicator\|GloireIndicator\|CrownsIndicator\|CouronnesIndicator\|level.*indicator" apps/explore-web/src/components/ | head -20
```

Si des composants existent déjà (ex: `GloryBadge`, `CrownsCount`), les réutiliser directement. Sinon, lire ce qu'il y a dans `playerStore` :

```bash
grep -n "level\|gloire\|crowns\|couronnes" apps/explore-web/src/stores/playerStore.ts
```

- [ ] **Step 2: Écrire `StatsBar`**

```tsx
// apps/explore-web/src/components/home/StatsBar.tsx
import { usePlayerStore } from '../../stores/playerStore'
import { EnergyIndicator } from '../map/badges/EnergyIndicator'
import './StatsBar.css'

export function StatsBar() {
  const level = usePlayerStore((s) => s.level)
  const glory = usePlayerStore((s) => s.glory)
  const crowns = usePlayerStore((s) => s.crowns)

  return (
    <div className="stats-bar">
      <button type="button" className="stats-cell" aria-label="Niveau et gloire">
        <span className="stats-cell-icon" aria-hidden>⭐</span>
        <span className="stats-cell-value">N{level}</span>
        <span className="stats-cell-sub">{glory} G</span>
      </button>

      <button type="button" className="stats-cell" aria-label="Couronnes">
        <span className="stats-cell-icon" aria-hidden>🪙</span>
        <span className="stats-cell-value">{crowns}</span>
      </button>

      <div className="stats-cell stats-cell-energy">
        <EnergyIndicator />
      </div>
    </div>
  )
}
```

⚠️ **Vérifier les noms exacts** des champs `level`, `glory`, `crowns` dans `playerStore`. S'ils s'appellent autrement (ex: `userLevel`, `userGlory`, `userCrowns`), adapter avant de tester.

⚠️ **Icône Couronnes** : `🪙` (pièce d'or) cf. mémoire XO `reference_couronne_icon_piece.md` — **JAMAIS** `👑`.

- [ ] **Step 3: CSS**

```css
/* apps/explore-web/src/components/home/StatsBar.css */
.stats-bar {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  overflow-x: auto;
  scrollbar-width: none;
  background: linear-gradient(180deg, rgba(244, 236, 216, 0.6), rgba(238, 232, 220, 0.4));
  border-bottom: 1px solid rgba(138, 106, 58, 0.3);
}

.stats-bar::-webkit-scrollbar { display: none; }

.stats-cell {
  flex: 1 0 auto;
  min-width: 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 12px;
  background: rgba(244, 236, 216, 0.85);
  border: 1px solid rgba(138, 106, 58, 0.4);
  border-radius: 10px;
  color: #2a1808;
  font-family: Georgia, serif;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.stats-cell:active {
  transform: scale(0.97);
  box-shadow: inset 0 1px 4px rgba(42, 36, 24, 0.2);
}

.stats-cell-icon { font-size: 18px; line-height: 1; }
.stats-cell-value { font-size: 16px; font-weight: 700; }
.stats-cell-sub { font-size: 12px; opacity: 0.7; font-style: italic; }

.stats-cell-energy {
  /* L'EnergyIndicator a son propre layout, juste donner le wrapper */
  padding: 4px 8px;
}
```

- [ ] **Step 4: Mount dans HomePage**

```tsx
// HomePage.tsx
import { StatsBar } from '../components/home/StatsBar'

// dans le return :
<div className="home-page">
  <StatsBar />
  <p>Sections à venir…</p>
  <BottomTabbar />
</div>
```

- [ ] **Step 5: Test live**

`pnpm --filter explore-web dev` → ouvrir `/accueil`. Expected: 3 cellules visibles, scroll-x si déborde, EnergyIndicator dans la 3e cellule, click sur Énergie ouvre la modal info existante.

- [ ] **Step 6: Commit**

```bash
git add apps/explore-web/src/components/home/StatsBar.tsx apps/explore-web/src/components/home/StatsBar.css apps/explore-web/src/pages/HomePage.tsx
git commit -m "feat(web): StatsBar HomePage (Niv+Gloire / Couronnes / Énergie)"
```

### Task 4.2 — `HouseAvatarBadge` (badge Maison sur avatar)

**Files:**
- Create: `apps/explore-web/src/components/home/HouseAvatarBadge.tsx`
- Create: `apps/explore-web/src/components/home/HouseAvatarBadge.css`
- Modify: `apps/explore-web/src/components/auth/ProfileMenu.tsx` (intégrer le badge sur l'avatar)

- [ ] **Step 1: Identifier la source de l'icône Héritage du joueur**

```bash
grep -rn "house\|heritage\|maison" apps/explore-web/src/stores/playerStore.ts apps/explore-web/src/hooks/usePlayer.ts
```

Trouver la propriété (ex: `userHouseIcon`, `userHouseId`, `userHeritageIcon`). Si le store ne l'a pas encore, étendre la requête `get_player_profile` pour la remonter.

- [ ] **Step 2: Écrire le composant**

```tsx
// apps/explore-web/src/components/home/HouseAvatarBadge.tsx
import { usePlayerStore } from '../../stores/playerStore'
import './HouseAvatarBadge.css'

interface Props {
  size?: number
}

export function HouseAvatarBadge({ size = 22 }: Props) {
  // Adapter le nom du field selon ce que le store expose réellement
  const houseIconUrl = usePlayerStore((s) => s.userHouseIconUrl)

  if (!houseIconUrl) return null

  return (
    <span
      className="house-avatar-badge"
      style={{ width: size, height: size }}
      aria-label="Mon Héritage"
    >
      <img src={houseIconUrl} alt="" className="house-avatar-badge-img" />
    </span>
  )
}
```

- [ ] **Step 3: CSS**

```css
/* apps/explore-web/src/components/home/HouseAvatarBadge.css */
.house-avatar-badge {
  position: absolute;
  bottom: -3px;
  right: -3px;
  border-radius: 50%;
  background: #2c2418;
  border: 2px solid #f0e6d0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none; /* l'avatar gère le click */
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.house-avatar-badge-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

- [ ] **Step 4: Intégrer le badge sur l'avatar dans `ProfileMenu`**

Dans `ProfileMenu.tsx`, modifier le bouton avatar pour qu'il devienne `position: relative` et insérer `<HouseAvatarBadge />` :

```tsx
import { HouseAvatarBadge } from '../home/HouseAvatarBadge'

// dans le JSX du bouton :
<button
  className="toolbar-btn profile-btn"
  onClick={() => setOpen(o => !o)}
  aria-label="Mon profil"
  style={{ position: 'relative' }}
>
  {userAvatarUrl ? (
    <img src={userAvatarUrl} alt="" className="profile-btn-avatar" />
  ) : (
    <span className="profile-btn-initial">{initial}</span>
  )}
  <HouseAvatarBadge size={20} />
</button>
```

Faire le même ajout dans `MobileHeader.tsx` (qui a aussi son propre bouton avatar/hamburger — vérifier si c'est le même pattern).

- [ ] **Step 5: Test live**

Vérifier sur un user qui a une Maison/Héritage assigné : badge visible en bas-droite de l'avatar, sur les deux contextes (desktop ProfileMenu + mobile MobileHeader). Sur un user sans Maison : pas de badge (composant retourne null).

- [ ] **Step 6: Commit**

```bash
git add apps/explore-web/src/components/home/HouseAvatarBadge.tsx apps/explore-web/src/components/home/HouseAvatarBadge.css apps/explore-web/src/components/auth/ProfileMenu.tsx apps/explore-web/src/components/map/controls/MobileHeader.tsx
git commit -m "feat(web): badge Maison/Héritage superposé sur l'avatar"
```

---

## Phase 5 — Sections content

### Task 5.1 — `DailyEnigmaCard`

**Files:**
- Create: `apps/explore-web/src/components/home/DailyEnigmaCard.tsx`
- Create: `apps/explore-web/src/components/home/DailyEnigmaCard.css`
- Modify: `apps/explore-web/src/pages/HomePage.tsx`

- [ ] **Step 1: Lire l'`EnigmaChestButton` pour comprendre l'API d'ouverture de l'énigme du jour**

Le composant `EnigmaChestButton` accepte `onOpenDaily` et `onOpenFragment`. Pour la card de la home, on veut juste l'énigme du jour — pas le menu fragment. On va créer une card visuelle propre qui réplique la logique mais en mode "bandeau".

- [ ] **Step 2: Écrire la card**

```tsx
// apps/explore-web/src/components/home/DailyEnigmaCard.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import './DailyEnigmaCard.css'

interface Props {
  onOpen: () => void
}

function getCountdown(): string {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  const diff = midnight.getTime() - now.getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${h}h${m.toString().padStart(2, '0')}`
}

export function DailyEnigmaCard({ onOpen }: Props) {
  const userId = usePlayerStore((s) => s.userId)
  const [dailyDone, setDailyDone] = useState(false)
  const [countdown, setCountdown] = useState(getCountdown())

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.rpc('get_daily_enigma_state', { p_user_id: userId })
      if (!cancelled && data) setDailyDone(Boolean((data as { done: boolean }).done))
    })()
    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    const id = setInterval(() => setCountdown(getCountdown()), 60000)
    return () => clearInterval(id)
  }, [])

  return (
    <button
      type="button"
      className={`daily-enigma-card${dailyDone ? ' done' : ''}`}
      onClick={onOpen}
      disabled={dailyDone}
    >
      <div className="daily-enigma-icon">📜</div>
      <div className="daily-enigma-content">
        <div className="daily-enigma-title">Énigme du jour</div>
        <div className="daily-enigma-sub">
          {dailyDone ? 'Résolue ✓' : `Disponible — réinitialise dans ${countdown}`}
        </div>
      </div>
    </button>
  )
}
```

⚠️ **Adapter** `get_daily_enigma_state` au nom réel de la RPC (à grepper). Si elle s'appelle autrement, remplacer.

- [ ] **Step 3: CSS**

```css
/* apps/explore-web/src/components/home/DailyEnigmaCard.css */
.daily-enigma-card {
  display: flex;
  align-items: center;
  gap: 14px;
  width: calc(100% - 32px);
  margin: 16px;
  padding: 18px 20px;
  background: linear-gradient(135deg, rgba(244, 236, 216, 0.95), rgba(220, 200, 160, 0.85));
  border: 1px solid rgba(138, 106, 58, 0.5);
  border-radius: 14px;
  box-shadow: 0 4px 14px rgba(42, 36, 24, 0.15);
  text-align: left;
  cursor: pointer;
  font-family: Georgia, serif;
  color: #2a1808;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.daily-enigma-card:active {
  transform: scale(0.99);
  box-shadow: 0 2px 8px rgba(42, 36, 24, 0.15);
}

.daily-enigma-card.done {
  opacity: 0.55;
  cursor: default;
}

.daily-enigma-icon {
  font-size: 32px;
  line-height: 1;
}

.daily-enigma-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.daily-enigma-sub {
  font-size: 13px;
  font-style: italic;
  margin-top: 4px;
  opacity: 0.8;
}
```

- [ ] **Step 4: Mount + handler dans HomePage**

```tsx
import { DailyEnigmaCard } from '../components/home/DailyEnigmaCard'
import { useState } from 'react'
import { DailyEnigmaModal } from '../components/enigma/DailyEnigmaModal'  // adapter au nom existant

export default function HomePage() {
  const [enigmaOpen, setEnigmaOpen] = useState(false)
  // ...
  return (
    <div className="home-page">
      <StatsBar />
      <DailyEnigmaCard onOpen={() => setEnigmaOpen(true)} />
      {enigmaOpen && <DailyEnigmaModal onClose={() => setEnigmaOpen(false)} />}
      <BottomTabbar />
    </div>
  )
}
```

⚠️ Adapter le nom de la modal d'énigme du jour (probablement `DailyEnigmaModal` ou similaire — à grepper).

- [ ] **Step 5: Test live + commit**

Vérifier : card visible, click ouvre la modal énigme, état "Résolue ✓" si déjà fait dans la journée.

```bash
git add apps/explore-web/src/components/home/DailyEnigmaCard.tsx apps/explore-web/src/components/home/DailyEnigmaCard.css apps/explore-web/src/pages/HomePage.tsx
git commit -m "feat(web): DailyEnigmaCard sur la HomePage"
```

### Task 5.2 — `HomeQuestsBoard` (embed des Quêtes + Expéditions)

**Files:**
- Create: `apps/explore-web/src/components/home/HomeQuestsBoard.tsx`
- Create: `apps/explore-web/src/components/home/HomeQuestsBoard.css`
- Modify: `apps/explore-web/src/pages/HomePage.tsx`

- [ ] **Step 1: Lire `DailyQuestsList` et `ExpeditionsList` pour comprendre leurs props**

```bash
head -40 apps/explore-web/src/components/quests/DailyQuestsList.tsx apps/explore-web/src/components/expeditions/ExpeditionsList.tsx
```

- [ ] **Step 2: Écrire le composant qui embed les deux listes**

```tsx
// apps/explore-web/src/components/home/HomeQuestsBoard.tsx
import { DailyQuestsList } from '../quests/DailyQuestsList'
import { ExpeditionsList } from '../expeditions/ExpeditionsList'
import './HomeQuestsBoard.css'

interface Props {
  onOpenExpedition: (id: string) => void
}

export function HomeQuestsBoard({ onOpenExpedition }: Props) {
  return (
    <section className="home-quests-board">
      <h2 className="home-quests-board-title">Tableau de Quête & Événements</h2>
      <div className="home-quests-board-section">
        <h3>Quêtes du jour</h3>
        <DailyQuestsList />
      </div>
      <div className="home-quests-board-section">
        <h3>Mes événements</h3>
        <ExpeditionsList onOpenExpedition={onOpenExpedition} />
      </div>
    </section>
  )
}
```

⚠️ **Adapter les props** au signatures réelles de `DailyQuestsList` et `ExpeditionsList`. Si elles attendent des props additionnels (ex: `userId`, `onComplete`), passer ce qu'il faut.

- [ ] **Step 3: CSS**

```css
/* apps/explore-web/src/components/home/HomeQuestsBoard.css */
.home-quests-board {
  margin: 0 16px 16px;
  padding: 16px;
  background: rgba(244, 236, 216, 0.9);
  border: 1px solid rgba(138, 106, 58, 0.4);
  border-radius: 14px;
  font-family: Georgia, serif;
  color: #2a1808;
}

.home-quests-board-title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(138, 106, 58, 0.3);
}

.home-quests-board-section + .home-quests-board-section {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed rgba(138, 106, 58, 0.3);
}

.home-quests-board-section h3 {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 0 10px;
  color: #5a3a18;
  font-style: italic;
}
```

- [ ] **Step 4: Mount dans HomePage avec orchestration de la modal Expedition**

```tsx
import { HomeQuestsBoard } from '../components/home/HomeQuestsBoard'
import { ExpeditionModal } from '../components/expeditions/ExpeditionModal'

export default function HomePage() {
  const [enigmaOpen, setEnigmaOpen] = useState(false)
  const [selectedExpeditionId, setSelectedExpeditionId] = useState<string | null>(null)

  return (
    <div className="home-page">
      <StatsBar />
      <DailyEnigmaCard onOpen={() => setEnigmaOpen(true)} />
      <HomeQuestsBoard onOpenExpedition={setSelectedExpeditionId} />

      {enigmaOpen && <DailyEnigmaModal onClose={() => setEnigmaOpen(false)} />}
      {selectedExpeditionId && (
        <ExpeditionModal
          expeditionId={selectedExpeditionId}
          onClose={() => setSelectedExpeditionId(null)}
        />
      )}
      <BottomTabbar />
    </div>
  )
}
```

- [ ] **Step 5: Test live + commit**

Vérifier les deux listes affichées, click sur une expé ouvre la modal.

```bash
git add apps/explore-web/src/components/home/HomeQuestsBoard.tsx apps/explore-web/src/components/home/HomeQuestsBoard.css apps/explore-web/src/pages/HomePage.tsx
git commit -m "feat(web): HomeQuestsBoard (Quêtes + Expéditions embed sur HomePage)"
```

### Task 5.3 — `FragmentsCarousel`

**Files:**
- Create: `apps/explore-web/src/components/home/FragmentsCarousel.tsx`
- Create: `apps/explore-web/src/components/home/FragmentsCarousel.css`
- Modify: `apps/explore-web/src/pages/HomePage.tsx`

- [ ] **Step 1: Écrire le composant**

```tsx
// apps/explore-web/src/components/home/FragmentsCarousel.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import './FragmentsCarousel.css'

interface Fragment {
  id: number
  name: string
  icon: string | null
  icon_url: string | null
  image_url: string | null
  link_url: string | null
  collection: string | null
  owned: boolean
}

export function FragmentsCarousel() {
  const userId = usePlayerStore((s) => s.userId)
  const [fragments, setFragments] = useState<Fragment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase.rpc('get_recent_fragments', {
          p_user_id: userId,
          p_limit: 10,
        })
        if (cancelled) return
        if (error) {
          console.warn('[FragmentsCarousel] get_recent_fragments failed', error)
          return
        }
        setFragments((data ?? []) as Fragment[])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [userId])

  if (loading || fragments.length === 0) return null

  return (
    <section className="fragments-carousel">
      <h2 className="fragments-carousel-title">Fragments</h2>
      <div className="fragments-carousel-track">
        {fragments.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`fragments-carousel-card${f.owned ? ' owned' : ''}`}
            onClick={() => {
              if (f.link_url) window.open(f.link_url, '_blank', 'noopener,noreferrer')
            }}
          >
            <div className="fragments-carousel-img-wrapper">
              {f.image_url || f.icon_url ? (
                <img src={f.image_url ?? f.icon_url ?? ''} alt={f.name} />
              ) : (
                <div className="fragments-carousel-placeholder">{f.icon ?? '✦'}</div>
              )}
              {f.owned && <div className="fragments-carousel-owned-badge">✓</div>}
            </div>
            <div className="fragments-carousel-name">{f.name}</div>
          </button>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: CSS**

```css
/* apps/explore-web/src/components/home/FragmentsCarousel.css */
.fragments-carousel {
  margin: 0 0 16px;
  padding: 0 0 8px;
}

.fragments-carousel-title {
  font-family: Georgia, serif;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #5a3a18;
  margin: 0 0 10px 16px;
}

.fragments-carousel-track {
  display: flex;
  gap: 10px;
  padding: 0 16px 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.fragments-carousel-track::-webkit-scrollbar { display: none; }

.fragments-carousel-card {
  flex: 0 0 auto;
  width: 120px;
  background: rgba(244, 236, 216, 0.9);
  border: 1px solid rgba(138, 106, 58, 0.4);
  border-radius: 12px;
  padding: 8px;
  cursor: pointer;
  transition: transform 0.15s ease;
  font-family: Georgia, serif;
}

.fragments-carousel-card:active { transform: scale(0.97); }
.fragments-carousel-card.owned { opacity: 0.7; }

.fragments-carousel-img-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  background: rgba(122, 90, 42, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.fragments-carousel-img-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.fragments-carousel-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  color: rgba(122, 90, 42, 0.6);
}

.fragments-carousel-owned-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  background: #2a1808;
  color: #f4ecd8;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
}

.fragments-carousel-name {
  margin-top: 6px;
  font-size: 13px;
  color: #2a1808;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 3: Mount + test live + commit**

```tsx
// dans HomePage.tsx
import { FragmentsCarousel } from '../components/home/FragmentsCarousel'

// après HomeQuestsBoard :
<FragmentsCarousel />
```

```bash
git add apps/explore-web/src/components/home/FragmentsCarousel.tsx apps/explore-web/src/components/home/FragmentsCarousel.css apps/explore-web/src/pages/HomePage.tsx
git commit -m "feat(web): FragmentsCarousel (10 derniers fragments, click ouvre Shopify)"
```

### Task 5.4 — `PlacesSection` (tabs Nouveaux / Proches)

**Files:**
- Create: `apps/explore-web/src/components/home/PlacesSection.tsx`
- Create: `apps/explore-web/src/components/home/PlacesSection.css`
- Modify: `apps/explore-web/src/pages/HomePage.tsx`

- [ ] **Step 1: Composant avec gestion geo + fallback**

```tsx
// apps/explore-web/src/components/home/PlacesSection.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import './PlacesSection.css'

interface Place {
  id: string
  title: string
  slug: string
  lat: number
  lng: number
  cover_image_url: string | null
  distance_km?: number
  created_at?: string
}

type Tab = 'recent' | 'nearby'

export function PlacesSection() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('recent')
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)

  // Récupérer la geo une fois pour la tab Proches
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeoError("La géolocalisation n'est pas disponible.")
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError('Active la géolocalisation pour voir les lieux proches.'),
      { timeout: 5000, maximumAge: 60000 }
    )
  }, [])

  // Fetcher les lieux selon le tab
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        if (tab === 'recent') {
          const { data, error } = await supabase.rpc('get_recent_places', { p_limit: 10 })
          if (!cancelled && !error) setPlaces((data ?? []) as Place[])
        } else if (tab === 'nearby' && userPos) {
          const { data, error } = await supabase.rpc('get_nearby_places', {
            p_lat: userPos.lat,
            p_lng: userPos.lng,
            p_limit: 10,
          })
          if (!cancelled && !error) setPlaces((data ?? []) as Place[])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [tab, userPos])

  function handlePlaceClick(p: Place) {
    navigate(`/carte?placeId=${p.id}`)
  }

  return (
    <section className="places-section">
      <h2 className="places-section-title">Nouveaux Lieux</h2>
      <div className="places-section-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'recent'}
          className={`places-section-tab${tab === 'recent' ? ' active' : ''}`}
          onClick={() => setTab('recent')}
        >
          Nouveaux
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'nearby'}
          className={`places-section-tab${tab === 'nearby' ? ' active' : ''}`}
          onClick={() => setTab('nearby')}
        >
          Proches
        </button>
      </div>

      {tab === 'nearby' && geoError && !userPos && (
        <p className="places-section-fallback">{geoError}</p>
      )}

      {loading && <p className="places-section-loading">Chargement…</p>}

      {!loading && places.length === 0 && tab === 'recent' && (
        <p className="places-section-empty">Aucun lieu pour le moment.</p>
      )}

      <ul className="places-section-list">
        {places.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="places-section-card"
              onClick={() => handlePlaceClick(p)}
            >
              {p.cover_image_url && (
                <img src={p.cover_image_url} alt="" className="places-section-card-img" />
              )}
              <div className="places-section-card-body">
                <div className="places-section-card-title">{p.title}</div>
                {tab === 'nearby' && p.distance_km != null && (
                  <div className="places-section-card-sub">
                    {p.distance_km < 1
                      ? `${Math.round(p.distance_km * 1000)} m`
                      : `${p.distance_km.toFixed(1)} km`}
                  </div>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 2: CSS**

```css
/* apps/explore-web/src/components/home/PlacesSection.css */
.places-section {
  margin: 0 16px 16px;
  font-family: Georgia, serif;
  color: #2a1808;
}

.places-section-title {
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #5a3a18;
  margin: 0 0 8px;
}

.places-section-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.places-section-tab {
  padding: 6px 14px;
  background: rgba(244, 236, 216, 0.6);
  border: 1px solid rgba(138, 106, 58, 0.3);
  border-radius: 14px;
  color: #5a3a18;
  font-size: 13px;
  font-weight: 600;
  font-family: Georgia, serif;
  cursor: pointer;
  transition: all 0.2s ease;
}

.places-section-tab.active {
  background: #5a3a18;
  border-color: #5a3a18;
  color: #f4ecd8;
}

.places-section-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.places-section-card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px;
  background: rgba(244, 236, 216, 0.85);
  border: 1px solid rgba(138, 106, 58, 0.3);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  font-family: Georgia, serif;
  color: #2a1808;
  transition: transform 0.15s ease;
}

.places-section-card:active { transform: scale(0.99); }

.places-section-card-img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 8px;
}

.places-section-card-title { font-size: 15px; font-weight: 700; }
.places-section-card-sub { font-size: 12px; opacity: 0.7; font-style: italic; margin-top: 2px; }

.places-section-fallback,
.places-section-empty,
.places-section-loading {
  font-size: 14px;
  font-style: italic;
  opacity: 0.7;
  margin: 8px 0;
}
```

- [ ] **Step 3: Adapter MapPage pour qu'elle ouvre `placeId` depuis l'URL**

```bash
grep -n "placeId\|useSearchParams" apps/explore-web/src/pages/MapPage.tsx
```

S'il n'y a pas déjà de prise en compte de `?placeId=…`, ajouter un useEffect qui lit `useSearchParams()` au mount et fait `useMapStore.getState().setSelectedPlaceId(placeId)`.

- [ ] **Step 4: Mount + test live + commit**

```tsx
// HomePage.tsx
import { PlacesSection } from '../components/home/PlacesSection'

// après FragmentsCarousel :
<PlacesSection />
```

```bash
git add apps/explore-web/src/components/home/PlacesSection.tsx apps/explore-web/src/components/home/PlacesSection.css apps/explore-web/src/pages/HomePage.tsx apps/explore-web/src/pages/MapPage.tsx
git commit -m "feat(web): PlacesSection (tabs Nouveaux/Proches) + deeplink ?placeId sur la carte"
```

### Task 5.5 — `ActivityFeed`

**Files:**
- Create: `apps/explore-web/src/components/home/ActivityFeed.tsx`
- Create: `apps/explore-web/src/components/home/ActivityFeed.css`
- Modify: `apps/explore-web/src/pages/HomePage.tsx`

- [ ] **Step 1: Vérifier la structure de la table `activity_log`**

```bash
grep -n "activity_log" supabase/migrations/*.sql | head -10
```

Identifier les colonnes : `id`, `type`, `actor_id`, `place_id`, `data` (jsonb), `created_at`. Comprendre les valeurs possibles de `type`.

- [ ] **Step 2: Composant avec filtre sur types narratifs**

```tsx
// apps/explore-web/src/components/home/ActivityFeed.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './ActivityFeed.css'

const NARRATIVE_TYPES = [
  'place_taken_back_gps',
  'place_taken_remote',
  'expedition_created',
  'place_discovered_first',
  'level_up',
] as const

interface ActivityRow {
  id: number
  type: string
  actor_id: string | null
  place_id: string | null
  data: {
    actorName?: string
    placeTitle?: string
    expeditionTitle?: string
    level?: number
  } | null
  created_at: string
}

function formatActivity(row: ActivityRow): { icon: string; text: string } {
  const actor = row.data?.actorName ?? 'Quelqu\'un'
  const place = row.data?.placeTitle ?? 'un lieu'
  switch (row.type) {
    case 'place_discovered_first':
      return { icon: '✨', text: `${actor} a découvert ${place} en premier` }
    case 'place_taken_back_gps':
      return { icon: '🚩', text: `${actor} a planté son drapeau sur ${place}` }
    case 'place_taken_remote':
      return { icon: '⚜️', text: `${actor} a pris ${place} par influence` }
    case 'expedition_created':
      return { icon: '🗺️', text: `${actor} organise « ${row.data?.expeditionTitle ?? 'un événement'} »` }
    case 'level_up':
      return { icon: '⭐', text: `${actor} a atteint le niveau ${row.data?.level ?? '?'}` }
    default:
      return { icon: '·', text: `${actor} ${row.type}` }
  }
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'à l\'instant'
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  const d = Math.floor(h / 24)
  return `il y a ${d}j`
}

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('activity_log')
          .select('id, type, actor_id, place_id, data, created_at')
          .in('type', NARRATIVE_TYPES as unknown as string[])
          .order('created_at', { ascending: false })
          .limit(30)
        if (cancelled) return
        if (error) {
          console.warn('[ActivityFeed] activity_log query failed', error)
          return
        }
        setItems((data ?? []) as ActivityRow[])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (loading) return null
  if (items.length === 0) return null

  return (
    <section className="activity-feed">
      <h2 className="activity-feed-title">Activités</h2>
      <ul className="activity-feed-list">
        {items.map((row) => {
          const { icon, text } = formatActivity(row)
          return (
            <li key={row.id} className="activity-feed-item">
              <span className="activity-feed-icon" aria-hidden>{icon}</span>
              <div className="activity-feed-body">
                <div className="activity-feed-text">{text}</div>
                <div className="activity-feed-time">{formatRelativeTime(row.created_at)}</div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
```

- [ ] **Step 3: CSS**

```css
/* apps/explore-web/src/components/home/ActivityFeed.css */
.activity-feed {
  margin: 0 16px 24px;
  font-family: Georgia, serif;
  color: #2a1808;
}

.activity-feed-title {
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #5a3a18;
  margin: 0 0 10px;
}

.activity-feed-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.activity-feed-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px;
  background: rgba(244, 236, 216, 0.55);
  border: 1px solid rgba(138, 106, 58, 0.2);
  border-radius: 8px;
}

.activity-feed-icon { font-size: 18px; line-height: 1.4; }
.activity-feed-text { font-size: 14px; line-height: 1.4; }
.activity-feed-time { font-size: 12px; opacity: 0.6; font-style: italic; margin-top: 2px; }
```

- [ ] **Step 4: Mount + test live + commit**

```tsx
// HomePage.tsx
import { ActivityFeed } from '../components/home/ActivityFeed'

// après PlacesSection :
<ActivityFeed />
```

```bash
git add apps/explore-web/src/components/home/ActivityFeed.tsx apps/explore-web/src/components/home/ActivityFeed.css apps/explore-web/src/pages/HomePage.tsx
git commit -m "feat(web): ActivityFeed (30 derniers events narratifs)"
```

---

## Phase 6 — Polish parchemin

### Task 6.1 — Texture parchemin + couleurs LandingPage

**Files:**
- Modify: `apps/explore-web/src/pages/HomePage.css`
- Possible: import du PNG parchemin depuis `assets/`

- [ ] **Step 1: Identifier l'asset parchemin de la LandingPage**

```bash
grep -rn "parchemin\|frame.*png\|landing.*frame" apps/explore-web/src/components/landing/ apps/explore-web/src/assets/
```

Si le PNG existe dans `assets/`, on peut le réutiliser comme background-image discret de la HomePage.

- [ ] **Step 2: Mettre à jour HomePage.css**

```css
.home-page {
  min-height: 100dvh;
  background-color: #eee8dc;
  background-image: url('/path/to/parchment-texture.png'); /* à adapter */
  background-size: cover;
  background-position: center top;
  background-attachment: fixed;
  padding-bottom: 96px;
}

.home-page::before {
  content: '';
  position: fixed;
  inset: 0;
  background: rgba(244, 236, 216, 0.3);
  pointer-events: none;
  z-index: -1;
}
```

- [ ] **Step 3: Test live polish**

`pnpm --filter explore-web dev` → vérifier que la HomePage a vraiment l'atmosphère parcheminée. Si la texture rend trop fort, baisser l'opacité.

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/pages/HomePage.css
git commit -m "polish(web): texture parchemin sur la HomePage (réutilisation asset LandingPage)"
```

### Task 6.2 — Animation transitions `/accueil` ↔ `/carte`

**Files:**
- Modify: `apps/explore-web/src/components/navigation/BottomTabbar.css`

- [ ] **Step 1: Ajouter une transition fluide d'opacité sur les pages**

(Optionnel — à faire si le rendu actuel saccade trop. Sinon skip.)

```css
/* Dans App.css ou un fichier global */
.home-page,
.map-page {
  animation: page-fade-in 0.25s ease;
}

@keyframes page-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: Test + commit (skip si pas utile)**

---

## Phase 7 — Tests live + cleanup final

### Task 7.1 — QA mobile complet

- [ ] **Step 1: Test sur Chrome mobile emulation**

`pnpm --filter explore-web dev`. Ouvrir DevTools → device toolbar → iPhone 14 Pro. Naviguer :
- Accueil ↔ Carte via tabbar
- (+) menu → créer expédition → ajouter lieu
- StatsBar : click sur Énergie → modal info ; clicks sur Niv+Gloire et Couronnes = no-op visuel (animation `:active` uniquement). Connexion des modals niveau/coffre repoussée à une phase ultérieure si besoin.
- DailyEnigmaCard → modal énigme, état "Résolue" si déjà fait
- HomeQuestsBoard → liste des quêtes + expéditions
- FragmentsCarousel → scroll-x, click ouvre Shopify dans nouvel onglet
- PlacesSection → tabs Nouveaux/Proches, click ouvre `/carte?placeId=…`, fallback sans geo
- ActivityFeed → 30 derniers events lisibles
- Avatar top-right → menu, badge Maison visible

- [ ] **Step 2: Test sur vrai téléphone**

Tunnel via `pnpm --filter explore-web dev --host` ou Netlify branch deploy. Tester sur iPhone et Android :
- Tabbar bottom respecte le safe-area-inset
- Scroll vertical fluide
- Geo prompt système

- [ ] **Step 3: Test edge cases**

- User pas loggé → redirect `/` (LandingPage)
- User loggé sans Maison → pas de badge avatar
- User refuse la geoloc → fallback "Active la géolocalisation pour voir les lieux proches."
- Aucune activité narrative dans la BDD → ActivityFeed ne s'affiche pas (return null)

### Task 7.2 — Push final + récap

- [ ] **Step 1: Vérifier qu'aucun commit local n'est resté en arrière**

```bash
git log home-pivot --oneline
git status
```

- [ ] **Step 2: Push de la branche**

```bash
git push -u origin home-pivot
```

- [ ] **Step 3: Décision merge**

Si tout marche (mobile + desktop + edge cases) ET que c'est jugé prêt par Uriel → merger sur `main` et déployer Netlify (chemin absolu pour `--dir`, cf. mémoire XO).

```bash
git checkout main
git merge home-pivot --no-ff -m "feat(web): pivot home-first (HomePage + BottomTabbar)"
git push origin main
```

Sinon → garder la branche `home-pivot` pushée pour reprise post-festival, **ne PAS merger sur `main`** (consigne Uriel : "Si on arrive pas à finir ce soir, on déploie pas").

---

## Récap visual companion

À la fin de l'implémentation, on peut clore la session du visual companion :

```bash
scripts/stop-server.sh "/c/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/.superpowers/brainstorm/2219-1778313956"
```

Les mockups restent persistés dans le repo (`.superpowers/brainstorm/` est dans `.gitignore`).
