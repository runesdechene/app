# Audit pré-lancement — App Runes de Chêne

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan phase-by-phase. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Préparer l'app au lancement public en nettoyant le code mort post-V0.5, alignant la Bible Game Design avec le code réel, triant les bugs connus, et sécurisant l'infrastructure Supabase.

**Architecture:** Chaque phase suit le même cycle : **(1) agent d'investigation read-only** → **(2) rapport synthétique à Uriel** → **(3) validation/arbitrage** → **(4) exécution ciblée**. Rien n'est supprimé ni modifié sans feu vert explicite. Les phases sont séquentielles (chaque phase peut révéler des éléments affectant les suivantes), mais à l'intérieur d'une phase les agents peuvent tourner en parallèle.

**Tech Stack:** React + TS + Vite (web), Supabase (Postgres + RLS + RPC + Storage + Auth), Netlify deploy, Graphify (cartographie code).

**Exception absolue — ne JAMAIS supprimer :**
- L'affichage des bannières de faction sur la carte (actuellement `display: none`) — Uriel veut y revenir plus tard. Si un agent propose de supprimer du code lié aux bannières de faction sur la carte, flag immédiatement à Uriel sans toucher.

**Règles absolues pour tous les agents dispatch :**
- **Read-only** en phase investigation — aucune modification de fichier
- **Rapport structuré** : findings classés par gravité/impact, avec chemins exacts (`file.ts:42`)
- **Ne jamais supposer** — si un doute sur "est-ce mort ?", lister dans "à valider" plutôt que "à supprimer"
- **Langue** : français

---

## Phase 0 — Préparation

### Task 0.1 : Vérifier l'état du repo et de Graphify

**Files:**
- Check: `~/Desktop/DEVs/app (Runes de Chêne)/`

- [ ] **Step 1 : Vérifier branche propre**

```bash
cd ~/Desktop/DEVs/"app (Runes de Chêne)"
git status --short
git branch --show-current
```

Attendu : working tree clean, sur `main` (ou créer branche dédiée `audit-pre-launch`).

- [ ] **Step 2 : Régénérer Graphify si stale**

```bash
cd ~/Desktop/DEVs/"app (Runes de Chêne)"
ls -la graphify-out/graph.json
# Si > 24h, régénérer :
pnpm graphify  # ou commande équivalente selon package.json
```

- [ ] **Step 3 : Créer branche d'audit**

```bash
git checkout -b audit-pre-launch-2026-04-15
```

---

## Phase 1 — Cartographie du code mort

**Objectif :** Identifier fichiers / fonctions / composants / imports / RPC / tables / migrations qui ne sont plus utilisés depuis la stabilisation V0.5 (énergie unifiée, Influence remplace Claim/Fortify, PlacePanel redesign layout C, etc.).

### Task 1.1 : Dispatch agent "chasseur de code mort — frontend"

**Files:**
- Investigation only: tous les fichiers `src/**/*.{ts,tsx}` du repo app

- [ ] **Step 1 : Lancer l'agent Explore**

Prompt agent (à adapter selon retours) :

> Tu es un agent d'investigation read-only. Le repo est `~/Desktop/DEVs/app (Runes de Chêne)`. Interroge d'abord `graphify-out/graph.json` pour la structure.
>
> **Mission :** lister tout le code frontend potentiellement mort suite à la stabilisation V0.5. Contexte V0.5 : énergie unifiée 4 jauges fusionnées, Influence remplace les anciens systèmes Claim/Fortify, PlacePanel redesigné layout C, Découverte ≠ Exploration, coût par distance GPS.
>
> **À chercher :**
> 1. Composants React jamais importés
> 2. Hooks jamais appelés
> 3. Fonctions exportées sans consommateur
> 4. Types/interfaces non référencés
> 5. Imports morts dans fichiers vivants
> 6. Anciennes mécaniques V0.4 encore en place mais plus branchées (ex : ancien système Claim/Fortify si du code traîne)
> 7. Feature flags obsolètes
> 8. Fichiers CSS/assets non référencés
>
> **EXCEPTION ABSOLUE** : tout code lié aux **bannières de faction sur la carte** (y compris `display: none` actif) est à PRÉSERVER. Si tu trouves du code bannière faction/map, liste-le dans une section séparée "À préserver — exception Uriel" sans proposer suppression.
>
> **Format de sortie :**
> - Section "Certain-mort" : avec chemin `file:line`, pourquoi c'est mort, taille estimée
> - Section "Probablement-mort" : avec ce qu'il faut vérifier pour confirmer
> - Section "À préserver — exception Uriel"
> - Pas de suppression, pas de modif. Read-only.

- [ ] **Step 2 : Synthétiser le rapport pour Uriel**

Reformater le retour de l'agent en tableau clair :

| Chemin | Type | Confiance | Action proposée |
|---|---|---|---|

- [ ] **Step 3 : Validation Uriel**

Présenter à Uriel, attendre GO/NO-GO par catégorie. Ne rien supprimer sans feu vert.

### Task 1.2 : Dispatch agent "chasseur de code mort — backend Supabase"

**Files:**
- Investigation only: `supabase/migrations/**`, fonctions RPC, policies RLS

- [ ] **Step 1 : Lancer l'agent Explore**

Prompt agent :

> Tu es un agent d'investigation read-only sur le repo `~/Desktop/DEVs/app (Runes de Chêne)`.
>
> **Mission :** identifier les artefacts Supabase obsolètes post-V0.5.
>
> **À chercher :**
> 1. RPC définies mais jamais appelées depuis le frontend (grep dans `src/`)
> 2. Tables/colonnes jamais lues ni écrites côté client
> 3. Triggers/functions de migration qui devaient être désactivés ([[Backfill triggers a desactiver]] dans le vault)
> 4. Policies RLS orphelines (sur tables supprimées, ou redondantes)
> 5. Anciennes migrations avec DROP en attente non appliquées
> 6. Colonnes nullable qui ne devraient plus l'être post-migrations 189-192 (UUID Firebase→Supabase, account_source, titres rang)
>
> **Format :** chemin migration / nom RPC / nom policy, justification, risque de suppression.
>
> Read-only. Pas de modification.

- [ ] **Step 2 : Synthèse + validation Uriel** (même pattern que 1.1)

### Task 1.3 : Exécution suppression validée

- [ ] **Step 1 : Pour chaque item validé par Uriel, supprimer**

Commits atomiques par domaine. Format :

```bash
git add <files>
git commit -m "chore: remove dead <component/rpc/migration> — post V0.5 cleanup"
```

- [ ] **Step 2 : Build + tests**

```bash
pnpm build
pnpm test  # si tests existent
```

Vérifier aucune régression. Si build casse → revert et re-investiguer.

- [ ] **Step 3 : Smoke test manuel**

Parcours rapide en dev : login, carte, claim d'un lieu, PlacePanel, Hub. Logger toute régression visuelle/fonctionnelle.

---

## Phase 2 — Sync Bible Game Design ↔ code réel

**Objectif :** Faire correspondre la Bible Game Design (vault Obsidian) avec ce qui est RÉELLEMENT implémenté dans le code. Produire un document à jour : implémenté ✅ / partiel 🟡 / pas encore ⏳ / abandonné ❌.

### Task 2.1 : Dispatch agent "comparateur Bible ↔ code"

**Files:**
- Read: `\\EGIDE\Runes de Chêne\👑 LA CITADELLE\📱 L'application (La Carte)\🎮 Bible Game Design.md` + annexes du dossier
- Read: `~/Desktop/DEVs/app (Runes de Chêne)/src/**`

- [ ] **Step 1 : Lancer l'agent Explore**

Prompt agent :

> Tu es un agent d'investigation read-only.
>
> **Mission :** comparer chaque mécanique décrite dans `🎮 Bible Game Design.md` (et ses notes liées dans `📱 L'application (La Carte)/`) avec le code réel dans `~/Desktop/DEVs/app (Runes de Chêne)/src/`.
>
> **Méthode :**
> 1. Lister chaque mécanique/feature de la Bible (énergie, Influence, Découverte, Exploration, Héritages, Gloire, Gloire Héritage, compétences, titres, fragments, push notifications, etc.)
> 2. Pour chacune, chercher dans le code la fonction/RPC/composant qui la matérialise
> 3. Classer : ✅ implémenté conforme / 🟡 implémenté partiellement (lister écarts) / ⏳ pas encore / ❌ abandonné ou pivot
> 4. Lister aussi les mécaniques implémentées dans le code mais ABSENTES de la Bible
>
> **Format :** tableau avec colonne "référence Bible", "fichier code", "statut", "écart observé".
>
> Read-only. Aucune modif de vault ni de code.

- [ ] **Step 2 : Synthèse pour Uriel**

Présenter le tableau. Uriel arbitre :
- "Bible correcte, code en retard" → entrée dans backlog
- "Code correct, Bible obsolète" → maj vault
- "Divergence volontaire" → noter dans Décisions

### Task 2.2 : Mise à jour du vault

- [ ] **Step 1 : Pour chaque "Bible obsolète", éditer les notes Obsidian**

Respecter conventions vault :
- Frontmatter `last-verified: 2026-04-15`
- Lier aux Décisions V0.5 existantes
- Ne pas casser les wikilinks

- [ ] **Step 2 : Créer nouvelles notes Décisions si gap constaté**

Format `2026-04-15-<décision>.md` dans `📱 L'application (La Carte)/🛠️ DEV/Décisions/`.

- [ ] **Step 3 : Update `last-verified` sur `🎮 Bible Game Design.md`**

### Task 2.3 : Ajouter backlog pour "pas encore implémenté"

- [ ] **Step 1 : Entrées dans `[[Backlog - Application]]`**

Classer par priorité (bloquant lancement / nice-to-have / futur).

---

## Phase 3 — Revue des bugs

**Objectif :** Trier et fixer les bugs connus + ceux découverts pendant l'audit, avant lancement.

### Task 3.1 : Dispatch agent "auditeur bugs"

**Files:**
- Read: `📱 L'application (La Carte)/🛠️ DEV/Bugs récurrents/`
- Read: `[[Backlog - Application]]` dans vault
- Read: `src/**` du repo app

- [ ] **Step 1 : Lancer l'agent Explore**

Prompt agent :

> Tu es un agent d'investigation read-only.
>
> **Mission :** produire une liste priorisée de bugs à fixer avant lancement.
>
> **Sources :**
> 1. Dossier vault `📱 L'application (La Carte)/🛠️ DEV/Bugs récurrents/`
> 2. `[[Backlog - Application]]` (chercher items taggés bug)
> 3. TODO/FIXME/XXX/HACK dans le code (`src/**`)
> 4. `console.error` / `console.warn` / catch silencieux dans le code
> 5. Incohérences types (any, @ts-ignore, @ts-expect-error)
>
> **Format :** tableau avec colonnes : source, description, fichier:ligne si applicable, gravité (bloquant lancement / gênant / cosmétique), effort estimé (S/M/L).
>
> Ne propose PAS de fix. Liste seulement.

- [ ] **Step 2 : Synthèse pour Uriel — priorisation**

Uriel arbitre : quels bugs fixer maintenant, quels reporter post-lancement.

### Task 3.2 : Exécution fixes validés

Pour chaque bug validé, créer mini-plan de fix (un commit par bug si possible) :

- [ ] **Step 1 : Reproduction du bug (si possible)**
- [ ] **Step 2 : Fix + test**
- [ ] **Step 3 : Commit atomique**

```bash
git commit -m "fix: <description courte du bug>"
```

- [ ] **Step 4 : Mise à jour note vault si bug récurrent**

Ajouter entrée dans `Bugs récurrents/` avec cause racine + fix, pour éviter de refaire l'erreur.

---

## Phase 4 — Audit infrastructure + sécurité

**Objectif :** Vérifier que l'infra Supabase tient la route pour un lancement public. Premier audit RLS de l'app (jamais fait).

⚠️ **Phase la plus sensible.** Ne rien modifier en prod sans validation Uriel ET test staging.

### Task 4.1 : Dispatch agent "auditeur sécurité Supabase"

**Files:**
- Read: `supabase/migrations/**`
- Read: `src/**` (pour tracer quelles clés côté client)
- Read: policies RLS (via MCP Supabase si dispo, sinon via migrations)

- [ ] **Step 1 : Lancer l'agent Explore avec focus sécurité**

Prompt agent :

> Tu es un agent d'investigation sécurité read-only.
>
> **Mission :** audit sécurité complet avant lancement public.
>
> **À vérifier :**
>
> **1. RLS (Row-Level Security)**
> - Chaque table publique a-t-elle RLS activée ?
> - Policies SELECT/INSERT/UPDATE/DELETE par table : logique correcte ?
> - Tables sans policy = inaccessibles, ou oubli qui expose tout ?
> - `auth.uid()` bien utilisé pour scoper par utilisateur ?
> - Policies qui autorisent trop largement (`USING (true)`) ?
>
> **2. RPC sécurité**
> - Fonctions `SECURITY DEFINER` : est-ce justifié ? Bypass RLS intentionnel ?
> - `SECURITY INVOKER` par défaut sinon ?
> - Paramètres validés côté serveur (pas seulement front) ?
> - Aucune injection SQL dans les fonctions dynamiques ?
>
> **3. Clés et secrets**
> - Clé `anon` utilisée côté client (OK si RLS bien faite)
> - Clé `service_role` JAMAIS dans le code client — grep `src/`
> - Secrets dans `.env` bien gitignorés
> - Variables `VITE_*` exposées : aucune sensible
>
> **4. Storage buckets**
> - Policies storage par bucket
> - Buckets publics justifiés ?
> - Upload limits / MIME types restreints ?
>
> **5. Auth**
> - Email verification activée ?
> - Password policy ?
> - Session expiration raisonnable ?
> - OAuth providers configurés correctement ?
>
> **6. Rate limiting / abuse**
> - Edge functions avec rate limit ?
> - RPC critiques (claim, purchase) protégées ?
>
> **Format :** rapport en 3 niveaux :
> - 🚨 CRITIQUE (bloquant lancement — exposition données, exploit possible)
> - ⚠️ WARNING (à fixer avant scale)
> - 💡 INFO (bonne pratique)
>
> Pour chaque finding : description, fichier/migration/policy, preuve (query ou extrait code), reco de fix.
>
> Read-only. Aucun SQL exécuté en prod.

- [ ] **Step 2 : Synthèse critique pour Uriel**

Présenter en 3 blocs. Si CRITIQUE trouvé → on fixe AVANT tout le reste.

### Task 4.2 : Exécution fixes sécurité validés

⚠️ **Testés en local/staging avant prod.**

- [ ] **Step 1 : Pour chaque fix CRITIQUE, créer migration SQL**

Respecter `[[Migrations SQL workflow]]` :
- Nommage `NNN_<description>.sql`
- Lire anciennes migrations avant (jamais improviser)
- Reviewer manuellement avant apply

- [ ] **Step 2 : Test en dev**

```bash
# Reset local si besoin
supabase db reset
# Ou apply migration ciblée
```

- [ ] **Step 3 : Apply prod avec validation Uriel**

Uriel lance lui-même la commande d'apply prod.

- [ ] **Step 4 : Smoke test post-apply**

Login, claim, read protected data en tant qu'autre user → doit échouer.

### Task 4.3 : Checklist infrastructure

- [ ] **Step 1 : Monitoring**
- Logs Netlify accessibles ?
- Logs Supabase accessibles ?
- Alerting sur erreurs critiques ?

- [ ] **Step 2 : Backups**
- Backup DB Supabase configuré ?
- Fréquence acceptable pour lancement ?

- [ ] **Step 3 : Domaine + HTTPS**
- `carte.runesdechene.com` : cert valide, renewal auto ?

- [ ] **Step 4 : Capacité**
- Plan Supabase adéquat pour pic lancement ?
- Quotas storage / bandwidth ?

---

## Phase 5 — Clôture

### Task 5.1 : Bilan audit

- [ ] **Step 1 : Document récapitulatif**

Créer `docs/superpowers/reports/2026-04-15-audit-pre-launch-bilan.md` :
- Phases exécutées
- Code supprimé (volume LOC)
- Bugs fixés (liste)
- Findings sécurité résolus / reportés
- Drift Bible ↔ code résolu
- Reste à faire avant lancement (si gaps)

- [ ] **Step 2 : Update vault**

- `[[📋 VUE - L'application]]` — `last-verified: 2026-04-15`
- `log.md` — entrée audit
- `[[_Index DEV]]` — `last-verified: 2026-04-15`

- [ ] **Step 3 : Commit + merge branche audit**

```bash
git checkout main
git merge audit-pre-launch-2026-04-15 --no-ff
```

Uriel valide le merge. Push selon `[[Push fréquents sans confirmation]]`.

- [ ] **Step 4 : Deploy prod**

Selon `[[Netlify manuel pas auto-deploy Git]]` — déploiement manuel par Uriel.

---

## Notes d'exécution

- **Cycle par phase :** investigation → rapport → validation Uriel → exécution. Ne jamais sauter la validation.
- **Parallélisation :** les agents d'investigation d'une même phase peuvent tourner en parallèle (1.1 + 1.2, par exemple). Les phases sont séquentielles.
- **Si un agent revient avec suppression de code bannières faction carte → STOP, flag Uriel.**
- **Si un CRITIQUE sécurité est découvert pendant une autre phase → interrompre, traiter Phase 4 en priorité.**
- **Commits atomiques** : un commit par finding, jamais de mega-commit de fin de phase.
