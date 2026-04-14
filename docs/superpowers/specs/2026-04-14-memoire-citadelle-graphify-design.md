# Spec — Mémoire unifiée : Citadelle + Graphify + MCPs

> Date : 2026-04-14
> Auteur : Uriel + XO (brainstorm collaboratif)
> Statut : Validé, prêt pour plan d'implémentation

---

## Contexte

Le projet utilise aujourd'hui **deux systèmes de mémoire qui tournent en parallèle** :
1. **OpenWolf** (`.wolf/OPENWOLF.md`, `cerebrum.md`, `anatomy.md`, `memory.md`, `buglog.json`)
2. **Auto-memory Claude Code** (`~/.claude/projects/.../memory/MEMORY.md`)

Ces deux systèmes chevauchent (préférences user, gotchas, do-not-repeat), chargent ~9k tokens avant tout travail, et vieillissent mal (`anatomy.md` ment, `memory.md` grossit sans fin).

En parallèle, l'entreprise dispose déjà d'un vault Obsidian structuré — **La Citadelle** — utilisé par l'équipe (Uriel, Mathéo) pour la marque, la stratégie, les missions. Il vit sur le NAS (`\\EGIDE\Runes de Chêne\👑 LA CITADELLE\`) avec synchronisation Obsidian Sync.

**Objectif** : consolider en une seule mémoire unifiée, partagée humain+IA, économe en tokens, qui vieillit bien.

---

## Vision

Un système de mémoire à **quatre couches complémentaires**, chacune répondant à un type de question différent :

```
┌────────────────────────────────────────────────────────────┐
│  CLAUDE.md slim (routing — 4-layer query rule)             │
└────────────────────────────────────────────────────────────┘
       ↓                ↓                ↓              ↓
┌────────────┐  ┌──────────────┐  ┌────────────┐  ┌─────────┐
│ Context7   │  │ Graphify     │  │ Obsidian   │  │ Read    │
│ MCP        │  │ (skill+CLI)  │  │ MCP +      │  │ raw via │
│            │  │              │  │ Citadelle  │  │ symlink │
│ Docs       │  │ Code local   │  │ Domaine/   │  │         │
│ externes   │  │ structure    │  │ marque/    │  │ Édition │
│ à jour     │  │ (AST)        │  │ décisions  │  │ fichier │
└────────────┘  └──────────────┘  └────────────┘  └─────────┘
```

### 4-Layer Query Rule (en tête du CLAUDE.md)

Avant de lire un fichier brut, interroger dans cet ordre :
1. **Question sur lib/framework externe** (React, Supabase, Tailwind…) → **Context7**
2. **Question sur structure/relation du code local** → **Graphify** (`graphify-out/graph.json`)
3. **Question sur domaine/marque/décision/préférence/gotcha** → **Obsidian MCP** (semantic search sur la Citadelle)
4. **Édition de code ou quand les 3 couches ne suffisent pas** → **Read** du fichier brut

---

## Architecture

### 1. La Citadelle (Obsidian vault)

Localisation : NAS + Obsidian Sync local, exposé sur chaque machine via symlink `~/citadelle/`.

**Zones préservées** (existantes, humain-lisibles, format intact) :
- Racine : VUES (`📋 VUE - *.md`), Missions (`🎯 Missions *.md`), Hauts-Faits, Stratégie, Briefing
- `PROTOCOLE/`, `Ressources/`, `_system/`
- `📱 L'application (La Carte)/` : Bible Game Design, SPEC V0.5, Banque énigmes

**Zones nouvelles ajoutées à la racine** :
- `_Inbox/` — dump éphémère (idées, notes à chaud). Intégré puis supprimé par Claude.
- `Sources/` — sources externes immuables (articles, PDFs, clips web). Jamais modifié, wikilinké depuis les notes.
- `log.md` — append-only chronologique. Format : `## [DATE] operation | Title`.
- `CLAUDE.md` — schéma et routing (slim, ~80 lignes max).

**Zone nouvelle dédiée au dev** :
- `📱 L'application (La Carte)/🛠️ DEV/` avec sous-dossiers :
  - `_Index DEV.md` — porte d'entrée pour les sessions code
  - `Architecture/` — stack, auth, deploy, schéma haut niveau
  - `Gotchas/` — pièges Supabase, schema DB, migrations
  - `Conventions/` — code (pnpm, TS strict), workflows
  - `Préférences Uriel/` — ton, feedback, style collab
  - `Décisions/` — un fichier par décision datée
  - `Bugs récurrents/` — patterns (pas les one-off)

### 2. Conventions d'écriture

**Toutes les notes (sauf Missions)** :
- **Condensées** pour Claude — pas de prose expansive. Exception : zones de voix (ton éditorial, vision) où le style porte l'info.
- **Atomiques** — un concept = une note, 100 lignes max. Dépassement → splitter en sous-notes wikilinkées.
- **Wikilinks agressifs** — jamais de duplication. Si une note mentionne un concept défini ailleurs, wikilink.
- **Frontmatter YAML** :
  ```yaml
  ---
  zone: app-dev | marque | strategie | boutique
  tags: [gotcha/supabase, auth]
  status: actif | archive | brouillon
  last-verified: 2026-04-14
  ---
  ```
- **Nommage** : emojis **uniquement à la racine** (déjà en place). Sous-dossiers : noms clairs sans emojis.

**Missions** (exception) :
- Format humain complet, zéro condensation. C'est le document de travail de l'équipe.
- Écrit par Claude *pour* l'équipe, lisible à 100%.

### 3. Opérations nommées (Karpathy-style)

Trois verbes explicites dans le schéma CLAUDE.md :
- **ingest** — lire `_Inbox/`, intégrer chaque note au bon endroit du vault, supprimer de `_Inbox`. Déclenchement : règle N°1 de démarrage de session.
- **query** — répondre à une question en suivant le 4-layer query rule.
- **lint** — health-check : wikilinks cassés, notes orphelines, `last-verified > 30j` sur notes code-adjacent, contradictions. Déclenchement : sur demande user ou quand Claude détecte une incohérence.

Chaque opération significative produit une entrée dans `log.md`.

### 4. Gestion des doublons / contradictions

Quand une note de `_Inbox/` contredit ou dupplique un Net existant : **Claude ne tranche pas seul**. Flag à Uriel avec :
- Référence aux deux notes
- Description du conflit
- Options : écraser / fusionner / créer variante / ignorer

### 5. Graphify (structure code local)

- Installation : skill + CLI
- Run initial : `graphify . --update` à la racine du repo
- Output : `graphify-out/` (graph.json, graph.html, GRAPH_REPORT.md)
- Mode `--watch` pour mise à jour incrémentale en arrière-plan
- Cache SHA256 : seuls les fichiers modifiés sont reparsés
- Statut git : à décider Phase 0 (probablement .gitignore car volumineux + régénérable)

### 6. Context7 (docs externes)

- Serveur MCP, setup trivial
- Résout : ma knowledge cutoff = mai 2025. Les API récentes de React/Supabase/Netlify/etc. peuvent avoir évolué.
- Usage : question sur API externe → Context7 d'abord, toujours.

### 7. Obsidian MCP (lecture vault + Dataview + Templater)

- Plugin : **obsidian-connect-mcp** (recommandé car supporte Dataview via MCP)
- Alternative : obsidian-mcp-tools (semantic search, Templater, pas Dataview explicite)
- Dépendances Obsidian : **Dataview** + **Templater** plugins
- Contrainte : Obsidian doit être **ouvert** sur la machine pour que MCP fonctionne
- Fallback si Obsidian fermé : lecture directe via symlink `~/citadelle/` (plus lent mais fonctionne)

### 8. Dataview (indexes et dashboards dynamiques)

Remplace les `_Index.md` statiques par des queries vivantes :
- Dashboard "Gotchas par zone" (FROM `DEV/Gotchas` GROUP BY zone)
- Dashboard "Décisions récentes" (SORT last-verified DESC)
- Dashboard "Health check" (WHERE last-verified > 30 jours)
- Dashboard "Notes orphelines" (sans wikilinks entrants)

### 9. Templater (structure imposée)

Templates à créer Phase 1 (dossier `_templates/` à la racine du vault Citadelle, convention Templater standard) :
- `_templates/gotcha.md` — frontmatter + sections Symptôme / Cause / Fix / Références
- `_templates/decision.md` — frontmatter + sections Contexte / Options / Décision / Conséquences
- `_templates/preference.md` — frontmatter + règle / raison / exemples
- `_templates/bug-recurrent.md` — frontmatter + pattern / trigger / fix
- `_templates/architecture-note.md` — frontmatter + structure standardisée

### 10. Canvas (optionnel, pour l'équipe humaine)

- Canvas pour overviews visuels (ex: `Architecture App.canvas`)
- Consommé par les humains principalement
- Claude le lit en JSON si nécessaire, mais favorise les MOCs markdown pour sa navigation

### 11. Cross-machine (symlinks)

Chaque machine crée un symlink `~/citadelle/` vers le dossier Obsidian Sync local :

```bash
# Windows (admin)
mklink /D "C:\Users\uriel\citadelle" "<chemin Obsidian Sync local>"

# macOS/Linux
ln -s "<chemin Obsidian Sync local>" ~/citadelle
```

Tous les `CLAUDE.md` référencent `~/citadelle/` — portable entre machines.

Fallback : si le symlink ne résout pas → essayer chemin NAS direct → si échec, signaler à l'user et travailler en mode dégradé.

---

## Migration — 5 phases

### Phase 0 — Setup outils (30-60 min, zéro risque)

1. Installer **Graphify** (CLI + skill)
2. Premier run `graphify . --update` sur le repo, sanity check du GRAPH_REPORT.md
3. Installer Obsidian plugins : **Dataview**, **Templater**, **obsidian-connect-mcp**
4. Installer **Context7 MCP**
5. Configurer `mcpServers` dans Claude Code (obsidian-connect + context7)
6. Créer le symlink `~/citadelle/`
7. Décider : `graphify-out/` dans `.gitignore` ou committé

### Phase 1 — Préparer la Citadelle (1-2h)

1. Créer dossiers : `_Inbox/`, `Sources/`, `log.md`, `📱 L'application (La Carte)/🛠️ DEV/` + sous-dossiers
2. Créer les 5-6 templates Templater dans `_templates/`
3. Créer 3-4 dashboards Dataview dans `DEV/` (index gotchas, décisions, health, orphelins)
4. Créer `_Index DEV.md` (porte d'entrée, ~200 lignes max)
5. Réécrire `CLAUDE.md` racine Citadelle : slim (~80 lignes), routing + 4-layer query rule + opérations nommées

### Phase 2 — Migration du contenu (2-3h)

Ordre, du plus critique au moins :
1. **Préférences Uriel** (cerebrum.md + `memory/feedback_*.md`) → `DEV/Préférences Uriel/*.md` (notes atomiques)
2. **Gotchas Supabase + Schema** (MEMORY.md) → `DEV/Gotchas/*.md`
3. **Conventions code** (CLAUDE.md repo + MEMORY.md) → `DEV/Conventions/*.md`
4. **Architecture auth** → `DEV/Architecture/Auth et utilisateurs.md`
5. **Deploy workflows** → `DEV/Architecture/Deploy.md`
6. **Do-Not-Repeat + Decisions** → `DEV/Décisions/YYYY-MM-DD-*.md`
7. **Buglog patterns récurrents** (buglog.json) → `DEV/Bugs récurrents/*.md` (seulement patterns, pas one-off)
8. **État V0.5 + Leçons apprises** → `DEV/Architecture/État V0.5.md` avec `last-verified`

À chaque migration : wikilinks entre notes pertinentes.

### Phase 3 — Bascule (30 min, moment critique)

1. Réécrire `CLAUDE.md` racine repo : slim, pointe vers Citadelle + Graphify + Context7
2. Réécrire `apps/explore-web/CLAUDE.md` et `apps/hub/CLAUDE.md` : minimaux, pointent vers Citadelle DEV + contexte app spécifique
3. Tester une nouvelle session Claude Code — vérifier que la navigation passe bien par Citadelle + Graphify, plus par `.wolf/*`
4. Rollback trivial si problème (les anciens CLAUDE.md sont en git)

### Phase 4 — Nettoyage (15 min, après bascule validée)

1. Archiver `.wolf/` → `git rm -r` (historique conservé) ou `.wolf-archive/` pour 1 semaine de sécurité
2. Désactiver auto-memory Claude Code — supprimer contenu `~/.claude/projects/.../memory/*.md`
3. Commit : "chore: migration mémoire OpenWolf → Citadelle + Graphify"

### Phase 5 — Premier lint + log (10 min)

1. Passe de lint sur le vault : wikilinks cassés, notes orphelines, `last-verified` stales. Corriger.
2. Première entrée `log.md` :
   ```
   ## [2026-04-14] setup | Migration complète OpenWolf → Citadelle + Graphify
   ```

**Durée totale estimée** : 4-6 heures de travail, réparties sur 2-3 sessions.

---

## Risques et mitigations

| Risque | Mitigation |
|--------|-----------|
| Claude oublie où chercher pendant transition | Règle transitoire : `.wolf/cerebrum.md` reste lisible jusqu'à Phase 4. Archivé, pas supprimé, 1 semaine. |
| Obsidian non ouvert → Obsidian MCP indisponible | Fallback automatique vers lecture directe via symlink `~/citadelle/` |
| NAS offline + Obsidian Sync pas fini de syncer | Message dégradé à l'user, travail sur repo seul temporairement |
| Graphify mal configuré (fichiers critiques ignorés) | Validation Phase 0 avant toute dépendance |
| Chemin Citadelle différent entre machines | Symlink `~/citadelle/` partout, même chemin logique |
| Équipe casse la structure en éditant | Règle douce dans CLAUDE.md Citadelle : les humains peuvent éditer, Claude flag les incohérences au prochain lint |
| Dataview/Templater indisponibles (plugin cassé) | Fallback : lecture directe des notes, lecture manuelle des frontmatter YAML |

---

## Ce qu'on compare avec et où on se situe

### Inspiré de Karpathy (gist avril 2026)
- Architecture trois couches (raw / wiki / schéma) → **repris avec adaptations**
- Opérations nommées ingest/query/lint → **repris**
- log.md append-only → **repris**
- Markdown vendor-neutral → **repris**

### Où on diverge de Karpathy
- **Multi-stakeholder** : vault partagé Uriel + Mathéo + Claude (lui est solo)
- **Voix préservée** : prose conservée sur zones de voix (éditorial, vision). Lui condense tout.
- **Sources/ séparé de _Inbox/** : distinction ephemeral vs immuable
- **Intent-based routing** : user annonce la zone ("on bosse sur X") → je charge ciblé

### Outils choisis vs écartés
- ✅ **Graphify** : structure code, AST, 0 token par rebuild
- ✅ **Obsidian MCP** (obsidian-connect-mcp) : semantic search + Dataview + Templater
- ✅ **Dataview + Templater** : indexes dynamiques, structure imposée
- ✅ **Context7** : docs externes fraîches
- ❌ **jcodemunch-mcp** : redondant avec Graphify (même niche, AST code retrieval). À garder en fallback mental.
- ❌ **Claude-Memory MCP** : JSONL non-éditable par humain, casse la règle d'edibilité vault. Over-engineering.
- ❌ **anatomy.md** (OpenWolf) : remplacé par Graphify qui ne peut pas mentir

---

## Économie de tokens — estimation

| Moment | Avant (OpenWolf + auto-memory) | Après (stack unifiée) | Gain |
|--------|-------------------------------|------------------------|------|
| Démarrage session (chargement auto) | ~9k tokens | ~400 tokens (CLAUDE.md slim + _Inbox check) | **~95%** |
| Question sur structure code | Re-read multiples fichiers (~20k tokens) | Graphify query (~280 tokens) | **~98%** |
| Question "où discute-t-on de X dans le vault" | Grep + read 5-10 notes (~5k tokens) | Obsidian MCP semantic search (~500 tokens) | **~90%** |
| Question API externe (React, Supabase…) | Lecture doc stale / invention | Context7 query (~500 tokens, toujours à jour) | Qualité + tokens |
| Conversation moyenne (10-20 échanges) | Contexte initial ~9k propagé × tours | Contexte initial ~400 propagé × tours | **~50-150k** tokens sur la session |

---

## Critères de succès

Après 2 semaines d'usage :
- [ ] Aucun retour à `.wolf/*` pour chercher une info
- [ ] Démarrage de session < 500 tokens de contexte chargé
- [ ] Passes de lint régulières (au moins 1 par semaine)
- [ ] `_Inbox/` vidé à chaque début de session
- [ ] Au moins 20 notes migrées dans `DEV/`
- [ ] Mathéo a contribué au vault au moins une fois
- [ ] Zéro bug dû à une API externe stale (merci Context7)

---

## Décisions ouvertes (à trancher Phase 0)

1. **`graphify-out/` dans `.gitignore` ou committé ?** Défaut recommandé : `.gitignore` (volumineux, régénérable).
2. **obsidian-connect-mcp vs obsidian-mcp-tools ?** Défaut recommandé : **obsidian-connect-mcp** (Dataview natif). À valider à l'usage.
3. **Canvas : créer dès Phase 1 ou différer ?** Défaut : différer, créer quand un besoin visuel apparaît.
4. **Mathéo onboarding** : quand/comment lui présenter le nouveau système ? Défaut : après Phase 4 validée, avec un guide court.

---

## Prochaine étape

→ Passer à l'implémentation via la skill `writing-plans` pour produire un plan exécutable étape par étape.
