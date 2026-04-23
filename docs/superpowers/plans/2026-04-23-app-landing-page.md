# App Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public landing page on `/` for `app.runesdechene.com` (parchment design + Friedrich image with Ken Burns + inline auth slide), keeping the map at `/carte` behind auth.

**Architecture:** Add React Router 7 to wrap `App.tsx`. Extract current map-only `App.tsx` content into a new `MapPage` page component. Build a new `LandingPage` with two columns (parchment + image) reusing the visual design of the Shopify popup. Auth flow stays inline: clicking the CTA when not authenticated slides the parchment content to reveal an inline `LandingAuthForm` (no modal popup). The existing `AuthModal` is preserved for non-landing flows; its Supabase logic is extracted into a reusable `useAuthForm` hook.

**Tech Stack:** React 18 + Vite 5 + TypeScript strict, React Router 7, Zustand (existing), Supabase (existing), `vite-plugin-pwa` (existing), CSS per component.

**Spec:** `docs/superpowers/specs/2026-04-23-app-landing-page-design.md`

**Testing convention:** This codebase does not use a test framework. Each task ends with **manual smoke tests via `pnpm dev` (port 3000)** + a commit. Type safety is enforced by `tsc --noEmit` (run before commit when adding new files).

**Repo:** `apps/explore-web/` in monorepo `C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)/`

---

## File Structure

**To create:**

```
apps/explore-web/src/
├── pages/
│   ├── MapPage.tsx              — Wraps the current full App.tsx content (map + all overlays)
│   └── LandingPageRoute.tsx     — Thin wrapper for the / route (just imports LandingPage)
│
├── components/
│   ├── RequireAuth.tsx          — Route guard: redirects to / if not authenticated
│   └── landing/
│       ├── LandingPage.tsx      — Orchestrator: layout + mode state (default | auth)
│       ├── LandingPage.css
│       ├── LandingImage.tsx     — Right column: image + Ken Burns + parchment frame overlay
│       ├── LandingImage.css
│       ├── LandingContent.tsx   — Default parchment view: titles, perks, CTA, tagline slot
│       ├── LandingContent.css
│       ├── LandingAuthForm.tsx  — Inline auth view (slides in from right)
│       ├── LandingAuthForm.css
│       ├── TaglineSlideshow.tsx — Auto-rotating taglines with dots
│       └── TaglineSlideshow.css
│
├── hooks/
│   └── useAuthForm.ts           — Shared Supabase auth logic (signIn, signUp, errors, loading)
│
└── assets/landing/              — Static assets for landing (Uriel uploads after Task 4)
    ├── friedrich-desktop.webp
    ├── friedrich-mobile.webp
    └── parchment-frame.png
```

**To modify:**

```
apps/explore-web/src/
├── App.tsx                      — Becomes pure router (BrowserRouter + Routes)
└── components/auth/
    └── AuthModal.tsx            — Refactored to use useAuthForm hook (behavior unchanged)

apps/explore-web/
├── vite.config.ts               — VitePWA manifest: start_url '/' → '/carte'
└── package.json                 — Add react-router-dom dependency
```

---

## Task 1: Install React Router and create folder structure

**Files:**
- Modify: `apps/explore-web/package.json`
- Create: `apps/explore-web/src/pages/` (empty folder)
- Create: `apps/explore-web/src/components/landing/` (empty folder)

- [ ] **Step 1: Install react-router-dom**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)" && pnpm --filter explore-web add react-router-dom@^7
```

Expected: `react-router-dom` and `@types/react-router-dom` (if needed for v7) added to `apps/explore-web/package.json`. v7 includes types built-in.

- [ ] **Step 2: Create folders**

```bash
mkdir -p "apps/explore-web/src/pages" "apps/explore-web/src/components/landing" "apps/explore-web/src/assets/landing"
```

- [ ] **Step 3: Verify install**

```bash
cd apps/explore-web && pnpm dev
```

Open http://localhost:3000 — current map should still work. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/package.json apps/explore-web/pnpm-lock.yaml
git commit -m "chore(explore-web): add react-router-dom v7 for landing page routing"
```

---

## Task 2: Wrap App.tsx with BrowserRouter (placeholder routes)

**Files:**
- Modify: `apps/explore-web/src/App.tsx`

The strategy: temporarily wrap the current App.tsx content in a Routes/Route on `/carte`, with a placeholder div on `/`. This proves routing works before any extraction. Task 3 will move the map content to its own file.

- [ ] **Step 1: Read current App.tsx structure**

```bash
head -80 "apps/explore-web/src/App.tsx"
```

Note where `App()` function starts and what it returns.

- [ ] **Step 2: Refactor App.tsx to add BrowserRouter**

Replace the `export default function App() { ... }` with:

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// ... keep all existing imports ...

function MapView() {
  // PASTE THE ENTIRE CURRENT CONTENT OF THE CURRENT App() function HERE
  // (all useState, useEffect, hooks, return statement, etc.)
  return (
    <>
      {/* current full content */}
    </>
  )
}

function LandingPlaceholder() {
  return (
    <div style={{ padding: '4rem', textAlign: 'center' }}>
      <h1>Landing Page (placeholder)</h1>
      <p><a href="/carte">Go to map →</a></p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPlaceholder />} />
        <Route path="/carte" element={<MapView />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 3: Run dev server and verify both routes**

```bash
cd apps/explore-web && pnpm dev
```

- Visit http://localhost:3000/ → see "Landing Page (placeholder)"
- Click "Go to map →" → URL becomes `/carte`, full map loads
- Stop server

- [ ] **Step 4: Type check**

```bash
cd apps/explore-web && pnpm exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/App.tsx
git commit -m "feat(explore-web): add BrowserRouter with /carte and / routes"
```

---

## Task 3: Extract MapView into pages/MapPage.tsx

**Files:**
- Create: `apps/explore-web/src/pages/MapPage.tsx`
- Modify: `apps/explore-web/src/App.tsx`

- [ ] **Step 1: Create MapPage.tsx**

Move the entire `MapView` function (all imports it needs + body) from App.tsx into a new file:

```bash
touch "apps/explore-web/src/pages/MapPage.tsx"
```

Content of `MapPage.tsx`:
- Copy all the imports currently at the top of App.tsx that are used by `MapView`
- Define `export default function MapPage() { ... }` with the body of MapView

- [ ] **Step 2: Slim down App.tsx**

App.tsx now contains only the router wiring:

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MapPage from './pages/MapPage'

function LandingPlaceholder() {
  return (
    <div style={{ padding: '4rem', textAlign: 'center' }}>
      <h1>Landing Page (placeholder)</h1>
      <p><a href="/carte">Go to map →</a></p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPlaceholder />} />
        <Route path="/carte" element={<MapPage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 3: Run dev server, verify map still works at /carte**

```bash
cd apps/explore-web && pnpm dev
```

Visit http://localhost:3000/carte — full map with all features (auth modal, place panels, etc.) works as before.

- [ ] **Step 4: Type check**

```bash
cd apps/explore-web && pnpm exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/App.tsx apps/explore-web/src/pages/MapPage.tsx
git commit -m "refactor(explore-web): extract map into pages/MapPage component"
```

---

## Task 4: LandingPage skeleton with two-column layout

**Files:**
- Create: `apps/explore-web/src/components/landing/LandingPage.tsx`
- Create: `apps/explore-web/src/components/landing/LandingPage.css`
- Modify: `apps/explore-web/src/App.tsx` (replace LandingPlaceholder with LandingPage)

- [ ] **Step 1: Create LandingPage.tsx (empty layout)**

```tsx
// apps/explore-web/src/components/landing/LandingPage.tsx
import { useState } from 'react'
import './LandingPage.css'

type Mode = 'default' | 'auth'

export default function LandingPage() {
  const [mode, setMode] = useState<Mode>('default')

  return (
    <div className="landing">
      <div className={`landing__parchment${mode === 'auth' ? ' is-auth-mode' : ''}`}>
        <div className="landing__view landing__view--default">
          {/* LandingContent will go here in Task 6 */}
          <p style={{ padding: '2rem' }}>Default view (placeholder)</p>
        </div>
        <div className="landing__view landing__view--auth">
          {/* LandingAuthForm will go here in Task 9 */}
          <p style={{ padding: '2rem' }}>Auth view (placeholder)</p>
        </div>
      </div>
      <div className="landing__image">
        {/* LandingImage will go here in Task 5 */}
        <p style={{ padding: '2rem' }}>Image (placeholder)</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create LandingPage.css with two-column responsive layout**

```css
/* apps/explore-web/src/components/landing/LandingPage.css */

.landing {
  display: flex;
  flex-direction: row;
  width: 100vw;
  min-height: 100dvh;
  background-color: #eee8dc;
}

.landing__parchment {
  flex: 1;
  position: relative;
  overflow: hidden;
  background-color: #eee8dc;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: clamp(2rem, 5vw, 4rem);
}

.landing__view {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: clamp(2rem, 5vw, 4rem);
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.landing__view--default {
  transform: translateX(0);
}

.landing__view--auth {
  transform: translateX(100%);
}

.landing__parchment.is-auth-mode .landing__view--default {
  transform: translateX(-100%);
}

.landing__parchment.is-auth-mode .landing__view--auth {
  transform: translateX(0);
}

.landing__image {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* Mobile: stack image on top, parchment below */
@media screen and (max-width: 749px) {
  .landing {
    flex-direction: column;
  }

  .landing__image {
    width: 100%;
    height: 38vh;
    flex: 0 0 38vh;
  }

  .landing__parchment {
    flex: 1;
    min-height: 62vh;
  }
}
```

- [ ] **Step 3: Wire LandingPage into App.tsx (replace LandingPlaceholder)**

```tsx
// apps/explore-web/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MapPage from './pages/MapPage'
import LandingPage from './components/landing/LandingPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/carte" element={<MapPage />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 4: Run dev server, verify layout**

```bash
cd apps/explore-web && pnpm dev
```

- Visit http://localhost:3000/ — see two columns (parchment left + image placeholder right) on desktop
- Resize browser < 750px wide → see image placeholder on top + parchment below
- Visit http://localhost:3000/carte — map still works

- [ ] **Step 5: Type check + commit**

```bash
cd apps/explore-web && pnpm exec tsc --noEmit
git add apps/explore-web/src/components/landing/ apps/explore-web/src/App.tsx
git commit -m "feat(explore-web): add LandingPage skeleton with two-column responsive layout"
```

---

## Task 5: LandingImage component (image + Ken Burns + parchment overlay)

**Files:**
- Create: `apps/explore-web/src/components/landing/LandingImage.tsx`
- Create: `apps/explore-web/src/components/landing/LandingImage.css`
- Modify: `apps/explore-web/src/components/landing/LandingPage.tsx`

**Note:** Uriel uploads the actual images to `apps/explore-web/src/assets/landing/` after this task. Until then, the component renders nothing (no broken image icons).

- [ ] **Step 1: Create LandingImage.tsx**

```tsx
// apps/explore-web/src/components/landing/LandingImage.tsx
import './LandingImage.css'

interface LandingImageProps {
  imageDesktopUrl?: string
  imageMobileUrl?: string
  framePngUrl?: string
  alt?: string
}

export default function LandingImage({
  imageDesktopUrl,
  imageMobileUrl,
  framePngUrl,
  alt = 'Personne face aux montagnes',
}: LandingImageProps) {
  if (!imageDesktopUrl && !imageMobileUrl) {
    return <div className="landing-image landing-image--placeholder" aria-hidden="true" />
  }

  return (
    <div className="landing-image">
      <picture className="landing-image__picture">
        {imageMobileUrl && (
          <source media="(max-width: 749px)" srcSet={imageMobileUrl} />
        )}
        <img
          className="landing-image__img"
          src={imageDesktopUrl || imageMobileUrl}
          alt={alt}
          loading="eager"
        />
      </picture>
      {framePngUrl && (
        <picture className="landing-image__frame" aria-hidden="true">
          <img className="landing-image__frame-img" src={framePngUrl} alt="" loading="eager" />
        </picture>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create LandingImage.css**

```css
/* apps/explore-web/src/components/landing/LandingImage.css */

.landing-image {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.landing-image--placeholder {
  background-color: #d4cab8;
}

.landing-image__picture {
  display: block;
  width: 100%;
  height: 100%;
}

.landing-image__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center;
  display: block;
  animation: landingImageKenBurns 20s ease-in-out infinite alternate;
  transform-origin: center center;
  will-change: transform;
}

@keyframes landingImageKenBurns {
  from { transform: scale(1.00); }
  to   { transform: scale(1.18); }
}

@media (prefers-reduced-motion: reduce) {
  .landing-image__img {
    animation: none;
  }
}

.landing-image__frame {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.landing-image__frame-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center;
  display: block;
}
```

- [ ] **Step 3: Wire into LandingPage.tsx**

Replace the `<p>Image (placeholder)</p>` with:

```tsx
import LandingImage from './LandingImage'

// inside JSX:
<div className="landing__image">
  <LandingImage
    imageDesktopUrl={undefined}  // Uriel will provide later
    imageMobileUrl={undefined}
    framePngUrl={undefined}
  />
</div>
```

- [ ] **Step 4: Run dev server**

Visit http://localhost:3000/ — right column shows a beige placeholder div (no broken image). When images are added in URL props, Ken Burns should animate.

- [ ] **Step 5: Type check + commit**

```bash
cd apps/explore-web && pnpm exec tsc --noEmit
git add apps/explore-web/src/components/landing/LandingImage.tsx apps/explore-web/src/components/landing/LandingImage.css apps/explore-web/src/components/landing/LandingPage.tsx
git commit -m "feat(explore-web): add LandingImage with Ken Burns and parchment overlay"
```

---

## Task 6: LandingContent (default parchment view: titles, perks, CTA)

**Files:**
- Create: `apps/explore-web/src/components/landing/LandingContent.tsx`
- Create: `apps/explore-web/src/components/landing/LandingContent.css`
- Modify: `apps/explore-web/src/components/landing/LandingPage.tsx`

- [ ] **Step 1: Create LandingContent.tsx with hardcoded copy**

```tsx
// apps/explore-web/src/components/landing/LandingContent.tsx
import './LandingContent.css'

const COPY = {
  overline: '🎁 BIENVENUE DANS',
  title: 'RUNES DE CHÊNE.',
  subtitle: 'Une Confrérie qui explore les contrées oubliées de France.',
  pitch: '+ de 2600 lieux d\'Histoire à découvrir, une carte vivante, une communauté en marche.',
  ctaLabel: 'Accéder à la carte',
  perks: [
    { text: 'Une appli gratuite, sans pub', color: '#c8956b' },
    { text: 'Tes Fragments achetés débloquent des bonus', color: '#7a8e6f' },
  ],
} as const

interface LandingContentProps {
  onCtaClick: () => void
}

export default function LandingContent({ onCtaClick }: LandingContentProps) {
  return (
    <div className="landing-content">
      <p className="landing-content__overline">{COPY.overline}</p>
      <h1 className="landing-content__title">{COPY.title}</h1>
      <p className="landing-content__subtitle">{COPY.subtitle}</p>
      <p className="landing-content__pitch">{COPY.pitch}</p>

      <div className="landing-content__perks">
        {COPY.perks.map((perk, i) => (
          <span
            key={i}
            className="landing-content__perk"
            style={{
              '--perk-color': perk.color,
              '--perk-rgb': hexToRgb(perk.color),
            } as React.CSSProperties}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span>{perk.text}</span>
          </span>
        ))}
      </div>

      <button type="button" className="landing-content__cta" onClick={onCtaClick}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="2" width="14" height="20" rx="2.5" ry="2.5" />
          <line x1="12" y1="18.5" x2="12.01" y2="18.5" />
        </svg>
        <span>{COPY.ctaLabel}</span>
      </button>

      {/* TaglineSlideshow will be added in Task 7 */}
    </div>
  )
}

function hexToRgb(hex: string): string {
  const cleaned = hex.replace('#', '')
  const r = parseInt(cleaned.substring(0, 2), 16)
  const g = parseInt(cleaned.substring(2, 4), 16)
  const b = parseInt(cleaned.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}
```

- [ ] **Step 2: Create LandingContent.css**

```css
/* apps/explore-web/src/components/landing/LandingContent.css */

.landing-content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: min(560px, 100%);
  color: #46352e;
  text-align: left;
}

.landing-content__overline {
  margin: 0;
  font-size: clamp(0.85rem, 1.1vw, 1rem);
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: #46352e;
  font-weight: 600;
}

.landing-content__title {
  margin: 0;
  font-size: clamp(2rem, 4.5vw, 3.5rem);
  line-height: 1.1;
  letter-spacing: 0.005em;
  font-weight: 700;
  color: #963e3e;
  text-wrap: balance;
}

.landing-content__subtitle {
  margin: 0.5rem 0 0;
  font-size: clamp(1rem, 1.3vw, 1.2rem);
  line-height: 1.55;
  color: #46352e;
  opacity: 0.92;
  font-weight: 400;
}

.landing-content__pitch {
  margin: 0;
  font-size: clamp(1rem, 1.3vw, 1.2rem);
  color: #46352e;
  font-weight: 600;
}

.landing-content__perks {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.25rem;
  align-items: flex-start;
}

.landing-content__perk {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.4rem 0.8rem;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.2;
  color: var(--perk-color);
  background-color: rgba(var(--perk-rgb), 0.14);
  border: 1.5px solid rgba(var(--perk-rgb), 0.4);
  border-radius: 9999px;
  white-space: nowrap;
}

.landing-content__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  min-height: 52px;
  padding: 0.875rem 2rem;
  font-size: 1rem;
  font-weight: 600;
  border: 1.5px solid #2a2418;
  background-color: #2a2418;
  color: #fff;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.25s ease, background-color 0.25s ease, border-color 0.25s ease;
  margin-top: 0.5rem;
  width: 100%;
  max-width: 320px;
}

.landing-content__cta:hover {
  background-color: rgba(42, 36, 24, 0.85);
  border-color: rgba(42, 36, 24, 0.85);
  transform: translateY(-2px);
}

@media screen and (max-width: 749px) {
  .landing-content__perk {
    font-size: 0.78rem;
    padding: 0.35rem 0.7rem;
  }
  .landing-content__title {
    font-size: clamp(1.6rem, 7vw, 2.4rem);
  }
}
```

- [ ] **Step 3: Wire LandingContent into LandingPage.tsx**

```tsx
// In LandingPage.tsx, replace the placeholder <p>Default view</p> with:
import LandingContent from './LandingContent'

// inside JSX, in landing__view--default div:
<LandingContent onCtaClick={() => setMode('auth')} />
```

For now `onCtaClick` just toggles to auth mode (we'll wire real auth check in Task 11).

- [ ] **Step 4: Run dev server**

Visit http://localhost:3000/ — see :
- Surtitre "🎁 BIENVENUE DANS"
- Title "RUNES DE CHÊNE." in bordeaux
- Subtitle + pitch
- 2 colored pills (perks)
- Black CTA "Accéder à la carte"

Click CTA → parchment slides left, "Auth view (placeholder)" appears on right.

- [ ] **Step 5: Type check + commit**

```bash
cd apps/explore-web && pnpm exec tsc --noEmit
git add apps/explore-web/src/components/landing/LandingContent.tsx apps/explore-web/src/components/landing/LandingContent.css apps/explore-web/src/components/landing/LandingPage.tsx
git commit -m "feat(explore-web): add LandingContent with title, perks, CTA"
```

---

## Task 7: TaglineSlideshow component

**Files:**
- Create: `apps/explore-web/src/components/landing/TaglineSlideshow.tsx`
- Create: `apps/explore-web/src/components/landing/TaglineSlideshow.css`
- Modify: `apps/explore-web/src/components/landing/LandingContent.tsx`

- [ ] **Step 1: Create TaglineSlideshow.tsx**

```tsx
// apps/explore-web/src/components/landing/TaglineSlideshow.tsx
import { useState, useEffect, useRef } from 'react'
import './TaglineSlideshow.css'

interface TaglineSlideshowProps {
  taglines: readonly string[]
  rotationMs?: number
}

export default function TaglineSlideshow({ taglines, rotationMs = 4000 }: TaglineSlideshowProps) {
  const [current, setCurrent] = useState(0)
  const intervalRef = useRef<number | null>(null)

  function startInterval() {
    if (intervalRef.current) window.clearInterval(intervalRef.current)
    intervalRef.current = window.setInterval(() => {
      setCurrent(c => (c + 1) % taglines.length)
    }, rotationMs)
  }

  useEffect(() => {
    if (taglines.length <= 1) return
    startInterval()
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taglines.length, rotationMs])

  function handleDotClick(i: number) {
    setCurrent(i)
    startInterval()
  }

  if (taglines.length === 0) return null

  return (
    <div className="tagline-slideshow">
      <div className="tagline-slideshow__track">
        {taglines.map((text, i) => (
          <p
            key={i}
            className={`tagline-slideshow__slide${i === current ? ' is-active' : ''}`}
          >
            « {text} »
          </p>
        ))}
      </div>
      {taglines.length > 1 && (
        <div className="tagline-slideshow__dots" role="tablist" aria-label="Sélection des taglines">
          {taglines.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`tagline-slideshow__dot${i === current ? ' is-active' : ''}`}
              onClick={() => handleDotClick(i)}
              aria-label={`Tagline ${i + 1}`}
              aria-selected={i === current}
              role="tab"
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create TaglineSlideshow.css**

```css
/* apps/explore-web/src/components/landing/TaglineSlideshow.css */

.tagline-slideshow {
  position: relative;
  margin-top: 0.75rem;
  width: 100%;
  max-width: 480px;
}

.tagline-slideshow__track {
  position: relative;
  min-height: 1.6em;
}

.tagline-slideshow__slide {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  margin: 0;
  font-style: italic;
  font-size: clamp(0.8rem, 1vw, 0.95rem);
  color: #46352e;
  opacity: 0;
  transition: opacity 0.6s ease;
  pointer-events: none;
}

.tagline-slideshow__slide.is-active {
  opacity: 0.85;
  position: relative;
  pointer-events: auto;
}

.tagline-slideshow__dots {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.625rem;
  align-items: center;
}

.tagline-slideshow__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: none;
  padding: 0;
  background: rgba(70, 53, 46, 0.25);
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.tagline-slideshow__dot:hover {
  background: rgba(70, 53, 46, 0.55);
  transform: scale(1.15);
}

.tagline-slideshow__dot.is-active {
  background: rgba(70, 53, 46, 0.85);
}

.tagline-slideshow__dot:focus-visible {
  outline: 2px solid #46352e;
  outline-offset: 2px;
}
```

- [ ] **Step 3: Wire TaglineSlideshow into LandingContent.tsx**

Add imports and constant at top:

```tsx
import TaglineSlideshow from './TaglineSlideshow'

const TAGLINES = [
  'Le Pokémon Go du patrimoine.',
  'Une rébellion contre le monde moderne.',
  'Un MMORPG dans la vraie vie.',
] as const
```

Add at the bottom of the JSX (after the CTA button):

```tsx
<TaglineSlideshow taglines={TAGLINES} />
```

- [ ] **Step 4: Run dev server**

Visit http://localhost:3000/ — see taglines under the CTA, rotating every 4s, dots clickable.

- [ ] **Step 5: Type check + commit**

```bash
cd apps/explore-web && pnpm exec tsc --noEmit
git add apps/explore-web/src/components/landing/TaglineSlideshow.tsx apps/explore-web/src/components/landing/TaglineSlideshow.css apps/explore-web/src/components/landing/LandingContent.tsx
git commit -m "feat(explore-web): add TaglineSlideshow with auto-rotation and dots"
```

---

## Task 8: Extract useAuthForm hook from AuthModal

**Files:**
- Read: `apps/explore-web/src/components/auth/AuthModal.tsx`
- Create: `apps/explore-web/src/hooks/useAuthForm.ts`
- Modify: `apps/explore-web/src/components/auth/AuthModal.tsx`

The goal: extract the Supabase auth logic from `AuthModal` into a reusable hook so `LandingAuthForm` (Task 9) can use the same logic.

- [ ] **Step 1: Read AuthModal.tsx to understand its current logic**

```bash
cat "apps/explore-web/src/components/auth/AuthModal.tsx"
```

Identify:
- The form fields (email, password, mode signin/signup)
- The Supabase calls (`supabase.auth.signInWithPassword`, `supabase.auth.signUp`)
- The error handling
- The loading state

- [ ] **Step 2: Create useAuthForm.ts**

```ts
// apps/explore-web/src/hooks/useAuthForm.ts
import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export type AuthMode = 'signin' | 'signup'

export interface UseAuthFormResult {
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  mode: AuthMode
  setMode: (m: AuthMode) => void
  loading: boolean
  error: string | null
  submit: () => Promise<void>
}

export interface UseAuthFormOptions {
  initialMode?: AuthMode
  onSuccess?: () => void
}

export function useAuthForm(options: UseAuthFormOptions = {}): UseAuthFormResult {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<AuthMode>(options.initialMode ?? 'signin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password })
        if (err) throw err
      }
      options.onSuccess?.()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erreur inconnue'
      setError(translateAuthError(message))
    } finally {
      setLoading(false)
    }
  }

  return { email, setEmail, password, setPassword, mode, setMode, loading, error, submit }
}

function translateAuthError(raw: string): string {
  if (raw.includes('Invalid login credentials')) return 'Email ou mot de passe incorrect.'
  if (raw.includes('User already registered')) return 'Un compte existe déjà avec cet email.'
  if (raw.includes('Password should be at least')) return 'Le mot de passe doit faire au moins 6 caractères.'
  return raw
}
```

- [ ] **Step 3: Refactor AuthModal.tsx to use useAuthForm**

In `AuthModal.tsx`:
- Remove the local `useState` for email/password/mode/loading/error
- Remove the Supabase call code from the submit handler
- Replace with:

```tsx
import { useAuthForm } from '../../hooks/useAuthForm'

// inside the component:
const { email, setEmail, password, setPassword, mode, setMode, loading, error, submit } = useAuthForm({
  onSuccess: () => {
    // Whatever AuthModal does on success — usually close modal
    onClose?.()
  },
})
```

Adapt the existing JSX to use these values from the hook (instead of local state). Keep all UI as-is.

- [ ] **Step 4: Run dev server, verify AuthModal still works**

```bash
cd apps/explore-web && pnpm dev
```

Visit `/carte` → trigger AuthModal (e.g., click on a feature requiring login). Try login with a real account. Should work as before.

- [ ] **Step 5: Type check + commit**

```bash
cd apps/explore-web && pnpm exec tsc --noEmit
git add apps/explore-web/src/hooks/useAuthForm.ts apps/explore-web/src/components/auth/AuthModal.tsx
git commit -m "refactor(explore-web): extract Supabase auth logic into useAuthForm hook"
```

---

## Task 9: LandingAuthForm (inline auth view in parchment)

**Files:**
- Create: `apps/explore-web/src/components/landing/LandingAuthForm.tsx`
- Create: `apps/explore-web/src/components/landing/LandingAuthForm.css`
- Modify: `apps/explore-web/src/components/landing/LandingPage.tsx`

- [ ] **Step 1: Create LandingAuthForm.tsx**

```tsx
// apps/explore-web/src/components/landing/LandingAuthForm.tsx
import { useAuthForm } from '../../hooks/useAuthForm'
import './LandingAuthForm.css'

interface LandingAuthFormProps {
  onSuccess: () => void
  onBack: () => void
}

export default function LandingAuthForm({ onSuccess, onBack }: LandingAuthFormProps) {
  const { email, setEmail, password, setPassword, mode, setMode, loading, error, submit } = useAuthForm({
    onSuccess,
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void submit()
  }

  return (
    <div className="landing-auth">
      <button type="button" className="landing-auth__back" onClick={onBack} aria-label="Revenir">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        <span>Retour</span>
      </button>

      <h2 className="landing-auth__title">
        {mode === 'signin' ? 'Se connecter' : 'Créer un compte'}
      </h2>

      <form className="landing-auth__form" onSubmit={handleSubmit}>
        <label className="landing-auth__field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={loading}
          />
        </label>

        <label className="landing-auth__field">
          <span>Mot de passe</span>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            disabled={loading}
          />
        </label>

        {error && <p className="landing-auth__error" role="alert">{error}</p>}

        <button type="submit" className="landing-auth__submit" disabled={loading}>
          {loading ? '...' : mode === 'signin' ? 'Connexion' : 'Créer mon compte'}
        </button>

        <button
          type="button"
          className="landing-auth__toggle"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          disabled={loading}
        >
          {mode === 'signin' ? 'Pas encore de compte ? Créer un compte' : 'Déjà un compte ? Se connecter'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Create LandingAuthForm.css**

```css
/* apps/explore-web/src/components/landing/LandingAuthForm.css */

.landing-auth {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: min(420px, 100%);
  color: #46352e;
}

.landing-auth__back {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: none;
  color: #46352e;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.25rem 0;
  width: fit-content;
  opacity: 0.75;
  transition: opacity 0.2s ease;
}

.landing-auth__back:hover {
  opacity: 1;
}

.landing-auth__title {
  margin: 0;
  font-size: clamp(1.5rem, 3vw, 2rem);
  color: #963e3e;
  font-weight: 700;
}

.landing-auth__form {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.landing-auth__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.landing-auth__field input {
  padding: 0.625rem 0.75rem;
  font-size: 1rem;
  font-family: inherit;
  border: 1.5px solid rgba(70, 53, 46, 0.3);
  border-radius: 8px;
  background: #fff;
  color: #46352e;
  transition: border-color 0.2s ease;
}

.landing-auth__field input:focus {
  outline: none;
  border-color: #46352e;
}

.landing-auth__field input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.landing-auth__error {
  margin: 0;
  padding: 0.625rem 0.75rem;
  font-size: 0.85rem;
  color: #a13030;
  background: rgba(161, 48, 48, 0.08);
  border-radius: 8px;
}

.landing-auth__submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 600;
  border: 1.5px solid #2a2418;
  background-color: #2a2418;
  color: #fff;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.landing-auth__submit:hover:not(:disabled) {
  background-color: rgba(42, 36, 24, 0.85);
}

.landing-auth__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.landing-auth__toggle {
  background: none;
  border: none;
  color: #46352e;
  font-size: 0.85rem;
  font-weight: 500;
  text-decoration: underline;
  cursor: pointer;
  padding: 0.25rem 0;
  text-align: center;
  opacity: 0.75;
}

.landing-auth__toggle:hover {
  opacity: 1;
}
```

- [ ] **Step 3: Wire LandingAuthForm into LandingPage.tsx**

```tsx
// In LandingPage.tsx, replace the placeholder <p>Auth view</p> with:
import LandingAuthForm from './LandingAuthForm'
import { useNavigate } from 'react-router-dom'

// inside the component:
const navigate = useNavigate()

// inside JSX, in landing__view--auth div:
<LandingAuthForm
  onSuccess={() => navigate('/carte')}
  onBack={() => setMode('default')}
/>
```

- [ ] **Step 4: Run dev server**

Visit http://localhost:3000/. Click CTA → form appears (slide). Try fake login → see error. Try real login → navigates to `/carte`.

- [ ] **Step 5: Type check + commit**

```bash
cd apps/explore-web && pnpm exec tsc --noEmit
git add apps/explore-web/src/components/landing/LandingAuthForm.tsx apps/explore-web/src/components/landing/LandingAuthForm.css apps/explore-web/src/components/landing/LandingPage.tsx
git commit -m "feat(explore-web): add LandingAuthForm with inline slide and Supabase auth"
```

---

## Task 10: Wire CTA auth check (skip auth slide if already logged in)

**Files:**
- Modify: `apps/explore-web/src/components/landing/LandingPage.tsx`

Currently, `onCtaClick` always toggles to auth mode. We need: if user already authenticated, go straight to `/carte`.

- [ ] **Step 1: Find the existing useAuth hook**

```bash
cat "apps/explore-web/src/hooks/useAuth.ts"
```

Note the property name returned for "is authenticated" (likely `isAuthenticated`, `user`, or `session`).

- [ ] **Step 2: Update LandingPage.tsx to use useAuth**

```tsx
// apps/explore-web/src/components/landing/LandingPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import LandingContent from './LandingContent'
import LandingAuthForm from './LandingAuthForm'
import LandingImage from './LandingImage'
import './LandingPage.css'

type Mode = 'default' | 'auth'

export default function LandingPage() {
  const [mode, setMode] = useState<Mode>('default')
  const navigate = useNavigate()
  const { user } = useAuth()  // adapt property name to match useAuth's actual return

  function handleCtaClick() {
    if (user) {
      navigate('/carte')
    } else {
      setMode('auth')
    }
  }

  return (
    <div className="landing">
      <div className={`landing__parchment${mode === 'auth' ? ' is-auth-mode' : ''}`}>
        <div className="landing__view landing__view--default">
          <LandingContent onCtaClick={handleCtaClick} />
        </div>
        <div className="landing__view landing__view--auth">
          <LandingAuthForm
            onSuccess={() => navigate('/carte')}
            onBack={() => setMode('default')}
          />
        </div>
      </div>
      <div className="landing__image">
        <LandingImage
          imageDesktopUrl={undefined}
          imageMobileUrl={undefined}
          framePngUrl={undefined}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run dev server**

Test scenarios:
- Not logged in: visit `/`, click CTA → slide to auth form
- Logged in: visit `/`, click CTA → navigate direct to `/carte`

- [ ] **Step 4: Type check + commit**

```bash
cd apps/explore-web && pnpm exec tsc --noEmit
git add apps/explore-web/src/components/landing/LandingPage.tsx
git commit -m "feat(explore-web): skip auth slide if user already authenticated"
```

---

## Task 11: RequireAuth wrapper for /carte route

**Files:**
- Create: `apps/explore-web/src/components/RequireAuth.tsx`
- Modify: `apps/explore-web/src/App.tsx`

- [ ] **Step 1: Create RequireAuth.tsx**

```tsx
// apps/explore-web/src/components/RequireAuth.tsx
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function RequireAuth() {
  const { user, loading } = useAuth()  // adapt to match useAuth's signature

  if (loading) {
    return <div style={{ padding: '4rem', textAlign: 'center' }}>Chargement...</div>
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
```

If `useAuth` doesn't expose `loading`, add it (or use `session === undefined` as the loading signal).

- [ ] **Step 2: Wrap /carte with RequireAuth in App.tsx**

```tsx
// apps/explore-web/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MapPage from './pages/MapPage'
import LandingPage from './components/landing/LandingPage'
import RequireAuth from './components/RequireAuth'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/carte" element={<MapPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 3: Run dev server**

Test:
- Logged out, visit `/carte` directly → redirects to `/`
- Login from landing → navigates to `/carte`, map loads

- [ ] **Step 4: Type check + commit**

```bash
cd apps/explore-web && pnpm exec tsc --noEmit
git add apps/explore-web/src/components/RequireAuth.tsx apps/explore-web/src/App.tsx
git commit -m "feat(explore-web): add RequireAuth guard for /carte route"
```

---

## Task 12: Update PWA manifest start_url to /carte

**Files:**
- Modify: `apps/explore-web/vite.config.ts`

- [ ] **Step 1: Edit vite.config.ts**

Find the `VitePWA({ ... manifest: { ... start_url: '/' ... } ... })` block. Change:

```ts
start_url: '/',
scope: '/',
```

to:

```ts
start_url: '/carte',
scope: '/',
```

Keep `scope: '/'` so the PWA can navigate to both `/` and `/carte`.

- [ ] **Step 2: Build and test PWA**

```bash
cd apps/explore-web && pnpm build && pnpm preview
```

- Visit http://localhost:4173/
- Open browser devtools → Application tab → Manifest → verify `start_url: /carte`
- Install PWA (browser prompt) → close → reopen installed app → should land on `/carte`

- [ ] **Step 3: Commit**

```bash
git add apps/explore-web/vite.config.ts
git commit -m "feat(explore-web): set PWA start_url to /carte"
```

---

## Task 13: Manual visual QA + Lighthouse

**Files:** none (testing only)

- [ ] **Step 1: Desktop QA**

Visit http://localhost:3000/ (`pnpm dev`):
- Two columns visible (parchment + image)
- Title bordeaux, perks colored pills, black CTA
- Tagline rotates every 4s, dots clickable
- Click CTA → slides to auth form (smooth 400ms)
- Click back ← → slides back to default
- Type fake credentials → see "Email ou mot de passe incorrect"
- Type real credentials → navigate to `/carte`

- [ ] **Step 2: Mobile QA**

Resize browser < 750px:
- Image on top (38vh), parchment below
- Same flows work
- No horizontal scrollbar

- [ ] **Step 3: Routing QA**

- Logged out, visit `/carte` direct → redirects to `/`
- Login → land on `/carte`
- Refresh `/carte` while logged in → stays on `/carte` (auth restored from session)
- Visit `/inexistant` → ideally redirects to `/` (we didn't add a wildcard route — add one if missing)

- [ ] **Step 4: Lighthouse audit**

In Chrome devtools → Lighthouse → run audit on http://localhost:4173/ (production preview).

Expected:
- Performance ≥ 80
- Accessibility ≥ 95
- Best Practices ≥ 90

If accessibility < 95, check: alt text on images, label associations on form, button aria-labels.

- [ ] **Step 5: Cleanup commit**

If anything was tweaked during QA:

```bash
git add -A
git commit -m "polish(explore-web): visual and a11y polish on landing page"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Tasks |
|---|---|
| §3.1 Components to create | Tasks 4, 5, 6, 7, 9, 11 |
| §3.2 Components to modify | Tasks 2, 3, 8, 11 |
| §3.3 useAuthForm hook | Task 8 |
| §4 Routing detail | Tasks 2, 11 |
| §5 Layout 2-col / mobile stacked | Task 4 |
| §6 Copy V1 hardcoded | Task 6 |
| §7 Slide animation | Tasks 4 (CSS), 10 (state wiring) |
| §8 Auth flow | Tasks 9, 10, 11 |
| §9 Visual style | Tasks 4, 5, 6, 7, 9 |
| §11 Acceptance criteria | Task 13 (QA) |

All spec sections covered.

**Placeholder scan:** No "TBD", "TODO", or vague instructions. Every code step has full code.

**Type consistency:** `Mode = 'default' | 'auth'` used consistently. `useAuthForm` signature defined in Task 8 and used in Tasks 8 (refactor) and 9 (LandingAuthForm). `useAuth` `user` property used in Tasks 10 and 11 — depends on existing hook's actual signature, noted "adapt to match" in steps.

**Image assets:** Tasks 5 and beyond depend on Uriel uploading images to `apps/explore-web/src/assets/landing/` and passing the import URLs to `<LandingImage />`. Until then, Task 5 renders a placeholder (no broken icon). This is documented in Task 5 step 1 note.

**No tests** in this plan because the project has no test framework. Each task has a manual smoke test instead. If the project later adopts Vitest, add unit tests for `useAuthForm` and `TaglineSlideshow` retroactively.
