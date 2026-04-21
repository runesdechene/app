# Runes de Chêne — Monorepo

> pnpm workspaces · TypeScript strict · Supabase · Netlify
> Mémoire unifiée : **La Citadelle** (Obsidian) + **Graphify** + **Context7**

> Identité XO, routing Obsidian et HARD GATE : voir `~/citadelle/CLAUDE.md` (auto-chargé au démarrage).

## 4-Layer Query Rule

Avant de lire un fichier brut, interroger dans cet ordre :

1. **Lib externe** (React, Supabase, Netlify, Tailwind, MapLibre…) → **Context7 MCP**
2. **Structure/relation code local** → **Graphify** (`graphify-out/graph.json`)
3. **Domaine/marque/décision/préférence** → **Obsidian MCP** (Citadelle)
4. **Édition ou fallback** → **Read** du fichier brut

## Graphify

- Avant toute question architecture/codebase : **lire `graphify-out/GRAPH_REPORT.md`** (god nodes, communautés)
- Si `graphify-out/wiki/index.md` existe : naviguer via le wiki plutôt que les fichiers bruts
- Après modifs code : `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` pour garder le graph à jour

## Ecosystem

| Projet | Lieu | Rôle |
|--------|------|------|
| **La Citadelle** | `~/citadelle/` (symlink) | QG partagé (marque + dev + stratégie) |
| **explore-web** | `apps/explore-web/` | App publique (`carte.runesdechene.com`) |
| **hub** | `apps/hub/` | Back-office (`hub.runesdechene.com`) |
| **seo-pages** | `apps/seo-pages/` | Pages SEO Node.js (`carte.runesdechene.com/lieu/*`) |
| **Supabase** | `supabase/` | DB + migrations + RPCs |
| **Boutique Shopify** | externe | E-commerce `runesdechene.com` |

Commandes, stack et règles spécifiques par app : voir `apps/<app>/CLAUDE.md`.

## Conventions monorepo-wide

- **pnpm** uniquement (jamais npm/yarn). `npx` seulement pour `supabase`.
- **TypeScript strict** — pas de `any`
- **Conventional Commits**
- **Migrations SQL** numérotées dans `supabase/migrations/`
- **Déploiement Netlify manuel**, jamais d'auto-deploy Git

Détail par zone : `~/citadelle/📱 L'application (La Carte)/🛠️ DEV/_Index DEV.md`
