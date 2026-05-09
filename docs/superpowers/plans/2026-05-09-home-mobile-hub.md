# Home Mobile Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une home mobile hub des 3 raisons de revenir (rituel/lien/aventure), avec navbar 5 cellules, header partagé entre `/accueil` et `/carte` mobile, et deux pages plein écran (`/chat`, `/activite`). Desktop inchangé : `/carte` reste racine.

**Architecture:** Nouvelle branche `home-mobile-hub` from `main`. Récupération chirurgicale par `git checkout home-pivot -- <file>` des composants utiles déjà construits sur `home-pivot` (sans charrier `MainShell` desktop ni `FragmentsCarousel`). Détection mobile/desktop via hook `useMediaQuery` (breakpoint `min-width: 750px`). Les composants existants (`ChatPanel`, `ActivityFeed`, `QuestsBoardPanel`, `StatsBar`, `DailyEnigmaCard`, `PlacesSection`) sont réutilisés — peu de code neuf, beaucoup d'orchestration.

**Tech Stack:** React 18, Vite 5, TypeScript strict, Zustand 5, React Router 7, Supabase JS, MapLibre GL JS. **Pas de framework de tests unitaires** dans la codebase — validation via `pnpm build` (tsc strict + vite build) + `pnpm dev` manuel sur mobile + desktop. Commits fréquents, push par lots cohérents.

**Spec source:** `docs/superpowers/specs/2026-05-09-home-mobile-hub-design.md`

---

## File Structure

### Nouveaux fichiers
- `apps/explore-web/src/hooks/useMediaQuery.ts` — détection mobile/desktop
- `apps/explore-web/src/components/navigation/MobileTopBar.tsx` + `.css` — bandeau partagé Home/Carte mobile
- `apps/explore-web/src/components/navigation/MobileStatsBar.tsx` + `.css` — wrapper de StatsBar pour usage partagé
- `apps/explore-web/src/components/navigation/BottomTabbar.tsx` + `.css` — 5 cellules + FAB
- `apps/explore-web/src/components/navigation/BottomTabbarPlusMenu.tsx` — menu du bouton +
- `apps/explore-web/src/pages/HomePage.tsx` + `.css` — page `/accueil`
- `apps/explore-web/src/pages/ChatPage.tsx` + `.css` — page `/chat` plein écran
- `apps/explore-web/src/pages/ActivityPage.tsx` + `.css` — page `/activite` plein écran

### Composants importés tels quels depuis `home-pivot` (via `git checkout home-pivot --`)
- `apps/explore-web/src/components/home/StatsBar.tsx` + `.css` — utilisé via le wrapper `MobileStatsBar`
- `apps/explore-web/src/components/home/DailyEnigmaCard.tsx` + `.css`
- `apps/explore-web/src/components/home/EnigmaFragmentsList.tsx` + `.css`
- `apps/explore-web/src/components/home/PlacesSection.tsx` + `.css`
- `apps/explore-web/src/components/home/ActivityFeed.tsx` + `.css` — utilisé en teaser sur `/accueil` (limit=3) ET en page complète sur `/activite` (limit=30) via prop `limit`

### Composants explicitement non importés depuis `home-pivot`
- `pages/MainShell.tsx` + `.css` — desktop split-view rejeté
- `pages/MapRouteGuard.tsx`, `pages/HomeRoute.tsx` — remplacés par redirections inline dans `App.tsx`
- `components/home/FragmentsCarousel.tsx` — exclu (cf. spec §3.3)
- `components/home/HouseAvatarBadge.tsx` — non requis (avatar de `ProfileMenu` existant suffit)
- Mode `in-panel` de `PlacePanel` — desktop garde le mode modal d'origine

### Fichiers modifiés
- `apps/explore-web/src/App.tsx` — ajout routes `/accueil`, `/chat`, `/activite`, redirection platform-aware sur `/`
- `apps/explore-web/src/pages/MapPage.tsx` — sur mobile : monte `MobileTopBar` + `MobileStatsBar`, retire le `ChatPanel` flottant (mais le garde sur desktop), retire l'ancien bouton flottant "Visiter la Boutique"
- `apps/explore-web/src/version.ts` — bump version (V0.7.8 ou V0.8.0)

---

## Task 1: Setup nouvelle branche

**Files:**
- Modify: working tree (branch state)

- [ ] **Step 1.1: Vérifier l'état git de départ**

```bash
cd "/c/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
git status
git branch --show-current
```

Expected: working tree clean, branche `main`. Si autre branche, demander à Uriel.

- [ ] **Step 1.2: Sync main avec origin**

```bash
git pull origin main
```

Expected: `Already up to date.` ou fast-forward propre. Si conflits, demander à Uriel.

- [ ] **Step 1.3: Créer la nouvelle branche depuis main**

```bash
git checkout -b home-mobile-hub
```

Expected: `Switched to a new branch 'home-mobile-hub'`.

- [ ] **Step 1.4: Vérifier que `home-pivot` est encore là (lecture des fichiers source pour les imports à venir)**

```bash
git rev-parse home-pivot
git rev-parse origin/home-pivot
```

Expected: deux SHA non vides. La branche `home-pivot` reste intacte (locale + origin) comme archive.

---

## Task 2: Hook `useMediaQuery`

**Files:**
- Create: `apps/explore-web/src/hooks/useMediaQuery.ts`

- [ ] **Step 2.1: Importer le hook depuis home-pivot**

```bash
git checkout home-pivot -- apps/explore-web/src/hooks/useMediaQuery.ts
```

Expected: fichier créé, contenu identique à la version home-pivot (`useMediaQuery` + `useIsDesktop` exporté avec breakpoint `750px`).

- [ ] **Step 2.2: Vérifier le contenu**

Run: `cat apps/explore-web/src/hooks/useMediaQuery.ts`

Expected: contient `export function useMediaQuery(query: string): boolean` et `export const useIsDesktop = () => useMediaQuery('(min-width: 750px)')`.

- [ ] **Step 2.3: Build typecheck**

```bash
cd apps/explore-web && pnpm build
```

Expected: build OK, pas d'erreur TS.

- [ ] **Step 2.4: Commit**

```bash
git add apps/explore-web/src/hooks/useMediaQuery.ts
git commit -m "feat(web): hook useMediaQuery + useIsDesktop (breakpoint 750px)"
```

---

## Task 3: Composants `home/` réutilisables (import depuis home-pivot)

**Files:**
- Create (via `git checkout home-pivot --`):
  - `apps/explore-web/src/components/home/StatsBar.tsx` + `.css`
  - `apps/explore-web/src/components/home/DailyEnigmaCard.tsx` + `.css`
  - `apps/explore-web/src/components/home/EnigmaFragmentsList.tsx` + `.css`
  - `apps/explore-web/src/components/home/PlacesSection.tsx` + `.css`
  - `apps/explore-web/src/components/home/ActivityFeed.tsx` + `.css`

- [ ] **Step 3.1: Importer les fichiers home/ utiles**

```bash
git checkout home-pivot -- apps/explore-web/src/components/home/StatsBar.tsx
git checkout home-pivot -- apps/explore-web/src/components/home/StatsBar.css
git checkout home-pivot -- apps/explore-web/src/components/home/DailyEnigmaCard.tsx
git checkout home-pivot -- apps/explore-web/src/components/home/DailyEnigmaCard.css
git checkout home-pivot -- apps/explore-web/src/components/home/EnigmaFragmentsList.tsx
git checkout home-pivot -- apps/explore-web/src/components/home/EnigmaFragmentsList.css
git checkout home-pivot -- apps/explore-web/src/components/home/PlacesSection.tsx
git checkout home-pivot -- apps/explore-web/src/components/home/PlacesSection.css
git checkout home-pivot -- apps/explore-web/src/components/home/ActivityFeed.tsx
git checkout home-pivot -- apps/explore-web/src/components/home/ActivityFeed.css
```

Expected: 10 fichiers stagés (vérifier avec `git status`).

- [ ] **Step 3.2: Vérifier qu'aucun de ces fichiers n'importe `FragmentsCarousel` ni `HouseAvatarBadge`**

Run: `grep -rn "FragmentsCarousel\|HouseAvatarBadge" apps/explore-web/src/components/home/`

Expected: aucun résultat. Si match, retirer l'import et l'usage manuellement (à montrer dans le diff).

- [ ] **Step 3.3: Adapter `ActivityFeed.tsx` pour accepter une prop `limit` et une prop optionnelle `onSeeMore`**

Lire le fichier importé : `cat apps/explore-web/src/components/home/ActivityFeed.tsx`

Modifier la signature (et la consommation) pour :

```tsx
interface ActivityFeedProps {
  /** Nombre max d'événements à afficher. Défaut: 30. */
  limit?: number
  /** Si défini, affiche un lien "Voir tout →" en bas. */
  onSeeMore?: () => void
}

export function ActivityFeed({ limit = 30, onSeeMore }: ActivityFeedProps) {
  // ... logique existante, mais slice(0, limit) sur la liste affichée
  // ... après la liste, si onSeeMore: <button className="activity-feed-more" onClick={onSeeMore}>Voir tout →</button>
}
```

Le fichier home-pivot rendait probablement les 30 events sans prop. Adapter pour `slice(0, limit)` au rendu et conditionner le bouton "Voir tout".

- [ ] **Step 3.4: Ajouter les styles du bouton "Voir tout" dans `ActivityFeed.css`**

```css
.activity-feed-more {
  display: block;
  width: 100%;
  padding: 12px;
  margin-top: 8px;
  background: transparent;
  border: 1px dashed var(--color-sepia);
  border-radius: 8px;
  color: var(--color-ink);
  font-family: var(--font-accent);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.activity-feed-more:hover { background: var(--color-parchment-dark); }
```

- [ ] **Step 3.5: Build typecheck**

```bash
cd apps/explore-web && pnpm build
```

Expected: build OK. Si erreur sur les types `--color-*` ou les imports, fixer en lisant les composants concernés.

- [ ] **Step 3.6: Commit**

```bash
git add apps/explore-web/src/components/home/
git commit -m "feat(web): import composants home/ réutilisables depuis home-pivot

- StatsBar, DailyEnigmaCard, EnigmaFragmentsList, PlacesSection
- ActivityFeed adapté avec props limit + onSeeMore (teaser ou page complète)
- Exclus : FragmentsCarousel et HouseAvatarBadge (non requis)"
```

---

## Task 4: Composant `MobileStatsBar` (wrapper de StatsBar)

**Files:**
- Create: `apps/explore-web/src/components/navigation/MobileStatsBar.tsx`
- Create: `apps/explore-web/src/components/navigation/MobileStatsBar.css`

- [ ] **Step 4.1: Créer le wrapper TypeScript**

Path: `apps/explore-web/src/components/navigation/MobileStatsBar.tsx`

```tsx
import { StatsBar } from '../home/StatsBar'
import './MobileStatsBar.css'

interface MobileStatsBarProps {
  /** Si true, applique un dégradé en bas (utilisé sur /carte mobile pour fondre vers MapLibre). */
  fadeOutBottom?: boolean
}

export function MobileStatsBar({ fadeOutBottom = false }: MobileStatsBarProps) {
  return (
    <div className={`mobile-stats-bar${fadeOutBottom ? ' mobile-stats-bar--fade' : ''}`}>
      <StatsBar />
    </div>
  )
}
```

- [ ] **Step 4.2: Créer le CSS associé**

Path: `apps/explore-web/src/components/navigation/MobileStatsBar.css`

```css
.mobile-stats-bar {
  position: relative;
  background: var(--color-parchment);
}

.mobile-stats-bar--fade::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -16px;
  height: 16px;
  background: linear-gradient(180deg, var(--color-parchment) 0%, transparent 100%);
  pointer-events: none;
  z-index: 5;
}
```

- [ ] **Step 4.3: Build typecheck**

```bash
cd apps/explore-web && pnpm build
```

Expected: build OK.

- [ ] **Step 4.4: Commit**

```bash
git add apps/explore-web/src/components/navigation/MobileStatsBar.tsx apps/explore-web/src/components/navigation/MobileStatsBar.css
git commit -m "feat(web): MobileStatsBar wrapper avec option fadeOutBottom pour /carte"
```

---

## Task 5: Composant `MobileTopBar` (logo + boutique + cloche + profile)

**Files:**
- Create: `apps/explore-web/src/components/navigation/MobileTopBar.tsx`
- Create: `apps/explore-web/src/components/navigation/MobileTopBar.css`

- [ ] **Step 5.1: Lire `ProfileMenu` et `NotificationBell` pour confirmer leurs signatures**

```bash
grep -n "export\|interface\|Props" apps/explore-web/src/components/auth/ProfileMenu.tsx | head -10
grep -n "export\|interface\|Props" apps/explore-web/src/components/notifications/NotificationBell.tsx | head -10
```

Expected: `ProfileMenu` requiert au moins `email: string`, `onSignOut: () => void`, et probablement `onFactionModal`. Adapter le code de Step 5.2 selon les vraies props vues.

- [ ] **Step 5.2: Créer `MobileTopBar.tsx`**

Path: `apps/explore-web/src/components/navigation/MobileTopBar.tsx`

```tsx
import { useAuth } from '../../hooks/useAuth'
import { ProfileMenu } from '../auth/ProfileMenu'
import { NotificationBell } from '../notifications/NotificationBell'
import logoImg from '../../assets/logo_couleur_mobile.webp'
import './MobileTopBar.css'

const SHOPIFY_URL = 'https://runesdechene.com'

interface MobileTopBarProps {
  /** Quand true, applique un dégradé en bas (sur /carte mobile pour fondre vers la carte). */
  fadeOutBottom?: boolean
  /** Callback ouverture modale faction (transmis à ProfileMenu). */
  onFactionModal?: () => void
}

export function MobileTopBar({ fadeOutBottom = false, onFactionModal }: MobileTopBarProps) {
  const { user, signOut } = useAuth()

  return (
    <header className={`mobile-topbar${fadeOutBottom ? ' mobile-topbar--fade' : ''}`}>
      <img src={logoImg} alt="Runes de Chêne" className="mobile-topbar-logo" />
      <div className="mobile-topbar-spacer" />
      <a
        href={SHOPIFY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mobile-topbar-shop"
        aria-label="Visiter la boutique"
      >
        🏪
      </a>
      <NotificationBell />
      {user?.email && (
        <ProfileMenu
          email={user.email}
          onSignOut={signOut}
          onFactionModal={onFactionModal ?? (() => {})}
        />
      )}
    </header>
  )
}
```

**NB :** si Step 5.1 a révélé que `ProfileMenu` a une autre signature, ajuster la prop `onFactionModal` ou supprimer ce paramètre.

- [ ] **Step 5.3: Créer `MobileTopBar.css`**

Path: `apps/explore-web/src/components/navigation/MobileTopBar.css`

```css
.mobile-topbar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--color-parchment);
  border-bottom: 1px solid var(--color-sepia);
  z-index: 10;
}

.mobile-topbar-logo {
  height: 28px;
  width: auto;
}

.mobile-topbar-spacer {
  flex: 1;
}

.mobile-topbar-shop {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-parchment-dark);
  border: 1px solid var(--color-sepia);
  color: var(--color-ink);
  text-decoration: none;
  font-size: 16px;
  transition: transform 0.15s ease;
}
.mobile-topbar-shop:active { transform: scale(0.92); }

.mobile-topbar--fade {
  border-bottom: none;
}

/* Sur desktop, on cache la topbar mobile (le HUD desktop a son propre header) */
@media (min-width: 750px) {
  .mobile-topbar { display: none; }
}
```

- [ ] **Step 5.4: Build typecheck**

```bash
cd apps/explore-web && pnpm build
```

Expected: build OK. Si TS plante sur `useAuth` ou `ProfileMenu`, ajuster les imports/props.

- [ ] **Step 5.5: Commit**

```bash
git add apps/explore-web/src/components/navigation/MobileTopBar.tsx apps/explore-web/src/components/navigation/MobileTopBar.css
git commit -m "feat(web): MobileTopBar (logo + 🏪 + cloche + ProfileMenu) partagé Home/Carte mobile"
```

---

## Task 6: BottomTabbar 5 cellules + PlusMenu

**Files:**
- Create: `apps/explore-web/src/components/navigation/BottomTabbar.tsx`
- Create: `apps/explore-web/src/components/navigation/BottomTabbar.css`
- Create (via `git checkout home-pivot --`): `apps/explore-web/src/components/navigation/BottomTabbarPlusMenu.tsx`

- [ ] **Step 6.1: Importer le PlusMenu existant depuis home-pivot**

```bash
git checkout home-pivot -- apps/explore-web/src/components/navigation/BottomTabbarPlusMenu.tsx
# Si un .css existe aussi sur home-pivot, l'importer également:
git ls-tree home-pivot apps/explore-web/src/components/navigation/ | grep -i plusmenu
```

Si un `BottomTabbarPlusMenu.css` existe sur home-pivot, l'importer pareil.

- [ ] **Step 6.2: Créer `BottomTabbar.tsx` à 5 cellules**

Path: `apps/explore-web/src/components/navigation/BottomTabbar.tsx`

```tsx
import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { BottomTabbarPlusMenu } from './BottomTabbarPlusMenu'
import { useNotificationStore } from '../../stores/notificationStore'
import { useChatStore } from '../../stores/chatStore'
import './BottomTabbar.css'

export function BottomTabbar() {
  const [plusOpen, setPlusOpen] = useState(false)

  // Compteurs non-lus pour les badges
  const unreadActivity = useNotificationStore((s) => s.unreadCount ?? 0)
  // Le chatStore n'a pas de unread natif aujourd'hui — placeholder à 0 (sera implémenté dans un sprint suivant si besoin)
  const unreadChat = 0

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

        <NavLink
          to="/chat"
          className={({ isActive }) => `bottom-tabbar-cell${isActive ? ' active' : ''}`}
        >
          <span className="bottom-tabbar-icon" aria-hidden>💬</span>
          <span className="bottom-tabbar-label">Chat</span>
          {unreadChat > 0 && <span className="bottom-tabbar-badge">{unreadChat}</span>}
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
          to="/activite"
          className={({ isActive }) => `bottom-tabbar-cell${isActive ? ' active' : ''}`}
        >
          <span className="bottom-tabbar-icon" aria-hidden>🔔</span>
          <span className="bottom-tabbar-label">Activité</span>
          {unreadActivity > 0 && <span className="bottom-tabbar-badge">{unreadActivity}</span>}
        </NavLink>

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

**NB :** si `notificationStore` n'a pas de propriété `unreadCount`, ajuster en lisant le store. Si rien d'utilisable pour les non-lus, mettre `unreadActivity = 0` et noter la dette dans le commit.

- [ ] **Step 6.3: Créer `BottomTabbar.css`**

Path: `apps/explore-web/src/components/navigation/BottomTabbar.css`

```css
.bottom-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: stretch;
  height: 64px;
  background: var(--color-parchment);
  border-top: 1px solid var(--color-sepia);
  z-index: 50;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.08);
}

.bottom-tabbar-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  text-decoration: none;
  color: var(--color-ink);
  font-family: var(--font-accent);
  font-size: 11px;
  position: relative;
  transition: color 0.15s ease;
}
.bottom-tabbar-cell.active { color: var(--color-gold); }

.bottom-tabbar-icon { font-size: 20px; line-height: 1; }
.bottom-tabbar-label { font-size: 10px; letter-spacing: 0.5px; }

.bottom-tabbar-badge {
  position: absolute;
  top: 6px;
  right: 22%;
  background: #c0392b;
  color: #fff;
  font-size: 10px;
  font-weight: bold;
  padding: 1px 5px;
  border-radius: 9px;
  min-width: 16px;
  text-align: center;
}

.bottom-tabbar-plus {
  width: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
}
.bottom-tabbar-plus::before {
  content: '+';
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-gold);
  color: var(--color-parchment);
  font-size: 28px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: -16px;
  box-shadow: 0 4px 14px rgba(212, 175, 55, 0.45);
  transition: transform 0.15s ease;
}
.bottom-tabbar-plus:active::before { transform: scale(0.92); }

/* La navbar ne s'affiche que sur mobile */
@media (min-width: 750px) {
  .bottom-tabbar { display: none; }
}
```

- [ ] **Step 6.4: Build typecheck**

```bash
cd apps/explore-web && pnpm build
```

Expected: build OK. Si erreur sur `notificationStore.unreadCount`, ajuster.

- [ ] **Step 6.5: Commit**

```bash
git add apps/explore-web/src/components/navigation/
git commit -m "feat(web): BottomTabbar 5 cellules (Accueil/Chat/+/Activité/Carte) + PlusMenu importé"
```

---

## Task 7: Page `/accueil` (HomePage)

**Files:**
- Create: `apps/explore-web/src/pages/HomePage.tsx`
- Create: `apps/explore-web/src/pages/HomePage.css`

- [ ] **Step 7.1: Créer `HomePage.tsx`**

Path: `apps/explore-web/src/pages/HomePage.tsx`

```tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePlayer } from '../hooks/usePlayer'
import { useResourceTimers } from '../hooks/useResourceTimers'
import { MobileTopBar } from '../components/navigation/MobileTopBar'
import { MobileStatsBar } from '../components/navigation/MobileStatsBar'
import { BottomTabbar } from '../components/navigation/BottomTabbar'
import { DailyEnigmaCard } from '../components/home/DailyEnigmaCard'
import { EnigmaFragmentsList } from '../components/home/EnigmaFragmentsList'
import { QuestsBoardPanel } from '../components/quests/QuestsBoardPanel'
import { PlacesSection } from '../components/home/PlacesSection'
import { ActivityFeed } from '../components/home/ActivityFeed'
import { FactionModal } from '../components/auth/FactionModal'
import { GameToast } from '../components/map/overlays/GameToast'
import { DailyEnigma } from '../components/enigma/DailyEnigma'
import { FragmentEnigma } from '../components/enigma/FragmentEnigma'
import './HomePage.css'

export default function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [showFactionModal, setShowFactionModal] = useState(false)
  const [showDailyEnigma, setShowDailyEnigma] = useState(false)
  const [enigmaRefreshKey, setEnigmaRefreshKey] = useState(0)
  const [fragmentEnigma, setFragmentEnigma] = useState<{
    fragmentId: number
    name: string
    icon: string | null
    iconUrl: string | null
  } | null>(null)

  // Hooks de contexte joueur (mêmes que MapPage)
  usePlayer()
  useResourceTimers()

  useEffect(() => {
    document.title = 'Runes de Chêne — Accueil'
  }, [])

  if (!user) return null

  return (
    <div className="home-page">
      <MobileTopBar onFactionModal={() => setShowFactionModal(true)} />
      <MobileStatsBar />

      <main className="home-page-scroll">
        <section className="home-section">
          <DailyEnigmaCard
            onOpenDaily={() => setShowDailyEnigma(true)}
            refreshKey={enigmaRefreshKey}
          />
          <EnigmaFragmentsList
            onOpenFragment={(f) => setFragmentEnigma(f)}
          />
        </section>

        <section className="home-section">
          <h2 className="home-section-title">Événements & Quêtes</h2>
          <QuestsBoardPanel />
        </section>

        <section className="home-section">
          <h2 className="home-section-title">Lieux récents</h2>
          <PlacesSection />
        </section>

        <section className="home-section">
          <h2 className="home-section-title">Activité de la carte</h2>
          <ActivityFeed limit={3} onSeeMore={() => navigate('/activite')} />
        </section>
      </main>

      <BottomTabbar />

      {/* Modales et toasts */}
      {showFactionModal && (
        <FactionModal
          isOpen
          currentFactionId={null}
          onClose={() => setShowFactionModal(false)}
        />
      )}
      {showDailyEnigma && (
        <DailyEnigma
          onClose={() => {
            setShowDailyEnigma(false)
            setEnigmaRefreshKey((k) => k + 1)
          }}
        />
      )}
      {fragmentEnigma && (
        <FragmentEnigma
          fragmentId={fragmentEnigma.fragmentId}
          name={fragmentEnigma.name}
          icon={fragmentEnigma.icon}
          iconUrl={fragmentEnigma.iconUrl}
          onClose={() => setFragmentEnigma(null)}
        />
      )}
      <GameToast />
    </div>
  )
}
```

**NB :** si les signatures des composants enfants (`DailyEnigmaCard`, `EnigmaFragmentsList`, `FactionModal`) diffèrent de ce qu'on suppose ici, lire les fichiers (`grep -n "interface.*Props\|export function" apps/explore-web/src/components/home/DailyEnigmaCard.tsx`) et corriger.

- [ ] **Step 7.2: Créer `HomePage.css`**

Path: `apps/explore-web/src/pages/HomePage.css`

```css
.home-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--color-parchment);
}

.home-page-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0 0 80px; /* espace pour la BottomTabbar */
}

.home-section {
  padding: 16px;
  border-bottom: 1px solid var(--color-sepia-light, rgba(74, 55, 40, 0.15));
}
.home-section:last-child { border-bottom: none; }

.home-section-title {
  margin: 0 0 12px;
  font-family: var(--font-accent);
  font-size: 16px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-ink);
}

/* Sticky top bar uniquement sur la home (sur la carte, le bandeau est posé sans sticky) */
.home-page > .mobile-topbar {
  position: sticky;
  top: 0;
}

/* Sur desktop, /accueil ne devrait pas être atteignable, mais au cas où, on cache le scroll spécifique */
@media (min-width: 750px) {
  .home-page { display: none; }
}
```

- [ ] **Step 7.3: Build typecheck**

```bash
cd apps/explore-web && pnpm build
```

Expected: build OK. Si erreur sur signatures de composants enfants, lire et corriger l'usage en conséquence.

- [ ] **Step 7.4: Commit**

```bash
git add apps/explore-web/src/pages/HomePage.tsx apps/explore-web/src/pages/HomePage.css
git commit -m "feat(web): HomePage /accueil (rituel/événements/lieux/activité teaser)"
```

---

## Task 8: Page `/chat` (ChatPage)

**Files:**
- Create: `apps/explore-web/src/pages/ChatPage.tsx`
- Create: `apps/explore-web/src/pages/ChatPage.css`

- [ ] **Step 8.1: Lire `ChatPanel` pour confirmer ses props**

```bash
grep -n "interface.*Props\|export function ChatPanel" apps/explore-web/src/components/chat/ChatPanel.tsx
```

Expected: voir la signature. Si pas de props, on peut le rendre tel quel.

- [ ] **Step 8.2: Créer `ChatPage.tsx`**

Path: `apps/explore-web/src/pages/ChatPage.tsx`

```tsx
import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { MobileTopBar } from '../components/navigation/MobileTopBar'
import { BottomTabbar } from '../components/navigation/BottomTabbar'
import { ChatPanel } from '../components/chat/ChatPanel'
import './ChatPage.css'

export default function ChatPage() {
  const { user } = useAuth()

  useEffect(() => {
    document.title = 'Runes de Chêne — Chat'
  }, [])

  if (!user) return null

  return (
    <div className="chat-page">
      <MobileTopBar />
      <main className="chat-page-content">
        <ChatPanel />
      </main>
      <BottomTabbar />
    </div>
  )
}
```

- [ ] **Step 8.3: Créer `ChatPage.css`**

Path: `apps/explore-web/src/pages/ChatPage.css`

```css
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-parchment);
}

.chat-page-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  padding-bottom: 64px; /* espace pour BottomTabbar */
}

/* Forcer le ChatPanel en plein conteneur (override de son mode flottant) */
.chat-page-content .chat-panel {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 0;
  border: none;
  box-shadow: none;
}

/* Cacher le bouton toggle interne du ChatPanel sur cette page (toujours ouvert) */
.chat-page-content .chat-toggle-btn { display: none; }

/* Cette page ne doit pas s'afficher sur desktop */
@media (min-width: 750px) {
  .chat-page { display: none; }
}
```

**NB :** les classes `.chat-panel` et `.chat-toggle-btn` viennent du CSS de `ChatPanel.css`. Si elles diffèrent (lire `apps/explore-web/src/components/chat/ChatPanel.css` head), ajuster.

- [ ] **Step 8.4: Build typecheck**

```bash
cd apps/explore-web && pnpm build
```

Expected: build OK.

- [ ] **Step 8.5: Commit**

```bash
git add apps/explore-web/src/pages/ChatPage.tsx apps/explore-web/src/pages/ChatPage.css
git commit -m "feat(web): ChatPage /chat — wrapper plein écran de ChatPanel sur mobile"
```

---

## Task 9: Page `/activite` (ActivityPage)

**Files:**
- Create: `apps/explore-web/src/pages/ActivityPage.tsx`
- Create: `apps/explore-web/src/pages/ActivityPage.css`

- [ ] **Step 9.1: Créer `ActivityPage.tsx`**

Path: `apps/explore-web/src/pages/ActivityPage.tsx`

```tsx
import { useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { MobileTopBar } from '../components/navigation/MobileTopBar'
import { BottomTabbar } from '../components/navigation/BottomTabbar'
import { ActivityFeed } from '../components/home/ActivityFeed'
import './ActivityPage.css'

export default function ActivityPage() {
  const { user } = useAuth()

  useEffect(() => {
    document.title = 'Runes de Chêne — Activité'
  }, [])

  if (!user) return null

  return (
    <div className="activity-page">
      <MobileTopBar />
      <main className="activity-page-scroll">
        <h1 className="activity-page-title">Activité de la carte</h1>
        <ActivityFeed limit={30} />
      </main>
      <BottomTabbar />
    </div>
  )
}
```

- [ ] **Step 9.2: Créer `ActivityPage.css`**

Path: `apps/explore-web/src/pages/ActivityPage.css`

```css
.activity-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--color-parchment);
}

.activity-page-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px 16px 80px;
}

.activity-page-title {
  margin: 0 0 16px;
  font-family: var(--font-accent);
  font-size: 18px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-ink);
}

@media (min-width: 750px) {
  .activity-page { display: none; }
}
```

- [ ] **Step 9.3: Build typecheck**

```bash
cd apps/explore-web && pnpm build
```

Expected: build OK.

- [ ] **Step 9.4: Commit**

```bash
git add apps/explore-web/src/pages/ActivityPage.tsx apps/explore-web/src/pages/ActivityPage.css
git commit -m "feat(web): ActivityPage /activite — page plein écran (30 derniers events)"
```

---

## Task 10: Routing & redirections platform-aware

**Files:**
- Modify: `apps/explore-web/src/App.tsx`

- [ ] **Step 10.1: Lire l'App.tsx actuel**

```bash
cat apps/explore-web/src/App.tsx
```

Noter les imports et la structure exacte (LandingPage, RequireAuth, MapPage).

- [ ] **Step 10.2: Modifier App.tsx pour ajouter les nouvelles routes et la redirection platform-aware**

Path: `apps/explore-web/src/App.tsx`

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { LandingPage } from './pages/LandingPage'  // path à confirmer
import { RequireAuth } from './components/auth/RequireAuth'  // path à confirmer
import MapPage from './pages/MapPage'
import { useIsDesktop } from './hooks/useMediaQuery'

const HomePage = lazy(() => import('./pages/HomePage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const ActivityPage = lazy(() => import('./pages/ActivityPage'))

/** Redirige vers /accueil sur mobile et /carte sur desktop. */
function RootRedirect() {
  const isDesktop = useIsDesktop()
  return <Navigate to={isDesktop ? '/carte' : '/accueil'} replace />
}

/** Sur desktop, les routes mobile-only redirigent vers /carte. */
function MobileOnly({ children }: { children: React.ReactNode }) {
  const isDesktop = useIsDesktop()
  if (isDesktop) return <Navigate to="/carte" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/post-login" element={<RootRedirect />} />
            <Route path="/carte" element={<MapPage />} />
            <Route path="/accueil" element={<MobileOnly><HomePage /></MobileOnly>} />
            <Route path="/chat" element={<MobileOnly><ChatPage /></MobileOnly>} />
            <Route path="/activite" element={<MobileOnly><ActivityPage /></MobileOnly>} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
```

**NB :** les imports `LandingPage` et `RequireAuth` sont à vérifier (Step 10.1) — adapter si named vs default export.

- [ ] **Step 10.3: Vérifier que la redirection post-login pointe vers `/post-login`**

```bash
grep -rn "navigate.*carte\|navigate.*accueil\|/post-login" apps/explore-web/src --include="*.tsx" --include="*.ts" | head
```

Si la connexion redirige aujourd'hui vers `/carte` en dur (par ex. dans un `useAuth` callback ou `RequireAuth`), modifier pour qu'elle redirige vers `/post-login` à la place. Le composant `RootRedirect` dispatchera ensuite vers `/accueil` ou `/carte` selon la plateforme.

- [ ] **Step 10.4: Build typecheck**

```bash
cd apps/explore-web && pnpm build
```

Expected: build OK.

- [ ] **Step 10.5: Commit**

```bash
git add apps/explore-web/src/App.tsx
# Ajouter aussi tout autre fichier modifié pour la redirection post-login
git commit -m "feat(web): routes /accueil /chat /activite + RootRedirect platform-aware

- /post-login redirige vers /accueil (mobile) ou /carte (desktop)
- MobileOnly wrapper pour les pages mobile-only (redirige /carte si desktop)
- Lazy loading des pages mobile pour ne pas alourdir le bundle desktop"
```

---

## Task 11: Adapter `MapPage` mobile (header partagé + dégradé + retraits)

**Files:**
- Modify: `apps/explore-web/src/pages/MapPage.tsx`
- Modify: probablement `apps/explore-web/src/pages/MapPage.css` (à créer/adapter pour le retrait du bouton boutique flottant)

- [ ] **Step 11.1: Lire le code actuel de MapPage et identifier les zones mobile**

```bash
grep -n "ChatPanel\|VISITER LA BOUTIQUE\|mobile-header\|MobileHeader\|BottomTabbar\|isDesktop\|isMobile" apps/explore-web/src/pages/MapPage.tsx
```

Noter les lignes où :
- `ChatPanel` est monté (`!addPlaceMode && !authLoading && isAuthenticated && <ChatPanel />` selon ce qu'on a vu)
- L'éventuel ancien header mobile / bouton "VISITER LA BOUTIQUE" est présent

- [ ] **Step 11.2: Importer `useIsDesktop` et les composants partagés en haut de MapPage.tsx**

```tsx
import { useIsDesktop } from '../hooks/useMediaQuery'
import { MobileTopBar } from '../components/navigation/MobileTopBar'
import { MobileStatsBar } from '../components/navigation/MobileStatsBar'
import { BottomTabbar } from '../components/navigation/BottomTabbar'
```

- [ ] **Step 11.3: Dans le rendu de MapPage, monter le header partagé en haut sur mobile**

Au début du conteneur racine de MapPage (juste après l'ouverture du `<div className="map-page">` ou équivalent), insérer :

```tsx
{!isDesktop && (
  <>
    <MobileTopBar fadeOutBottom onFactionModal={() => setShowFactionModal(true)} />
    <MobileStatsBar fadeOutBottom />
  </>
)}
```

Ajouter `const isDesktop = useIsDesktop()` dans le corps du composant en haut.

**NB :** si MapPage utilise déjà `setShowFactionModal` ailleurs, réutiliser l'état existant. Sinon créer le state local.

- [ ] **Step 11.4: Conditionner le mount du `ChatPanel` flottant pour qu'il n'apparaisse que sur desktop**

Trouver la ligne `{!addPlaceMode && !authLoading && isAuthenticated && <ChatPanel />}` et la remplacer par :

```tsx
{!addPlaceMode && !authLoading && isAuthenticated && isDesktop && <ChatPanel />}
```

Sur mobile, le chat est dans `/chat`. Sur desktop, le panel flottant existant reste.

- [ ] **Step 11.5: Retirer l'ancien bouton flottant "VISITER LA BOUTIQUE OFFICIELLE" sur mobile**

Identifier l'élément (probablement dans le HUD de MapPage ou dans un composant `MobileHeader` legacy). Si présent en JSX, le wrapper dans `{isDesktop && (...)}` ou le supprimer si déjà non-utilisé sur desktop.

```bash
grep -rn "VISITER LA BOUTIQUE\|Visiter la Boutique\|visiter-boutique" apps/explore-web/src --include="*.tsx" --include="*.ts" --include="*.css"
```

Pour chaque résultat, soit le retirer (si redondant avec `MobileTopBar`), soit le wrapper en `{isDesktop && ...}`. Écrire le diff exact dans le commit message.

- [ ] **Step 11.6: Monter `BottomTabbar` sur mobile dans MapPage**

À la fin du conteneur racine de MapPage, juste avant la fermeture `</div>`, ajouter :

```tsx
{!isDesktop && <BottomTabbar />}
```

Pour que la navbar soit accessible depuis `/carte` aussi.

- [ ] **Step 11.7: Adapter le CSS de MapPage pour laisser de la place au header partagé sur mobile**

Si le HUD existant de la carte a un `position: absolute; top: 0`, il va se superposer au `MobileTopBar`. Identifier les conflits :

```bash
grep -n "position.*absolute\|top:.*0\|top:.*px" apps/explore-web/src/pages/MapPage.css apps/explore-web/src/components/map/**/*.css 2>/dev/null | head -20
```

Si conflit, ajouter du `padding-top` à la zone carte mobile, ou pousser les éléments HUD vers le bas, **uniquement sur mobile** (media query `@media (max-width: 749px)`).

**NB :** cette étape peut être longue selon la complexité du HUD existant. Si trop, faire un commit intermédiaire et continuer dans un commit suivant.

- [ ] **Step 11.8: Build typecheck**

```bash
cd apps/explore-web && pnpm build
```

Expected: build OK.

- [ ] **Step 11.9: Commit**

```bash
git add apps/explore-web/src/pages/MapPage.tsx apps/explore-web/src/pages/MapPage.css
# + tous autres fichiers touchés au step 11.5/11.7
git commit -m "feat(web): MapPage mobile — header partagé + BottomTabbar, retire ChatPanel flottant et ancien bouton Boutique

- MobileTopBar + MobileStatsBar montés en haut (avec fadeOutBottom pour fondre vers la carte)
- BottomTabbar montée en bas
- ChatPanel flottant conditionné isDesktop (mobile passe par /chat)
- Ancien bouton 'Visiter la Boutique' retiré du HUD mobile (icône 🏪 dans MobileTopBar)
- Ajustements CSS HUD mobile pour laisser place au bandeau supérieur"
```

---

## Task 12: Validation manuelle (mobile + desktop)

**Files:**
- Aucun (validation seulement)

- [ ] **Step 12.1: Lancer le dev server**

```bash
cd apps/explore-web && pnpm dev
```

Expected: server actif sur http://localhost:3000.

- [ ] **Step 12.2: Tester en mobile (Chrome DevTools en mode responsive 375px ou téléphone réel)**

Ouvrir `http://localhost:3000` en mode responsive, faire les tests suivants et noter chaque résultat :

| # | Test | Attendu |
|---|---|---|
| 1 | Login → arrive sur `/accueil` | OK / KO + observation |
| 2 | Sur `/accueil` : voir Topbar + StatsBar + 4 sections + BottomTabbar | OK / KO |
| 3 | Énigme du jour cliquable, ouvre la modale | OK / KO |
| 4 | Carrousel Lieux récents scrollable horizontalement | OK / KO |
| 5 | Teaser Activité affiche 3 lignes + "Voir tout →" | OK / KO |
| 6 | Clic "Voir tout →" → atterrit sur `/activite` | OK / KO |
| 7 | `/activite` affiche ~30 events + Topbar + BottomTabbar | OK / KO |
| 8 | Clic onglet Chat → atterrit sur `/chat` plein écran | OK / KO |
| 9 | `/chat` affiche les 3 canaux fonctionnels (général/faction/bugs), envoi message OK | OK / KO |
| 10 | Clic onglet Carte → atterrit sur `/carte`, header partagé visible avec dégradé | OK / KO |
| 11 | `/carte` mobile : pas de panel chat flottant, pas d'ancien bouton "VISITER LA BOUTIQUE" | OK / KO |
| 12 | Bouton + central → ouvre PlusMenu (créer expé/lieu) | OK / KO |
| 13 | Icône 🏪 dans la topbar → ouvre Shopify dans nouvel onglet | OK / KO |
| 14 | Avatar (ProfileMenu) → ouvre menu profil | OK / KO |

Si un test échoue, créer un mini-commit "fix(web): ..." avant le push final.

- [ ] **Step 12.3: Tester en desktop (≥ 750px)**

Ouvrir `http://localhost:3000` plein écran, faire les tests suivants :

| # | Test | Attendu |
|---|---|---|
| 1 | Login → arrive sur `/carte` (pas `/accueil`) | OK / KO |
| 2 | `/carte` : carte MapLibre comme avant, pas de Topbar mobile, pas de BottomTabbar | OK / KO |
| 3 | `ChatPanel` flottant toujours présent sur la carte desktop | OK / KO |
| 4 | Aucune régression visuelle sur le HUD desktop (toolbar, panneaux, modales) | OK / KO |
| 5 | Tape `/accueil` dans l'URL → redirige vers `/carte` | OK / KO |
| 6 | Tape `/chat` dans l'URL → redirige vers `/carte` | OK / KO |
| 7 | Tape `/activite` dans l'URL → redirige vers `/carte` | OK / KO |

- [ ] **Step 12.4: Tester les régressions critiques**

| # | Test | Attendu |
|---|---|---|
| 1 | Soumettre une énigme du jour → +XP/Couronne crédité, toast affiché | OK / KO |
| 2 | Découvrir un lieu à distance → fragment crédité, +1 Couronne | OK / KO |
| 3 | Créer une expédition (PlusMenu) → enregistrée, apparaît dans QuestsBoardPanel | OK / KO |
| 4 | Recevoir une notification push (si PWA installée) → ouvre la bonne route | OK / KO |
| 5 | Profil joueur clicable → modale s'ouvre avec stats correctes | OK / KO |

Si régression détectée, identifier la cause et fixer dans un commit dédié.

- [ ] **Step 12.5: Arrêter le dev server**

`Ctrl+C` dans le terminal `pnpm dev`.

---

## Task 13: Bump version + push final

**Files:**
- Modify: `apps/explore-web/src/version.ts` (ou équivalent)

- [ ] **Step 13.1: Localiser le fichier version**

```bash
find apps/explore-web/src -name "version.ts" -o -name "version.tsx" 2>&1 | head
```

- [ ] **Step 13.2: Bumper la version (V0.7.7 → V0.7.8)**

Ouvrir le fichier et incrémenter la patch (ou minor selon l'ampleur — discuter avec Uriel si gros changement). Exemple :

```tsx
export const APP_VERSION = 'V0.7.8'
export const APP_VERSION_DATE = '2026-05-09'
```

- [ ] **Step 13.3: Commit du bump**

```bash
git add apps/explore-web/src/version.ts
git commit -m "chore(web): bump version V0.7.8 — home mobile hub"
```

- [ ] **Step 13.4: Récap des commits sur la branche**

```bash
git log main..home-mobile-hub --oneline
```

Vérifier qu'on a une histoire propre (pas de WIP ou commits foireux).

- [ ] **Step 13.5: Push de la branche sur origin**

```bash
git push -u origin home-mobile-hub
```

Expected: la branche est sur origin, accessible pour Uriel.

- [ ] **Step 13.6: Inviter Uriel à merger sur main**

Demander : "Branche home-mobile-hub poussée. Tu veux qu'on merge sur main et qu'on déploie sur Netlify (production), ou tu veux d'abord tester encore en local ? Si déploiement : `cd apps/explore-web && netlify deploy --prod --dir \"$PWD/dist\" --no-build` après un `pnpm build`."

---

## Self-review checklist (pour le rédacteur du plan)

**Spec coverage** — chaque section de la spec a-t-elle au moins une tâche correspondante ?

| Spec § | Couvert par |
|---|---|
| 2. Périmètre — `/accueil`, `/chat`, `/activite` | Tasks 7, 8, 9 |
| 2. Périmètre — `MobileTopBar`/`MobileStatsBar` partagés | Tasks 4, 5 |
| 2. Périmètre — Navbar 5 cellules | Task 6 |
| 2. Périmètre — Atterrissage login mobile/desktop | Task 10 |
| 2. Périmètre — Cleanup MainShell desktop | implicite (nouvelle branche from main, MainShell jamais importé) |
| 3.1 Routes & redirections | Task 10 |
| 3.2 Composants partagés | Tasks 4, 5 |
| 3.2 Dégradé sur `/carte` mobile | Tasks 4, 5 (`fadeOutBottom`) + Task 11 |
| 3.3 Ordre du scroll `/accueil` | Task 7 |
| 3.4 Page `/chat` | Task 8 |
| 3.5 Page `/activite` | Task 9 |
| 3.6 Navbar mobile | Task 6 |
| 4. Backend (mig 140 déjà déployée) | Aucune nouvelle mig requise — noté en intro |
| 5. Composants à créer/adapter/supprimer | Tasks 2-11 |
| 7. Critères de succès | Task 12 (validation manuelle) |

**Placeholder scan** — pas de "TBD", "TODO", "implement later". Les "à confirmer" pointent vers des lectures de fichiers spécifiques (`grep` ou `cat` donnés).

**Type consistency** — `MobileTopBar`, `MobileStatsBar`, `BottomTabbar`, `useIsDesktop` utilisés de manière cohérente entre tasks.

---

## Notes pour l'exécutant

1. **Commit fréquent** (cf. préférence Uriel) — chaque Task = 1 commit minimum, plusieurs si la Task contient des sous-étapes logiques distinctes.
2. **Push par lots cohérents** — pas de push à chaque commit, le push est groupé en Task 13.
3. **Si une étape révèle un fait imprévu** (signature de composant différente, route legacy, etc.), arrêter et demander à Uriel plutôt que de deviner.
4. **Si le HUD mobile de MapPage cause trop de conflits visuels avec le bandeau partagé** (Task 11.7), faire un commit intermédiaire avec ce qui marche et ouvrir une discussion.
5. **Ne pas merger sur main sans validation manuelle** (Task 12) ET accord d'Uriel.
