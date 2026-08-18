# Runes de Chêne — Monorepo

> pnpm workspaces · TypeScript strict · Supabase · Netlify
> Mémoire unifiée : **La Citadelle** (Obsidian) + **Graphify** + **Context7**

> Identité de l'agent et HARD GATE : `_ContexteIA/Équipe/<nom>.md`.
> Où poser le code, quand pusher, anti-patterns : **`docs/xo-discipline.md`** — source de vérité unique.
> Le vault `~/citadelle/` : voir « Quand ouvrir la Citadelle » en bas. Jamais au démarrage.

## 4-Layer Query Rule

Avant de lire un fichier brut, interroger dans cet ordre :

1. **Lib externe** (React, Supabase, Netlify, Tailwind, MapLibre…) → **Context7 MCP**
2. **Structure/relation code local** → **Graphify** (`graphify-out/graph.json`)
3. **Domaine/marque/décision/préférence** → **Obsidian MCP** (Citadelle)
4. **Édition ou fallback** → **Read** du fichier brut

## Graphify

- Avant toute question architecture/codebase : **lire `graphify-out/GRAPH_REPORT.md`** (god nodes, communautés)
- Si `graphify-out/wiki/index.md` existe : naviguer via le wiki plutôt que les fichiers bruts

**Auto via post-commit hook** (`.git/hooks/post-commit`) :
- Rebuild AST sur tout commit (zone `graphify-hook-start/end`)
- Lance `scripts/graphify-sql.py` si le commit touche `supabase/migrations/` (zone `graphify-sql-hook-start/end`)

**Rebuilds manuels (rares)** :
- Code TS/TSX : `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`
- SQL : `python3 scripts/graphify-sql.py` (idempotent)

Les deux pipelines sont indépendantes — les nodes SQL (`category: "sql"`) survivent au rebuild AST.

## Ecosystem

| Projet | Lieu | Rôle |
|--------|------|------|
| **La Citadelle** | `~/citadelle/` (symlink) | Vault marque + concept + arbitrages — **pas** le code |
| **explore-web** | `apps/explore-web/` | App publique (`app.runesdechene.com`) |
| **hub** | `apps/hub/` | Back-office (`hub.runesdechene.com`) |
| **seo-pages** | `apps/seo-pages/` | Pages SEO Node.js (`app.runesdechene.com/lieu/*`) |
| **Supabase** | `supabase/` | DB + migrations + RPCs |
| **Boutique Shopify** | `../shopify (Runes de Chêne)/` (voisin) | Thème Crépuscule, e-commerce `runesdechene.com` |

Commandes, stack et règles spécifiques par app : voir `apps/<app>/CLAUDE.md`.

### Repo voisin — thème Shopify (accès cross-repo, PAS de fusion)

Décision 2026-06-14 : le thème Shopify reste un **repo séparé**, voisin sur le disque (`../shopify (Runes de Chêne)/`) — pipelines, Graphify et déploiements distincts. Mais il **consomme des RPC anon de CE monorepo** et reçoit des push du hub, donc un changement ici peut impacter le thème :

- `supabase/functions/` + `supabase/migrations/` — RPC anon lues par le thème : `get_community_photos_by_product` (mur « Ils nous portent »), `get_fragment_unlocks_by_product` (bloc app-unlock fiche produit). **Modifier/supprimer une de ces RPC casse une section du thème** → vérifier l'usage côté `../shopify (Runes de Chêne)/sections/`.
- `apps/hub/` — pousse avis & photos communautaires vers le thème.

> Graphify n'indexe pas le Liquid → le thème n'est pas dans ce graphe. Sa source de design/contenu vit dans son propre repo (`docs/superpowers/`).

## Conventions monorepo-wide

- **pnpm** uniquement (jamais npm/yarn). `npx` seulement pour `supabase`.
- **TypeScript strict** — pas de `any`
- **Conventional Commits**
- **Migrations SQL** numérotées dans `supabase/migrations/`. **Canal unique = `npx supabase db push --linked`** (jamais MCP `apply_migration` ni dashboard SQL : ils créent des orphelins timestamp et cassent `db push`). Tout `CREATE OR REPLACE` se base sur la def **LIVE** (`pg_get_functiondef`). Détail : `docs/db/migrations-workflow.md` (un hook deny bloque `apply_migration`).
- **Déploiement Netlify manuel**, jamais d'auto-deploy Git

## Quand ouvrir la Citadelle

Le vault `~/citadelle/` est le QG de la marque, pas de la technique. **Ne pas le lire au
démarrage** — un agent qui code n'en a pas besoin pour commencer.

L'ouvrir **seulement si** la réponse dépend d'une décision d'entreprise plutôt que du code :

| Si je me demande | J'ouvre |
|---|---|
| Ce que l'app *veut dire* — concept, game design, ce qu'un joueur doit ressentir | `L'app/🎮 Bible Game Design.md`, `L'app/Décisions Game Design 2026.md` |
| Comment Uriel veut qu'on déploie, qu'on release, qu'on reprenne sur un autre poste | `L'app/Préférences Uriel.md` |
| Le ton, le nom d'une fonctionnalité, un mot affiché à l'utilisateur | `🍁 Identité.md`, `📣 Communication/` |
| Si un arbitrage a déjà été tranché (pour ne pas le retrancher) | `_ContexteIA/xo-status.md` |

**Ne PAS y chercher** : l'état réel du code, un nom de colonne, une signature de RPC, ce que
fait l'app *aujourd'hui*. Ça vit ici — `graphify-out/`, `docs/db/`, `docs/superpowers/`. Le
vault décrit l'intention, le repo décrit le fait ; quand les deux divergent, **le repo a raison
sur le code** et la note du vault est à corriger.

> ⚠️ `📱 L'application (La Carte)/` est un dossier **vidé** — l'ancien « cimetière de specs ».
> Le dossier vivant est `L'app/`. Plusieurs notes renvoient encore vers l'ancien nom.

> Le `xo-status.md` du vault porte les tâches d'entreprise (contenu, boutique, production).
> Celui d'ici ne porte que le dev. Une tâche qui ne se livre pas en commit n'a rien à faire ici.
