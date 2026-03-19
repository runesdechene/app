# La Carte — Runes de Chêne

> Dernière mise à jour : 20 mars 2026

## RÈGLE N°0 — Ce fichier est la mémoire du projet

**Ce CLAUDE.md est un document vivant.** À chaque session, le XO DOIT le mettre à jour quand :
- Une **migration SQL** est créée → mettre à jour Tables, RPCs, Triggers, Indexes
- Un **composant** est créé, renommé ou supprimé → mettre à jour l'arborescence
- Un **store** change de shape → mettre à jour la section Stores
- Un **hook** est ajouté/modifié → mettre à jour la section Hooks
- Une **RPC** est ajoutée ou modifiée → mettre à jour RPCs + mapping RPC↔Frontend
- Un **bug connu** est corrigé → le retirer de la liste. Un nouveau est trouvé → l'ajouter
- Du **code mort** est nettoyé → le retirer de la liste

**Quand mettre à jour :** immédiatement après chaque changement stable (pas en plein WIP).
**Comment :** utiliser l'outil Edit pour modifier la section concernée, puis mettre à jour la date en haut.
**Ne jamais :** refaire un audit complet. Tenir le fichier à jour incrémentalement.

---

## Boussole — Relire à chaque session

**On vend : de l'Appartenance et de la Découverte**

Pense à relire : 

**Le gameplay / la vision à terme** 
`\\EGIDE\Runes de Chêne\👑 LA CITADELLE\📱 L'application (Conquête)\🎮 Bible Game Design.md`
ou si EGIDE non dispo, demander la position de l'OBSIDIAN CITADELLE

**La vision globale de l'application (Conquête)** 
`\\EGIDE\Runes de Chêne\👑 LA CITADELLE\📋VUE - L'application (Conquête)` 
ou si EGIDE non dispo, demander la position de l'OBSIDIAN CITADELLE

### Règles

1. **Moindre friction** — Si ça bloque ou prend du temps, c'est inutile ou mal abordé
2. **Pareto** — 20% d'effort pour 80% de résultat


## Stack technique

| Couche | Techno |
|--------|--------|
| Runtime | Node.js |
| Package manager | pnpm (workspaces) |
| Language | TypeScript strict |
| Framework | React 18 (types) — React 19 installé via pnpm overrides |
| Build | Vite 5, target es2022, PWA via vite-plugin-pwa |
| Backend | Supabase (PostgreSQL 17, Auth OTP, Storage, RPC, RLS, Realtime) |
| Carte | MapLibre GL JS + OpenFreeMap (tuiles gratuites) |
| Géo | Turf.js (union, buffer, intersect, simplify, difference, distance) |
| Territoires | d3-delaunay (Voronoi) + Web Worker |
| State | Zustand (6 stores) |
| Styles | Tailwind CSS 4 + App.css monolithique |
| Déploiement | Netlify CLI manuel (pas d'auto-deploy Git) |

## Conventions

- **pnpm** — jamais npm ni yarn
- **TypeScript strict** — pas de `any`
- **Conventional Commits** — `feat:`, `fix:`, `chore:`, `docs:`
- **Pas de code mort** — si c'est unused, on supprime
- **Pas d'over-engineering** — simple, direct, fonctionnel
- **Migrations SQL** — fichiers numérotés dans `supabase/migrations/` (002→097)
- **RPCs** — logique métier côté serveur via `SECURITY DEFINER` functions

## Commandes

```bash
# Dev
pnpm dev                # Lance explore-web (port 3000)

# Build
pnpm build              # tsc && vite build

# Déploiement (TOUJOURS manuel, chemin ABSOLU obligatoire)
cd apps/explore-web && netlify deploy --prod --dir "%CD%\dist" --no-build

# Supabase
npx supabase start      # Supabase local
npx supabase db push    # Appliquer les migrations
```

## Variables d'environnement

Fichier `.env` à la racine du monorepo :
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

---

## Architecture

```
src/
├── App.tsx              # Orchestrateur principal (~15 modals/panels)
├── App.css              # Styles médiévaux (monolithique, ~2000 lignes)
├── components/
│   ├── map/
│   │   ├── ExploreMap.tsx        # Carte MapLibre + territoires (~1093 lignes)
│   │   ├── EnergyIndicator.tsx   # Jauge énergie + regen timer
│   │   ├── ResourceIndicator.tsx # Jauge conquête OU construction
│   │   ├── FactionBar.tsx        # Scoreboard factions (notoriété)
│   │   ├── FactionMembersModal.tsx
│   │   ├── ConquestToggle.tsx    # Switch exploration/conquête
│   │   ├── GameToast.tsx         # Toasts in-game temps réel
│   │   ├── InfoModal.tsx         # Modal info ressources
│   │   ├── PlayerProfileModal.tsx # Profil joueur + édition
│   │   ├── LeaderboardModal.tsx  # Classements (cache 30s)
│   │   ├── TerritoryPanel.tsx    # Détail territoire + vote nom
│   │   ├── Minimap.tsx           # Canvas minimap
│   │   ├── MobileHeader.tsx      # Header mobile
│   │   ├── MobileNavbar.tsx      # Nav mobile (Carte/Activité/Chat/Profil)
│   │   └── VersionBadge.tsx      # Changelog modal
│   ├── places/
│   │   ├── PlacePanel.tsx        # Fiche lieu (~1043 lignes)
│   │   └── AddPlaceFlow.tsx      # Création de lieu + upload photos
│   ├── auth/
│   │   ├── AuthModal.tsx         # Login OTP email
│   │   ├── FactionModal.tsx      # Choix/changement faction
│   │   ├── OnboardingModal.tsx   # Setup profil initial
│   │   ├── ProfileMenu.tsx       # Menu profil desktop
│   │   ├── GameModeModal.tsx     # Choix mode de jeu
│   │   └── EmailChangeModal.tsx  # Changement email
│   ├── chat/
│   │   └── ChatPanel.tsx         # Chat 3 canaux + cheat codes admin
│   └── pwa/
│       ├── InstallPrompt.tsx     # PWA install banner
│       └── OfflineIndicator.tsx  # Indicateur hors-ligne
├── hooks/
│   ├── useAuth.ts               # Auth Supabase + session
│   ├── usePlayer.ts             # Boot sequence (4 RPCs // + realtime)
│   ├── usePlace.ts              # Fetch détail lieu
│   ├── usePlaces.ts             # Fetch TOUS les lieux (get_map_places)
│   ├── usePresence.ts           # Presence joueurs en ligne
│   ├── useChat.ts               # Chat 3 canaux + realtime
│   └── useConstructionTypes.ts  # Types fortification (cache module)
├── stores/
│   ├── playerStore.ts           # Joueur : resources, faction, notoriété, admin
│   ├── mapStore.ts              # Carte : selection, flyTo, overrides, mode
│   ├── toastStore.ts            # File de toasts in-game
│   ├── chatStore.ts             # Messages 3 canaux
│   ├── mobileNavStore.ts        # Panel mobile actif
│   └── playersStore.ts          # Joueurs en ligne (Map<id, player>)
├── workers/
│   └── territoryWorker.ts       # Voronoi + clip + union (Web Worker)
├── lib/
│   ├── supabase.ts              # Client Supabase (NON typé)
│   ├── map-icons.ts             # Pipeline SVG : cache, colorize, shift, ImageData
│   ├── map-layers.ts            # Définitions layers MapLibre
│   └── map-style.ts             # Styles de carte (game/detailed/satellite)
└── types/
    └── database.types.ts        # Types générés (STALE, jamais importé)
```

---

## Gameplay — La Carte

### Factions

Joueurs → faction. Chaque faction : titre, couleur, pattern SVG. Territoires = zones Voronoi colorées par faction sur la carte.

### 3 ressources (régénération par ticks)

| Ressource | Regen | Max | Usage |
|-----------|-------|-----|-------|
| Énergie ⚡ | +1/7200s | 5 + bonus | Découvrir des lieux |
| Conquête ⚔️ | +1/14400s | 5 + bonus | Revendiquer des lieux |
| Construction 🔨 | +1/14400s | 5 + bonus | Fortifier des lieux |

### Fog of War

Lieux non découverts = masqués. Coût : 1.0 énergie remote (0.5 même faction), gratuit GPS < 500m.

### Actions joueur

| Action | RPC | Coût | Gain notoriété | Effet |
|--------|-----|------|----------------|-------|
| Découvrir | `discover_place` | Énergie | — | Débloque lieu + récompenses tag |
| Revendiquer | `claim_place` | 1 + fortif. level conquête | +10 | Change faction du lieu, reset fortif. |
| Fortifier | `fortify_place` | Selon niveau (1→5) construction | +5 | Monte le niveau de défense (0→4) |
| Créer un lieu | `create_place` | Gratuit | — | Auto-claim si faction |

### Fortification (5 niveaux : 0→4)

| Niveau | Nom | Coût construction | Coût conquête ennemi | Bonus influence |
|--------|-----|-------------------|----------------------|-----------------|
| 0 | — | — | 1 | +0 |
| 1 | Tour de guet | 1 | 2 | +10 |
| 2 | Tour de défense | 2 | 3 | +20 |
| 3 | Bastion | 3 | 4 | +30 |
| 4 | Forteresse | 5 | 5 | +60 |

### Notoriété

- **Personnelle** : `users.notoriety_points` (+10 claim, +5 fortify)
- **Faction** : `get_faction_notoriety()` — `floor(heures_tenues) * (1 + fortif * 0.5)`

### Territoires

- Voronoi via d3-delaunay + Turf.js dans un Web Worker
- Chaque faction : union de cercles autour des lieux contrôlés
- Taille cercle = basée sur le **score d'influence** (voir ci-dessous)
- Labels = nom voté par les joueurs (`territory_votes`)
- Noms de territoire : max **2 propositions** par joueur, suppression possible de ses propres propositions

### Score d'influence (rayon territoire)

Le rayon d'un lieu sur la carte dépend de son score d'influence :

**Formule rayon :** `0.25 + √(score - 1) × 0.65` km

**Score = likes×1 + vues×0.1 + explorations×3 + bonus fortification**

| Fortification | Bonus score |
|---|---|
| Tour de guet (niv.1) | +10 |
| Tour de défense (niv.2) | +20 |
| Bastion (niv.3) | +30 |
| Forteresse (niv.4) | +60 |

Le bonus de fortification est **perdu** quand le lieu est conquis (reset à 0).

**Important :** côté serveur (`territory_radius_km`), le rayon est multiplié par **0.6** pour compenser le clipping Voronoi. Les territoires visuels sont clippés par les cellules Voronoi, donc le rayon réel est plus petit que le cercle théorique. Sans cette compensation, le blob serveur incluait des lieux visuellement non-connectés.

**Debug admin :** un bloc "DEBUG TERRITOIRE" apparaît dans le PlacePanel pour les admins, montrant le détail du calcul (likes, vues, explo, fortif, score effectif, rayon, ID du lieu).
- Emblèmes faction (étendards) aux centroïdes, badges fort sur lieux fortifiés
- Rendu 100% GPU via symbol layers MapLibre (plus de DOM markers)
- `enrichedGeojson` dans ExploreMap applique les `placeOverrides` (fortif, faction, score) aux features pour mise à jour temps réel des icônes

### Migrations récentes (session 19-20 mars 2026)

| Migration | Description |
|---|---|
| 099 | Bonus territoire par fortification (10/20/30/60) |
| 100 | Profil joueur : LIMIT 50 → 500 sur les lieux |
| 101 | Rebalance influence : likes×1, vues×0.1, explo×3 |
| 102 | Propositions territoire : max 2, suppression possible |
| 103 | Compensation Voronoi : rayon serveur ×0.6 |

---

## Base de données — État final (post-migration 097)

### Tables principales

| Table | Colonnes clés | Rôle |
|-------|---------------|------|
| `users` | id, email, avatar_url, faction_id, energy/conquest/construction + reset_at + cycle + max + bonus, notoriety_points, game_mode, is_admin, bio, instagram | Joueurs |
| `places` | id, name, description, lat/lng, address, images[], author_id, faction_id, claimed_by, claimed_at, fortification_level, score, total_votes | Lieux (2400+) |
| `factions` | id, title, color, pattern, icon, description, created_by | Factions jouables |
| `tags` | id, name, color, icon, reward_energy/conquest/construction | Tags de lieux |
| `place_tags` | place_id, tag_id, is_primary | Liaison lieu↔tag |
| `places_discovered` | user_id, place_id, discovered_at | Fog of war |
| `place_claims` | id, place_id, user_id, faction_id, claimed_at | Historique conquêtes |
| `activity_log` | id, type, actor_id, place_id, faction_id, data, created_at | Feed temps réel (Realtime) |
| `chat_messages` | id, user_id, user_name, avatar_url, faction_id, channel, content, created_at | Chat (general/faction/bugs) |
| `territory_votes` | id, faction_id, anchor_place_id, proposed_name, user_id, created_at | Vote noms territoires |
| `territory_tiers` | id, minPlaces, radiusKm, label | Paliers taille territoires |
| `construction_types` | id, level, name, cost, defense_bonus, description | Définitions fortification |
| `app_settings` | key, value | Config jeu (zone_fort_multiplier, etc.) |
| `place_photos` | id, place_id, user_id, url, created_at | Photos communautaires |
| `reviews` | id, user_id, place_id, rating, comment | Avis (hub) |
| `places_liked` | user_id, place_id | Likes |
| `places_viewed` | user_id, place_id, viewed_at | Vues |
| `places_explored` | user_id, place_id, explored_at | Explorations |
| `places_bookmarked` | user_id, place_id | Favoris |

### RPCs — Liste complète

#### Game Core
| RPC | Params | Retour | Logique |
|-----|--------|--------|---------|
| `discover_place` | target_place_id, is_gps | json | Coût énergie, insert places_discovered, récompenses tag, +activity_log |
| `claim_place` | target_place_id | json | Coût conquête (1+fortif), change faction/claimed_by, reset fortif, +10 notoriété |
| `fortify_place` | target_place_id, ct_id | json | Coût construction, monte level, +5 notoriété, +activity_log |
| `get_user_energy` | — | json | 3 ressources + regen ticks + bonus + notoriété |
| `get_user_discoveries` | — | setof uuid | IDs lieux découverts par le joueur |

#### Map & Feed
| RPC | Params | Retour | Logique |
|-----|--------|--------|---------|
| `get_map_places` | lim | json[] | Tous les lieux avec coords, faction, tags, scores |
| `get_faction_notoriety` | — | json[] | Score temporel par faction (heures × fortif) |
| `get_recent_activity` | — | json[] | Dernières entrées activity_log |
| `get_winning_territory_names` | — | json[] | Noms gagnants par territoire |

#### Place Detail
| RPC | Params | Retour | Logique |
|-----|--------|--------|---------|
| `get_place_by_id` | target_place_id | json | Détail complet (auteur, tags, images, claim, fortif, scores) |
| `like_place` | p_place_id | void | Insert places_liked + activity_log |
| `unlike_place` | p_place_id | void | Delete places_liked |
| `get_place_likers` | p_place_id | json[] | Liste des likers (avatar_url) |
| `get_place_explorers` | p_place_id | json[] | Liste des explorateurs (avatar_url) |
| `explore_place` | p_place_id | void | Insert places_explored + activity_log |
| `create_place` | name, desc, lat, lng, ... | json | Crée lieu + tag primaire + auto-claim si faction + activity_log |
| `delete_place` | p_place_id | void | Supprime lieu (admin) |

#### Profile & Users
| RPC | Params | Retour | Logique |
|-----|--------|--------|---------|
| `get_my_informations` | — | json | Profil complet du joueur connecté |
| `get_player_profile` | p_user_id | json | Profil public (avatar_url, stats, notoriété, lieux) |
| `update_my_profile` | name, bio, instagram, avatar_url, game_mode | void | Mise à jour profil |
| `get_user_titles` | — | json | Titres débloqués + affichés |
| `set_displayed_titles` | titles | void | Choix des titres affichés (max 2) |
| `set_user_faction` | p_faction_id | void | Rejoint/change de faction |
| `get_leaderboard` | tab | json[] | Classement (avatar_url, notoriété/authored/explored) |
| `get_faction_members` | p_faction_id | json[] | Membres d'une faction (avatar_url, stats) |
| `get_construction_types` | — | json[] | Liste des types de fortification |

#### Territory Naming
| RPC | Params | Retour | Logique |
|-----|--------|--------|---------|
| `get_territory_votes` | p_faction_id, p_anchor_place_id | json[] | Propositions + votes pour un territoire |
| `propose_territory_name` | p_faction_id, p_anchor_place_id, p_name | json | Nouvelle proposition (1 par joueur par territoire) |
| `vote_territory_name` | p_vote_id | json | Vote (1 par joueur par territoire) |

#### Chat & Admin
| RPC | Params | Retour | Logique |
|-----|--------|--------|---------|
| `cleanup_old_chat_messages` | — | void | Supprime messages > 7 jours |
| `cheat_refill` | — | void | Admin : recharge ses propres ressources |
| `cheat_refill_target` | target_name | void | Admin : recharge ressources d'un joueur |

### Triggers actifs

| Trigger | Table | Event | Action |
|---------|-------|-------|--------|
| `trg_log_claim` | `place_claims` | AFTER INSERT | Insère dans activity_log (type 'claim') |
| `trg_check_titles` | `users` | AFTER UPDATE of notoriety_points | Débloque titres selon seuils |

### Channels Realtime (frontend)

| Channel | Type | Source | Usage |
|---------|------|--------|-------|
| `activity-feed` | Postgres Changes INSERT | `activity_log` | Toasts in-game (claims, discovers, likes, etc.) |
| `chat-general` | Postgres Changes INSERT | `chat_messages` (channel=general) | Chat général |
| `chat-faction` | Postgres Changes INSERT | `chat_messages` (channel=faction) | Chat faction |
| `chat-bugs` | Postgres Changes INSERT | `chat_messages` (channel=bugs) | Chat bugs |
| `map-presence` | Presence | — | Joueurs en ligne sur la carte |

### Storage Buckets

> **⚠️ Un seul bucket `place-images` pour tout** (mal nommé historiquement).
> Il n'existe PAS de bucket `avatars`. Ne jamais faire `.from('avatars')`.

| Bucket | Contenu | Chemin | Policy DELETE |
|--------|---------|--------|---------------|
| `place-images` | Avatars joueurs | `{userId}/avatar.webp` | `foldername[1] = auth.uid()` ✅ |
| `place-images` | Photos de lieux | `{placeId}/{filename}` | `foldername[1] = auth.uid()` |
| `community-photos` | Soumissions hub | — | — |
| `app-assets` | Icônes globales | — | — |
| `tag-icons` | Icônes de tags | — | — |
| `faction-patterns` | Patterns factions | — | — |

> **Pas de `upsert: true`** pour les avatars — la policy DELETE exige que le premier dossier du chemin = userId.
> Toujours faire `remove([path])` puis `upload()` séparément.

---

## Stores Zustand (6)

### playerStore — État joueur
```
discoveredIds, userId, userName, userAvatarUrl,
userFactionId/Color/Title/Pattern, factionTitle2,
energy/maxEnergy/energyCycle, conquestPoints/maxConquest/conquestCycle,
constructionPoints/maxConstruction/constructionCycle,
bonusEnergy/bonusConquest/bonusConstruction,
notorietyPoints, unlockedTitles, displayedTitles,
gameMode ('exploration'|'conquest'), isAdmin, loading, userPosition
```

### mapStore — État carte
```
selectedPlaceId, selectedPlayerId, pendingFlyTo, pendingZoom,
placeOverrides (Map), deletedPlaceIds (Set), addPlaceMode,
pendingNewPlaceCoords, placesRefreshKey, mapStyleMode ('game'|'detailed'|'satellite'),
selectedTerritoryData, territoryNames (Map)
```

### chatStore — Chat
```
showGeneral/showFaction/showBugs (filtres), sendChannel,
generalMessages/factionMessages/bugsMessages (ChatMessage[], max 100/canal)
```

### toastStore — Toasts in-game
```
toasts (GameToast[]) — types: claim/discover/explore/new_place/new_user/like/fortify
Chaque toast: message, highlights, color (faction), highlightColors, actorId, previousActorId
```

### playersStore — Joueurs en ligne
```
players (Map<string, OnlinePlayer>) — id, name, avatar, faction, lat/lng, last_seen
```

### mobileNavStore — Navigation mobile
```
activePanel ('notifications'|'chat'|'profile'|null), notificationsSeenAt, chatSeenAt
```

---

## RPC ↔ Frontend — Qui appelle quoi

| Fichier | RPCs appelées |
|---------|---------------|
| `usePlayer.ts` | get_user_discoveries, get_user_energy, get_my_informations, get_user_titles, get_recent_activity, discover_place, set_displayed_titles |
| `usePlaces.ts` | get_map_places |
| `usePlace.ts` | get_place_by_id |
| `useChat.ts` | cleanup_old_chat_messages |
| `useConstructionTypes.ts` | get_construction_types |
| `ExploreMap.tsx` | get_winning_territory_names + direct SELECT territory_tiers, app_settings |
| `EnergyIndicator.tsx` | get_user_energy |
| `ResourceIndicator.tsx` | get_user_energy |
| `FactionBar.tsx` | get_faction_notoriety |
| `FactionMembersModal.tsx` | get_faction_members + direct SELECT factions |
| `PlayerProfileModal.tsx` | get_player_profile, update_my_profile |
| `LeaderboardModal.tsx` | get_leaderboard |
| `TerritoryPanel.tsx` | get_territory_votes, propose_territory_name, vote_territory_name + direct SELECT places, places_liked, place_tags |
| `PlacePanel.tsx` | like/unlike_place, get_place_likers/explorers, explore_place, delete_place, claim_place, fortify_place + direct SELECT app_settings |
| `AddPlaceFlow.tsx` | create_place + direct INSERT/UPDATE places, place_tags + SELECT tags |
| `ConquestToggle.tsx` | update_my_profile |
| `FactionModal.tsx` | set_user_faction + direct SELECT factions, users |
| `OnboardingModal.tsx` | update_my_profile |
| `GameModeModal.tsx` | update_my_profile |
| `ProfileMenu.tsx` | get_my_informations |
| `MobileHeader.tsx` | get_my_informations |
| `ChatPanel.tsx` | cheat_refill, cheat_refill_target + direct INSERT chat_messages |

---

## Bugs corrigés (session 19-20 mars 2026)

- **Nom territoire "Nom incertain"** : le `customName` n'était pas résolu au clic sur un territoire polygon (seulement sur les emblèmes). Corrigé dans ExploreMap.tsx — résolution depuis le store `territoryNames` au moment du clic.
- **Fortification pas mise à jour en temps réel sur la carte** : `PlaceOverride` ne supportait pas `fortificationLevel`. Ajouté dans mapStore + ClaimButton (reset à 0) + FortifyButton (nouveau niveau). Le `enrichedGeojson` dans ExploreMap applique les overrides aux features pour le rendu des icônes/badges.
- **Bouton Fortifier absent après conquête** : le PlacePanel ne se rafraîchissait pas après un claim. Ajouté `refetch` dans usePlace, passé via `onClaimed` callback de ClaimButton → PlaceContent → DiscoveredPlaceContent.
- **Blob serveur incluait des lieux visuellement non-connectés** : `territory_radius_km` utilisait le rayon théorique complet, mais le frontend clippe les cercles par Voronoi. Ajouté facteur ×0.6 dans la RPC (migration 103).
- **Profil joueur limité à 50 lieux** : `get_player_profile` avait `LIMIT 50` sur les 3 requêtes de lieux. Monté à 500 (migration 100).
- **Propositions territoire limitées à 3** : réduit à **2 max** par joueur par territoire. Ajouté bouton de suppression de ses propres propositions (migration 102).

## Bugs connus

### CRITIQUES

1. **`claim_place` (migration 091) a perdu des fonctionnalités** :
   - N'insère plus dans `place_claims` → historique conquêtes cassé, trigger `trg_log_claim` mort
   - N'auto-discover plus le lieu dans `places_discovered`
   - Ne renvoie plus les timers de regen (conquestNextPointIn, constructionNextPointIn)

### MAJEURS

2. **RLS trop permissive** : `app_settings` et `factions` modifiables par tout utilisateur authentifié (devrait être admin-only)
3. **`get_my_informations` appelé 3 fois** : usePlayer + ProfileMenu + MobileHeader font 3 requêtes identiques au lieu de lire le store

### Performance

4. **ExploreMap.tsx (~1100 lignes)** : composant monolithique, impossible à optimiser par parties
5. **PlacePanel.tsx (~1050 lignes)** : idem, sous-composants inline qui re-render ensemble
6. **App.tsx est un God component** : ~15 states boolean, chaque changement re-évalue tout
7. **usePlaces charge les 5000 lieux d'un coup** : pas de viewport-based loading
8. **Territory Worker recalcule tout** à chaque changement (pas d'update incrémental)

---

## Code mort à nettoyer

| Fichier/Export | Statut |
|----------------|--------|
| `components/AuthCallback.tsx` | Jamais importé |
| `components/AuthForm.tsx` | Remplacé par AuthModal.tsx |
| `components/UserProfile.tsx` | Remplacé par PlayerProfileModal.tsx |
| `hooks/useSupabaseConnection.ts` | Jamais importé |
| `lib/supabase.ts` → `testConnection()`, `fetchTables()` | Utilisés uniquement par le hook mort |
| `types/database.types.ts` | Stale, jamais importé (13 tables vs 22 réelles) |
| `packages/supabase-client/` | Package partagé typé, jamais importé par les apps |
| RPCs orphelines | `log_fortify_activity`, `get_user_profile`, `reset_user_energy` |
| `haversineM()` dupliqué | PlacePanel.tsx + TerritoryPanel.tsx (identique) |
