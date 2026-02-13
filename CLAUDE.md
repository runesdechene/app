# Runes de Chêne — Monorepo

> Dernière mise à jour : 13 février 2026

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
1. `🍁 INDEX - Runes de Chêne.md` — Identité, mission, parcours client, équipe (constitution permanente)
2. `⚔️ PLAN DE BATAILLE — Objectif 22 Mars.md` — Roadmap, deadlines, tâches semaine par semaine
3. `📋 ECT — La Carte.md` — Specs de La Carte (MVP)
4. `📋 ECT — Hérauts.md` — Specs du système de recrutement ambassadeurs
5. `📋 ECT — Communication.md` — Stratégie Instagram
6. `🏛️ INFRASTRUCTURE.md` — État de tous les outils

**Avant chaque session de travail, consulter le Plan de Bataille pour les priorités actuelles.**

## Ce qu'on vend

De l'**Appartenance** et de la **Découverte**. Pas des vêtements. Pas une app.
Chaque décision technique doit servir ça.

---

## Structure du monorepo

```
.
├── apps/
│   ├── explore-web/          # La Carte — MVP carte interactive (PRIORITE 1)
│   └── hub/                  # Back-office admin (fonctionnel)
├── packages/
│   └── supabase-client/      # Client Supabase partagé + types générés
├── supabase/
│   ├── config.toml           # Config Supabase CLI
│   └── migrations/           # Migrations SQL (006-011)
├── package.json              # Root monorepo
├── pnpm-workspace.yaml       # Workspaces : apps/* + packages/*
└── pnpm-lock.yaml
```

### Apps actives

| App | Rôle | Port | Domaine | CLAUDE.md |
|-----|------|------|---------|-----------|
| **explore-web** | La Carte — carte interactive patrimoine | 3000 | `carte.runesdechene.com` | `apps/explore-web/CLAUDE.md` |
| **hub** | Back-office admin (users, photos, avis, hérauts) | 3001 | `hub.runesdechene.com` | `apps/hub/CLAUDE.md` |

### Package partagé

| Package | Rôle | Consommé par |
|---------|------|-------------|
| `@runes/supabase-client` | Client Supabase + types TS générés | explore-web, hub |

---

## Priorités actuelles (fév-mars 2026)

1. **La Carte MVP** — explore-web, objectif déployée le 22 mars, testable le 7 mars
2. **Hérauts** — Page `/rejoindre` sur le Hub + section admin candidatures
3. **Hub maintenance** — Corrections et ajouts selon besoins

---

## Stack technique commune

- **Runtime :** Node.js
- **Package manager :** pnpm (workspaces)
- **Language :** TypeScript strict
- **Framework :** React 18
- **Build :** Vite 5
- **Backend :** Supabase (PostgreSQL, Auth OTP, Storage, RPC functions, RLS)
- **Déploiement :** Netlify (les deux apps)
- **Branche principale :** `main`

## Conventions

- **pnpm** — jamais npm ni yarn
- **TypeScript strict** — pas de `any`
- **Conventional Commits** — `feat:`, `fix:`, `chore:`, `docs:`
- **Pas de code mort** — si c'est unused, on supprime
- **Pas d'over-engineering** — simple, direct, fonctionnel

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

## Ecosystem Runes de Chêne

Ce monorepo fait partie d'un écosystème plus large :

| Projet | Lieu | Rôle |
|--------|------|------|
| **La Citadelle** | `\\EGIDE\...\👑 LA CITADELLE\` | QG stratégique (Obsidian) |
| **HUB + LA CARTE** | Ce repo | Code applicatif |
| **Boutique Shopify** | `\\EGIDE\...\BOUTIQUE EN LIGNE (SHOPIFY)\` | Thème e-commerce Heritage v3.2.1 |
