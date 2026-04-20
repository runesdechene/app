# Runes de Chêne — Monorepo

> pnpm workspaces · TypeScript strict · Supabase · Netlify
> Mémoire unifiée : **La Citadelle** (Obsidian) + **Graphify** + **Context7**

## Protocole de démarrage — OBLIGATOIRE

### Déclencheurs (cas où ce protocole s'exécute)

- Le premier message de chaque session qui mentionne un domaine de travail
- Formulations reconnues : *"Sujet : X"*, *"Sujet X"*, *"On bosse sur X"*, *"On parle de X"*
- Ou toute question dont le domaine est identifiable (boutique, app, marque, festivals, com, etc.)

### Actions requises (dans cet ordre, AVANT toute réponse)

**Étape 1** — Exécuter immédiatement :
```
Read("~/citadelle/CLAUDE.md")
```
Ne pas commenter, ne pas résumer — juste l'avoir en contexte.

**Étape 2** — Consulter la section "## 2. Routing par intent" de ce fichier Citadelle et identifier la ligne correspondant au sujet annoncé.

**Étape 3** — Exécuter les Read des fichiers listés "Charger en priorité" pour cette ligne (souvent : 1 VUE + 1 note DEV + 1 Backlog + 1 INDEX). Utiliser Obsidian MCP si disponible, sinon Read direct via symlink.

**Étape 4** — Maintenant seulement, répondre à la demande de l'utilisateur avec le contexte chargé.

### Exemple concret

> Utilisateur : *"Sujet : boutique en ligne"*

Actions :
1. `Read("~/citadelle/CLAUDE.md")`
2. Trouver ligne "Boutique en ligne / Shopify" dans routing table
3. `Read("~/citadelle/📋 VUE - Boutique en ligne.md")` + `Read("~/citadelle/⛩️ La Marque/🌐 La boutique en ligne/DEV - Notes techniques.md")` + `Read("~/citadelle/Backlogs/Backlog - Boutique en ligne.md")`
4. Répondre : *"OK, contexte chargé : thème Crépuscule (fork Heritage v3.2.1), jamais MAJ Heritage, mix CA 30%/70%, 4 chantiers en backlog. Sur quoi on attaque ?"*

### Ne JAMAIS

- ❌ Demander à l'utilisateur "qu'est-ce que tu veux faire ?" sans avoir lu Citadelle d'abord
- ❌ Répondre depuis la mémoire ou le CLAUDE.md repo seul (il ne contient que les conventions code)
- ❌ Supposer le sens du sujet sans consulter la VUE + notes associées

### Fallback

Si `~/citadelle` inaccessible : vérifier qu'Obsidian est ouvert. Fallback NAS : `\\EGIDE\Runes de Chêne\👑 LA CITADELLE\`. Signaler explicitement le mode dégradé.

## HARD GATE — Avant toute action code

**STOP. Tu ne crées, modifies ou supprimes AUCUN fichier tant que ces checks ne sont pas passés.**

1. **Graphify présent ?** → `ls graphify-out/graph.json` — si absent, STOP et demander à Uriel
2. **Schema DB lu ?** → Suivre `_Index DEV → Gotchas → [[Schema DB — noms de colonnes]]` — ne JAMAIS deviner un nom de colonne
3. **Routing Obsidian suivi ?** → Citadelle CLAUDE.md → table routing → lire les notes liées dans l'ordre. PAS de search_vault en freestyle
4. **Bon repo confirmé ?** → `hostname` → `_system/machines.md` → vérifier qu'on est au bon chemin

**Si un check échoue → STOP et demander. Ne pas contourner. Ne pas "aller plus vite".**

---

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
