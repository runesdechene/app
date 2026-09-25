# Runes de Chêne — Monorepo

> pnpm workspaces · TypeScript strict · Supabase · Netlify
> Mémoire unifiée : **Mon Cerveau** (Obsidian) + **Graphify** + **Context7**

> ⚠️ **Mis à jour le 25/09/2026.** Le vault Citadelle a été fusionné dans **Mon Cerveau**
> (`\\EGIDE\Uriel Lahoussaye\🧠 Mon Cerveau\`) et le symlink `~/citadelle` supprimé — tout renvoi
> vers lui est mort. Le contexte d'Uriel se charge désormais tout seul par le noyau
> (`~/.claude/CLAUDE.md`) ; il n'y a plus d'identité d'agent à aller chercher.

## 4-Layer Query Rule

Avant de lire un fichier brut, interroger dans cet ordre :

1. **Lib externe** (React, Supabase, Netlify, Tailwind, MapLibre…) → **Context7 MCP**
2. **Structure/relation code local** → **Graphify** (`graphify-out/graph.json`)
3. **Domaine/marque/décision/préférence** → le vault **Mon Cerveau**, par lecture directe : `Projets/Runes de Chêne/Dev.md` (produit), `Identité.md` (les mots), `_Socle/Méthode.md` (comment travailler). *(Le MCP Obsidian pointe encore vers le plugin de Citadelle : hors service tant qu'il n'est pas réinstallé.)*
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
| **Mon Cerveau** | `\\EGIDE\Uriel Lahoussaye\🧠 Mon Cerveau\` | Vault unique — décisions, état, identité — **pas** le code |
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

> ⚠️ Le renvoi qui vivait ici — `~/citadelle/📱 L'application (La Carte)/🛠️ DEV/_Index DEV.md` —
> visait un dossier **vidé le 18/08/2026** puis archivé. L'état réel du produit se lit dans
> `Projets/Runes de Chêne/Dev.md` du vault ; l'état réel du **code**, ici même, via
> `graphify-out/GRAPH_REPORT.md` et `docs/db/`.
