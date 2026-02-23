# La Carte — Runes de Chêne

> Jeu de carte interactive du patrimoine français
> Dernière mise à jour : 23 février 2026

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
| Zustand | State management (fogStore, mapStore, toastStore) |
| vite-plugin-pwa | PWA installable |
| Netlify | Déploiement → `carte.runesdechene.com` |

**Port dev :** 3000 | **Build :** `pnpm build`

---

## Architecture

```
src/
├── components/
│   ├── map/
│   │   ├── ExploreMap.tsx        # Carte MapLibre + territoires Voronoi (web worker)
│   │   ├── EnergyIndicator.tsx   # Jauge ⚡ X.X/5 +0.5/h (cycle 7200s)
│   │   ├── ResourceIndicator.tsx # Jauges ⚔️/🔨 X.X/5 +0.25/h (cycle 14400s)
│   │   ├── FactionBar.tsx        # Scoreboard factions (notoriété temporelle)
│   │   ├── PlayerProfileModal.tsx # Profil joueur public
│   │   ├── ActivityToast.tsx     # Toasts activité temps réel
│   │   └── ...
│   ├── places/
│   │   └── PlacePanel.tsx        # Fiche lieu complète :
│   │                               # - Vue fog (lieu non découvert, coût énergie)
│   │                               # - Vue découverte (stats, claim, fortify)
│   │                               # - ClaimButton (coût dynamique conquête)
│   │                               # - FortifyButton (coût progressif construction)
│   ├── auth/
│   │   ├── AuthForm.tsx          # Login email magic link OTP
│   │   ├── AuthCallback.tsx      # Callback OTP
│   │   └── FactionModal.tsx      # Rejoindre/quitter une faction
│   └── UserProfile.tsx           # Profil self (nom, rang, avatar, lieux explorés)
├── hooks/
│   ├── useAuth.ts                # Hook auth Supabase (user, isAuthenticated)
│   ├── useFog.ts                 # Init fog of war + énergie + Realtime activity
│   │                               # discoverPlace() — fonction standalone
│   └── usePlace.ts               # Fetch détail lieu → PlaceDetail type
├── stores/
│   ├── fogStore.ts               # State central joueur :
│   │                               # userId, userFactionId/Color/Pattern
│   │                               # energy/maxEnergy/nextPointIn
│   │                               # conquestPoints/maxConquest/conquestNextPointIn
│   │                               # constructionPoints/maxConstruction/constructionNextPointIn
│   │                               # notorietyPoints
│   │                               # discoveredIds (Set<string>)
│   │                               # userName, userAvatarUrl, isAdmin
│   ├── mapStore.ts               # placeOverrides (Map<string, PlaceOverride>)
│   │                               # Pour updates temps réel post-claim
│   └── toastStore.ts             # File de toasts in-game
├── lib/
│   └── supabase.ts               # Client Supabase singleton
├── App.tsx                       # Toolbar (3 jauges) + ExploreMap + PlacePanel
└── App.css                       # Tous les styles (parchemin, medieval, jauges, etc.)
```

---

## Systèmes de jeu

### Fog of War

- `fogStore.discoveredIds` = Set de place IDs déjà découverts
- Lieux non découverts → floutés sur la carte
- `discoverPlace(placeId, lat, lng)` dans useFog.ts (standalone, pas un hook)
- Coût : 1.0 énergie remote (0.5 même faction), 0 si GPS < 500m
- `discover_place` RPC donne des récompenses tag (énergie, conquête, construction)

### 3 Ressources

Régénération par ticks côté serveur (`get_user_energy` RPC) :
- **Énergie ⚡** : cycle 7200s (+0.5/h), max 5, pour découvrir
- **Conquête ⚔️** : cycle 14400s (+0.25/h), max 5, pour revendiquer
- **Construction 🔨** : cycle 14400s (+0.25/h), max 5, pour fortifier

Frontend : `EnergyIndicator` et `ResourceIndicator` affichent un countdown + fractional smooth avec `setInterval` 1s. Refetch auto quand le timer atteint 0.

### Claim (Revendication)

- PlacePanel > ClaimButton
- Coût : `1 + fortification_level` conquête
- `claim_place` RPC : met à jour places.faction_id, reset fortification à 0, +10 notoriété
- Update temps réel via `mapStore.setPlaceOverride` + Realtime `activity_log`
- Toast : "Lieu revendiqué pour {faction} ! +10 Notoriété"

### Fortification

- PlacePanel > FortifyButton (visible si lieu de sa faction + level < 4)
- `fortify_place` RPC : coûts progressifs [1, 2, 3, 5], +5 notoriété
- 4 niveaux : Tour de guet, Tour de défense, Bastion, Béfroi
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
    claimedBy, claimedAt, fortificationLevel
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
