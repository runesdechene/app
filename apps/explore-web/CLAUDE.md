# La Carte — Runes de Chêne (V0.4 — L'Érudition Conquérante)

> Dernière mise à jour : 29 mars 2026

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

**Philosophie V0.4 :** On ne conquiert plus par la force, on conquiert par la dignité culturelle.
Les factions sont des **Héritages** culturels. Les joueurs sont des **gardiens** du patrimoine, pas des conquérants.

Pense à relire :

**La vision V3.2 (L'Érudition Conquérante)**
`\\EGIDE\Runes de Chêne\👑 LA CITADELLE\📱 L'application (Conquête)\🎮 V3.2 — L'Érudition Conquérante.md`

**Le document d'Alliances et Guildes (horizon futur)**
`\\EGIDE\Runes de Chêne\👑 LA CITADELLE\📱 L'application (Conquête)\🛡️ Alliances & Guildes.md`

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
| Styles | CSS par composant (22+ fichiers) + `styles/mobile.css` pour les media queries |
| Déploiement | Netlify CLI manuel (pas d'auto-deploy Git) |

## Conventions

- **pnpm** — jamais npm ni yarn
- **TypeScript strict** — pas de `any`
- **Conventional Commits** — `feat:`, `fix:`, `chore:`, `docs:`
- **Pas de code mort** — si c'est unused, on supprime
- **Pas d'over-engineering** — simple, direct, fonctionnel
- **CSS par composant** — chaque composant importe son propre `.css`. App.css ne contient que le global (layout, MapLibre). Media queries dans `styles/mobile.css`
- **Pas de console.log en prod** — nettoyés régulièrement
- **Hub SaveBar** — toutes les pages du Hub utilisent le pattern SaveBar (try/finally, refetch serveur après save)
- **Presence** — les données du marker sont lues depuis le store playerStore à chaque tick (10s)
- **Migrations SQL** — fichiers numérotés dans `supabase/migrations/` (002→182)
- **RPCs** — logique métier côté serveur via `SECURITY DEFINER` functions

## Vocabulaire du jeu (V0.4)

| Avant | Après |
|-------|-------|
| Faction | **Héritage** |
| Conquérir / Revendiquer | **Veiller sur / Protéger** |
| Conquis par | **Veillé par** |
| Notoriété | **Gloire** |
| Chat faction | **Le Dortoir** |
| Territoire | **Terre d'influence** |
| Énergie + Conquête + Construction | **Énergie (unique)** |

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
├── App.css              # Styles globaux + toolbar (~224 lignes)
├── styles/
│   └── mobile.css       # Media queries responsive
├── components/
│   ├── map/
│   │   ├── ExploreMap.tsx          # Carte MapLibre + territoires
│   │   ├── EnergyIndicator.tsx     # Jauge énergie unique + regen timer
│   │   ├── ResourceIndicator.tsx   # (legacy, plus utilisé en V0.4)
│   │   ├── AbilityBar.tsx          # Barre de compétences actives (fragments)
│   │   ├── TagBonusList.tsx        # Affichage bonus heritage par tags
│   │   ├── FactionBar.tsx          # Scoreboard héritages (Gloire totale)
│   │   ├── FactionMembersModal.tsx # Détail héritage + membres + bonus tags
│   │   ├── ConquestToggle.tsx      # Switch Territoires ON/OFF
│   │   ├── GameToast.tsx           # Toasts in-game temps réel
│   │   ├── InfoModal.tsx           # Modal info énergie + bouton ajouter lieu
│   │   ├── PlayerProfileModal.tsx  # Profil joueur + titres v3 + fragments
│   │   ├── AdScreen.tsx            # Loading screen interstitiel (Ken Burns)
│   │   ├── OnlinePlayerMarkers.tsx # Markers joueurs en ligne (nom + titre)
│   │   ├── LeaderboardModal.tsx    # Classements (cache 30s)
│   │   ├── TerritoryPanel.tsx      # Détail territoire + vote nom
│   │   ├── TerritoryMarkers.tsx    # Markers emblèmes faction
│   │   ├── Minimap.tsx             # Canvas minimap
│   │   ├── MobileHeader.tsx        # Header mobile
│   │   ├── MobileNavbar.tsx        # Nav mobile
│   │   ├── MapStyleSelect.tsx      # Sélecteur style carte
│   │   └── VersionBadge.tsx        # Changelog modal
│   ├── places/
│   │   ├── PlacePanel.tsx          # Fiche lieu
│   │   ├── ClaimButton.tsx         # Bouton "Veiller sur ce lieu"
│   │   ├── FoggedPlaceView.tsx     # Lieu non découvert + bouton découvrir
│   │   ├── FortifyButton.tsx       # Bouton fortifier
│   │   ├── AddPlaceFlow.tsx        # Création de lieu + charte explorateur
│   │   └── ScoreSlider.tsx         # Slider score
│   ├── auth/
│   │   ├── AuthModal.tsx           # Login OTP email
│   │   ├── FactionModal.tsx        # Choix héritage + bonus tags affichés
│   │   ├── OnboardingModal.tsx     # Setup profil initial
│   │   ├── ProfileMenu.tsx         # Menu profil desktop
│   │   ├── GameModeModal.tsx       # Choix mode de jeu
│   │   └── EmailChangeModal.tsx    # Changement email
│   ├── chat/
│   │   └── ChatPanel.tsx           # Chat 3 canaux (Général, Dortoir, Bugs)
│   └── pwa/
│       ├── InstallPrompt.tsx       # PWA install banner
│       └── OfflineIndicator.tsx    # Indicateur hors-ligne
├── hooks/
│   ├── useAuth.ts                  # Auth Supabase + session
│   ├── usePlayer.ts               # Boot sequence (RPCs + realtime)
│   ├── usePlace.ts                 # Fetch détail lieu
│   ├── usePlaces.ts               # Fetch TOUS les lieux (get_map_places)
│   ├── usePresence.ts             # Presence joueurs en ligne
│   ├── useChat.ts                  # Chat 3 canaux + realtime
│   ├── useConstructionTypes.ts    # Types fortification (cache module)
│   ├── useResourceTimers.ts       # Timer regen énergie
│   └── useSupabaseConnection.ts   # Reconnexion auto
├── stores/
│   ├── playerStore.ts             # Joueur : énergie, faction, gloire, admin, buff actif
│   ├── mapStore.ts                # Carte : selection, flyTo, overrides, mode
│   ├── toastStore.ts              # File de toasts in-game
│   ├── chatStore.ts               # Messages 3 canaux
│   ├── mobileNavStore.ts          # Panel mobile actif
│   └── playersStore.ts            # Joueurs en ligne (Map<id, player>)
├── workers/
│   └── territoryWorker.ts         # Voronoi + clip + union (Web Worker)
├── lib/
│   ├── supabase.ts                # Client Supabase (NON typé)
│   ├── map-icons.ts               # Pipeline SVG : cache, colorize, shift, ImageData
│   ├── map-layers.ts              # Définitions layers MapLibre
│   └── map-style.ts               # Styles de carte (game/detailed/satellite)
└── types/
    └── database.types.ts          # Types générés (STALE, jamais importé)
```

---

## Gameplay — V0.4 L'Érudition Conquérante

### Héritages (ex-Factions)

Les joueurs se placent sous un **Héritage** culturel. Chaque héritage a : titre, couleur, pattern SVG, description, image (bannière), et des **bonus de réduction de coût par type de lieu**.

### 1 ressource unique : Énergie ⚡

| Ressource | Regen | Max défaut | Usage |
|-----------|-------|-----------|-------|
| Énergie ⚡ | Configurable dans Hub > Réglages | 3 | Découvrir, veiller, fortifier — tout |

L'ancienne Conquête et Construction sont **supprimées de l'UI**. Les colonnes existent encore en BDD mais ne sont plus affichées ni utilisées.

### Coût par distance

Plus un lieu est loin, plus il coûte d'énergie. Seuils configurables dans Hub > Réglages.

| Distance | Multiplicateur |
|----------|---------------|
| GPS sur place (< seuil 1) | ×0.5 |
| Proche (< seuil 2) | ×1 |
| Moyen (seuil 2 → seuil 3) | ×2 |
| Loin (> seuil 3) | ×3 |

**Formule coût** : `(base_cost × distance_mult × (1 - tag_reduction%)) + fortification_cost`

La fortification s'ajoute APRÈS le multiplicateur de distance (pas multipliée).

### Coût par type de lieu

Chaque tag a un `base_cost` (configurable dans Hub > Tags). Par défaut : 1.

### Bonus Heritage par tag

Chaque Héritage a des **réductions de coût** sur certains types de lieux, stockées dans `faction_tag_bonuses`. Configurables dans Hub > Héritages.

- Avantages primaires : **-50%** sur les tags naturels de l'héritage
- Avantages secondaires : **-25%** sur des tags complémentaires

Affichés dans : FactionModal (choix), FactionMembersModal (détail), ClaimButton/FoggedPlaceView/FortifyButton (sous les boutons).

### Actions joueur

| Action | RPC | Coût | Gain Gloire | Effet |
|--------|-----|------|-------------|-------|
| Découvrir | `discover_place` | base × distance × (1 - reduction) | +2 | Débloque lieu + récompenses tag |
| Veiller | `claim_place` | base × distance × (1 - reduction) + fortif | +5 | Change héritage du lieu |
| Fortifier | `fortify_place` | base × distance × (1 - reduction) + fortif_cost | +5 | Monte niveau défense |
| Créer un lieu | `create_place` | Gratuit (min 5 découvertes + titre requis) | — | Auto-claim si faction |

### Fortification (5 niveaux : 0→4)

| Niveau | Nom | Coût énergie (base) | Bonus influence |
|--------|-----|---------------------|-----------------|
| 0 | — | — | +0 |
| 1 | Tour de guet | 1 | +10 |
| 2 | Tour de défense | 2 | +20 |
| 3 | Bastion | 3 | +30 |
| 4 | Forteresse | 5 | +60 |

Le coût de fortification est ajouté au coût de base (après multiplicateur distance et réduction héritage).

### Gloire (ex-Notoriété)

- Se **gagne** uniquement par les actions (+2 découverte, +5 veille, +5 fortification)
- Ne se **dépense jamais** — c'est un score pur
- **Classement des Héritages** : basé sur la somme de la Gloire de tous les membres (pas la notoriété faction horaire)
- Affiché dans FactionBar avec 🎖️

### Fragments (boutique)

Chaque achat boutique débloque un **fragment** qui donne :
- Des **mots de titre** (système titres v3)
- Un **bonus gameplay passif** (max_energy, regen_energy, etc.)
- Une **compétence active** optionnelle avec cooldown

### Compétences actives (Fragments)

Les fragments peuvent avoir une **compétence activable** (`ability_type`) :

| ability_type | Effet | Cooldown |
|-------------|-------|----------|
| `free_discover` | Découverte gratuite (0 énergie) | Configurable |
| `free_claim` | Protection gratuite (0 énergie) | Configurable |
| `double_glory` | Double gloire sur la prochaine action | Configurable |
| `distance_ignore` | Ignore le multiplicateur de distance | Configurable |
| `discount_discover` | Réduction % sur la prochaine découverte | Configurable |
| `discount_claim` | Réduction % sur la prochaine protection | Configurable |

- **Barre de compétences** : `AbilityBar.tsx` — boutons ronds en bas à gauche de la carte
- **Cooldown visuel** : overlay `conic-gradient` qui s'anime
- **Buff actif** : stocké dans `playerStore.activeBuff` + persisté en localStorage
- **Flag serveur** : paramètre `p_free` sur les RPCs `discover_place` et `claim_place`
- **Tracking** : table `fragment_ability_uses` (user_id, fragment_id, used_at)
- **RPC** : `get_my_abilities` (compétences + cooldown) + `use_fragment_ability` (active + enregistre)

### Charte de l'explorateur érudit

Page Nouveau Lieu (`AddPlaceFlow.tsx`) : description obligatoire + 4 checkboxes philosophie avant création.

### Loading Screen (Interstitiel) ✅

Écran de chargement affiché au lancement, avant l'entrée sur la carte.
- Ken Burns effect, astuce aléatoire depuis `ad_tips`
- Classes CSS `loading-*` (pas `ad-*` pour éviter les ad blockers)
- Images et tips gérés depuis le Hub (page Publicités)

### Fog of War

Lieux non découverts = masqués. Coût : énergie × multiplicateur distance.

### Titres v3 (badges)

Système de titres = badges sélectionnables (max 3 affichés). Chaque titre a un `id`, `name`, `icon`, `icon_url` optionnel, `description`, `condition` (JSONB).

- **Titres généraux** : débloqués par les stats — table `titles` avec progression affichée (X/Y)
- **Titre faction** : lié à l'héritage du joueur
- **Mots de fragments** : id négatif = `fw.id * -1`
- **Affichage** : `displayed_title_ids_v3` INT[] sur `users`
- **Nettoyage auto** : les titres orphelins (faction changée, titre perdu) sont retirés au boot et au changement de faction
- **Sur la carte** : 1 `primaryTitle` via Presence

### Territoires

- Voronoi via d3-delaunay + Turf.js dans un Web Worker
- Noms votés par les joueurs (filtrage par faction, max 2 propositions)
- **Votes filtrés par faction** : seuls les votes de joueurs de la faction du territoire comptent

### Score d'influence (rayon territoire)

**Formule rayon :** `0.25 + √(score - 1) × 0.65` km

**Score = likes×1 + vues×0.1 + explorations×3 + bonus fortification**

Compensation serveur ×0.6 pour le clipping Voronoi.

### Baroud d'Honneur (Bonus Underdog)

L'héritage le plus faible reçoit un bonus de régénération. Configurable via Hub.

---

## Base de données — Schéma réel (post-migration 182)

> Source : `information_schema.columns` du 29 mars 2026. C'est la VÉRITÉ — toujours s'y référer avant de modifier une RPC.

### users
```
id VARCHAR PK, created_at, updated_at, email_address VARCHAR, first_name VARCHAR,
role VARCHAR, display_name TEXT, bio TEXT, biography VARCHAR (legacy), avatar_url TEXT,
instagram TEXT, is_active BOOLEAN, last_login_at TIMESTAMPTZ,
faction_id VARCHAR FK→factions, game_mode VARCHAR DEFAULT 'exploration',
energy_points NUMERIC DEFAULT 5, max_energy NUMERIC DEFAULT 3, energy_reset_at TIMESTAMPTZ,
conquest_points NUMERIC (legacy), max_conquest NUMERIC (legacy), conquest_reset_at (legacy),
construction_points NUMERIC (legacy), max_construction NUMERIC (legacy), construction_reset_at (legacy),
vitalite_points NUMERIC (legacy), max_vitalite NUMERIC (legacy), vitalite_reset_at (legacy),
notoriety_points INT DEFAULT 0 (= Gloire),
displayed_general_title_ids INT[] (legacy v2), displayed_title_ids_v3 INT[]
```
⚠️ La colonne s'appelle `first_name` PAS `name`. `bio` ET `biography` existent (legacy). `text` n'existe PAS sur users.

### places
```
id VARCHAR PK, created_at, updated_at, author_id VARCHAR FK→users,
place_type_id VARCHAR FK→place_types, title VARCHAR, text TEXT (= description du lieu),
address VARCHAR, latitude REAL, longitude REAL, images JSONB,
accessibility VARCHAR, sensible BOOLEAN, begin_at TIMESTAMPTZ, end_at TIMESTAMPTZ,
faction_id VARCHAR FK→factions, claimed_by VARCHAR FK→users, claimed_at TIMESTAMPTZ,
claimed_avatar_url TEXT, fortification_level INT DEFAULT 0
```
⚠️ La description s'appelle `text` PAS `description`. `images` est JSONB pas un array. Pas de colonne `score` (calculé dynamiquement).

### factions
```
id VARCHAR PK, title VARCHAR, color VARCHAR, pattern VARCHAR (SVG URL),
order INT, description TEXT, image_url TEXT,
bonus_energy NUMERIC, bonus_regen_energy NUMERIC,
bonus_conquest NUMERIC (legacy), bonus_construction NUMERIC (legacy),
bonus_regen_conquest NUMERIC (legacy), bonus_regen_construction NUMERIC (legacy),
bonus_vitalite NUMERIC (legacy), bonus_regen_vitalite NUMERIC (legacy)
```

### tags
```
id VARCHAR PK, title VARCHAR, color VARCHAR, background VARCHAR, icon VARCHAR (SVG URL),
order INT, base_cost NUMERIC DEFAULT 1.0, gauge VARCHAR (legacy),
reward_energy INT (legacy), reward_conquest INT (legacy), reward_construction INT (legacy)
```

### titles
```
id SERIAL PK, name VARCHAR, type VARCHAR ('general'|'faction'), faction_id VARCHAR,
order INT, icon VARCHAR, description TEXT, condition JSONB, unlocks TEXT[], created_at
```

### title_fragments
```
id SERIAL PK, name VARCHAR, description TEXT, icon VARCHAR, icon_url TEXT, image_url TEXT,
link_url TEXT, collection VARCHAR, visible BOOLEAN, bonus_type VARCHAR, bonus_value NUMERIC,
ability_type VARCHAR, ability_cooldown_hours INT DEFAULT 24, ability_value NUMERIC DEFAULT 0
```

### fragment_words
```
id SERIAL PK, fragment_id INT FK→title_fragments, word VARCHAR, slot VARCHAR, gender VARCHAR
```

### user_fragments
```
user_id VARCHAR FK→users, fragment_id INT FK→title_fragments, unlocked_at, source VARCHAR
```

### fragment_ability_uses
```
user_id VARCHAR PK, fragment_id INT PK, used_at TIMESTAMPTZ
```

### faction_tag_bonuses
```
faction_id VARCHAR PK FK→factions, tag_id VARCHAR PK FK→tags, cost_reduction NUMERIC(5,2)
```

### place_tags
```
place_id VARCHAR PK, tag_id VARCHAR PK, is_primary BOOLEAN, created_at
```

### places_discovered
```
user_id VARCHAR, place_id VARCHAR, method VARCHAR, discovered_at TIMESTAMPTZ
```

### place_claims
```
id SERIAL, place_id VARCHAR, user_id VARCHAR, faction_id VARCHAR, claimed_at,
previous_faction_id VARCHAR, previous_claimed_by VARCHAR
```

### activity_log
```
id SERIAL, type VARCHAR, actor_id VARCHAR, place_id VARCHAR, faction_id VARCHAR,
data JSONB, created_at TIMESTAMPTZ
```

### chat_messages
```
id BIGSERIAL, channel VARCHAR, user_id VARCHAR, user_name VARCHAR,
faction_id VARCHAR, faction_color VARCHAR, faction_pattern TEXT, content TEXT, created_at
```

### construction_types
```
level INT, name TEXT, description TEXT, image_url TEXT, cost INT, conquest_bonus INT, tag_ids TEXT[]
```

### territory_name_proposals / territory_name_votes
```
proposals: id UUID PK, anchor_place_id VARCHAR, proposed_by VARCHAR, name VARCHAR
votes: id UUID PK, proposal_id UUID FK, voter_id VARCHAR, value SMALLINT (+1/-1)
```

### territory_tiers
```
id SERIAL, min_places INT, title VARCHAR
```

### app_settings
```
key TEXT PK, value TEXT, updated_at TIMESTAMPTZ
```
Clés utilisées : underdog_enabled, underdog_multiplier, zone_fort_multiplier, zone_detection_radius_km, distance_gps_km, distance_close_km, distance_mid_km, distance_mult_gps/close/mid/far, energy_base_cycle, glory_discover, glory_claim, glory_fortify, glory_cost_bonus_pct

### ad_screens / ad_tips
```
screens: id SERIAL, image_url TEXT, product_url TEXT, title TEXT, active BOOLEAN
tips: id SERIAL, title TEXT, subtitle TEXT, tag VARCHAR, active BOOLEAN
```

### Tables legacy (ne pas toucher)
`image_media`, `member_codes`, `password_resets`, `refresh_tokens`, `mikro_orm_migrations`, `reviews`, `reviews_images`, `tag_gauge_mapping`

### RPCs — Liste complète

#### Game Core
| RPC | Params | Logique |
|-----|--------|---------|
| `discover_place` | target_place_id, method, p_user_lat, p_user_lng, p_free | Coût énergie × distance × (1-reduction), insert places_discovered, +2 Gloire |
| `claim_place` | target_place_id, p_user_lat, p_user_lng, p_free | Coût énergie × distance × (1-reduction) + fortif, change faction/claimed_by + avatar, +5 Gloire |
| `fortify_place` | target_place_id, ct_id, p_user_lat, p_user_lng | Coût énergie × distance + fortif_cost, monte level, +5 Gloire |
| `get_user_energy` | p_user_id | Énergie + regen + bonus faction/fragments + underdog + Gloire |
| `get_underdog_faction_id` | — | ID heritage underdog |

#### Compétences
| RPC | Params | Logique |
|-----|--------|---------|
| `get_my_abilities` | p_user_id | Liste compétences actives du joueur + cooldown |
| `use_fragment_ability` | p_user_id, p_fragment_id | Active la compétence, enregistre cooldown |

#### Titres & Fragments
| RPC | Params | Logique |
|-----|--------|---------|
| `get_all_player_titles` | p_user_id | 3 catégories + stats + conditions + displayedIds |
| `set_displayed_titles_v3` | p_user_id, p_ids | Sauvegarde max 3 titres affichés |
| `get_user_fragments` | p_user_id | Fragments possédés |
| `get_all_fragments` | p_user_id | Tous les fragments avec flag owned + ability |
| `get_player_profile` | p_user_id | Profil complet (v3 titres, stats, Gloire, avatar protecteur) |

#### Map & Feed
| RPC | Params | Logique |
|-----|--------|---------|
| `get_map_places` | lim | Lieux avec coords, faction, tags, scores, avatar protecteur |
| `get_faction_notoriety` | — | Score par heritage (heures × fortif) + isUnderdog |
| `get_winning_territory_names` | — | Noms gagnants par territoire |

#### Territory Naming
| RPC | Params | Logique |
|-----|--------|---------|
| `get_territory_votes` | anchor, user_id, blob_ids | Propositions + votes (filtrés par faction) |
| `propose_territory_name` | user_id, anchor, name, blob_ids | Max 2 propositions, vérifie faction |
| `vote_territory_name` | vote_id, user_id, proposal_id, value, blob_ids | Vote (+1/-1), vérifie faction |

### Storage Buckets

| Bucket | Contenu |
|--------|---------|
| `place-images` | Avatars joueurs + photos de lieux |
| `community-photos` | Soumissions hub |
| `app-assets` | Icônes globales |
| `tag-icons` | Icônes de tags |
| `faction-patterns` | Patterns héritages |
| `app-fragments` | Images fragments (icon-X.webp, ability-X.png) |

---

## Stores Zustand (6)

### playerStore — État joueur
```
discoveredIds, userId, userName, userAvatarUrl,
userFactionId/Color/Title/Pattern, factionTitle2,
energy/maxEnergy/energyCycle, notorietyPoints (=Gloire),
unlockedTitles, displayedTitles, primaryTitle,
gameMode ('exploration'|'conquest'), isAdmin, loading, userPosition,
activeBuff (free_discover|free_claim|...|null)
```

### mapStore — État carte
```
selectedPlaceId, selectedPlayerId, pendingFlyTo, pendingZoom,
placeOverrides (Map), deletedPlaceIds (Set), addPlaceMode,
pendingNewPlaceCoords, placesRefreshKey, mapStyleMode,
selectedTerritoryData, territoryNames (Map)
```

### chatStore — Chat
```
showGeneral/showFaction/showBugs, sendChannel,
generalMessages/factionMessages/bugsMessages (max 100/canal)
```

### toastStore — Toasts in-game
```
toasts (GameToast[]) — types: claim/discover/explore/new_place/new_user/like/fortify
```

### playersStore — Joueurs en ligne
```
players (Map<string, OnlinePlayer>) — id, name, avatar, faction, lat/lng, primaryTitle, last_seen
```

### mobileNavStore — Navigation mobile
```
activePanel ('notifications'|'chat'|'profile'|null), notificationsSeenAt, chatSeenAt
```

---

## Bugs connus

### MAJEURS

1. **RLS trop permissive** : `app_settings` et `factions` modifiables par tout utilisateur authentifié (devrait être admin-only)
2. **`get_my_informations` appelé 3 fois** : usePlayer + ProfileMenu + MobileHeader font 3 requêtes identiques

### Performance

3. **ExploreMap.tsx (~1100 lignes)** : composant monolithique
4. **PlacePanel.tsx (~1050 lignes)** : idem
5. **App.tsx est un God component** : ~15 states boolean

### Connus non-critiques

6. **ResourceIndicator.tsx** : composant legacy, plus affiché mais toujours importé dans App.tsx (import à retirer)
7. **Colonnes legacy** : conquest_points, construction_points, max_conquest, max_construction toujours en BDD (non utilisées)

---

## Migrations récentes (128-165)

| Migration | Description |
|---|---|
| 128 | CLEANUP : DROP composed_title_*, RPCs mortes |
| 129 | INDEX performance |
| 130 | Progression titres : condition + stats dans get_all_player_titles |
| 131-134 | Votes territoire : filtrage faction, suppression orphelins |
| 135 | 4e jauge Vitalité + gauge sur tags (ensuite rollback UI vers 1 jauge) |
| 136 | Suppression tags inutilisés |
| 137-138 | Actions basées sur la jauge du tag du lieu |
| 139 | Max énergie réduit à 3 par défaut |
| 140 | Cycles de regen configurables via app_settings |
| 141 | **Jauge unique Énergie** : discover/claim/fortify utilisent tous energy_points |
| 142-143 | **Coût par distance** : multiplicateur GPS/proche/moyen/loin |
| 144 | Seuils de distance configurables |
| 145 | Fortification utilise l'énergie |
| 146-147 | Gloire comme joker → revert (score pur) |
| 148 | Avatar du protecteur sur les lieux (claimed_avatar_url) |
| 149-150 | Fortification : coût distance + formule corrigée (base × dist + fortif) |
| 151-152 | Bonus heritage par tag (faction_tag_bonuses) appliqué dans claim/discover |
| 153-155 | Compétences actives fragments (ability_type, cooldown, table uses) |
| 156-161 | Image compétence → rollback vers image_url du fragment |
| 162-163 | Nettoyage titres orphelins (changement faction) |
| 164 | ability_value (paramètre % pour discount) |
| 165 | Nettoyage titres locked encore affichés |
