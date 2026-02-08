# CLAUDE.MD — Audit de explore-mobile & Plan de migration Supabase

> Analyse de l'app mobile React Native (Expo) et plan de migration de l'API NestJS vers Supabase.
> Date : 8 fevrier 2026

---

## 1. Vue d'ensemble

**Stack** : React Native 0.79 + Expo 53 + TypeScript + Redux Toolkit + React Query + Axios + Zustand
**Architecture** : Ports & Adapters (meme pattern que l'API)
**Navigation** : Expo Router (file-based routing)
**UI** : React Native Paper + styled-components + custom fonts (Inconsolata, BebasNeue)
**Maps** : react-native-maps (Google Maps)
**State** : Redux Toolkit (place feed, details, banners) + React Query (queries) + Zustand
**Auth actuelle** : JWT custom via Axios → `api.guildedesvoyageurs.fr` (DigitalOcean)

### Structure

```
src/
  adapters/              # Implementations HTTP (Axios → API NestJS)
    http-session-gateway     → auth (login, register, password reset)
    http-places-feed-gateway → feeds (map, regular, banner, user places)
    http-places-query-gateway → queries (place types, place by id, total)
    http-places-command-gateway → actions (CRUD places, like/bookmark/explore/view)
    http-reviews-gateway     → reviews (CRUD + queries)
    http-account-gateway     → profil utilisateur
    http-users-query-gateway → profil public
    http-admin-query-gateway → stats admin
  ports/                 # Interfaces (contrats)
  model/                 # Types API (identiques a ceux de l'API)
  services/              # Authenticator, MediaUploader, ImageSelector, LocationService
  store/                 # Redux slices (placeFeed, placeDetails, bannerFeed)
  queries/               # React Query hooks (use-*-query)
  hooks/                 # use-session
  screens/               # Ecrans (auth, places, users, tabs, notifications)
  app/                   # Expo Router layouts et pages
  ui/                    # 219 fichiers UI (composants, assets, theme, providers)
  shared/                # HTTP client (Axios), ports infra (storage, router, alerter, date)
  core/                  # React Query provider
```

---

## 2. Comment l'app se connecte a l'API aujourd'hui

### 2.1 Point d'entree

```
.env.prod → EXPO_PUBLIC_API_URL=https://api.guildedesvoyageurs.fr/
```

Le `DependenciesProvider` cree un `AxiosHttpClient` avec cette URL comme base, puis injecte tous les gateways HTTP dans le contexte React.

### 2.2 Flux d'authentification

1. L'utilisateur entre email + mot de passe
2. `HttpSessionGateway.signIn()` → POST `auth/login-with-credentials`
3. L'API retourne `{ user, accessToken, refreshToken }`
4. `Authenticator` stocke les tokens dans AsyncStorage
5. `AxiosHttpClient` ajoute `Authorization: Bearer <accessToken>` a chaque requete
6. Toutes les 45 secondes, `maintainValidAccessToken()` verifie l'expiration
7. Si expire → `refreshAccessToken()` → POST `auth/login-with-refresh-token`

### 2.3 Flux de donnees

```
Screen → useQuery (React Query) → Gateway (port) → HttpGateway (adapter) → Axios → API NestJS
Screen → dispatch (Redux) → thunk → Gateway → Axios → API NestJS
```

---

## 3. Inventaire des appels API a migrer

### 3.1 Auth (ISessionGateway) → REMPLACER par Supabase Auth

| Methode | Endpoint actuel | Remplacement Supabase |
|---|---|---|
| `signIn(email, password)` | POST `auth/login-with-credentials` | `supabase.auth.signInWithPassword()` |
| `refreshAccessToken(token)` | POST `auth/login-with-refresh-token` | Automatique (Supabase gere les sessions) |
| `signOut()` | (no-op actuellement) | `supabase.auth.signOut()` |
| `register(data)` | POST `auth/register` | `supabase.auth.signUp()` |
| `beginPasswordReset(email)` | POST `auth/begin-password-reset` | `supabase.auth.resetPasswordForEmail()` |
| `endPasswordReset(code, password)` | POST `auth/end-password-reset` | `supabase.auth.updateUser({ password })` |

### 3.2 Account (IAccountGateway) → Supabase direct + RPC

| Methode | Endpoint actuel | Remplacement Supabase |
|---|---|---|
| `getMyUser()` | GET `auth/get-my-informations` | `supabase.from('users').select().eq('id', user.id)` |
| `changeInformations(data)` | POST `auth/change-informations` | `supabase.from('users').update(data).eq('id', user.id)` |
| `changePassword(data)` | POST `auth/change-password` | `supabase.auth.updateUser({ password })` |
| `changeEmailAddress(data)` | POST `auth/change-email-address` | `supabase.auth.updateUser({ email })` |
| `activateAccount(code)` | POST `auth/activate-account` | RPC `activate_account(code)` ou a supprimer |
| `deleteAccount()` | DELETE `auth/delete-account` | RPC `delete_account()` |

### 3.3 Places Feed (IPlacesFeedGateway) → Fonctions RPC Supabase

| Methode | Endpoint actuel | Remplacement Supabase |
|---|---|---|
| `getMapPlaces(query)` | POST `places/get-map-places` | `supabase.rpc('get_map_places', params)` |
| `getMapBanners(query)` | POST `places/get-map-banners` | `supabase.rpc('get_map_banners', params)` |
| `getRegularFeed(query)` | POST `places/get-regular-feed` | `supabase.rpc('get_regular_feed', params)` |
| `getBannerFeed(query)` | POST `places/get-banner-feed` | `supabase.rpc('get_banner_feed', params)` |
| `getLikedPlaces(query)` | POST `places/get-liked-places` | `supabase.rpc('get_user_liked_places', params)` |
| `getExploredPlaces(query)` | POST `places/get-explored-places` | `supabase.rpc('get_user_explored_places', params)` |
| `getBookmarkedPlaces(query)` | POST `places/get-bookmarked-places` | `supabase.rpc('get_user_bookmarked_places', params)` |
| `getAddedPlaces(query)` | POST `places/get-added-places` | `supabase.rpc('get_user_added_places', params)` |

### 3.4 Places Query (IPlacesQueryGateway) → Supabase direct + RPC

| Methode | Endpoint actuel | Remplacement Supabase |
|---|---|---|
| `getRootPlaceTypes()` | GET `places/get-root-place-types` | `supabase.from('place_types').select().is('parent_id', null)` |
| `getChildPlaceTypes(parentId)` | GET `places/get-children-place-types` | `supabase.from('place_types').select().eq('parent_id', parentId)` |
| `getPlaceById(id)` | GET `places/get-place-by-id` | `supabase.rpc('get_place_by_id', { p_id, p_user_id })` |
| `getTotalPlaces()` | GET `places/get-total-places` | `supabase.from('places').select('id', { count: 'exact', head: true })` |

### 3.5 Places Command (IPlacesCommandGateway) → Supabase direct

| Methode | Endpoint actuel | Remplacement Supabase |
|---|---|---|
| `createPlace(payload)` | POST `places/create-place` | `supabase.from('places').insert(...)` |
| `updatePlace(payload)` | POST `places/update-place` | `supabase.from('places').update(...).eq('id', id)` |
| `deletePlace(id)` | DELETE `places/delete-place` | `supabase.from('places').delete().eq('id', id)` |
| `bookmarkPlace(id)` | POST `places/bookmark-place` | `supabase.from('places_bookmarked').insert(...)` |
| `removeBookmarkPlace(id)` | DELETE `places/remove-bookmark-place` | `supabase.from('places_bookmarked').delete().match(...)` |
| `likePlace(id)` | POST `places/like-place` | `supabase.from('places_liked').insert(...)` |
| `removeLikePlace(id)` | DELETE `places/remove-like-place` | `supabase.from('places_liked').delete().match(...)` |
| `explorePlace(id)` | POST `places/explore-place` | `supabase.from('places_explored').insert(...)` |
| `removeExplorePlace(id)` | DELETE `places/remove-explore-place` | `supabase.from('places_explored').delete().match(...)` |
| `viewPlace(id)` | POST `places/view-place` | `supabase.from('places_viewed').insert(...)` |

### 3.6 Reviews (IReviewsGateway) → Supabase direct + RPC

| Methode | Endpoint actuel | Remplacement Supabase |
|---|---|---|
| `createReview(payload)` | POST `reviews/create-review` | `supabase.from('reviews').insert(...)` |
| `updateReview(payload)` | POST `reviews/update-review` | `supabase.from('reviews').update(...).eq('id', id)` |
| `deleteReview(payload)` | DELETE `reviews/delete-review` | `supabase.from('reviews').delete().eq('id', id)` |
| `getPlaceReviews(query)` | POST `reviews/get-place-reviews` | `supabase.rpc('get_place_reviews', params)` |
| `getReviewById(id)` | GET `reviews/get-review-by-id` | `supabase.rpc('get_review_by_id', { p_id })` |

### 3.7 Medias (MediaUploader) → Supabase Storage

| Methode | Endpoint actuel | Remplacement Supabase |
|---|---|---|
| `storeAsUrl(uri)` | POST `medias/store-as-url` (multipart) | `supabase.storage.from('bucket').upload(path, file)` |
| `storeAsMedia(uri)` | POST `medias/store-as-media` (multipart) | `supabase.storage.from('bucket').upload(path, file)` |

### 3.8 Users (IUsersQueryGateway)

| Methode | Endpoint actuel | Remplacement Supabase |
|---|---|---|
| `getUserProfile(userId)` | GET `users/get-user-profile` | `supabase.rpc('get_user_profile', { p_user_id })` |

---

## 4. Plan de migration — Ce qui change dans explore-mobile

### Phase 1 : Installer @supabase/supabase-js

```bash
pnpm add @supabase/supabase-js
```

Creer `src/shared/supabase/supabase-client.ts` :
```typescript
import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { storage: AsyncStorage } }
)
```

### Phase 2 : Remplacer les adapters

Grace a l'architecture Ports & Adapters, **les ports (interfaces) ne changent pas**. On remplace uniquement les adapters :

```
http-session-gateway.ts     → supabase-session-gateway.ts
http-account-gateway.ts     → supabase-account-gateway.ts
http-places-feed-gateway.ts → supabase-places-feed-gateway.ts
http-places-query-gateway.ts → supabase-places-query-gateway.ts
http-places-command-gateway.ts → supabase-places-command-gateway.ts
http-reviews-gateway.ts     → supabase-reviews-gateway.ts
http-users-query-gateway.ts → supabase-users-query-gateway.ts
```

Le `DependenciesProvider` instancie les nouveaux adapters au lieu des anciens. **Aucun ecran ne change.**

### Phase 3 : Remplacer l'Authenticator

L'`Authenticator` actuel gere manuellement les JWT + refresh tokens. Avec Supabase Auth, tout ca est automatique :

```typescript
// Avant : Authenticator custom (168 lignes)
// Apres : ~30 lignes
export class SupabaseAuthenticator {
  async signIn(credentials) {
    const { data, error } = await supabase.auth.signInWithPassword(credentials)
    // ...
  }
  async signOut() {
    await supabase.auth.signOut()
  }
  // onAuthStateChange() remplace le polling toutes les 45s
}
```

### Phase 4 : Remplacer le MediaUploader

```typescript
// Avant : multipart upload vers /medias/store-as-url
// Apres : Supabase Storage
async storeAsUrl({ uri }) {
  const response = await fetch(uri)
  const blob = await response.blob()
  const path = `places/${nanoid()}.jpg`
  const { data } = await supabase.storage.from('place-images').upload(path, blob)
  return { url: supabase.storage.from('place-images').getPublicUrl(path).data.publicUrl }
}
```

### Phase 5 : Mettre a jour le DependenciesProvider

Remplacer les instanciations dans `Dependencies.tsx` :
- Supprimer `AxiosHttpClient`, `HttpRemote`, `HttpAuthentication`
- Instancier les `Supabase*Gateway` a la place des `Http*Gateway`
- Remplacer `Authenticator` par `SupabaseAuthenticator`
- Remplacer `MediaUploader` par `SupabaseMediaUploader`

### Phase 6 : Mettre a jour les variables d'environnement

```
# Avant
EXPO_PUBLIC_API_URL=https://api.guildedesvoyageurs.fr/

# Apres
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 5. Ce qui NE change PAS

- **Tous les ecrans** (screens/) — aucune modification
- **Tous les composants UI** (ui/) — aucune modification
- **Les ports/interfaces** — le contrat reste le meme
- **Les models/types** — les types API restent les memes (les RPC Supabase retourneront le meme format)
- **Redux store** — aucune modification
- **React Query hooks** — aucune modification (ils appellent les gateways via les ports)
- **Navigation** — aucune modification
- **LocationService, ImageSelector** — aucune modification

**Impact estime** : ~10 fichiers a modifier/remplacer sur ~380.

---

## 6. Prerequis cote Supabase (a faire AVANT de toucher au mobile)

1. **Fonctions RPC** pour les queries complexes (feeds, map, place detail)
2. **RLS policies** pour places, reviews, actions utilisateur
3. **Bucket Storage** pour les images de places
4. **Migration des users** vers Supabase Auth (Magic Link ou import des hash Argon2)

---

## 7. Risques et points d'attention

1. **Images S3 existantes** — Les places ont des images sur S3 (`gdv-*.s3.amazonaws.com`). Les URLs restent valides. Les nouvelles images iront dans Supabase Storage.

2. **Member codes / Rank** — Le systeme guest/member avec codes d'activation est specifique. A decider si on le garde (RPC) ou si on le supprime.

3. **Offline / Cache** — React Query gere le cache. Pas de changement necessaire.

4. **Performance** — Les RPC Supabase sont des appels PostgreSQL directs, potentiellement plus rapides que l'API NestJS intermediaire.

5. **Auth migration** — Les users existants ont des mots de passe hashes en Argon2. Supabase Auth utilise bcrypt. Options :
   - Importer les users dans `auth.users` avec un hook de migration au premier login
   - Forcer un reset de mot de passe pour tous les users
   - Utiliser Magic Link (plus de mot de passe du tout)

---

## 8. Ordre de travail recommande

```
1. [Supabase] Creer les fonctions RPC (migration SQL)
2. [Supabase] Creer les RLS policies
3. [Supabase] Creer le bucket Storage pour les images
4. [Mobile]   Installer @supabase/supabase-js
5. [Mobile]   Creer supabase-client.ts
6. [Mobile]   Creer les nouveaux adapters Supabase (1 par 1, en testant)
7. [Mobile]   Remplacer Authenticator par SupabaseAuthenticator
8. [Mobile]   Remplacer MediaUploader par SupabaseMediaUploader
9. [Mobile]   Mettre a jour DependenciesProvider
10. [Mobile]  Tester sur Expo Go
11. [Mobile]  Build + deploy sur les stores
12. [Infra]   Eteindre le serveur DigitalOcean
```
