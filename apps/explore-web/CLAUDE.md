# La Carte — Runes de Chêne

> MVP Salon — Carte interactive du patrimoine
> Dernière mise à jour : 13 février 2026

## Source de vérité

Ce fichier traduit techniquement les décisions stratégiques prises dans **La Citadelle** (Obsidian).
En cas de conflit, **La Citadelle fait autorité** :

- `⚔️ PLAN DE BATAILLE — Objectif 22 Mars.md` (roadmap, deadlines, priorités)
- `📋 ECT — La Carte.md` (exigences, conception, tâches)

Avant toute session de travail, vérifier si ces documents ont évolué.

---

## Vision (V1 — MVP Salon)

Une carte interactive du patrimoine français, **belle et fonctionnelle sur mobile**, qui :
1. Impressionne visuellement (style parchemin/Skyrim)
2. Affiche 2400+ lieux du patrimoine sans lag
3. Capture les emails des utilisateurs (auth OTP obligatoire)
4. Est montrable en salon (QR code → téléphone)
5. S'embed dans la boutique Shopify (iframe)

### Ce que V1 n'est PAS

Pas de gameplay. Pas de factions. Pas de conquête. Pas de brouillard de guerre. Pas de territoires. Pas de guildes. Pas de chat. Pas de musique par zone. Pas de duels.

> "La Carte as MMO — des studios de 20 devs mettent des années."
> — Analyse stratégique, février 2026

Le gameplay viendra en V2, **uniquement si V1 prouve l'engagement**.

---

## Stack technique

| Outil | Rôle |
|-------|------|
| React 18 + TypeScript | Framework UI |
| Vite 5 | Build tool |
| TailwindCSS + shadcn/ui | Styling + composants UI |
| MapLibre GL JS | Rendu cartographique |
| OpenFreeMap | Tuiles (gratuit, pas de clé API, basé OpenStreetMap) |
| Supabase | Auth OTP, RPC functions, storage |
| Zustand | State management (léger) |
| React Query | Cache serveur + data fetching |
| vite-plugin-pwa | PWA installable |
| Netlify | Déploiement → `carte.runesdechene.com` |

**Package manager :** pnpm
**Port dev :** 3000
**Package partagé :** `@runes/supabase-client` (client + types générés)

---

## État actuel du code

Le projet est un **squelette d'authentification**. La carte n'existe pas encore.

```
src/
├── components/
│   ├── AuthCallback.tsx    # Callback OTP
│   ├── AuthForm.tsx        # Formulaire email magic link
│   ├── ConnectionStatus.tsx # Indicateur connexion Supabase
│   ├── TablesList.tsx      # Debug (à supprimer)
│   └── UserProfile.tsx     # Profil utilisateur basique
├── hooks/
│   ├── useAuth.ts          # Hook auth Supabase
│   └── useSupabaseConnection.ts
├── lib/
│   └── supabase.ts         # Client Supabase local
├── types/
│   └── database.types.ts   # Types Supabase générés
├── App.tsx                 # Point d'entrée (auth + profil)
├── App.css
├── main.tsx
└── index.css
```

**A nettoyer :**
- Le PWA manifest dit "Rune2Chain Blockchain Explorer" (ancien nom)
- `index.html` dit "Rune2Chain" aussi
- `TablesList.tsx` est un composant de debug
- Tauri est configuré dans package.json mais pas prioritaire (Phase 2+)

---

## Architecture cible

```
src/
├── components/
│   ├── map/           # MapLibre, markers, clusters, popups
│   ├── places/        # Fiche lieu, panneau latéral
│   ├── auth/          # Login OTP, gate d'accès
│   ├── search/        # Barre de recherche
│   ├── filters/       # Filtres type/époque
│   └── ui/            # shadcn/ui
├── hooks/
│   ├── useMap.ts
│   ├── useAuth.ts
│   └── usePlaces.ts
├── lib/
│   ├── supabase.ts
│   └── map.ts         # Config MapLibre + style parchemin
├── types/
│   └── database.types.ts
├── stores/            # Zustand (auth state, map state)
├── pages/             # SEO /lieu/:slug (P2)
└── styles/            # Tailwind globals, thème parchemin
```

---

## Fonctionnalités MVP

### P0 — Indispensable

| Fonctionnalité | Détail |
|----------------|--------|
| **Style parchemin** | Couleurs sépia, typographie médiévale, texture |
| **2400 markers + clusters** | Affichage performant, clusters au dézoom |
| **Popup au clic** | Aperçu rapide : nom, type, photo |
| **Fiche détaillée** | Panneau latéral gauche : description, photos, avis |
| **Auth OTP** | Email obligatoire pour explorer au-delà de la zone proche |
| **Responsive mobile first** | Les gens scannent un QR code sur leur téléphone |
| **PWA installable** | Manifest, service worker, mode standalone |

### P1 — Important

| Fonctionnalité | Détail |
|----------------|--------|
| **Géolocalisation** | Centrage sur la position de l'utilisateur |
| **Recherche globale** | Lieux + adresses (Nominatim/OpenStreetMap) |
| **Filtres** | Par type de lieu, par époque historique |

### P2 — Si le temps le permet

| Fonctionnalité | Détail |
|----------------|--------|
| **Pages SEO** | `/lieu/:slug` (indexable, Open Graph) |
| **Mode embed** | `?embed=true` pour iframe Shopify |
| **Optimisation performance** | Lazy loading, code splitting |

---

## Données Supabase

### Tables principales (migration 006)

- `places` — 2400+ lieux (titre, texte, lat/lng, type, images, auteur)
- `place_types` — Types de lieux (château, église, mégalithe...) avec couleurs
- `reviews` — Avis sur les lieux (score, message, images)
- `users` — Utilisateurs (rank, profil, avatar)
- `places_viewed` / `places_liked` / `places_explored` / `places_bookmarked` — Actions utilisateur
- `image_media` — Médias avec variantes
- `member_codes` — Système guest/member

### RPC disponibles

| Fonction | Usage |
|----------|-------|
| `get_map_places` | Tous les lieux pour la carte (markers) |
| `get_place_by_id` | Détail complet d'un lieu |
| `get_place_reviews` | Avis d'un lieu |
| `get_user_profile` | Profil public d'un utilisateur |
| `get_my_informations` | Profil de l'utilisateur connecté |
| `get_map_banners` | Lieux mis en avant |
| `get_regular_feed` / `get_banner_feed` | Feeds de lieux |
| `get_user_places` | Lieux créés par un utilisateur |
| `get_review_by_id` | Détail d'un avis |

### Auth

- **Méthode** : Magic Link OTP (email)
- **Flow** : email → lien magique → `/auth/callback` → session
- **Auto-création** : migration 007 crée automatiquement un profil `users` au signup

---

## Timeline (du Plan de Bataille V3)

| Semaine | Dates | Objectif La Carte |
|---------|-------|-------------------|
| **S2** | 17-23 fév | TailwindCSS + shadcn/ui + MapLibre parchemin + 2400 markers + clusters + popup |
| **S3** | 24 fév - 2 mar | Fiche détaillée + recherche + géoloc + auth OTP + responsive mobile |
| **S4** | 3-9 mar | Filtres + PWA + tests + corrections. **Version testable avant Yggdrasil (7-8 mar)** |
| **S5** | 10-16 mar | Déploiement Netlify + SEO pages + embed + corrections ambassadeurs |
| **S6** | 17-22 mar | Ajustements finaux + monitoring post-lancement |

**Date critique :** 7-8 mars = Festival Yggdrasil, Lyon. La Carte doit être montrable.
**Deadline finale :** 22 mars = tout déployé, fonctionnel, en production.

---

## Utilisateurs cibles

1. **Visiteurs de salon** — Scannent le QR code dans leur sac → téléphone → inscription email → exploration
2. **Visiteurs boutique en ligne** — Voient La Carte en iframe sur runesdechene.com
3. **Ambassadeurs/Hérauts** — Testeurs avant-première (semaine 5)

---

## Design & UX

### Style visuel

- **Ambiance :** Parchemin, Skyrim, médiéval fantaisie
- **Couleurs :** Sépia, bruns, ors, rouges foncés (#833434)
- **Typographie :** Médiévale pour les titres, lisible pour le corps
- **Texture :** Effet parchemin sur le fond de carte
- **Markers :** Iconographie par type de lieu, couleurs de `place_types`

### Interface

- **Plein écran :** La carte occupe 100% du viewport
- **Panneau latéral gauche :** Fiche lieu (s'ouvre au clic sur un marker)
- **Barre de recherche :** En haut, flottante
- **Filtres :** Panneau déroulant ou drawer
- **Auth gate :** L'utilisateur peut voir la carte et sa zone proche. Pour explorer plus loin → inscription email

### Mobile first

- Panneau latéral = panneau bas (bottom sheet) sur mobile
- Recherche = barre fixe en haut
- Filtres = icône + drawer
- Carte = plein écran, gestes tactiles natifs (pinch zoom, pan)

---

## Conventions de code

- **TypeScript strict** — pas de `any`, types explicites
- **TailwindCSS** — pas de CSS custom sauf nécessité absolue
- **Composants fonctionnels** — hooks, pas de classes
- **Imports** — `@/` alias pour `src/`
- **State serveur** — React Query (pas de state local pour les données distantes)
- **State client** — Zustand (auth, UI, map viewport)
- **Commits** — Conventional Commits (`feat:`, `fix:`, `chore:`)
- **Package manager** — pnpm uniquement
- **Nommage fichiers** — kebab-case pour les fichiers, PascalCase pour les composants
- **A11y** — labels, contraste, navigation clavier
- **Pas d'over-engineering** — code simple, direct, pas d'abstraction prématurée

---

## Déploiement

- **Hébergement :** Netlify
- **Domaine :** `carte.runesdechene.com`
- **Build :** `pnpm build` (tsc + vite build)
- **Previews :** Netlify deploy previews sur chaque PR
- **Variables d'environnement :** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
