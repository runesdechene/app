# Mémoire unifiée : Citadelle + Graphify — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer OpenWolf + auto-memory Claude Code par une mémoire unifiée Citadelle (vault Obsidian) + Graphify (AST code) + Context7 (docs externes) + Obsidian MCP (semantic search + Dataview + Templater).

**Architecture:** Stack 4 couches avec CLAUDE.md slim en routeur. Citadelle vit sur NAS + Obsidian Sync, accédée via symlink `~/citadelle/`. Graphify indexe le code local, Context7 fournit docs externes fraîches, Obsidian MCP interroge le vault.

**Tech Stack:** Obsidian + plugins (Dataview, Templater, obsidian-connect-mcp) · Graphify CLI · Context7 MCP · symlinks cross-machine · Markdown vendor-neutral.

**Spec source:** `docs/superpowers/specs/2026-04-14-memoire-citadelle-graphify-design.md`

---

## Préambule — Décisions à trancher avant démarrage

Avant Phase 0, Uriel tranche les 4 décisions ouvertes de la spec :

- [ ] **Décision A** — `graphify-out/` : `.gitignore` (défaut) ou committé ?
- [ ] **Décision B** — MCP server : `obsidian-connect-mcp` (défaut, Dataview natif) ou `obsidian-mcp-tools` ?
- [ ] **Décision C** — Canvas : créer dès Phase 1 ou différer ?
- [ ] **Décision D** — Chemin local exact d'Obsidian Sync sur ce PC (pour créer le symlink)

Ces choix figent le reste du plan. Noter les décisions ici avant de continuer.

---

## Phase 0 — Setup outils

### Task 1 : Installer Graphify

**Files:**
- Modify: `package.json` (ou global : installation pnpm/npx selon préférence)

- [ ] **Step 1 : Vérifier Python disponible**

```bash
python --version
```
Expected: Python 3.10+ ou message d'erreur → installer Python d'abord.

- [ ] **Step 2 : Installer Graphify via pipx**

```bash
pipx install graphify
```

Si pipx absent : `pip install --user pipx && pipx ensurepath` puis rouvrir le shell.

- [ ] **Step 3 : Vérifier installation**

```bash
graphify --version
graphify --help
```
Expected: version affichée, liste de commandes.

- [ ] **Step 4 : Premier run sur le repo**

```bash
cd "C:/Users/uriel/Desktop/DEVs/app (Runes de Chêne)"
graphify . --update
```
Expected: création de `graphify-out/` avec `graph.json`, `graph.html`, `GRAPH_REPORT.md`. Durée < 2 min.

- [ ] **Step 5 : Sanity check du GRAPH_REPORT.md**

Ouvrir `graphify-out/GRAPH_REPORT.md` et vérifier :
- Les "god nodes" incluent des fichiers reconnaissables (ex: `App.tsx`, `place-actions.ts`)
- Le nombre de nodes/edges est cohérent (centaines, pas des milliers ou dizaines)
- Les clusters correspondent à des zones logiques (auth, map, conquest, etc.)

Si aberrant : inspecter la config Graphify, revoir les fichiers ignorés.

- [ ] **Step 6 : Appliquer Décision A (`graphify-out/` git)**

Si `.gitignore` :
```bash
echo "graphify-out/" >> .gitignore
```

Si committé : laisser tel quel, commit en fin de phase.

- [ ] **Step 7 : Tester une query Graphify**

```bash
graphify query "where is claim_place called"
```
Expected: retour structuré avec nodes, edges, confidence scores. Temps < 5 sec.

- [ ] **Step 8 : Commit**

```bash
git add .gitignore
git commit -m "chore: add graphify-out to gitignore (or: add graphify baseline)"
```

---

### Task 2 : Installer les plugins Obsidian

**Files:** (aucun dans le repo — actions dans Obsidian)

- [ ] **Step 1 : Ouvrir Obsidian, pointer vers le vault Citadelle**

Si Obsidian pas installé : installer depuis obsidian.md. Ouvrir le vault via Open folder → sélectionner le dossier Obsidian Sync local du vault Citadelle (Décision D).

- [ ] **Step 2 : Activer Community Plugins**

Settings → Community plugins → Turn on community plugins (accepter le warning).

- [ ] **Step 3 : Installer Dataview**

Browse → chercher "Dataview" → Install → Enable.
Expected: le plugin apparaît dans la liste des installés, activé.

- [ ] **Step 4 : Installer Templater**

Browse → chercher "Templater" → Install → Enable.

- [ ] **Step 5 : Configurer Templater**

Settings → Templater → Template folder location : `_templates` (sera créé Phase 1).

- [ ] **Step 6 : Installer le plugin MCP choisi (Décision B)**

Si `obsidian-connect-mcp` : Browse → chercher "Obsidian Connect MCP" → Install → Enable. Noter le port (défaut 22360 ou similaire).

Si `obsidian-mcp-tools` : Browse → chercher "MCP Tools" → Install → Enable. Suivre le bouton "Install Server" dans les settings.

- [ ] **Step 7 : Vérifier les plugins actifs**

Dans le vault, créer une note test `test-dataview.md` avec :
```
\`\`\`dataview
LIST
FROM ""
LIMIT 5
\`\`\`
```
Expected: rendu automatique d'une liste de 5 notes.

- [ ] **Step 8 : Supprimer la note test**

---

### Task 3 : Installer et configurer Context7 MCP

**Files:**
- Modify: `~/.claude/settings.json` (ou équivalent config Claude Code)

- [ ] **Step 1 : Localiser la config Claude Code**

```bash
ls "$HOME/.claude/settings.json" 2>&1
```

- [ ] **Step 2 : Ajouter Context7 à `mcpServers`**

Editer le settings.json pour inclure :

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    }
  }
}
```

Si d'autres serveurs MCP sont déjà présents, ajouter la clé `context7` à l'objet existant, ne pas écraser.

- [ ] **Step 3 : Redémarrer Claude Code pour prise en compte**

Fermer et rouvrir la session Claude Code.

- [ ] **Step 4 : Vérifier que Context7 est disponible**

Dans une nouvelle session, demander : "use context7 to look up React 19 useActionState". Vérifier que Claude utilise l'outil MCP (pas sa knowledge base).

---

### Task 4 : Configurer Obsidian MCP dans Claude Code

**Files:**
- Modify: `~/.claude/settings.json`

- [ ] **Step 1 : Récupérer la commande/endpoint du plugin MCP**

Dans Obsidian : Settings → [plugin MCP choisi] → copier le port/URL ou la commande d'invocation exposée.

- [ ] **Step 2 : Ajouter à `mcpServers`**

Pour `obsidian-connect-mcp` (WebSocket, auto-discovery) :

```json
"obsidian-connect": {
  "command": "npx",
  "args": ["-y", "obsidian-connect-mcp-client"]
}
```

Pour `obsidian-mcp-tools` (binaire local) : suivre la config générée par le bouton "Install Server" dans le plugin.

Adapter selon la doc du plugin exact installé.

- [ ] **Step 3 : Redémarrer Claude Code**

- [ ] **Step 4 : Vérifier la connexion**

Obsidian doit être **ouvert** sur le vault Citadelle. Dans Claude Code, demander : "search the vault for 'Venner'". Attendre une réponse qui cite `feedback_enigma_tone.md` ou équivalent.

---

### Task 5 : Créer le symlink `~/citadelle/`

**Files:**
- Create: `~/citadelle` (symlink)

- [ ] **Step 1 : Identifier le chemin local du vault (Décision D)**

Chemin Obsidian Sync local du vault Citadelle. Exemple Windows : `C:\Users\uriel\Documents\Obsidian\Citadelle\`.

- [ ] **Step 2 : Créer le symlink (Windows)**

Ouvrir **cmd.exe en admin** (mklink nécessite admin ou Developer Mode) :

```cmd
mklink /D "C:\Users\uriel\citadelle" "C:\chemin\vers\Obsidian\Citadelle"
```

- [ ] **Step 3 : Vérifier**

```bash
ls -la ~/citadelle
```
Expected: le contenu du vault apparaît.

- [ ] **Step 4 : Tester un chemin représentatif**

```bash
ls "~/citadelle/📱 L'application (La Carte)/"
```
Expected: "🎮 Bible Game Design.md", "📐 SPEC V0.5 — De la Conquête à l'Influence.md", etc.

---

### Task 6 : Commit fin Phase 0

- [ ] **Step 1 : État git**

```bash
git status
```

- [ ] **Step 2 : Commit si changements**

```bash
git add .gitignore
git commit -m "chore(memory): phase 0 — outils installés (graphify, obsidian mcp, context7, symlink)"
```

Les configs Claude Code (`~/.claude/settings.json`) sont hors repo, pas à committer ici.

---

## Phase 1 — Préparer la Citadelle

### Task 7 : Créer l'ossature de dossiers

**Files:**
- Create: `~/citadelle/_Inbox/` (dossier)
- Create: `~/citadelle/Sources/` (dossier)
- Create: `~/citadelle/_templates/` (dossier)
- Create: `~/citadelle/log.md`
- Create: `~/citadelle/📱 L'application (La Carte)/🛠️ DEV/` + sous-dossiers

- [ ] **Step 1 : Créer dossiers racine**

```bash
mkdir -p ~/citadelle/_Inbox
mkdir -p ~/citadelle/Sources
mkdir -p ~/citadelle/_templates
```

- [ ] **Step 2 : Créer `log.md` initial**

Écrire dans `~/citadelle/log.md` :

```markdown
# Log Citadelle

> Append-only. Format : `## [YYYY-MM-DD] operation | Title`
> Operations : ingest | query | lint | setup | decision

## [2026-04-14] setup | Démarrage migration OpenWolf → Citadelle + Graphify
Phase 1 en cours. Voir `docs/superpowers/specs/2026-04-14-memoire-citadelle-graphify-design.md` dans le repo app.
```

- [ ] **Step 3 : Créer l'arbre DEV/**

```bash
cd "~/citadelle/📱 L'application (La Carte)/"
mkdir -p "🛠️ DEV"/{Architecture,Gotchas,Conventions,"Préférences Uriel",Décisions,"Bugs récurrents"}
```

- [ ] **Step 4 : Vérifier**

```bash
ls "~/citadelle/📱 L'application (La Carte)/🛠️ DEV/"
```
Expected: 6 dossiers listés.

---

### Task 8 : Créer les templates Templater

**Files:**
- Create: `~/citadelle/_templates/gotcha.md`
- Create: `~/citadelle/_templates/decision.md`
- Create: `~/citadelle/_templates/preference.md`
- Create: `~/citadelle/_templates/bug-recurrent.md`
- Create: `~/citadelle/_templates/architecture-note.md`

- [ ] **Step 1 : Template Gotcha**

Créer `~/citadelle/_templates/gotcha.md` :

```markdown
---
zone: <% tp.system.prompt("Zone (app-dev, hub, etc.)") %>
tags: [gotcha]
severity: <% tp.system.suggester(["low","medium","high"], ["low","medium","high"]) %>
last-verified: <% tp.date.now("YYYY-MM-DD") %>
source: 
---

# <% tp.file.title %>

## Symptôme


## Cause


## Fix


## Références
- 
```

- [ ] **Step 2 : Template Décision**

Créer `~/citadelle/_templates/decision.md` :

```markdown
---
zone: <% tp.system.prompt("Zone") %>
tags: [decision]
date: <% tp.date.now("YYYY-MM-DD") %>
status: actif
---

# <% tp.file.title %>

## Contexte


## Options envisagées
1. 
2. 

## Décision


## Conséquences


## Références
- 
```

- [ ] **Step 3 : Template Préférence**

Créer `~/citadelle/_templates/preference.md` :

```markdown
---
zone: preferences
tags: [preference]
last-verified: <% tp.date.now("YYYY-MM-DD") %>
---

# <% tp.file.title %>

## Règle


## Raison


## Exemples
- 

## Contre-exemples
- 
```

- [ ] **Step 4 : Template Bug récurrent**

Créer `~/citadelle/_templates/bug-recurrent.md` :

```markdown
---
zone: <% tp.system.prompt("Zone") %>
tags: [bug-recurrent]
occurrences: 1
last-seen: <% tp.date.now("YYYY-MM-DD") %>
---

# <% tp.file.title %>

## Pattern


## Trigger (quand ça revient)


## Fix type


## Références
- 
```

- [ ] **Step 5 : Template Architecture Note**

Créer `~/citadelle/_templates/architecture-note.md` :

```markdown
---
zone: <% tp.system.prompt("Zone") %>
tags: [architecture]
last-verified: <% tp.date.now("YYYY-MM-DD") %>
---

# <% tp.file.title %>

## Résumé (1-3 lignes)


## Composants
- 

## Flux / séquence


## Fichiers clés
- 

## Décisions liées
- [[...]]
```

- [ ] **Step 6 : Tester un template**

Dans Obsidian : Cmd/Ctrl-P → "Templater: Create new note from template" → gotcha → remplir les prompts. Vérifier que le frontmatter est rempli correctement.

- [ ] **Step 7 : Supprimer la note test**

---

### Task 9 : Créer `_Index DEV.md` et dashboards Dataview

**Files:**
- Create: `~/citadelle/📱 L'application (La Carte)/🛠️ DEV/_Index DEV.md`

- [ ] **Step 1 : Créer `_Index DEV.md`**

Écrire dans `~/citadelle/📱 L'application (La Carte)/🛠️ DEV/_Index DEV.md` :

````markdown
# _Index DEV

> Porte d'entrée de Claude pour toute session code sur l'app Runes de Chêne.
> À lire en premier quand la session concerne le développement.

## Zones
- **[[Architecture/]]** — stack, auth, deploy, état V0.5
- **[[Gotchas/]]** — pièges Supabase, schema DB, migrations
- **[[Conventions/]]** — code (pnpm, TS strict), workflows
- **[[Préférences Uriel/]]** — ton, feedback, style collab
- **[[Décisions/]]** — un fichier par décision datée
- **[[Bugs récurrents/]]** — patterns, pas one-off

## Dashboard — Gotchas récents

```dataview
TABLE zone, severity, last-verified
FROM "📱 L'application (La Carte)/🛠️ DEV/Gotchas"
SORT last-verified DESC
LIMIT 15
```

## Dashboard — Décisions 2026

```dataview
TABLE date, status
FROM "📱 L'application (La Carte)/🛠️ DEV/Décisions"
WHERE date >= date("2026-01-01")
SORT date DESC
```

## Health check — notes potentiellement stales

```dataview
TABLE last-verified, zone
FROM "📱 L'application (La Carte)/🛠️ DEV"
WHERE last-verified < date(today) - dur(30 days)
SORT last-verified ASC
```

## Notes orphelines

```dataview
LIST
FROM "📱 L'application (La Carte)/🛠️ DEV"
WHERE length(file.inlinks) = 0 AND !contains(file.name, "_Index")
```
````

- [ ] **Step 2 : Ouvrir `_Index DEV.md` dans Obsidian, vérifier rendu**

Les tableaux Dataview doivent rendre (vides pour l'instant — on n'a rien migré).

---

### Task 10 : Réécrire `CLAUDE.md` racine Citadelle (slim)

**Files:**
- Modify: `~/citadelle/CLAUDE.md`

- [ ] **Step 1 : Sauvegarder l'ancien CLAUDE.md**

```bash
cp ~/citadelle/CLAUDE.md ~/citadelle/CLAUDE.md.old
```

- [ ] **Step 2 : Écrire le nouveau CLAUDE.md slim**

Remplacer le contenu de `~/citadelle/CLAUDE.md` par :

```markdown
# Protocole XO — La Citadelle

> Lu automatiquement au démarrage de chaque session Claude Code.
> Schéma de routing. Les notes détaillées se trouvent via les liens.

---

## 1. Règle N°1 — Toujours en premier : ingest `_Inbox/`

Scanner `_Inbox/`. Pour chaque note :
1. Comprendre le sujet
2. Intégrer au bon endroit du vault (créer/mettre à jour la note cible)
3. Supprimer de `_Inbox/` une fois intégrée
4. Appender au `log.md` : `## [DATE] ingest | titre note`

En cas de doublon/contradiction avec une note existante : **flag à Uriel**, ne pas trancher seul.

## 2. Routing par intent

L'utilisateur annonce le sujet. Charger la zone concernée, pas tout le vault.

| Sujet annoncé | Charger en priorité |
|---------------|---------------------|
| App / code / dev | `📱 L'application (La Carte)/🛠️ DEV/_Index DEV.md` |
| Game design / énigmes | `📱 L'application (La Carte)/🎮 Bible Game Design.md` + `📜 BANQUE - Énigmes...` |
| Marque / stratégie | `🧭 STRATEGIE 2026.md` + `📋 VUE - L'entreprise.md` |
| Boutique en ligne | `📋 VUE - Boutique en ligne.md` |
| Communication / réseaux | `📋 VUE - La Communication digitale.md` |
| Infrastructure / serveurs | `📋 VUE - Infrastructure.md` |
| Missions du jour | `1.🎯 Missions Uriel.md` ou `1.🎯 Missions Mathéo.md` |

## 3. 4-Layer Query Rule

Avant de lire un fichier brut, interroger dans cet ordre :
1. **Lib/framework externe** (React, Supabase, Tailwind…) → **Context7 MCP**
2. **Structure/relation du code local** → **Graphify** (`graphify-out/graph.json` dans le repo)
3. **Domaine/marque/décision/préférence** → **Obsidian MCP** (semantic search sur Citadelle)
4. **Édition ou fallback** → **Read** du fichier brut

## 4. Opérations nommées

- **ingest** — intégrer `_Inbox/` (règle N°1)
- **query** — répondre via 4-layer rule
- **lint** — health-check : wikilinks cassés, notes orphelines, `last-verified > 30j` sur code-adjacent, contradictions

Chaque opération significative → une entrée dans `log.md`.

## 5. Règle d'or

Ne jamais se fier à la mémoire des sessions précédentes. Relire la note pertinente **au moment où on en a besoin**, pas en anticipation. Toujours vérifier `last-verified` sur les notes code-adjacent.
```

- [ ] **Step 3 : Vérifier dans Obsidian**

Ouvrir le nouveau CLAUDE.md, vérifier que les wikilinks résolvent (survol = preview visible).

---

### Task 11 : Commit Phase 1

Phase 1 = ossature vault. Pas de commit git (le vault vit hors repo). Juste valider manuellement que tout est en place :

- [ ] **Step 1 : Checklist Phase 1**

```bash
ls ~/citadelle/_Inbox ~/citadelle/Sources ~/citadelle/_templates
ls "~/citadelle/📱 L'application (La Carte)/🛠️ DEV/"
cat ~/citadelle/log.md
cat ~/citadelle/CLAUDE.md | head -20
```
Expected: tout présent, CLAUDE.md slim, log.md démarré.

---

## Phase 2 — Migration du contenu

### Task 12 : Migrer les préférences Uriel

**Sources :**
- `.wolf/cerebrum.md` (section User Preferences)
- `~/.claude/projects/C--Users-uriel-Desktop-DEVs-app--Runes-de-Ch-ne-/memory/feedback_*.md`
- `~/.claude/projects/.../memory/MEMORY.md` (section préférences)

**Files:**
- Create: `~/citadelle/📱 L'application (La Carte)/🛠️ DEV/Préférences Uriel/*.md` (notes atomiques)

- [ ] **Step 1 : Lire les sources**

```bash
cat ".wolf/cerebrum.md"
ls ~/.claude/projects/C--Users-uriel-Desktop-DEVs-app--Runes-de-Ch-ne-/memory/
```

- [ ] **Step 2 : Pour chaque préférence distincte, créer une note atomique**

Utiliser le template `preference.md` via Templater OU écrire manuellement. Exemples attendus (un fichier par préférence) :

- `Push fréquents sans confirmation.md`
- `Ton éditorial bonapartiste.md`
- `Pas d'auto-deploy Git.md`
- `Déploiement Netlify manuel.md`
- `Pnpm uniquement jamais npm.md`
- `TypeScript strict pas de any.md`

Chaque note : 20-50 lignes, frontmatter rempli, wikilinks vers notes liées.

- [ ] **Step 3 : Ajouter entrée `log.md`**

```markdown
## [2026-04-14] ingest | Migration préférences Uriel (N notes créées)
```

---

### Task 13 : Migrer Gotchas Supabase + Schema DB

**Sources :**
- MEMORY.md sections "Supabase comportement" et "Schema — pièges connus"
- `.wolf/cerebrum.md` Do-Not-Repeat (filtrer ce qui est gotcha Supabase/schema)

**Files:**
- Create: `~/citadelle/📱 L'application (La Carte)/🛠️ DEV/Gotchas/*.md`

- [ ] **Step 1 : Identifier chaque gotcha distinct**

Liste minimale (basée sur MEMORY.md actuel) :
- `Select single ne throw pas.md`
- `STABLE ignore UPDATE silencieusement.md`
- `RPC toujours destructurer data error.md`
- `Places author_id pas created_by.md`
- `Places_bookmarked pas bookmarks.md`
- `Users display_name pas last_name.md`
- `Activity_log colonnes specifiques.md`
- `Claim_place retourne ok pas success.md`
- `AnchorPlaceId migre noms apres fusion.md`
- `Migrations backfill disable triggers.md`

- [ ] **Step 2 : Pour chaque, créer la note via template `gotcha.md`**

Chaque note : 30-50 lignes, sections Symptôme/Cause/Fix/Références remplies. Frontmatter `severity` selon impact.

- [ ] **Step 3 : Wikilinks croisés**

Ex : `Select single ne throw pas.md` link vers `RPC toujours destructurer data error.md` (même famille).

- [ ] **Step 4 : Entrée `log.md`**

```markdown
## [2026-04-14] ingest | Migration gotchas Supabase et schema DB (N notes)
```

---

### Task 14 : Migrer Conventions code et workflows

**Sources :**
- Repo `CLAUDE.md` (section Conventions globales)
- `apps/explore-web/CLAUDE.md` et `apps/hub/CLAUDE.md` (sections conventions)
- MEMORY.md section "Workflow avec Uriel"

**Files:**
- Create: `~/citadelle/📱 L'application (La Carte)/🛠️ DEV/Conventions/*.md`

- [ ] **Step 1 : Notes à créer**

- `Stack et outils.md` (pnpm, TypeScript strict, Conventional Commits)
- `Migrations SQL workflow.md` (npx supabase, versioning, lecture avant réécriture)
- `Deploiement Netlify.md` (commandes exactes, --dir absolu, --functions pour hub)
- `DB de dev actuelle.md` (travail sur prod alpha, future DB dev)

- [ ] **Step 2 : Remplir avec contenu condensé**

Reprendre le contenu existant, condenser, éliminer redondance.

- [ ] **Step 3 : Entrée `log.md`**

---

### Task 15 : Migrer Architecture (Auth + Deploy + État V0.5)

**Sources :**
- MEMORY.md sections "Architecture Auth / Users", "Déploiement", "Images", "V0.5 — État d'avancement"

**Files:**
- Create: `~/citadelle/📱 L'application (La Carte)/🛠️ DEV/Architecture/Auth et utilisateurs.md`
- Create: `~/citadelle/📱 L'application (La Carte)/🛠️ DEV/Architecture/Deploy.md`
- Create: `~/citadelle/📱 L'application (La Carte)/🛠️ DEV/Architecture/Images et storage.md`
- Create: `~/citadelle/📱 L'application (La Carte)/🛠️ DEV/Architecture/État V0.5.md`

- [ ] **Step 1 : Créer chaque note via template `architecture-note.md`**

Sections : Résumé (1-3 lignes) / Composants / Flux / Fichiers clés / Décisions liées.

- [ ] **Step 2 : `last-verified: 2026-04-14` dans frontmatter**

- [ ] **Step 3 : Wikilinks vers décisions pertinentes (créées Task 16) et vers fichiers code**

Ex : `Deploy.md` link vers `Pas d'auto-deploy Git.md` (Décision) et mentionne chemins :
```
Voir : `apps/explore-web/` et `apps/hub/`.
Graphify : cluster "deploy" dans GRAPH_REPORT.md.
```

- [ ] **Step 4 : Entrée `log.md`**

---

### Task 16 : Migrer Décisions (Do-Not-Repeat + décisions historiques)

**Sources :**
- `.wolf/cerebrum.md` sections Do-Not-Repeat et Decision Log

**Files:**
- Create: `~/citadelle/📱 L'application (La Carte)/🛠️ DEV/Décisions/YYYY-MM-DD-<topic>.md`

- [ ] **Step 1 : Pour chaque décision datée dans cerebrum.md, créer une note**

Format : `YYYY-MM-DD-<topic>.md`. Exemples à extraire :
- `2026-02-XX-conquest-to-influence.md`
- `2026-02-XX-titles-glory-threshold.md`
- etc. (dater selon commits git correspondants si cerebrum.md n'a pas les dates)

- [ ] **Step 2 : Utiliser template `decision.md`**

Sections : Contexte / Options / Décision / Conséquences.

- [ ] **Step 3 : Pour chaque Do-Not-Repeat, décider :**

- Si c'est une gotcha → déjà dans `Gotchas/` (skip)
- Si c'est un choix architectural → note Décision
- Si c'est une leçon générale → note dans `Préférences Uriel/` ou `Conventions/`

- [ ] **Step 4 : Entrée `log.md`**

---

### Task 17 : Migrer Bugs récurrents (patterns seulement)

**Sources :**
- `.wolf/buglog.json`

**Files:**
- Create: `~/citadelle/📱 L'application (La Carte)/🛠️ DEV/Bugs récurrents/*.md`

- [ ] **Step 1 : Lire le buglog.json**

```bash
cat ".wolf/buglog.json" | jq '.[] | {id, error_message, tags, occurrences}'
```

- [ ] **Step 2 : Filtrer les bugs avec `occurrences > 1` OU tags transversaux**

Les one-off déjà fix → SKIP (le code est la vérité).

- [ ] **Step 3 : Pour chaque pattern, créer note via template `bug-recurrent.md`**

Exemples attendus :
- `Toast cascade quand backfill active.md`
- `Images collapse min-width.md` (si récurrent)

- [ ] **Step 4 : Entrée `log.md`**

---

### Task 18 : Fin Phase 2 — état des lieux

- [ ] **Step 1 : Compter les notes migrées**

```bash
find "~/citadelle/📱 L'application (La Carte)/🛠️ DEV/" -name "*.md" | wc -l
```
Expected: 20+ notes.

- [ ] **Step 2 : Ouvrir `_Index DEV.md` dans Obsidian**

Vérifier que les Dataview dashboards se remplissent (Gotchas, Décisions, Health check).

- [ ] **Step 3 : Entrée récap dans `log.md`**

```markdown
## [2026-04-14] setup | Phase 2 complétée — N notes migrées dans DEV/
```

---

## Phase 3 — Bascule

### Task 19 : Réécrire `CLAUDE.md` racine repo

**Files:**
- Modify: `C:/Users/uriel/Desktop/DEVs/app (Runes de Chêne)/CLAUDE.md`

- [ ] **Step 1 : Lire l'ancien CLAUDE.md**

```bash
cat "CLAUDE.md"
```

- [ ] **Step 2 : Sauvegarder pour rollback**

```bash
cp CLAUDE.md CLAUDE.md.openwolf-era
```

- [ ] **Step 3 : Écrire le nouveau CLAUDE.md slim**

Remplacer le contenu par :

```markdown
# Runes de Chêne — Monorepo

> pnpm workspaces · TypeScript strict · Supabase · Netlify
> Mémoire unifiée : Citadelle (Obsidian) + Graphify + Context7

## Démarrage — Règle N°1

Lire `~/citadelle/CLAUDE.md` (symlink vers le vault Citadelle). Ce fichier contient :
- Le protocole ingest (scanner `_Inbox/`)
- Le routing par intent
- La 4-Layer Query Rule

Si `~/citadelle` inaccessible : vérifier Obsidian ouvert + Obsidian Sync actif sur cette machine. Fallback NAS : `\\EGIDE\Runes de Chêne\👑 LA CITADELLE\`.

## 4-Layer Query Rule

1. Question lib externe (React, Supabase…) → **Context7 MCP**
2. Question structure code local → **Graphify** (`graphify-out/graph.json`)
3. Question domaine/marque/décision → **Obsidian MCP** (semantic search Citadelle)
4. Édition ou fallback → **Read** fichier brut

## Commandes rapides

\`\`\`bash
pnpm dev                # explore-web (port 3000)
pnpm --filter hub dev   # hub (port 3001)
pnpm build              # build explore-web
pnpm --filter hub build # build hub
graphify . --update     # régénérer l'index code
\`\`\`

## Conventions critiques (détail : Citadelle → DEV/Conventions/)

- **pnpm** uniquement (jamais npm/yarn). `npx` seulement pour supabase.
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

Pour le détail dev de chaque app, voir `~/citadelle/📱 L'application (La Carte)/🛠️ DEV/_Index DEV.md`.
```

- [ ] **Step 4 : Diff check**

```bash
git diff CLAUDE.md
```
Expected: diff cohérent, anciennes sections OpenWolf supprimées.

---

### Task 20 : Simplifier les CLAUDE.md des apps

**Files:**
- Modify: `apps/explore-web/CLAUDE.md`
- Modify: `apps/hub/CLAUDE.md`

- [ ] **Step 1 : Lire les CLAUDE.md des apps**

```bash
cat apps/explore-web/CLAUDE.md
cat apps/hub/CLAUDE.md
```

- [ ] **Step 2 : Identifier le contenu à migrer dans la Citadelle (si pas déjà fait Phase 2)**

Si du contenu est spécifique à l'app et non migré → le migrer maintenant vers `DEV/Architecture/App explore-web.md` ou `DEV/Architecture/App hub.md`.

- [ ] **Step 3 : Réécrire `apps/explore-web/CLAUDE.md`**

Format slim :

```markdown
# explore-web — La Carte

> App publique. Port dev 3000. Prod : carte.runesdechene.com (Netlify).

Pour la mémoire projet (conventions, gotchas, décisions) : voir `~/citadelle/📱 L'application (La Carte)/🛠️ DEV/_Index DEV.md`.

Pour la structure code : interroger Graphify (`graphify-out/graph.json` à la racine du monorepo).

## Spécificités cette app

- React + Vite + TypeScript strict
- Supabase client initialisé dans `src/lib/supabaseClient.ts`
- Bundle deploy : `cd apps/explore-web && netlify deploy --prod --dir "$PWD/dist" --no-build`

(Tout le reste : Citadelle)
```

- [ ] **Step 4 : Réécrire `apps/hub/CLAUDE.md`**

Même approche, slim, pointe vers Citadelle.

---

### Task 21 : Test de session fraîche

- [ ] **Step 1 : Fermer complètement Claude Code**

- [ ] **Step 2 : Rouvrir une nouvelle session dans le repo**

- [ ] **Step 3 : Poser une question test : "Qu'est-ce qu'on doit savoir sur le deploy Netlify ?"**

Expected:
- Claude charge `CLAUDE.md` racine repo (slim)
- Suit le lien vers `~/citadelle/CLAUDE.md`
- Interroge Obsidian MCP ou Read `DEV/Architecture/Deploy.md`
- Ne mentionne pas `.wolf/*`

- [ ] **Step 4 : Poser une question code : "où est appelé `claim_place` ?"**

Expected: Claude utilise Graphify (pas Grep massif sur tout le repo).

- [ ] **Step 5 : Poser une question API externe : "la syntaxe useActionState de React 19 ?"**

Expected: Claude utilise Context7.

Si un de ces 3 tests échoue → rollback Phase 3 (CLAUDE.md.openwolf-era), diagnostiquer avant Phase 4.

---

### Task 22 : Commit bascule

- [ ] **Step 1 : Commit**

```bash
git add CLAUDE.md apps/explore-web/CLAUDE.md apps/hub/CLAUDE.md
git rm CLAUDE.md.openwolf-era
git commit -m "chore(memory): bascule CLAUDE.md vers Citadelle + Graphify + Context7"
```

Garder `CLAUDE.md.openwolf-era` uncommitted pendant 1 semaine en local au cas où.

---

## Phase 4 — Nettoyage

### Task 23 : Archiver `.wolf/`

**Files:**
- Delete (via git): `.wolf/` entier

- [ ] **Step 1 : Vérifier que tout le contenu utile est migré**

Relire `.wolf/cerebrum.md`, `.wolf/buglog.json` — confirmer que chaque info pertinente est dans la Citadelle.

- [ ] **Step 2 : Renommer `.wolf/` en `.wolf-archive/` localement (sécurité 1 semaine)**

```bash
mv .wolf .wolf-archive
```

- [ ] **Step 3 : Ajouter `.wolf-archive/` au `.gitignore`**

```bash
echo ".wolf-archive/" >> .gitignore
```

- [ ] **Step 4 : Supprimer `.wolf/` du tracking git**

```bash
git rm -r --cached .wolf 2>/dev/null || true
git rm -r .wolf 2>/dev/null || true
```

- [ ] **Step 5 : Commit**

```bash
git add .gitignore
git commit -m "chore(memory): archive .wolf/ (OpenWolf remplacé par Citadelle)"
```

---

### Task 24 : Désactiver auto-memory Claude Code

**Files:**
- Delete: contenu de `~/.claude/projects/C--Users-uriel-Desktop-DEVs-app--Runes-de-Ch-ne-/memory/*.md`

- [ ] **Step 1 : Lister les fichiers**

```bash
ls ~/.claude/projects/C--Users-uriel-Desktop-DEVs-app--Runes-de-Ch-ne-/memory/
```

- [ ] **Step 2 : Vérifier que tout est migré**

Confirmer que le contenu de chaque `feedback_*.md` et `MEMORY.md` a une contrepartie dans la Citadelle.

- [ ] **Step 3 : Vider les fichiers OU remplacer `MEMORY.md` par un pointeur**

Option A — vidage complet :
```bash
rm ~/.claude/projects/C--Users-uriel-Desktop-DEVs-app--Runes-de-Ch-ne-/memory/feedback_*.md
# Laisser MEMORY.md exister mais vide/minimal
```

Option B — remplacer `MEMORY.md` par un pointeur (sûr si Claude Code exige sa présence) :

```markdown
# Memory — Runes de Chêne

> **Mémoire migrée vers La Citadelle** (vault Obsidian).
> Point d'entrée : `~/citadelle/CLAUDE.md`
> Détail dev : `~/citadelle/📱 L'application (La Carte)/🛠️ DEV/_Index DEV.md`
```

- [ ] **Step 4 : Tester qu'une nouvelle session charge bien peu**

Relancer Claude Code, vérifier que `MEMORY.md` ne s'étale pas dans le contexte.

---

## Phase 5 — Premier lint + log final

### Task 25 : Première passe de lint

- [ ] **Step 1 : Demander à Claude : "lint la Citadelle"**

Dans une session fraîche, demander explicitement un lint. Claude doit :
- Parcourir `DEV/` et les zones touchées
- Détecter les wikilinks cassés
- Détecter les notes orphelines (0 inlinks)
- Détecter les `last-verified` > 30j sur code-adjacent (normal, tout est récent là)
- Détecter les contradictions éventuelles

- [ ] **Step 2 : Fixer les issues trouvées**

Pour chaque problème : corriger ou flagguer dans `_Inbox/lint-issues.md` si résolution non-triviale.

---

### Task 26 : Entrée log finale de migration

**Files:**
- Modify: `~/citadelle/log.md`

- [ ] **Step 1 : Ajouter l'entrée finale**

Appender à `~/citadelle/log.md` :

```markdown
## [2026-04-14] setup | Migration complète OpenWolf → Citadelle + Graphify
- Phase 0 : outils installés (Graphify, Obsidian MCP, Context7, symlink)
- Phase 1 : ossature Citadelle créée (_Inbox, Sources, DEV/, templates)
- Phase 2 : N notes migrées (préférences, gotchas, conventions, archi, décisions, bugs récurrents)
- Phase 3 : CLAUDE.md basculés (repo + apps) vers routing Citadelle
- Phase 4 : .wolf/ archivé, auto-memory désactivée
- Phase 5 : premier lint, vault en état sain
- Spec : `docs/superpowers/specs/2026-04-14-memoire-citadelle-graphify-design.md`
- Plan : `docs/superpowers/plans/2026-04-14-memoire-citadelle-graphify.md`
```

---

### Task 27 : Validation finale (critères succès)

- [ ] **Step 1 : Vérifier chaque critère de succès de la spec**

- [ ] Aucun retour à `.wolf/*` pendant la validation
- [ ] Démarrage de session < 500 tokens de contexte chargé (observable au premier message de Claude)
- [ ] Une passe de lint exécutée (Task 25)
- [ ] `_Inbox/` vide à la fin
- [ ] 20+ notes migrées dans `DEV/` (Task 18)
- [ ] Une requête Context7 réussie (Task 21 Step 5)
- [ ] Une requête Graphify réussie (Task 21 Step 4)
- [ ] Une requête Obsidian MCP réussie (Task 21 Step 3)

- [ ] **Step 2 : Commit final si nécessaire**

```bash
git status
# Si des changements non-committés, commit
```

- [ ] **Step 3 : Annoncer la complétion**

"Migration terminée. Observer le comportement pendant 1-2 semaines. Mathéo onboarding à planifier."

---

## Rollback si besoin

À tout moment avant Phase 4 Task 23 :

```bash
# Restaurer les CLAUDE.md
cp CLAUDE.md.openwolf-era CLAUDE.md
# .wolf/ existe encore (pas archivé avant Task 23)
git checkout -- apps/explore-web/CLAUDE.md apps/hub/CLAUDE.md
```

Après Task 23 (archivage `.wolf/`) :

```bash
mv .wolf-archive .wolf
git checkout -- CLAUDE.md apps/explore-web/CLAUDE.md apps/hub/CLAUDE.md
```

Si `.wolf-archive/` déjà supprimé (> 1 semaine) : récupérer depuis l'historique git.

---

## Notes pour l'exécutant

- **Ne pas sauter les 4 Décisions** du préambule. Elles figent Phase 0.
- **Obsidian doit être ouvert** pendant toutes les tâches Phase 1+ qui utilisent MCP.
- **Le vault vit hors repo** — les changements dans `~/citadelle/` ne se committent pas. Seul le repo est versionné (CLAUDE.md, .gitignore, plan, spec).
- **Chaque Task de Phase 2 est indépendante** — peuvent être parallélisées si confortable.
- **En cas de blocage sur une tâche** : logger dans `_Inbox/blocked-<task>.md`, continuer la phase, revenir après.
