# Runes de Chêne — Monorepo

> pnpm workspaces · TypeScript strict · Supabase · Netlify
> Mémoire unifiée : **La Citadelle** (Obsidian) + **Graphify** + **Context7**

## Démarrage — Règle N°1

Lire `~/citadelle/CLAUDE.md` (symlink vers le vault Citadelle). Ce fichier contient :
- Le protocole ingest (scanner `_Inbox/`)
- Le routing par intent
- La 4-Layer Query Rule

Si `~/citadelle` inaccessible : vérifier qu'Obsidian est ouvert et que le vault est synchronisé. Fallback NAS : `\\EGIDE\Runes de Chêne\👑 LA CITADELLE\`. Mode dégradé en dernier recours.

## 4-Layer Query Rule

Avant de lire un fichier brut, interroger dans cet ordre :

1. **Question lib externe** (React, Supabase, Netlify, Tailwind…) → **Context7 MCP**
2. **Structure/relation du code local** → **Graphify** (`graphify-out/graph.json`)
3. **Question domaine/marque/décision/préférence** → **Obsidian MCP** (semantic search Citadelle)
4. **Édition ou fallback** → **Read** du fichier brut

## Entrée dev détaillée

Pour tout ce qui concerne le dev de l'app (conventions, gotchas, architecture, décisions, préférences, bugs récurrents) :

**`~/citadelle/📱 L'application (La Carte)/🛠️ DEV/_Index DEV.md`**

## Commandes rapides

```bash
pnpm dev                # explore-web (port 3000)
pnpm --filter hub dev   # hub (port 3001)
pnpm build              # build explore-web
pnpm --filter hub build # build hub
graphify update .       # régénérer l'index code
```

## Conventions critiques (détail : Citadelle → DEV/Conventions/)

- **pnpm** uniquement (jamais npm/yarn). `npx` seulement pour `supabase`.
- **TypeScript strict** — pas de `any`
- **Conventional Commits**
- **Migrations SQL** numérotées dans `supabase/migrations/`
- **Déploiement Netlify manuel**, jamais d'auto-deploy Git

## Ecosystem

| Projet | Lieu | Rôle |
|--------|------|------|
| **La Citadelle** | `~/citadelle/` (symlink) | QG partagé (marque + dev + stratégie) |
| **explore-web** | `apps/explore-web/` | Application (carte.runesdechene.com) |
| **hub** | `apps/hub/` | Back-office (hub.runesdechene.com) |
| **Supabase** | `supabase/` | DB + migrations + RPCs |
| **Boutique Shopify** | externe | E-commerce runesdechene.com |

## Déploiement Netlify (rappel)

explore-web :
```bash
cd apps/explore-web && netlify deploy --prod --dir "$PWD/dist" --no-build
```

hub (⚠️ `--functions` obligatoire pour Shopify) :
```bash
cd apps/hub && netlify deploy --prod --dir "$PWD/dist" --functions "$PWD/netlify/functions" --no-build
```

Détail complet : `~/citadelle/📱 L'application (La Carte)/🛠️ DEV/Architecture/Deploy.md`

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
