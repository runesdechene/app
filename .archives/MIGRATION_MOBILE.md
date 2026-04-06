# Migration explore-mobile : API vers Supabase

Ce document liste tous les changements necessaires pour migrer l'application mobile de l'ancienne API REST (DigitalOcean) vers Supabase.

---

## Resume

| Avant | Apres |
|-------|-------|
| API REST custom (`api.guildedesvoyageurs.fr`) | Supabase Client direct |
| Authentification JWT custom | Supabase Auth (Magic Link) |
| Axios + HttpClient custom | `@supabase/supabase-js` |
| Tokens access/refresh manuels | Sessions gerees par Supabase |

---

## 1. Configuration environnement

### Fichier `.env`

**Avant :**
```
EXPO_PUBLIC_API_URL=https://api.guildedesvoyageurs.fr/
```

**Apres :**
```
EXPO_PUBLIC_SUPABASE_URL=https://ukpapqssgsxirsgmcvof.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

---

## 2. Dependances

### Ajouter
```bash
pnpm add @supabase/supabase-js @react-native-async-storage/async-storage
```

### Supprimer (optionnel)
```bash
pnpm remove axios  # Si plus utilise ailleurs
```

---

## 3. Fichiers a modifier

### 3.1 Creer le client Supabase

**Nouveau fichier : `src/lib/supabase.ts`**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
```

---

### 3.2 Adapter l'authentification

**Fichier : `src/services/authenticator.ts`**

| Methode actuelle | Nouvelle methode Supabase |
|------------------|---------------------------|
| `signIn(email, password)` | `supabase.auth.signInWithOtp({ email })` (Magic Link) |
| `signOut()` | `supabase.auth.signOut()` |
| `refreshAccessToken()` | Automatique avec Supabase |
| `onUserChange()` | `supabase.auth.onAuthStateChange()` |

**Exemple de remplacement :**

```typescript
// AVANT
async signIn(credentials: SignInCredentials) {
  const apiUser = await this.gateway.signIn(
    credentials.emailAddress,
    credentials.password,
  )
  // ...
}

// APRES
async signInWithMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: 'runesdechene://auth/callback',
    },
  })
  if (error) throw error
}
```

---

### 3.3 Adapter les Gateways (Adapters)

Chaque adapter HTTP doit etre remplace par des appels Supabase directs.

#### `http-session-gateway.ts` -> `supabase-session-gateway.ts`

| Endpoint API | Requete Supabase |
|--------------|------------------|
| `POST auth/login-with-credentials` | `supabase.auth.signInWithPassword()` ou Magic Link |
| `POST auth/login-with-refresh-token` | Automatique |
| `POST auth/register` | `supabase.auth.signUp()` |
| `POST auth/begin-password-reset` | `supabase.auth.resetPasswordForEmail()` |
| `DELETE auth/delete-account` | `supabase.rpc('delete_user')` (Edge Function) |

#### `http-account-gateway.ts` -> `supabase-account-gateway.ts`

| Endpoint API | Requete Supabase |
|--------------|------------------|
| `GET auth/get-my-informations` | `supabase.from('users').select('*').eq('id', userId).single()` |
| `POST auth/change-password` | `supabase.auth.updateUser({ password })` |
| `POST auth/change-informations` | `supabase.from('users').update({...}).eq('id', userId)` |
| `POST auth/change-email-address` | `supabase.auth.updateUser({ email })` |

#### `http-places-query-gateway.ts` -> `supabase-places-gateway.ts`

| Endpoint API | Requete Supabase |
|--------------|------------------|
| `GET places/get-root-place-types` | `supabase.from('place_types').select('*').is('parent_id', null)` |
| `GET places/get-children-place-types?parentId=X` | `supabase.from('place_types').select('*').eq('parent_id', X)` |
| `GET places/get-place-by-id?id=X` | `supabase.from('places').select('*').eq('id', X).single()` |
| `GET places/get-total-places` | `supabase.from('places').select('*', { count: 'exact', head: true })` |

#### `http-places-feed-gateway.ts` -> `supabase-places-feed-gateway.ts`

| Endpoint API | Requete Supabase |
|--------------|------------------|
| `POST places/get-banner-feed` | `supabase.from('places').select('*').limit(10)` + filtres |
| `POST places/get-regular-feed` | `supabase.from('places').select('*').range(offset, limit)` |
| `POST places/get-map-places` | `supabase.rpc('get_places_in_bounds', { bounds })` |
| `POST places/get-liked-places` | `supabase.from('places_liked').select('*, places(*)').eq('user_id', userId)` |
| `POST places/get-explored-places` | `supabase.from('places_explored').select('*, places(*)').eq('user_id', userId)` |
| `POST places/get-bookmarked-places` | `supabase.from('places_bookmarked').select('*, places(*)').eq('user_id', userId)` |

#### `http-reviews-gateway.ts` -> `supabase-reviews-gateway.ts`

| Endpoint API | Requete Supabase |
|--------------|------------------|
| `POST reviews/create-review` | `supabase.from('reviews').insert({...})` |
| `POST reviews/update-review` | `supabase.from('reviews').update({...}).eq('id', reviewId)` |
| `DELETE reviews/delete-review` | `supabase.from('reviews').delete().eq('id', reviewId)` |
| `GET reviews/get-review-by-id?id=X` | `supabase.from('reviews').select('*').eq('id', X).single()` |
| `POST reviews/get-place-reviews` | `supabase.from('reviews').select('*').eq('place_id', placeId)` |

---

## 4. Mapping des modeles

Les modeles API doivent etre adaptes aux types Supabase.

### User

```typescript
// AVANT (ApiAuthenticatedUser)
{
  user: {
    id: string
    emailAddress: string
    lastName: string
    profileImage: { variants: [...] }
    role: string
    rank: string
  },
  accessToken: { value: string, expiresAt: Date },
  refreshToken: { value: string, expiresAt: Date }
}

// APRES (Supabase)
// Auth user: supabase.auth.getUser()
// Profile: supabase.from('users').select('*')
{
  id: string
  email_address: string
  first_name: string | null
  last_name: string
  profile_image_id: string | null
  role: string
  rank: string
  biography: string
}
```

---

## 5. Deep Linking pour Magic Link

### Configuration Expo (`app.json`)

```json
{
  "expo": {
    "scheme": "runesdechene",
    "plugins": [
      [
        "expo-linking",
        {
          "scheme": "runesdechene"
        }
      ]
    ]
  }
}
```

### Gerer le callback

```typescript
import * as Linking from 'expo-linking'
import { supabase } from './lib/supabase'

Linking.addEventListener('url', async (event) => {
  const url = event.url
  if (url.includes('auth/callback')) {
    await supabase.auth.getSession()
  }
})
```

---

## 6. Row Level Security (RLS)

Configurer les policies RLS dans Supabase pour securiser les donnees :

```sql
-- Lecture publique des places
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON places FOR SELECT USING (true);

-- Utilisateur peut lire/modifier ses propres donnees
ALTER TABLE places_liked ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User own data" ON places_liked 
  FOR ALL USING (auth.uid()::text = user_id);

-- Idem pour places_bookmarked, places_explored, reviews...
```

---

## 7. Checklist de migration

- [ ] Creer `src/lib/supabase.ts`
- [ ] Modifier `.env` avec les credentials Supabase
- [ ] Remplacer `HttpSessionGateway` par Supabase Auth
- [ ] Remplacer `HttpAccountGateway` par requetes Supabase
- [ ] Remplacer `HttpPlacesQueryGateway` par requetes Supabase
- [ ] Remplacer `HttpPlacesFeedGateway` par requetes Supabase
- [ ] Remplacer `HttpReviewsGateway` par requetes Supabase
- [ ] Adapter `Authenticator` pour utiliser `supabase.auth`
- [ ] Configurer le deep linking pour Magic Link
- [ ] Tester l'authentification Magic Link
- [ ] Tester toutes les requetes de donnees
- [ ] Configurer RLS sur Supabase
- [ ] Supprimer le code HTTP inutilise

---

## 8. Estimation du travail

| Tache | Temps estime |
|-------|--------------|
| Setup Supabase client | 30 min |
| Migration authentification | 2-3h |
| Migration gateways (6 fichiers) | 4-6h |
| Tests et debug | 2-3h |
| **Total** | **8-12h** |

---

## 9. Avantages de la migration

- **Moins de code** : Plus besoin de gerer les tokens manuellement
- **Temps reel** : Possibilite d'ajouter des subscriptions Supabase
- **Securite** : RLS gere au niveau base de donnees
- **Magic Link** : Meilleure UX, pas de mot de passe a retenir
- **Maintenance** : Un seul backend (Supabase) au lieu de deux
