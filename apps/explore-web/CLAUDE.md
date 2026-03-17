# La Carte — Runes de Chêne

> Jeu de carte interactive du patrimoine français
> Dernière mise à jour : 17 mars 2026

## Source de vérité

Ce fichier traduit techniquement les décisions stratégiques prises dans **La Citadelle** (Obsidian).
En cas de conflit, **La Citadelle fait autorité**.

---

## Vision

Une carte interactive du patrimoine français transformée en **jeu de factions**. Les joueurs découvrent des lieux, revendiquent des territoires pour leur faction, fortifient leurs positions, et accumulent de la notoriété.

**Style visuel :** Parchemin, Skyrim, médiéval fantaisie. Couleurs sépia, typographie médiévale.

---

## Stack technique

| Outil | Rôle |
|-------|------|
| React 18 + TypeScript | Framework UI |
| Vite 5 | Build tool |
| MapLibre GL JS | Rendu cartographique |
| OpenFreeMap | Tuiles (gratuit, basé OpenStreetMap) |
| Supabase | Auth OTP, RPC functions, Storage, Realtime |
| Zustand | State management (playerStore, mapStore, toastStore) |
| vite-plugin-pwa | PWA installable |
| Netlify | Déploiement → `carte.runesdechene.com` |

**Port dev :** 3000 | **Build :** `pnpm build`

---

## Architecture

```
src/
├── components/
│   ├── map/
│   │   ├── ExploreMap.tsx          # Carte MapLibre + territoires Voronoi (~750 lignes)
│   │   ├── MapStyleSelect.tsx      # Dropdown style carte (game/detailed/satellite)
│   │   ├── TerritoryMarkers.tsx    # Emblèmes, labels, badges fort (React.memo)
│   │   ├── OnlinePlayerMarkers.tsx # Marqueurs joueurs en ligne (React.memo)
│   │   ├── EnergyIndicator.tsx     # Jauge ⚡ X.X/5 (rendu pur, pas de timer)
│   │   ├── ResourceIndicator.tsx   # Jauges ⚔️/🔨 X.X/5 (rendu pur, pas de timer)
│   │   ├── Minimap.tsx             # Minimap Canvas2D (Path2D batching par couleur)
│   │   ├── FactionBar.tsx          # Scoreboard factions (notoriété temporelle)
│   │   ├── ConquestToggle.tsx      # Toggle mode conquête/exploration
│   │   ├── MobileHeader.tsx        # Header mobile (profil, énergie)
│   │   ├── MobileNavbar.tsx        # Navbar mobile bottom
│   │   ├── PlayerProfileModal.tsx  # Profil joueur public
│   │   ├── FactionMembersModal.tsx # Membres d'une faction
│   │   ├── LeaderboardModal.tsx    # Classement joueurs
│   │   ├── TerritoryPanel.tsx      # Panel détail territoire
│   │   ├── InfoModal.tsx           # Modal info/aide
│   │   ├── GameToast.tsx           # Toasts activité temps réel
│   │   └── VersionBadge.tsx        # Badge version app
│   ├── places/
│   │   ├── PlacePanel.tsx          # Fiche lieu (~590 lignes, orchestrateur)
│   │   ├── FoggedPlaceView.tsx     # Vue lieu non découvert (coût énergie, GPS)
│   │   ├── ClaimButton.tsx         # Bouton revendication (coût dynamique)
│   │   ├── FortifyButton.tsx       # Bouton fortification (coût progressif)
│   │   ├── ScoreSlider.tsx         # Slider score/influence (admin only)
│   │   └── AddPlaceFlow.tsx        # Ajout de lieu par l'utilisateur
│   ├── auth/
│   │   ├── AuthModal.tsx           # Modal auth (login/signup)
│   │   ├── FactionModal.tsx        # Rejoindre/quitter une faction
│   │   ├── OnboardingModal.tsx     # Onboarding nouveau joueur
│   │   ├── GameModeModal.tsx       # Choix mode de jeu
│   │   ├── ProfileMenu.tsx         # Menu profil dropdown
│   │   └── EmailChangeModal.tsx    # Changement d'email
│   ├── chat/
│   │   └── ChatPanel.tsx           # Chat temps réel
│   ├── pwa/
│   │   ├── InstallPrompt.tsx       # Prompt installation PWA
│   │   └── OfflineIndicator.tsx    # Indicateur hors-ligne
│   ├── AuthForm.tsx                # Login email magic link OTP (legacy)
│   ├── AuthCallback.tsx            # Callback OTP (legacy)
│   └── UserProfile.tsx             # Profil self (nom, rang, avatar, lieux explorés)
├── hooks/
│   ├── useAuth.ts                  # Hook auth Supabase (user, isAuthenticated)
│   ├── usePlayer.ts                # Init joueur + énergie + Realtime activity
│   │                                 # discoverPlace() — fonction standalone
│   ├── usePlace.ts                 # Fetch détail lieu → PlaceDetail type
│   ├── usePlaces.ts                # Fetch liste lieux → GeoJSON FeatureCollection
│   ├── useResourceTimers.ts        # Timer unique partagé (1 setInterval pour 3 ressources)
│   ├── useConstructionTypes.ts     # Types de construction (niveaux fortification)
│   ├── useChat.ts                  # Hook chat temps réel
│   ├── usePresence.ts              # Présence joueurs en ligne
│   └── useSupabaseConnection.ts    # Gestion connexion Supabase
├── stores/
│   ├── playerStore.ts              # State central joueur (ex-fogStore) :
│   │                                 # userId, userFactionId/Color/Pattern
│   │                                 # energy/maxEnergy/nextPointIn
│   │                                 # conquestPoints/maxConquest/conquestNextPointIn
│   │                                 # constructionPoints/maxConstruction/constructionNextPointIn
│   │                                 # notorietyPoints, gameMode
│   │                                 # discoveredIds (Set<string>)
│   │                                 # userName, userAvatarUrl, isAdmin
│   ├── mapStore.ts                 # placeOverrides (Map<string, PlaceOverride>)
│   ├── playersStore.ts             # Joueurs en ligne (positions, factions)
│   ├── chatStore.ts                # Messages chat
│   ├── mobileNavStore.ts           # Navigation mobile state
│   └── toastStore.ts               # File de toasts in-game
├── lib/
│   ├── supabase.ts                 # Client Supabase singleton
│   ├── map-icons.ts                # Pipeline SVG : cache, colorize, shift, ImageData
│   ├── map-layers.ts               # Définitions layers MapLibre (territoires, icônes, points)
│   ├── map-style.ts                # Styles de carte (game/detailed/satellite)
│   └── imageUtils.ts               # Utilitaires images
├── workers/
│   └── territoryWorker.ts          # Web worker Voronoi (calcul territoires)
├── types/
│   └── database.types.ts           # Types Supabase auto-générés
├── App.tsx                         # Orchestrateur : toolbar + carte + panels + modals
├── App.css                         # Tous les styles (parchemin, medieval, jauges, etc.)
├── main.tsx                        # Point d'entrée React
└── vite-env.d.ts                   # Types Vite
```

---

## Systèmes de jeu

### Fog of War

- `playerStore.discoveredIds` = Set de place IDs déjà découverts
- Lieux non découverts → floutés sur la carte
- `discoverPlace(placeId, lat, lng)` dans usePlayer.ts (standalone, pas un hook)
- Coût : 1.0 énergie remote (0.5 même faction), 0 si GPS < 500m
- `discover_place` RPC donne des récompenses tag (énergie, conquête, construction)

### 3 Ressources

Régénération par ticks côté serveur (`get_user_energy` RPC) :
- **Énergie ⚡** : cycle 7200s (+0.5/h), max 5, pour découvrir
- **Conquête ⚔️** : cycle 14400s (+0.25/h), max 5, pour revendiquer
- **Construction 🔨** : cycle 14400s (+0.25/h), max 5, pour fortifier

Frontend : `useResourceTimers` gère un unique `setInterval` 1s pour les 3 compteurs. Refetch auto quand un timer atteint 0. `EnergyIndicator` et `ResourceIndicator` sont des composants de rendu pur (pas de timer interne).

### Claim (Revendication)

- PlacePanel > ClaimButton (composant séparé)
- Coût : `1 + fortification_level + zone_bonus + size_bonus` conquête
- `claim_place` RPC : met à jour places.faction_id, reset fortification à 0, +10 notoriété
- Update temps réel via `mapStore.setPlaceOverride` + Realtime `activity_log`
- Toast : "Lieu revendiqué pour {faction} ! +10 Notoriété"

### Fortification

- PlacePanel > FortifyButton (composant séparé, visible si lieu de sa faction + level < max)
- `fortify_place` RPC : coûts progressifs définis par `construction_types`, +5 notoriété
- Niveaux définis dynamiquement via `useConstructionTypes`
- Chaque niveau ajoute +1 au coût de claim ennemi

### Notoriété

- **Personnelle** : `users.notoriety_points` (+10 claim, +5 fortify)
- **Faction** : `get_faction_notoriety()` — `floor(heures) * (1 + fort_level * 0.5)`
- FactionBar affiche le score faction (remplace l'ancien %)
- PlayerProfileModal affiche la notoriété personnelle

### Territoires Voronoi

- ExploreMap calcule des zones Voronoi via un web worker (`territoryWorker`)
- Chaque lieu revendiqué crée une zone colorée par la faction
- Opacité : 28% pour sa faction, 18% pour les autres, 30% au hover
- Blasons (patterns SVG) affichés aux centroïdes des territoires
- `TerritoryMarkers` (React.memo) gère le rendu des emblèmes, labels et badges fort

### Activité Realtime

- Canal Supabase `activity-realtime` sur `activity_log` (INSERT)
- Types : claim, discover, like, new_user
- `loadRecentActivity()` charge les 50 derniers events (7 jours)
- Toasts in-game avec highlights et liens vers les lieux

---

## Types clés

### PlaceDetail (usePlace.ts)

```typescript
{
  id, title, text, address, accessibility, sensible, geocaching,
  images: Array<{ id, url }>,
  author: { id, lastName, profileImageUrl },
  type: { id, title },
  primaryTag: { id, title, color, background } | null,
  tags: Array<{ id, title, color, background, icon, isPrimary }>,
  location: { latitude, longitude },
  metrics: { views, likes, explored, note },
  claim: {
    factionId, factionTitle, factionColor,
    claimedBy, claimedAt, fortificationLevel,
    zoneFortification, zoneNeighborCount
  } | null,
  requester: { bookmarked, liked, explored } | null,
  lastExplorers: Array<{ id, lastName, profileImageUrl }>,
  beginAt, endAt
}
```

---

## Conventions

- **CSS** — tout dans App.css (pas de Tailwind, pas de CSS modules)
- **State serveur** — appels Supabase directs (pas de React Query)
- **State client** — Zustand avec `getState()` pour les fonctions standalone
- **Composants** — fonctionnels, hooks, pas de classes
- **Nommage** — PascalCase composants, camelCase hooks/stores
- **Extraction** — composants > 200 lignes → extraire en sous-composants (React.memo si props stables)
- **Timers** — centralisés dans `useResourceTimers`, jamais de timer dans un composant de rendu
- **Layers MapLibre** — définitions dans `lib/map-layers.ts`, pas inline dans ExploreMap
- **Icônes SVG** — pipeline dans `lib/map-icons.ts` avec cache module-level
