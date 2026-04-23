# Spec — Page d'accueil de l'application (explore-web)

**Date** : 2026-04-23
**Statut** : Validé par Uriel, prêt pour plan d'implémentation
**Auteurs** : XO + Uriel
**Repo** : `apps/explore-web/` (monorepo `app (Runes de Chêne)`)

---

## 1. Contexte

L'application web Runes de Chêne (React 18 + Vite 5 + TypeScript strict, prod sur `app.runesdechene.com`) ouvre actuellement directement sur la carte interactive (`<ExploreMap />`). Pour les nouveaux visiteurs (notamment via pub Meta ou lien depuis la boutique Shopify), l'arrivée brutale sur la carte sans contexte rend l'app intimidante et peu engageante.

La STRATEGIE 2026 §IV.3 dit : *"Onboarding repensé : trois écrans qui expliquent le mouvement, pas les fonctionnalités. Dès qu'on entre dans l'application, on doit être DANS un mouvement."*

Cette spec définit une **page d'accueil propre** qui se substitue à la carte pour les visiteurs non-engagés, et un flow d'auth élégant qui s'intègre dans cette page (slide inline dans le parchemin, pas modal pop-up).

Le design visuel reprend exactement le style de la popup saisonnière de la home boutique Shopify (déployée en LIVE le 23 avril 2026) : 2 colonnes, parchemin gauche + image Friedrich + Ken Burns + frame parchemin overlay.

## 2. Décisions tranchées

| Décision | Choix | Raison |
|---|---|---|
| Routing | React Router 7 ajouté | Standard industry, scalable, PWA deep links |
| URL landing | `/` (root) | URL canonique simple, indexable |
| URL carte | `/carte` | Séparée pour PWA `start_url` |
| PWA `start_url` | `/carte` | Les utilisateurs réguliers (PWA installée) ouvrent direct sur la carte |
| Layout | 2 colonnes desktop (parchemin gauche + image droite), stacked mobile | Reprend exactement le design de la popup Shopify |
| Auth flow | Inline slide dans parchemin (pas modal) | Élégance, cohérence visuelle, transition smooth |
| Copy | Hardcoded V1 | Pas de système config (YAGNI) |
| Style | Recréation React du design popup Shopify | Stack différente (React vs Liquid), pas de réutilisation directe code |

## 3. Architecture

### 3.1 Composants à créer

```
apps/explore-web/src/components/landing/
├── LandingPage.tsx          — Route /, orchestre layout + state (default | auth)
├── LandingPage.css
├── LandingContent.tsx       — Vue par défaut : surtitre, titre, sous-titre, perks, CTA, tagline
├── LandingAuthForm.tsx      — Vue login : formulaire inline (réutilise useAuthForm)
├── LandingImage.tsx         — Image Friedrich + Ken Burns + frame parchemin overlay
└── TaglineSlideshow.tsx     — Composant carrousel taglines (3 slides + dots, auto-rotation 4s)

apps/explore-web/src/pages/
├── MapPage.tsx              — Wrapper route /carte (= App.tsx actuel extrait)
└── LandingPageRoute.tsx     — Wrapper route / (juste import LandingPage)

apps/explore-web/src/hooks/
└── useAuthForm.ts           — Hook partagé entre <AuthModal /> et <LandingAuthForm />
```

### 3.2 Composants à modifier

- `App.tsx` → wrapper avec `<BrowserRouter>` + `<Routes>` :
  - `/` → `<LandingPage />`
  - `/carte` → `<RequireAuth><MapPage /></RequireAuth>` (redirect `/` si pas auth)
- App.tsx actuel (carte + tous ses imports) → extraire dans `<MapPage />` (`apps/explore-web/src/pages/MapPage.tsx`)
- `<AuthModal />` existant (`components/auth/AuthModal.tsx`) → extraire la logique Supabase dans `useAuthForm()` hook réutilisable. L'AuthModal continue d'exister pour les cas non-landing (modal pop-up classique).

### 3.3 Hook partagé `useAuthForm`

Encapsule :
- État du formulaire (email, password, mode signup/login)
- Validation (email format, password length)
- Calls Supabase via `supabaseClient` (signIn, signUp, resetPassword)
- Errors handling (messages user-friendly)
- Loading state
- Callback `onSuccess` configurable (utilisé par LandingAuthForm pour navigate('/carte'))

Utilisé par `<AuthModal />` (existant, mode modal) ET `<LandingAuthForm />` (nouveau, mode inline).

## 4. Routing détaillé

```
React Router routes:
  /              → <LandingPage />
  /carte         → <RequireAuth><MapPage /></RequireAuth>
  /*             → redirect /

<RequireAuth> :
  if (!isAuthenticated) navigate('/', { replace: true })
  else <Outlet />
```

PWA `manifest.json` (à modifier) :
```json
{
  "start_url": "/carte",
  ...
}
```

## 5. Layout LandingPage

### 5.1 Desktop (≥ 750px)

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│  ┌──────────────────────┐  ┌────────────────────────┐  │
│  │                      │  │                        │  │
│  │   PARCHEMIN          │  │   IMAGE FRIEDRICH      │  │
│  │   (50% width)        │  │   + Ken Burns          │  │
│  │                      │  │   + Frame parchemin    │  │
│  │   [Vue par défaut    │  │     overlay (PNG)      │  │
│  │   OU                 │  │   (50% width)          │  │
│  │   Vue auth]          │  │                        │  │
│  │                      │  │                        │  │
│  └──────────────────────┘  └────────────────────────┘  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 5.2 Mobile (< 750px)

```
┌────────────────────────┐
│  IMAGE FRIEDRICH       │
│  (38vh)                │
└────────────────────────┘
┌────────────────────────┐
│                        │
│  PARCHEMIN             │
│  (60vh remaining)      │
│  [Vue par défaut       │
│  OU                    │
│  Vue auth]             │
│                        │
└────────────────────────┘
```

## 6. Copy V1 hardcodée

```
Surtitre: "🎁 BIENVENUE DANS"
Titre:    "RUNES DE CHÊNE."
Sous-titre: "Une Confrérie qui explore les contrées oubliées de France."
Accroche: "+ de 2600 lieux d'Histoire à découvrir, une carte vivante, une communauté en marche."

Perks (gélules colorées empilées):
- ✓ "Une appli gratuite, sans pub" (couleur 1, ex. ambre #c8956b)
- ✓ "Tes Fragments achetés débloquent des bonus" (couleur 2, ex. vert sauge #7a8e6f)

CTA primaire (un seul): "Accéder à la carte"

Tagline slideshow (3 textes auto-rotation 4s, dots cliquables):
- "Le Pokémon Go du patrimoine."
- "Une rébellion contre le monde moderne."
- "Un MMORPG dans la vraie vie."
```

## 7. Animation slide auth

```css
.landing__parchment-content {
  position: relative;
  overflow: hidden;
}

.landing__view {
  position: absolute;
  inset: 0;
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.landing__view--default {
  transform: translateX(0);
}
.landing__parchment-content.is-auth-mode .landing__view--default {
  transform: translateX(-100%);
}

.landing__view--auth {
  transform: translateX(100%);
}
.landing__parchment-content.is-auth-mode .landing__view--auth {
  transform: translateX(0);
}
```

Transition 400ms en cubic-bezier(0.16, 1, 0.3, 1) (smooth-out).

Une discrete back-arrow ← dans la vue auth pour revenir à la vue default.

## 8. Auth flow

```
1. User sur LandingPage (vue default)
2. User clique "Accéder à la carte"
3. checkAuth(): isAuthenticated ?
   ├── OUI → navigate('/carte')
   └── NON → setMode('auth') → slide vers LandingAuthForm
4. LandingAuthForm rendu inline dans le parchemin :
   - Email + password
   - Boutons "Connexion" / "Créer un compte" (toggle)
   - Reset password → ouvre l'AuthModal classique pour ce flow secondaire
5. Submit → useAuthForm.signIn() ou .signUp()
6. Auth réussi → navigate('/carte')
7. Échec → afficher erreur dans le formulaire, reste sur landing
8. Click ← back → slide retour vers vue default
```

## 9. Style visuel — réutiliser l'esthétique popup Shopify

Conventions à reproduire en React/CSS :
- **Fonts** : utiliser les fonts du theme (Inter ou similaire) — pas de Google Font supplémentaire
- **Couleur texte** : sombre (#46352e ou similaire) sur parchemin clair
- **Couleur titre** : différente du texte (ex. #963e3e bordeaux)
- **Couleur CTA primaire** : sombre (#2a2418), texte blanc, border-radius 12px
- **Pas d'ombres** sur le contenu textuel ou boutons
- **Background parchemin** : couleur #eee8dc (blanc cassé chaud)
- **Frame PNG parchemin** : overlay sur l'image (zones transparentes pour révéler la photo)
- **Ken Burns** : animation `scale(1.00) → scale(1.18)` en 20s ease-in-out alternate (continue à zoomer/dézoomer)
- **Tagline slideshow** : carrousel auto 4s + dots cliquables sous le texte
- **Perks (gélules)** : pills border-radius 9999px, texte + bordure colorés, fond couleur transparente 14%

Configuration de ces éléments via constantes en haut du fichier (LandingPage.tsx) :
```typescript
const LANDING_CONFIG = {
  imageDesktopUrl: '...', // upload Supabase storage ou import depuis assets/
  imageMobileUrl: '...',
  framePngUrl: '...',
  textColor: '#46352e',
  titleColor: '#963e3e',
  ctaPrimaryColor: '#2a2418',
  perk1Color: '#c8956b',
  perk2Color: '#7a8e6f',
  parchmentBg: '#eee8dc',
} as const;
```

## 10. Hors-scope V1

- Système de config (édition de copy depuis admin/Hub) — V2 si besoin
- Page de profil / settings au-delà de l'auth basique
- Reset password en inline (reste sur AuthModal classique)
- A/B test de copy
- Multilangue (français only V1)
- Animations avancées (parallax, etc.)
- Configuration des perks / tagline depuis l'extérieur
- Onboarding multi-écrans post-signup (existe déjà via `<OnboardingModal />`, pas touché)

## 11. Critères d'acceptation

1. Visiteur arrive sur `/` → voit la LandingPage avec image + parchemin + texte + CTA
2. Click "Accéder à la carte" non-connecté → slide vers vue auth dans le parchemin
3. Login réussi → navigate vers `/carte` → la carte s'affiche
4. Visiteur déjà connecté arrive sur `/` → click "Accéder à la carte" → navigate direct vers `/carte`
5. Visiteur non-connecté arrive sur `/carte` (lien direct ou bookmark) → redirect vers `/`
6. PWA installée s'ouvre sur `/carte` (start_url)
7. Lighthouse Performance ≥ 80, Accessibility ≥ 95 sur la landing
8. Mobile (< 750px) : layout stacked image-en-haut + parchemin-en-bas, fonctionne sans scroll horizontal
9. Animation slide auth ↔ default fluide (400ms), bouton back fonctionnel
10. AuthModal existant continue de fonctionner pour les autres flux (post-signup onboarding, change email, etc.)

## 12. Évolutions prévues

- **V1.1** : intégration tagline slideshow contrôlé via Hub (Mathéo peut éditer les taglines sans toucher au code)
- **V2** : page de profil / mes données dans `/profil` (route additionnelle React Router)
- **V2** : système d'avis Porteurs intégré (section landing)
- **V2** : POC migration vers Astro/Next pour SSR de la landing (pour SEO + partage social)

---

*Spec rédigée en session brainstorming XO + Uriel le 23 avril 2026, après déploiement de la popup saisonnière sur la home boutique Shopify (même esthétique réutilisée en React).*
