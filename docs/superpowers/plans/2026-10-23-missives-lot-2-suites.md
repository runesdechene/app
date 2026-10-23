# Missives — lot 2 (suites) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chaque nouvel inscrit reçoit sa suite d'e-mails tout seul (Bienvenue, Bienvenue du stand, Après le premier achat), un achat arrête la découverte, et Uriel règle chaque suite dans « Automatisations ».

**Architecture:** Une étape de suite **est** une Missive (`missives.statut = 'automatique'`) : même éditeur, même rendu, même envoi, même `missive_envois` (sa clé `(missive_id, user_id)` garantit qu'une personne ne reçoit jamais deux fois la même étape). La base inscrit et arrête par **déclencheurs** (sur `users` et `purchase_log`), sans toucher au code des portes. Le réveil existant (`pg_cron` → `missives-envoyer`) gagne un appel : `suites_preparer()`, qui pose dans `missive_envois` l'étape due de chaque inscription et avance l'inscription à l'étape suivante.

**Tech Stack:** Supabase (Postgres, déclencheurs, `pg_cron`), fonction Netlify `missives-envoyer`, Hub V2 (React 19, Vitest), `@runes/missives`.

**Spec:** `docs/superpowers/specs/2026-10-22-mailing-parcours-client-design.md` (sections « Le parcours », « Les règles qui ne se discutent pas », « Automatisations »). Lot 1 : `docs/superpowers/plans/2026-10-22-missives-lot-1-fondation.md`.

## Global Constraints

- Celles du lot 1 valent toutes (pnpm, TS strict, Conventional Commits, briques `shared/ui`, déploiement manuel).
- Migrations : à partir de `548`, `-- WHY:` et `-- SCHEMA CHECKED (date, live)` en tête ; tout `CREATE OR REPLACE` part de `pg_get_functiondef` **live** recopié entier ; appliquées par `npx supabase db push --linked` ; puis `pnpm --filter hub-v2 gen:types`.
- Les suites ne prennent que les personnes inscrites **après** leur activation. Une fiche créée par `shopify-sync` (porte `shopify`) n'entre jamais dans une suite.
- **Accord** : Bienvenue exige `accord_nouvelles = true`. Bienvenue du stand et Après le premier achat relèvent de l'exception client (L34-5) : elles partent sauf **refus daté** (`accord_nouvelles = false AND accord_nouvelles_le IS NOT NULL`). Toujours le désabonnement en un clic (déjà dans `lib/missive.ts`).
- Jours de la suite Bienvenue proposés : 0, 3, 7, 11, 14. Réglables dans le Hub.
- Toutes les suites naissent **en pause** : rien ne part avant qu'Uriel ait écrit les textes et activé.

## Review Focus

1. **Une suite mise en pause puis réactivée** : personne ne reçoit trois e-mails d'un coup. L'écart entre deux étapes se compte depuis l'envoi précédent, pas depuis l'inscription. → test tâche 3.
2. **Un achat pendant la Bienvenue** : la découverte s'arrête et l'étape suivante ne part pas, même déjà posée `a_envoyer`. → tests tâches 2 et 3.
3. **Une adresse portée par deux fiches** (5 cas en prod) : une seule inscription par suite et par adresse. → test tâche 2.
4. **Un client désabonné** qui achète : il n'entre pas dans Après le premier achat. → test tâche 3.
5. **Une étape retirée ou ajoutée pendant qu'une personne est en route** : sa suite continue sur les étapes restantes, sans planter ni renvoyer. → test tâche 3.

---

### Task 1: Les tables des suites

**Files:**
- Create: `supabase/migrations/548_missives_suites.sql`
- Modify: `apps/hub-v2/src/shared/supabase/database.types.ts` (régénéré)

**Interfaces:**
- Produces :
  - `missives.statut` accepte `'automatique'` (CHECK recréé).
  - `suites (cle text PK CHECK in ('bienvenue','stand','apres_achat'), nom text NOT NULL, exige_accord boolean NOT NULL, active boolean NOT NULL DEFAULT false)`, semée : `('bienvenue','Bienvenue',true)`, `('stand','Bienvenue du stand',false)`, `('apres_achat','Après le premier achat',false)`.
  - `suite_etapes (id bigint identity PK, suite text → suites, jour int NOT NULL CHECK (jour >= 0), missive_id bigint NOT NULL UNIQUE → missives ON DELETE CASCADE, UNIQUE (suite, jour))`.
  - `suite_inscriptions (suite text → suites, user_id varchar → users ON DELETE CASCADE, inscrit_le timestamptz DEFAULT now(), jour_fait int` (dernier jour envoyé, NULL au départ)`, prochaine_le timestamptz` (NULL = suite finie)`, arretee_le timestamptz, PRIMARY KEY (suite, user_id))` ; index partiel sur `prochaine_le WHERE arretee_le IS NULL AND prochaine_le IS NOT NULL`.
  - RLS : lecture et écriture `_is_admin()` ; le service role écrit tout.

- [ ] **Step 1: Vérifier le schéma live** : CHECK actuel de `missives.statut`, `purchase_log(user_id varchar, shopify_order_id varchar, created_at)`, `users.account_source`. Noter dans `SCHEMA CHECKED`.
- [ ] **Step 2: Écrire et appliquer la migration** : `npx supabase db push --linked` → sans erreur ; `select * from suites` → 3 lignes, `active = false`.
- [ ] **Step 3: Types** : `pnpm --filter hub-v2 gen:types && pnpm --filter hub-v2 typecheck` → OK.
- [ ] **Step 4: Commit** `feat(db): les suites de Missives et leurs inscriptions`

### Task 2: Inscrire et arrêter, par déclencheurs

**Files:**
- Create: `supabase/migrations/549_suites_inscrire.sql`
- Test: `scratchpad/suites-inscrire.sql` (scénarios dans une transaction terminée par `ROLLBACK`)

**Interfaces:**
- Consumes : tables de la tâche 1.
- Produces :
  - `_inscrire(p_suite text, p_user varchar) RETURNS void` : rien si la suite n'est pas active, si la personne y est déjà, ou si une autre fiche de la même adresse (`lower(email_address)`) y est. Sinon insère avec `prochaine_le = now() + (premier jour) * interval '1 day'` (NULL si la suite n'a pas d'étape).
  - Déclencheur `users_suites` AFTER INSERT OR UPDATE OF accord_nouvelles ON users :
    - INSERT avec `account_source = 'stand'` → `_inscrire('stand', id)`.
    - accord qui passe à `true` (INSERT avec accord, ou `OLD.accord_nouvelles = false`), porte dans `('site','flyer','appli')`, `account_source <> 'stand'`, aucun `purchase_log` pour lui → `_inscrire('bienvenue', id)`.
  - Déclencheur `purchase_log_suites` AFTER INSERT ON purchase_log (si `user_id` non NULL) :
    - arrête sa Bienvenue (`arretee_le = now()`) ;
    - si aucun `purchase_log` du même `user_id` avec un autre `shopify_order_id` → `_inscrire('apres_achat', user_id)`.

- [ ] **Step 1: Écrire les scénarios** dans `scratchpad/suites-inscrire.sql`, après `UPDATE suites SET active = true` et une étape jour 0 par suite (dans la transaction), chacun suivi d'un `SELECT` attendu :
  1. fiche flyer avec accord → 1 inscription `bienvenue` ;
  2. fiche `shopify-sync` (porte `shopify`) avec accord → 0 inscription ;
  3. fiche stand → 1 inscription `stand`, 0 `bienvenue` ;
  4. inscrit Bienvenue puis `purchase_log` → Bienvenue `arretee_le` non NULL, 1 inscription `apres_achat` ;
  5. deuxième commande (autre `shopify_order_id`) d'un client sans inscription → 0 `apres_achat` ;
  6. deux lignes `purchase_log` de la **même** commande (deux Fragments) → 1 seule `apres_achat` ;
  7. deux fiches de même adresse (casse différente) qui donnent leur accord → 1 inscription ;
  8. suite en pause → 0 inscription.
- [ ] **Step 2: Lancer avant la migration** (`npx supabase db query --linked -f …` ou l'éditeur SQL) → échoue (`_inscrire` n'existe pas).
- [ ] **Step 3: Écrire la migration 549** (`_inscrire`, deux fonctions de déclencheur `SECURITY DEFINER`, `REVOKE` de `PUBLIC, anon, authenticated`), l'appliquer.
- [ ] **Step 4: Relancer les scénarios** → les huit résultats attendus, puis `ROLLBACK` : `select count(*) from suite_inscriptions` → 0.
- [ ] **Step 5: Commit** `feat(db): inscrire aux suites et arrêter la découverte à l'achat`

### Task 3: Le réveil envoie les étapes dues

**Files:**
- Create: `supabase/migrations/550_suites_reveil.sql`
- Modify: `apps/hub-v2/netlify/missives/missives-envoyer.ts`
- Test: `apps/hub-v2/netlify/missives-envoyer.test.ts`, `scratchpad/suites-reveil.sql`

**Interfaces:**
- Consumes : tâches 1 et 2 ; `missives_prendre_lot`, `_reveiller_missives` (définitions live, mig 541/545).
- Produces :
  - `suites_preparer() RETURNS void` (service role seul). Pour chaque inscription d'une suite **active**, non arrêtée, `prochaine_le <= now()`, prise `FOR UPDATE SKIP LOCKED` : prend la première étape de la suite avec `jour > COALESCE(jour_fait, -1)` ; insère `(missive_id, user_id)` dans `missive_envois` `ON CONFLICT DO NOTHING` ; met `jour_fait = étape.jour` et `prochaine_le = now() + (jour de l'étape suivante − étape.jour) jours`, ou NULL s'il n'y en a plus. Sans étape restante : `prochaine_le = NULL`.
  - `missives_prendre_lot` recréée : prend aussi les envois des Missives `automatique` ; pour elles, la condition d'accord est celle de la suite (`exige_accord` → `accord_nouvelles` ; sinon pas de refus daté), et l'inscription ne doit pas être arrêtée. Le reste à l'identique.
  - `_reveiller_missives` recréée : se réveille aussi s'il existe une inscription due (même condition que `suites_preparer`) ou un envoi `a_envoyer` d'une Missive `automatique`.
  - `missives-envoyer` appelle `rpc/suites_preparer` juste après `rpc/missives_preparer`.

- [ ] **Step 1: Test de la fonction** dans `missives-envoyer.test.ts` : `appelle suites_preparer avant de prendre le lot` (ordre des URL appelées sur le `fetch` simulé : `missives_preparer`, `suites_preparer`, `missives_prendre_lot`).
- [ ] **Step 2: `pnpm --filter hub-v2 test missives-envoyer`** → FAIL.
- [ ] **Step 3: Ajouter l'appel**, relancer → PASS.
- [ ] **Step 4: Écrire `scratchpad/suites-reveil.sql`** (transaction, `ROLLBACK`), étapes aux jours 0, 3, 7 :
  1. inscrit maintenant → `suites_preparer()` → 1 envoi (jour 0), `prochaine_le ≈ now() + 3 jours` ; second appel → toujours 1 envoi ;
  2. `prochaine_le` reculé de 10 jours (pause rattrapée) → un appel pose **une** étape (jour 3), pas deux ;
  3. inscription arrêtée avec un envoi `a_envoyer` → `missives_prendre_lot(10)` ne le prend pas ;
  4. client avec refus daté inscrit à `apres_achat` → pas pris ; même client sans date → pris ;
  5. étape du jour 3 supprimée pendant que `jour_fait = 0` → l'appel suivant pose le jour 7 ;
  6. suite en pause → `suites_preparer()` ne pose rien.
- [ ] **Step 5: Écrire et appliquer la migration 550**, lancer les scénarios → attendus, `ROLLBACK`.
- [ ] **Step 6: `pnpm --filter hub-v2 build`** (rempaquette `missives-envoyer.mjs`) → OK.
- [ ] **Step 7: Commit** `feat(missives): le réveil envoie les étapes des suites`

### Task 4: Le Hub lit et règle les suites

**Files:**
- Create: `supabase/migrations/551_suites_hub.sql`, `apps/hub-v2/src/features/missives/api/suites.ts`, `apps/hub-v2/src/features/missives/hooks/useSuites.ts`
- Modify: `hub_enregistrer_missive` (accepte le statut `automatique`), `hub_envois` (exclut les `automatique`)

**Interfaces:**
- Produces (toutes `_is_admin()`, `GRANT` à `authenticated`) :
  - `hub_suites() RETURNS jsonb` : `[{cle, nom, active, exige_accord, en_cours, finis, arretes, etapes: [{id, jour, missive_id, objet, envoyes, ouverts, clics}]}]`, étapes triées par jour.
  - `hub_activer_suite(p_cle text, p_active boolean) RETURNS void`.
  - `hub_ajouter_etape(p_cle text, p_jour int) RETURNS bigint` : crée une Missive `automatique` (modèle `missive`, palette de la marque, contenu vide comme `brouillonVide` côté Hub) et son étape ; renvoie l'id de la Missive. Refus `_refus('Ce jour a déjà son e-mail', 'jour')` si le jour est pris.
  - `hub_regler_etape(p_id bigint, p_jour int) RETURNS void`, `hub_retirer_etape(p_id bigint) RETURNS void` : supprime l'étape et sa Missive ; **refus** `_refus('Cet e-mail est déjà parti, change-le plutôt', 'envois')` si elle a des envois, pour garder l'historique.
  - `api/suites.ts` : `lireSuites(): Promise<Suite[]>`, `activerSuite(cle: CleSuite, active: boolean)`, `ajouterEtape(cle: CleSuite, jour: number): Promise<number>`, `reglerEtape(id: number, jour: number)`, `retirerEtape(id: number)` ; `type CleSuite = 'bienvenue' | 'stand' | 'apres_achat'`.
  - `useSuites()` : React Query, mêmes conventions que `useListes`.

- [ ] **Step 1: Vérifier live** `pg_get_functiondef` de `hub_enregistrer_missive` et `hub_envois`.
- [ ] **Step 2: Migration 551**, appliquée ; en prod : `select hub_suites()` connecté admin → 3 suites ; avec la clé `anon` → refusé ; `hub_retirer_etape` d'une étape qui a des envois → refus.
- [ ] **Step 3: Types régénérés, `api/suites.ts` et `useSuites.ts`**, `pnpm --filter hub-v2 typecheck` → OK.
- [ ] **Step 4: Commit** `feat(hub): lire et régler les suites`

### Task 5: L'écran Automatisations et Écrire pour une étape

**Files:**
- Create: `apps/hub-v2/src/features/missives/components/Automatisations.tsx`, `Automatisations.test.tsx`
- Modify: `app/router.tsx` (`missives/automatisations`), `app/coquille/menu.ts` (entrée « Automatisations » après « Listes »), `components/Ecrire.tsx` et `Reglages.tsx` (mode étape)

**Interfaces:**
- Consumes : `useSuites`, `api/suites.ts` (tâche 4) ; route existante `missives/ecrire/:id`.

- [ ] **Step 1: Maquette** dans Figma (fichier App v2, page « Hub Emails »), à 1440 et 390 px : une suite par bloc (nom, interrupteur Active/En pause, en cours · finis · arrêtés), ses e-mails jour par jour (« Jour 3 », objet, envoyés · ouverts · clics, lien « Écrire »), « + Ajouter un e-mail ». **Validée par Uriel avant de coder.**
- [ ] **Step 2: Tests** dans `Automatisations.test.tsx` :
  - `affiche les trois suites, en pause` ;
  - `chaque e-mail mène à missives/ecrire/<missive_id>` ;
  - `ajouter un e-mail appelle ajouterEtape avec le jour saisi puis ouvre Écrire` ;
  - `activer une suite sans e-mail est refusé avec « Écris d'abord son premier e-mail »`.
  Dans `Ecrire.test.tsx` : `une étape automatique n'a ni liste ni Programmer, seulement Enregistrer et l'essai`.
- [ ] **Step 3: `pnpm --filter hub-v2 test missives`** → FAIL.
- [ ] **Step 4: Implémenter.** Une étape `automatique` enregistre `contenu_envoi` à chaque enregistrement (`lettrePourEnvoi`, `lib/envoi.ts`), puisqu'elle n'a pas de moment « Programmer ».
- [ ] **Step 5: Tests** → PASS ; `pnpm --filter hub-v2 lint && pnpm --filter hub-v2 build` → OK.
- [ ] **Step 6: Navigateur** (`pnpm dev`) : ajouter un e-mail à Bienvenue, l'écrire, s'envoyer un essai, revenir ; vérifier à 390 px.
- [ ] **Step 7: Commit** `feat(hub): l'écran Automatisations`

### Task 6: Mise en route

Personne n'est inscrit tant qu'une suite est en pause : le code peut partir en prod avant les textes.

- [ ] **Step 1: Déployer** le Hub (commande du lot 1, `.claude/rules/deploiement.md`) ; vérifier le bundle live.
- [ ] **Step 2: Uriel écrit** les e-mails de Bienvenue (la lettre au jour 0, puis 3, 7, 11, 14), de Bienvenue du stand et d'Après le premier achat (réécriture des quatre e-mails Shopify) ; un essai de chacun.
- [ ] **Step 3: Essai réel** : activer Bienvenue, s'inscrire au flyer avec une adresse de test → la lettre du jour 0 arrive en ≤ 5 minutes ; une commande test → la Bienvenue s'arrête, l'Après-achat part.
- [ ] **Step 4: Le jour où Après le premier achat est activée**, Uriel coupe la série Shopify équivalente (spec, décision du 22/10).
- [ ] **Step 5:** une ligne dans `_État.md` du parcours client (vault) ; push.
