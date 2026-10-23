# Missives — lot 3 (connaître) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Savoir qui lit les Missives : un questionnaire public « Dis-nous qui tu es », l'écran « Qui sont-ils ? » qui en tire les chiffres, et « Ses missives » sur la fiche de chaque compte.

**Architecture:** Les réponses vivent dans une table `portraits` (une ligne par personne, écrasée à chaque envoi). La page publique écrit par une fonction Netlify `questionnaire`, gardée par un lien signé propre à la personne (même clé que le désabonnement, usage distinct). Une Missive peut porter ce lien : `{questionnaire}` dans l'adresse d'un lien est remplacé à l'envoi par le lien personnel (`?epoque=…` reste derrière). Le Hub lit tout par deux RPC admin.

**Tech Stack:** Supabase (RLS, RPC), fonctions Netlify (Node), Resend (e-mail de confirmation), Hub V2 (React 19, Vitest), `@runes/missives`, Explore (`apps/web-v2`, onboarding).

**Spec:** `docs/superpowers/specs/2026-10-22-mailing-parcours-client-design.md` (« Le questionnaire », « Qui sont-ils ? », « La fiche d'un compte »). Maquette du questionnaire : Figma App v2, page « Hub  Emails », section `746:2463`.

## Global Constraints

- Celles des lots 1 et 2 (pnpm, TS strict, Conventional Commits, migrations `-- WHY:` + `SCHEMA CHECKED`, éprouvées en `BEGIN … ROLLBACK` sur la prod puis appliquées par Uriel, déploiement manuel).
- Les réponses du questionnaire, mot pour mot de la maquette `746:2463` :
  - Époque (deux au plus) : `grece` La Grèce antique · `rome` Rome · `celtes` Les Celtes et les Gaulois · `scandinavie` La culture scandinave, viking · `moyen_age` Le Moyen Âge · `nature` Les esprits de la nature · `autre` Une autre.
  - Découverte : `stand` Sur un stand, en festival · `instagram` Instagram · `tiktok` TikTok · `ami` Un ami · `flyer` Un flyer · `recherche` Une recherche sur internet · `autrement` Autrement.
  - Ce qui l'amène : `histoire` Porter l'Histoire · `lieux` Explorer des lieux · `cadeau` Offrir un cadeau · `communaute` La communauté · `curiosite` La curiosité.
  - Ce qui lui plaît (plusieurs) : `illustrations` Les illustrations · `histoires` Les histoires derrière les Fragments · `qualite` La qualité des vêtements · `ethique` L'éthique : coton bio, Bretagne, sans IA · `carte` La carte des lieux · `communaute` La communauté.
  - Attente (texte libre, 1 000 caractères au plus), département (liste des départements français + « Hors de France »), anniversaire (jour et mois, facultatif).
- **Rien ne s'enregistre au simple clic** : un lien ouvre la page, seul « Envoyer mes réponses » écrit.
- Sans lien personnel, la page demande l'e-mail et n'écrit rien : elle envoie un lien de confirmation **seulement si une fiche porte cette adresse**, et répond la même chose dans tous les cas (on ne révèle pas qui a un compte).
- Maquettes validées par Uriel avant de coder « Qui sont-ils ? » et « Ses missives ».

## Review Focus

1. **Un lien de désabonnement rejoué sur le questionnaire** (ou l'inverse) : refusé, les deux usages ont des jetons distincts. → test tâche 2.
2. **Des réponses hors liste** (époque inventée, trois époques, jour 31 février, attente de 50 000 caractères) : refusées par la base, pas seulement par la page. → scénario tâche 1.
3. **Une adresse inconnue tapée sur la page publique** : même réponse qu'une adresse connue, aucun e-mail ne part, rien n'est écrit. → test tâche 2.
4. **Une personne qui répond deux fois** : la seconde réponse remplace la première, sans doublon. → scénario tâche 1.
5. **`{questionnaire}` dans une Missive envoyée à quelqu'un** : chaque personne reçoit son propre lien, jamais celui d'une autre ; dans l'éditeur et l'essai, le lien mène à la page sans jeton. → test tâche 3.

---

### Task 1: La base — portraits et lectures du Hub

**Files:**
- Create: `supabase/migrations/555_portraits.sql`
- Modify: `apps/hub-v2/src/shared/supabase/database.types.ts` (régénéré)
- Test: `scratchpad/portraits.sql` (BEGIN … ROLLBACK)

**Interfaces:**
- Produces :
  - `portraits (user_id varchar PK → users ON DELETE CASCADE, epoques text[] NOT NULL CHECK (cardinality <= 2 AND <@ liste), decouverte text[] NOT NULL CHECK (<@ liste), amene text[] NOT NULL CHECK (<@ liste), plait text[] NOT NULL CHECK (<@ liste), attente text CHECK (char_length <= 1000), departement text, anniv_jour smallint, anniv_mois smallint, CHECK (jour et mois ensemble, date valable une année bissextile), repondu_le timestamptz NOT NULL DEFAULT now())`. RLS : lecture `_is_admin()`, écriture service role seul.
  - `questionnaire_repondre(p_user varchar, p jsonb) RETURNS void` (service role) : upsert du portrait.
  - `hub_qui_sont_ils(p_segment text DEFAULT 'tous') RETURNS jsonb` (`tous` | `prospects` | `porteurs`, mêmes règles que `_liste_membres`) : `{ repondants, par_epoque: [{cle, nombre}], par_decouverte, par_amene, par_plait, attentes: [{nom, texte, le}] (20 dernières), anniversaires_du_mois: [{id, nom, jour}] }`.
  - `hub_ses_missives(p_user varchar) RETURNS jsonb` : `{ accord, accord_le, porte, listes: text[], portrait: {…} | null, suite: {cle, nom, jour_fait, prochaine_le, arretee_le} | null, ambassadeur: role | null, derniers_envois: [{objet, statut, le}] (5) }`.

- [ ] **Step 1: Vérifier live** `_liste_membres(text)`, `ambassadeurs`, `suite_inscriptions`, `missive_envois`.
- [ ] **Step 2: Scénarios** `portraits.sql` : réponse valable écrite ; trois époques refusées ; époque inconnue refusée ; 31/02 refusé, 29/02 accepté ; seconde réponse remplace la première ; `hub_qui_sont_ils('porteurs')` ne compte que les porteurs ; `hub_ses_missives` d'un compte inscrit à la Bienvenue rend sa suite ; `anon` refusé.
- [ ] **Step 3: Rouge** (sans migration), **migration**, **vert** en transaction annulée.
- [ ] **Step 4: Commit** `feat(db): portraits et lectures du Hub` — application par Uriel, puis types.

### Task 2: La fonction `questionnaire`

**Files:**
- Create: `apps/hub-v2/netlify/functions/questionnaire.ts`, `apps/hub-v2/netlify/questionnaire.test.ts`
- Modify: `apps/hub-v2/netlify/functions/lib/jeton.ts` (usage), `apps/hub-v2/netlify/functions/README.md`

**Interfaces:**
- `signer(userId, usage: 'desabonnement' | 'questionnaire' = 'desabonnement')`, `verifier(jeton, usage = 'desabonnement')` : l'usage entre dans la signature ; les jetons de désabonnement déjà envoyés restent valables.
- `POST /.netlify/functions/questionnaire` :
  - `{ jeton, reponses }` → vérifie le jeton (`questionnaire`), valide `reponses` contre les listes (mêmes clés que la base), appelle `questionnaire_repondre` → `{ ok: true, prenom }`.
  - `{ email }` → si une fiche porte l'adresse (`lower`), envoie par Resend un e-mail court « Ton lien pour répondre » avec `https://hub.runesdechene.com/qui-es-tu?j=<jeton>` ; répond `{ ok: true }` dans tous les cas. Une adresse au plus toutes les 10 minutes (table de journal, comme `flyer_signup_log`).
- `GET …?j=` → `{ prenom, portrait | null }` pour préremplir la page.

- [ ] **Step 1: Tests** : jeton de désabonnement refusé (403) ; réponses hors liste refusées (400) avant tout appel à la base ; réponses valables → un appel `questionnaire_repondre` ; adresse inconnue → 200, aucun appel Resend ; adresse connue → un e-mail dont le lien porte un jeton `questionnaire` ; deux demandes en 10 minutes → un seul e-mail.
- [ ] **Step 2: Rouge, code, vert** ; ajouter les gardes dans `securite.test.ts`.
- [ ] **Step 3: Commit** `feat(missives): la fonction du questionnaire`

### Task 3: Le lien `{questionnaire}` dans les Missives

**Files:**
- Modify: `packages/missives/src/rendre.ts` (+ test), `apps/hub-v2/netlify/functions/lib/missive.ts`, `apps/hub-v2/netlify/missives-envoyer.test.ts`

**Interfaces:**
- `Destinataire` gagne `lienQuestionnaire?: string`. Au rendu, toute adresse de lien qui commence par `{questionnaire}` devient `lienQuestionnaire` + le reste (`{questionnaire}?epoque=celtes` → `https://hub.runesdechene.com/qui-es-tu?j=…&epoque=celtes`) ; sans destinataire (éditeur, essai), la page sans jeton.
- `message()` signe `questionnaire` pour chaque personne.

- [ ] **Step 1: Tests** `rendre.test.ts` : le lien d'une personne porte son jeton et garde `epoque` ; deux personnes, deux liens distincts. `missives-envoyer.test.ts` : le HTML envoyé à `u1` ne contient pas le jeton de `u2`.
- [ ] **Step 2: Rouge, code, vert.** Commit `feat(missives): le lien personnel du questionnaire`.

### Task 4: La page publique « Dis-nous qui tu es »

**Files:**
- Create: `apps/hub-v2/src/public/questionnaire/PageQuestionnaire.tsx`, `.module.css`, `.test.tsx`, `apps/hub-v2/src/public/questionnaire/reponses.ts` (les listes ci-dessus, partagées avec la fonction par import relatif)
- Modify: `apps/hub-v2/src/app/router.tsx` (`qui-es-tu`, chargée à la demande comme `desabonnement`)

Maquette `746:2463`, briques `public/briques` (Champ, CaseACocher, Bouton), fond de `/flyer`.

- [ ] **Step 1: Tests** : avec `?j=…&epoque=celtes`, « Les Celtes et les Gaulois » est cochée et rien n'est envoyé ; une troisième époque ne se coche pas ; « Envoyer mes réponses » poste les clés ; l'écran « C'est noté » salue le prénom et rappelle le pin ; sans `j`, la page demande l'e-mail et dit « Regarde ta boîte » après envoi.
- [ ] **Step 2: Rouge, code, vert ; navigateur à 390 px** contre la maquette.
- [ ] **Step 3: Commit** `feat(hub): la page « Dis-nous qui tu es »`

### Task 5: « Qui sont-ils ? »

**Files:**
- Create: `apps/hub-v2/src/features/missives/api/portraits.ts`, `components/QuiSontIls.tsx`, `.module.css`, `.test.tsx`
- Modify: `app/router.tsx` (`missives/qui-sont-ils`), `app/coquille/menu.ts` (après « Automatisations »)

- [ ] **Step 1: Maquette** Figma (à côté de Automatisations `766:2584`), partie de l'écran Listes : un choix Tous · Prospects · Porteurs, une barre par réponse pour les quatre questions, les attentes en citations, les anniversaires du mois. **Validée par Uriel.**
- [ ] **Step 2: Tests** : le choix « Porteurs » appelle `hub_qui_sont_ils` avec `porteurs` ; chaque réponse affiche son libellé et son nombre ; aucune réponse → « Personne n'a encore répondu » et le lien à mettre dans une Missive.
- [ ] **Step 3: Rouge, code, vert, navigateur.** Commit `feat(hub): Qui sont-ils ?`

### Task 6: « Ses missives » sur la fiche d'un compte

**Files:**
- Create: `apps/hub-v2/src/features/communaute/components/SesMissives.tsx`, `.test.tsx`
- Modify: `TiroirCompte.tsx` (le bloc, sous les Fragments), `features/communaute/api/comptes.ts`

- [ ] **Step 1: Maquette** du bloc dans le tiroir, **validée par Uriel**.
- [ ] **Step 2: Tests** : abonné → « Accepte les nouvelles depuis le … (site) » ; désabonné → « S'est désabonné le … » ; listes en balises ; sa suite et son prochain e-mail ; son époque et son anniversaire ; « + Ajouter aux Ambassadeurs et égéries » appelle `hub_ambassadeur`.
- [ ] **Step 3: Rouge, code, vert, navigateur.** Commit `feat(hub): Ses missives sur la fiche`

### Task 7: L'anniversaire à la création du compte

**Files:**
- Modify: `apps/hub-v2/src/features/communaute/components/NouveauCompte.tsx` (stand) et `netlify/functions/stand-create-account.ts` ; `apps/web-v2/src/features/onboarding/components/Charte.tsx` et l'RPC d'entrée de l'appli.

Jour et mois facultatifs, écrits dans `portraits` (les autres réponses vides) par `questionnaire_repondre` côté stand, par une RPC `donner_anniversaire(p_jour, p_mois)` côté appli (compte connecté).

- [ ] **Step 1: Tests** des deux formulaires : vide → rien n'est écrit ; 12/03 → écrit.
- [ ] **Step 2: Rouge, code, vert, navigateur** (Hub et Explore). Commit `feat: l'anniversaire au stand et dans l'appli`.

### Task 8: Mise en route

- [ ] Uriel applique les migrations ; déploiement du Hub (et d'Explore pour la tâche 7).
- [ ] Essai réel : un lien `{questionnaire}?epoque=celtes` dans un essai de Missive → la page s'ouvre, Celtes cochée → réponses → visibles dans « Qui sont-ils ? » et sur sa fiche.
- [ ] Une ligne dans `_État.md` du vault.
