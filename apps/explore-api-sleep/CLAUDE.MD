# CLAUDE.MD — Audit de explore-api

> Analyse architecturale de l'ancien backend NestJS en vue de la migration vers Supabase.
> Date : 8 fevrier 2026

---

## 1. Vue d'ensemble

**Stack** : NestJS + Fastify + MikroORM + PostgreSQL (DigitalOcean) + AWS S3 + BullMQ/Redis + MJML emails
**Architecture** : Clean Architecture / Hexagonal (Ports & Adapters) avec CQRS (@nestjs/cqrs)
**Auteur original** : Anthony Benkhebbab
**Tests** : Vitest (unit + integration avec testcontainers)

### Structure

```
src/
  adapters/
    for-production/     # Implementations concretes (SQL repos, S3, SES, BullMQ, Winston)
    for-tests/          # Implementations de test (in-memory repos, loopback mailer)
  app/
    application/
      commands/          # Write operations (CQRS Command side)
        auth/            # login, register, password reset, change info, delete account
        medias/          # store-as-media, store-as-url, compress-image
        places/          # CRUD places + bookmark/like/explore/view
        reports/         # signalements
        reviews/         # CRUD reviews
      queries/           # Read operations (CQRS Query side)
        get-map-places, get-regular-feed, get-place-by-id, get-banner-feed...
        get-liked/explored/bookmarked/added-places
        get-place-reviews, get-review-by-id
        get-my-informations, get-user-profile
      controllers/       # REST endpoints (Fastify)
      emails/            # Templates MJML (password reset, register, report)
      guards/            # Auth guards (JWT Bearer, PublicRoute, RequiresGuest, RequiresAdmin)
      interceptors/      # DatabaseInterceptor (flush MikroORM), LoggingInterceptor
      ports/             # Interfaces (repositories, services, queues)
      services/          # Auth services (JWT, Argon2, tokens, authorizer)
      viewmodels/        # DTOs de sortie (ApiPlaceDetail, ApiPlaceSummary, ApiReview...)
    domain/
      entities/          # Entites MikroORM (User, Place, PlaceType, Review, ImageMedia...)
      model/             # Value Objects (Role, Rank, Gender, AuthContext, Token)
      builders/          # Builders pour les tests
    libs/
      exceptions/        # Exceptions metier (BadRequest, NotFound, NotAuthorized...)
      i18n/              # Systeme de traduction maison
      mailing/           # Abstraction email (Mail, MailBuilder, MJMLRenderer)
      media/             # Image processing (Sharp)
      places/            # Helpers (PlaceSummaryHelper, ReviewVmMapper)
      shared/            # BaseCommand, pagination, Duration, Optional, types
      storage/           # Storable, events
tests/
  suites/
    functional/          # Tests d'integration (auth, places, medias)
    unit/                # Tests unitaires (auth, media, shared)
  config/                # Setup Docker (testcontainers), fixtures, tester
```

---

## 2. Inventaire des fonctionnalites

### 2.1 Authentification & Utilisateurs

| Fonctionnalite | Fichiers cles | Verdict |
|---|---|---|
| Register (email/password + member code) | `commands/auth/register.ts` | **REMPLACER** par Supabase Auth |
| Login (credentials → JWT access + refresh token) | `commands/auth/login-with-credentials.ts` | **REMPLACER** par Supabase Auth |
| Login (refresh token → nouveau JWT) | `commands/auth/login-with-refresh-token.ts` | **REMPLACER** par Supabase Auth |
| Password reset (code par email) | `commands/auth/begin-password-reset.ts`, `end-password-reset.ts` | **REMPLACER** par Supabase Auth |
| Change password | `commands/auth/change-password.ts` | **REMPLACER** par Supabase Auth |
| Change email | `commands/auth/change-email-address.ts` | **REMPLACER** par Supabase Auth |
| Change informations (profil) | `commands/auth/change-informations.ts` | **GARDER la logique**, adapter au client Supabase |
| Delete account | `commands/auth/delete-account.ts` | **GARDER la logique**, adapter |
| Activate account (member code) | `commands/auth/activate-account.ts` | **A EVALUER** — le systeme de codes membres est-il encore pertinent ? |
| Get my informations | `queries/get-my-informations.ts` | **GARDER**, requete Supabase directe |
| Get user profile | `queries/get-user-profile.ts` | **GARDER**, requete Supabase directe |
| JWT Guard / Authorizer | `guards/`, `services/auth/authorizer/` | **REMPLACER** par Supabase Auth (session-based) |

**Entites concernees** : `User`, `RefreshToken`, `PasswordReset`, `MemberCode`

> **Conclusion Auth** : Tout le systeme d'auth custom (Argon2, JWT maison, refresh tokens, password resets) est **remplace par Supabase Auth**. C'est ~40% du code de l'API. Les tables `refresh_tokens`, `password_resets` et potentiellement `member_codes` disparaissent.

### 2.2 Places (Lieux)

| Fonctionnalite | Fichiers cles | Verdict |
|---|---|---|
| Get map places (all/latest/popular, avec viewport) | `queries/get-map-places.ts` | **GARDER** — logique metier riche |
| Get map banners | `queries/get-map-banners.ts` | **GARDER** |
| Get regular feed (latest/closest/popular, pagine) | `queries/get-regular-feed.ts` | **GARDER** — requetes SQL complexes |
| Get banner feed | `queries/get-banner-feed.ts` | **GARDER** |
| Get place by ID (detail complet) | `queries/get-place-by-id.ts` | **GARDER** — logique riche (metrics, explorers, requester state) |
| Get liked/explored/bookmarked/added places | `queries/get-*.ts` | **GARDER** |
| Get total places | `queries/get-total-places.ts` | **GARDER** (trivial) |
| Create/Update/Delete place | `commands/places/` | **GARDER la logique** |
| Bookmark/Like/Explore/View place | `commands/places/` | **GARDER la logique** |
| Get place types (root + children) | `queries/get-root-place-types.ts`, `get-children-place-types.ts` | **GARDER** |

**Entites concernees** : `Place`, `PlaceType`, `PlaceLiked`, `PlaceBookmarked`, `PlaceExplored`, `PlaceViewed`

> **Conclusion Places** : C'est le **coeur metier** de l'application. Les requetes SQL sont complexes (geo-distance, aggregations, joins multiples). Tout doit etre conserve. La question est : **comment** le porter.

### 2.3 Reviews (Avis)

| Fonctionnalite | Fichiers cles | Verdict |
|---|---|---|
| Create/Update/Delete review | `commands/reviews/` | **GARDER** |
| Get place reviews (pagine) | `queries/get-place-reviews.ts` | **GARDER** |
| Get review by ID | `queries/get-review-by-id-query.ts` | **GARDER** |

**Entites concernees** : `Review` (avec relation ManyToMany vers `ImageMedia`)

### 2.4 Medias (Images)

| Fonctionnalite | Fichiers cles | Verdict |
|---|---|---|
| Upload image → S3 + compression async (BullMQ) | `commands/medias/`, `services/media/` | **REMPLACER** par Supabase Storage |
| Store as media (avec variantes webp/png) | `store-as-media.ts` | **REMPLACER** — Supabase Storage + image transforms |
| Store as URL (upload simple) | `store-as-url.ts` | **REMPLACER** par Supabase Storage |
| Image compression worker (Sharp → variantes) | `image-processing-worker.ts` | **REMPLACER** par Supabase Image Transformations |

**Entites concernees** : `ImageMedia` (variantes JSON)

> **Conclusion Medias** : Le systeme de variantes (original, webp_small, png_medium, etc.) stockees dans S3 avec compression async via BullMQ est **entierement remplacable** par Supabase Storage + Image Transformations on-the-fly. C'est un gain enorme en complexite.

### 2.5 Emails

| Fonctionnalite | Fichiers cles | Verdict |
|---|---|---|
| Password reset email (MJML) | `emails/begin-password-reset-email.ts` | **REMPLACER** par Supabase Auth emails |
| Registration email | `emails/registered-email.ts` | **REMPLACER** par Supabase Auth emails |
| Report email | `emails/report-email.ts` | **A EVALUER** — garder si signalements restent |
| Systeme de mailing (SES/Nodemailer/BullMQ queue) | `adapters/for-production/services/` | **REMPLACER** par Supabase Edge Functions si besoin |

### 2.6 Infrastructure

| Composant | Verdict |
|---|---|
| MikroORM (ORM + migrations) | **REMPLACER** par Supabase migrations SQL |
| BullMQ + Redis (queues async) | **SUPPRIMER** — plus necessaire |
| AWS S3 | **REMPLACER** par Supabase Storage |
| AWS SES / Nodemailer | **REMPLACER** par Supabase Auth emails + Edge Functions |
| Winston logging | **REMPLACER** par Supabase logs / console |
| Docker / docker-compose | **SUPPRIMER** pour le dev (Supabase CLI) |
| Pinggy tunneling | **SUPPRIMER** |

---

## 3. Ce qui est EXCELLENT et a conserver (logique metier)

### 3.1 Requetes geospatiales et feeds

Les queries dans `get-map-places.ts`, `get-regular-feed.ts`, `get-banner-feed.ts` contiennent de la **logique SQL complexe et optimisee** :
- Calcul de distance Haversine pour le tri par proximite
- Filtrage par viewport (lat/lng delta)
- Aggregation des vues, likes, notes moyennes
- Pagination

**Recommandation** : Porter ces requetes en **fonctions RPC Supabase** (`CREATE FUNCTION ... LANGUAGE plpgsql`). Le SQL brut est deja ecrit, il suffit de l'encapsuler.

### 3.2 Viewmodels / DTOs

Les types dans `viewmodels/` definissent un **contrat d'API propre** :
- `ApiPlaceDetail` — vue complete d'un lieu (metrics, explorers, requester state)
- `ApiPlaceSummary` — vue carte/liste
- `ApiPlaceMap` — vue marqueur carte
- `ApiReview` — vue avis avec images
- `ApiPlaceType` — categories avec images et couleurs

**Recommandation** : **Reutiliser ces types TypeScript** cote client (explore-web / explore-mobile). Ils constituent le contrat de donnees.

### 3.3 Modele de donnees Places

Le schema de donnees des places est riche et bien pense :
- `Place` : title, text, address, lat/lng, images (JSON), accessibility, sensible, private, masked, beginAt/endAt
- `PlaceType` : hierarchique (parent/children), avec images (background, regular, map, local), couleurs, ordre
- Actions utilisateur : liked, bookmarked, explored, viewed (tables pivot)

**Recommandation** : **Conserver le schema tel quel** dans Supabase. Les tables existent deja.

### 3.4 Validation Zod

Chaque commande/query valide ses inputs avec Zod. C'est propre et reutilisable cote client.

**Recommandation** : Extraire les schemas Zod dans un package partage du monorepo.

### 3.5 Pattern BaseCommand

Le pattern `BaseCommand<TProps>` avec validation, auth context et headers est elegant.

**Recommandation** : Pas directement reutilisable (c'est du NestJS CQRS), mais l'idee de valider systematiquement les inputs est a conserver.

---

## 4. Ce qui est OBSOLETE et a supprimer

| Composant | Raison |
|---|---|
| **Tout le systeme d'auth** (~18 fichiers) | Supabase Auth gere tout (Magic Link, sessions, tokens) |
| **RefreshToken entity + repository** | Supabase Auth gere les sessions |
| **PasswordReset entity + repository** | Supabase Auth gere le reset |
| **MemberCode entity + repository** | A evaluer si le systeme de codes est encore utilise |
| **ImageMedia entity + variantes** | Supabase Storage + Image Transformations |
| **BullMQ workers** (image compression, email queue) | Plus de queue necessaire |
| **S3Storage adapter** | Supabase Storage |
| **SES/Nodemailer mailers** | Supabase Auth emails + Edge Functions |
| **MikroORM config + migrations** | Supabase migrations SQL |
| **DatabaseInterceptor** (flush ORM) | Pas d'ORM avec Supabase client |
| **NestJS module system** (app-module.ts, 652 lignes de DI) | Plus de serveur NestJS |
| **Docker / docker-compose** | Supabase CLI pour le dev |
| **Certificate.crt** (DigitalOcean SSL) | Supabase gere le SSL |

---

## 5. Plan de migration recommande

### Phase 1 — Schema de donnees (FAIT en partie)

Les tables `users`, `places`, `place_types`, `reviews`, `places_liked`, `places_bookmarked`, `places_explored`, `places_viewed` existent deja dans Supabase (migrees depuis DigitalOcean). Les colonnes HUB ont ete ajoutees (`role`, `display_name`, `bio`, `avatar_url`, etc.).

**Reste a faire** :
- Verifier que `image_media` et `reviews_images` (table pivot) sont migrees
- Ajouter les RLS policies pour les tables places/reviews/actions
- Migrer les donnees `place_types` (categories avec images et couleurs)

### Phase 2 — Fonctions RPC pour les queries complexes

Porter les requetes SQL de `get-map-places`, `get-regular-feed`, `get-place-by-id`, etc. en fonctions RPC Supabase :

```sql
-- Exemple : get-map-places (popular)
CREATE FUNCTION get_map_places_popular(p_limit INT DEFAULT 100)
RETURNS TABLE (id TEXT, title TEXT, latitude FLOAT, longitude FLOAT, place_type JSONB, views_count BIGINT)
AS $$ ... $$;

-- Exemple : get-regular-feed (closest)
CREATE FUNCTION get_regular_feed_closest(p_lat FLOAT, p_lng FLOAT, p_limit INT, p_offset INT)
RETURNS TABLE (...) AS $$ ... $$;
```

### Phase 3 — Actions utilisateur

Les actions (like, bookmark, explore, view) deviennent de simples INSERT/DELETE via le client Supabase avec RLS :

```typescript
// Avant (NestJS CQRS)
await commandBus.execute(new LikePlaceCommand(context, { placeId }))

// Apres (Supabase direct)
await supabase.from('places_liked').insert({ user_id: user.id, place_id: placeId })
```

### Phase 4 — Reviews

Les reviews in-app (score, message, geocache, images) sont distinctes des `hub_review_submissions` (formulaire public). Les deux systemes coexistent.

### Phase 5 — Storage

Remplacer S3 + Sharp + BullMQ par Supabase Storage. Les URLs d'images existantes (S3) restent valides, les nouvelles vont dans Supabase Storage.

---

## 6. Fichiers a conserver comme reference

| Fichier | Pourquoi |
|---|---|
| `domain/entities/place.ts` | Schema de reference pour Place |
| `domain/entities/place-type.ts` | Schema PlaceType (hierarchie, images, couleurs) |
| `domain/entities/review.ts` | Schema Review |
| `domain/entities/user.ts` | Schema User complet (champs originaux) |
| `application/viewmodels/*` | Contrats d'API (types TypeScript reutilisables) |
| `application/queries/get-map-places.ts` | SQL geospatial a porter en RPC |
| `application/queries/get-regular-feed.ts` | SQL feed pagine a porter en RPC |
| `application/queries/get-place-by-id.ts` | SQL detail lieu a porter en RPC |
| `application/queries/get-place-reviews.ts` | SQL reviews paginee |
| `libs/places/place-summary-helper.ts` | Helper de mapping reutilisable |
| `libs/places/review-vm-mapper.ts` | Mapper review → ViewModel |
| `libs/shared/pagination.ts` | Types pagination reutilisables |
| `domain/model/auth-context.ts` | Pattern AuthContext (adaptable a Supabase Auth) |
| `libs/exceptions/*` | Pattern d'exceptions metier |

---

## 7. Metriques

| Metrique | Valeur |
|---|---|
| Fichiers source (src/) | ~269 |
| Fichiers de test | ~79 |
| Entites domaine | 12 |
| Controllers | 15 |
| Commands | ~27 |
| Queries | ~16 |
| Repositories (ports) | 12 |
| Services (ports) | 7 |
| Viewmodels | 11 |

**Estimation de code a supprimer** : ~60% (auth, infra, ORM, queues, storage adapters)
**Estimation de code a porter** : ~30% (queries SQL, logique places/reviews, viewmodels)
**Estimation de code a garder tel quel** : ~10% (types, schemas Zod, helpers)

---

## 8. Risques et points d'attention

1. **Donnees S3 existantes** — Les images des places et reviews sont sur S3 (URLs en `gdv-*.s3.*.amazonaws.com`). Il faut soit garder l'acces S3 en lecture, soit migrer les fichiers vers Supabase Storage.

2. **ImageMedia et variantes** — Le systeme actuel stocke plusieurs variantes (webp_small, png_medium, etc.) dans un champ JSON. Avec Supabase Image Transformations, on stocke l'original et on genere les variantes a la volee. Les anciennes URLs de variantes restent valides sur S3.

3. **Member codes** — Le systeme de codes d'activation (`member_codes`) permet de passer de `guest` a `member`. A decider si ce mecanisme est encore pertinent ou s'il est remplace par le systeme de roles du HUB.

4. **Geocaching** — Les reviews ont un flag `geocache`. C'est une feature specifique a conserver.

5. **Place visibility** — Les places ont des flags `private`, `masked`, `sensible` et les PlaceTypes ont un flag `hidden`. Les RLS policies doivent en tenir compte.

6. **Requetes N+1** — Certaines queries (comme `get-map-places`) font des sous-requetes par place pour le `requester` state. A optimiser avec des JOINs ou des fonctions RPC.

---

## 9. Verdict final

L'architecture de explore-api est **professionnelle et bien structuree** (Clean Architecture, CQRS, Ports & Adapters, tests). Cependant, **~60% du code est de l'infrastructure** qui est nativement geree par Supabase (auth, storage, queues, ORM, emails).

**Ce qui a de la valeur et serait dommage de perdre** :
- Les **requetes SQL geospatiales** (distance Haversine, viewport filtering, aggregations)
- Les **viewmodels TypeScript** (contrat d'API)
- Le **schema de donnees** des places et place_types (riche et bien pense)
- La **logique metier** des actions utilisateur (like/bookmark/explore/view avec etat requester)

**Ce qui est remplacable sans regret** :
- Tout le systeme d'auth custom
- Le pipeline de traitement d'images (S3 + Sharp + BullMQ)
- Le systeme d'emails (SES/Nodemailer + MJML + queue)
- L'infrastructure NestJS (DI, modules, interceptors, guards)

**Strategie recommandee** : Extraire les requetes SQL et les types, les porter en fonctions RPC Supabase et types partages dans le monorepo. Le reste du code NestJS peut etre archive.
