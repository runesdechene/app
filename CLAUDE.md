# Runes de Chêne — Monorepo

> Dernière mise à jour : 23 février 2026

## Rôle de Claude

Claude est le **XO** (commandant en second) de Runes de Chêne.
Uriel commande. Le XO conçoit, développe, rédige, et exécute.

## Règles d'or

1. **Moindre friction** — Si ça bloque ou prend du temps, c'est inutile ou mal abordé
2. **Pareto** — 20% d'effort pour 80% de résultat
3. **Parkinson** — Définir des délais stricts ; une tâche prend le temps qu'on lui donne

## Source de vérité stratégique

Les décisions produit et les priorités sont dans **La Citadelle** (Obsidian vault) :
`\\EGIDE\Runes de Chêne\👑 LA CITADELLE\`

Documents clés, par ordre de priorité :
1. `🍁 INDEX - Runes de Chêne.md` — Identité, mission, parcours client, équipe
2. `⚔️ PLAN DE BATAILLE — Objectif 22 Mars.md` — Roadmap, deadlines, tâches
3. `📋 ECT — La Carte.md` — Specs de La Carte
4. `📋 ECT — Hérauts.md` — Specs du système de recrutement ambassadeurs
5. `📋 ECT — Communication.md` — Stratégie Instagram
6. `🏛️ INFRASTRUCTURE.md` — État de tous les outils

## Ce qu'on vend

De l'**Appartenance** et de la **Découverte**. Pas des vêtements. Pas une app.
Chaque décision technique doit servir ça.

---

## Structure du monorepo

```
.
├── apps/
│   ├── explore-web/          # La Carte — jeu de carte interactive (PRIORITE 1)
│   └── hub/                  # Back-office admin (fonctionnel)
├── packages/
│   └── supabase-client/      # Client Supabase partagé + types générés
├── supabase/
│   ├── config.toml           # Config Supabase CLI
│   └── migrations/           # Migrations SQL (006-041)
├── package.json              # Root monorepo
├── pnpm-workspace.yaml       # Workspaces : apps/* + packages/*
└── pnpm-lock.yaml
```

### Apps actives

| App | Rôle | Port | Domaine |
|-----|------|------|---------|
| **explore-web** | La Carte — jeu de carte interactive patrimoine | 3000 | `carte.runesdechene.com` |
| **hub** | Back-office admin (users, photos, avis, hérauts, tags) | 3001 | `hub.runesdechene.com` |

---

## Stack technique

- **Runtime :** Node.js
- **Package manager :** pnpm (workspaces)
- **Language :** TypeScript strict
- **Framework :** React 18
- **Build :** Vite 5
- **Backend :** Supabase (PostgreSQL, Auth OTP, Storage, RPC functions, RLS)
- **Carte :** MapLibre GL JS + OpenFreeMap (tuiles gratuites)
- **State :** Zustand (fogStore, mapStore, toastStore)
- **Déploiement :** Netlify (les deux apps)
- **Branche principale :** `main`

## Conventions

- **pnpm** — jamais npm ni yarn
- **TypeScript strict** — pas de `any`
- **Conventional Commits** — `feat:`, `fix:`, `chore:`, `docs:`
- **Pas de code mort** — si c'est unused, on supprime
- **Pas d'over-engineering** — simple, direct, fonctionnel
- **Migrations SQL** — fichiers numérotés dans `supabase/migrations/`
- **RPCs** — logique métier côté serveur via `SECURITY DEFINER` functions

## Commandes

```bash
# Dev
pnpm dev              # Lance explore-web (port 3000)
pnpm --filter hub dev # Lance le hub (port 3001)

# Build
pnpm build            # Build explore-web
pnpm --filter hub build

# Supabase
npx supabase start    # Supabase local
npx supabase db push  # Appliquer les migrations
npx supabase gen types typescript --local > packages/supabase-client/src/types/database.types.ts
```

## Variables d'environnement

Fichier `.env` à la racine (`.env.example` fourni) :
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

---

## Gameplay — La Carte (explore-web)

### Factions

Les joueurs rejoignent une faction. Chaque faction a un titre, une couleur, et un blason (pattern SVG). Les territoires sont visualisés sur la carte via des zones Voronoi colorées par faction.

### 3 ressources — régénération temporelle

| Ressource | Icône | Regen | Max | Usage |
|-----------|-------|-------|-----|-------|
| Énergie | ⚡ | +0.5/h (cycle 7200s) | 5 | Découvrir des lieux |
| Conquête | ⚔️ | +0.25/h (cycle 14400s) | 5 | Revendiquer des lieux |
| Construction | 🔨 | +0.25/h (cycle 14400s) | 5 | Fortifier des lieux |

Chaque ressource régénère via un système de ticks (cycle fixe, taux 1 pt/tick). Les RPCs calculent les ticks écoulés et mettent à jour à chaque appel.

### Fog of War

Lieux non découverts = masqués. Coût pour découvrir :
- **Remote :** 1.0 énergie (0.5 si même faction)
- **GPS (< 500m) :** gratuit

### Découverte

`discover_place` — débloque le lieu, donne des récompenses basées sur le tag primaire (énergie, conquête, construction).

### Revendication (Claim)

`claim_place` — coûte `1 + fortification_level` conquête. Donne **+10 notoriété personnelle**. Pas de récompense ressource. Reset fortification à 0.

### Fortification (4 niveaux)

`fortify_place` — renforce un lieu de sa faction. **+5 notoriété**.

| Niveau | Nom | Coût construction | Coût conquête ennemi |
|--------|-----|-------------------|-----------------------|
| 0 | — | — | 1 |
| 1 | Tour de guet | 1 | 2 |
| 2 | Tour de défense | 2 | 3 |
| 3 | Bastion | 3 | 4 |
| 4 | Béfroi | 5 | 5 |

### Notoriété

- **Personnelle :** `users.notoriety_points` (+10 claim, +5 fortify). Visible dans le profil.
- **Faction :** calculée en temps réel par `get_faction_notoriety()`. Formule : `floor(heures_tenues) * (1 + fortification_level * 0.5)`. Lvl 0 = x1, lvl 4 = x3. Remplace l'ancien % dans le FactionBar.

### Activité temps réel

Canal Supabase Realtime sur `activity_log` — claims, découvertes, likes, nouveaux joueurs apparaissent en toasts.

---

## Tables Supabase principales

| Table | Rôle |
|-------|------|
| `users` | Joueurs (faction_id, 3 ressources + reset_at, notoriety_points) |
| `places` | 2400+ lieux (lat/lng, faction_id, claimed_by/at, fortification_level) |
| `factions` | Factions (title, color, pattern SVG) |
| `tags` | Tags avec couleurs, icônes, reward_energy/conquest/construction |
| `place_tags` | Liaison lieu-tag (is_primary) |
| `places_discovered` | Fog of war |
| `place_claims` | Historique revendications |
| `activity_log` | Feed temps réel |

## RPCs principales

| Fonction | Usage |
|----------|-------|
| `get_map_places` | Markers pour la carte |
| `get_place_by_id` | Détail lieu (claim + fortification) |
| `get_user_energy` | 3 ressources + regen timers + notoriété |
| `discover_place` | Découvrir (coût énergie, récompenses tag) |
| `claim_place` | Revendiquer (coût conquête, +10 notoriété) |
| `fortify_place` | Fortifier (coût construction, +5 notoriété) |
| `get_faction_notoriety` | Score temporel par faction |
| `get_player_profile` | Profil public (stats + notoriété) |

---

## Architecture explore-web

```
apps/explore-web/src/
├── components/
│   ├── map/
│   │   ├── ExploreMap.tsx        # Carte MapLibre + territoires Voronoi
│   │   ├── EnergyIndicator.tsx   # Jauge énergie
│   │   ├── ResourceIndicator.tsx # Jauges conquête/construction
│   │   ├── FactionBar.tsx        # Scoreboard factions (notoriété)
│   │   └── PlayerProfileModal.tsx
│   ├── places/
│   │   └── PlacePanel.tsx        # Fiche lieu (découverte, claim, fortify)
│   ├── auth/
│   │   ├── AuthForm.tsx          # Login email OTP
│   │   └── FactionModal.tsx      # Choix de faction
│   └── ...
├── hooks/
│   ├── useAuth.ts                # Auth Supabase
│   ├── useFog.ts                 # Init fog + activité Realtime
│   └── usePlace.ts               # Fetch détail lieu
├── stores/
│   ├── fogStore.ts               # State joueur (resources, faction, notoriété)
│   ├── mapStore.ts               # State carte (placeOverrides)
│   └── toastStore.ts             # Toasts in-game
├── lib/supabase.ts
├── App.tsx
└── App.css                       # Styles parchemin/médiéval
```

---

## Ecosystem Runes de Chêne

| Projet | Lieu | Rôle |
|--------|------|------|
| **La Citadelle** | `\\EGIDE\...\👑 LA CITADELLE\` | QG stratégique (Obsidian) |
| **HUB + LA CARTE** | Ce repo | Code applicatif |
| **Boutique Shopify** | `\\EGIDE\...\BOUTIQUE EN LIGNE (SHOPIFY)\` | Thème e-commerce Heritage v3.2.1 |
