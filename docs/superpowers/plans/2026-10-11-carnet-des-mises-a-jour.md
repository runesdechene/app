# Le carnet des mises à jour — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** chaque note de mise à jour de « Nouveautés » reçoit les cœurs à volonté d'un lieu et, dessous, le Carnet de passage d'un lieu (mots, réponses, photos, un cœur par personne sur un mot), avec les mêmes composants rendus communs.

**Architecture:** la base reçoit trois tables de même forme que celles du lieu et des RPC calquées sur leurs définitions live (migration 478). Côté appli, `Carnet`, `EcrireAuCarnet`, `PastilleCoeurs` et `FeuilleCoeurs` passent dans `shared/ui` et reçoivent données et actions de qui les affiche ; le lieu les alimente par ses hooks actuels, « Nouveautés » par deux hooks neufs. Deux nouveaux types de notification partent en push par `send-push`.

**Tech Stack:** Supabase (PL/pgSQL, RPC `SECURITY DEFINER`, RLS), Deno (edge function `send-push`), React 19, TypeScript strict, TanStack Query 5, CSS Modules, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-11-carnet-des-mises-a-jour-design.md`

## Global Constraints

- TS strict : pas de `any`, `@ts-ignore`, `as unknown as`, ni `!` non nul. Pas de `console.log`.
- pnpm uniquement ; `npx` seulement pour `supabase`. Les commandes de web-v2 se lancent depuis `apps/web-v2` (`pnpm exec vitest run <motif>`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`).
- Chaque fichier neuf commence par un en-tête `QUOI — / POURQUOI — / ATTENTION —` (ATTENTION si utile) ; les en-têtes des fichiers dont le rôle change sont mis à jour.
- CSS : jetons de `src/shared/styles/tokens.css` seulement ; stylelint passe ; pas de propriété personnalisée locale dans un module (tokens.test) ; une propriété passée en ligne se déclare dans `src/types/css.d.ts` et `PASSED_INLINE`.
- Code mort croisé : supprimé dans le même commit. Un composant sans état React → `lib/`, avec → composant/hook.
- Toute brique de `shared/ui/*.tsx` est montrée sur la page DA (`DaPage.test.tsx` le vérifie).
- Typographie : apostrophe ’ dans les textes affichés.
- Migrations : en tête `-- WHY:` et `-- SCHEMA CHECKED (date) :` listant les colonnes vérifiées (`.claude/rules/supabase.md`) ; tout `CREATE OR REPLACE` part de la définition **live** copiée entière ; **jamais appliquées par un sous-agent** (la session principale fait `npx supabase db push --linked`). Un sous-agent peut **lire** la base (`npx supabase db query --linked "select …"`), jamais y écrire.
- Conventional Commits, ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Le lieu ne change pas pour le joueur : rendu, textes, RPC et tests du lieu restent identiques.

## Review Focus

1. **Le lieu après le déménagement des composants** : la fiche, son carnet (« Lire les N mots », la page du carnet), ses cœurs et la feuille des cœurs se comportent exactement comme avant. Les tests existants du lieu passent sans changer leurs attentes (tâche 3).
2. **Un administrateur qui écrit** : il ne se notifie pas lui-même ; un administrateur à qui l'on répond ne reçoit qu'une notification (tâche 1, test SQL).
3. **Un cœur sur sa propre note ou son propre mot** : refusé par la base, bouton absent ou inerte dans l'appli (tâches 1 et 4).
4. **Une note effacée du Hub** : ses mots et ses cœurs partent avec elle (cascade) ; les notifications qui la visaient ne cassent pas la cloche (tâches 1 et 4).
5. **Une note précédente repliée** : on voit ses comptes sans charger son carnet ; le carnet ne se charge qu'à l'ouverture (tâche 4).

---

### Task 1: la base — migration 478

**Files:**
- Create: `supabase/migrations/478_carnet_des_mises_a_jour.sql`
- Create: `supabase/tests/v2-nouveautes/478_carnet_des_mises_a_jour.sql` (test en transaction annulée, `BEGIN … ROLLBACK`)

**Interfaces (produites) :**
- Tables `mots_mise_a_jour(id bigint identity, mise_a_jour_id → mises_a_jour(id) ON DELETE CASCADE, user_id varchar → users ON DELETE CASCADE, texte text, images jsonb, parent_id → mots_mise_a_jour ON DELETE CASCADE, created_at)`, `coeurs_mot_mise_a_jour(mot_id → mots_mise_a_jour ON DELETE CASCADE, user_id, nombre, premier_le, dernier_le, PRIMARY KEY (mot_id, user_id))` (même forme que `coeurs_mot` après la 390), `coeurs_mise_a_jour(mise_a_jour_id → mises_a_jour ON DELETE CASCADE, user_id, nombre > 0, …, PRIMARY KEY (mise_a_jour_id, user_id))` (même forme que `coeurs_lieu`). RLS active, aucune policy ; `REVOKE ALL … FROM PUBLIC, anon`.
- RPC, toutes `SECURITY DEFINER`, `SET search_path TO 'public'`, `GRANT EXECUTE … TO authenticated` seulement :
  - `carnet_de_mise_a_jour(p_id bigint, p_limite int DEFAULT NULL) RETURNS json` — même JSON que `carnet_du_lieu` (`{ total, mots: [{ id, quand, texte, qui, venu, photos, coeurs, miens, aMoi, reponses }] }`) avec `venu` toujours `false` ;
  - `ecrire_sous_mise_a_jour(p_id bigint, p_texte text, p_images jsonb DEFAULT '[]', p_parent bigint DEFAULT NULL) RETURNS json` — mêmes contrôles que `ecrire_au_carnet` (1 à 2000 signes, 4 photos au plus dans le dossier du compte et qui existent, 30 mots par jour, une réponse à une réponse va sous le mot d'origine), sans la condition de découverte ; tout membre peut écrire ;
  - `basculer_coeur_mot_mise_a_jour(p_id bigint) RETURNS json` — comme `basculer_coeur_mot` (390) ;
  - `effacer_mot_mise_a_jour(p_id bigint) RETURNS json` — comme `effacer_mot` (auteur ou `_is_staff()`) ;
  - `aimer_mise_a_jour(p_id bigint) RETURNS json` — comme `aimer_lieu` ; refus sur sa propre note (`mises_a_jour.par`) ;
  - `coeurs_de_mise_a_jour(p_id bigint) RETURNS json` — même JSON que `coeurs_du_lieu` (`{ total, miens, gens: [...] }`).
- `mises_a_jour_publiees()` : chaque note rend en plus `coeurs` (total), `miens` et `mots` (nombre de mots, réponses comprises), et `par` reste disponible pour savoir si c'est la mienne (`aMoi` booléen si la fonction actuelle ne rend pas `par`).
- `_notification_v2` : apprend `mot_mise_a_jour` et `coeur_mise_a_jour` (comme elle rend `coeur_mot`, `comment_reply`).

**Notifications** (par `notify(…)` ou l'insertion que les RPC du lieu utilisent, selon la définition live) :
- `ecrire_sous_mise_a_jour` : la réponse prévient l'auteur du mot répondu (`comment_reply`, données adaptées : `mise_a_jour_id`, titre de la note) ; chaque mot ou réponse prévient chaque `users.role = 'admin'` sauf l'auteur, et sauf l'admin déjà prévenu par `comment_reply`, par `mot_mise_a_jour` (données : `actorName`, `mise_a_jour_id`, `titre`, extrait du texte).
- `basculer_coeur_mot_mise_a_jour` : `coeur_mot` à l'auteur du mot, une fois par personne.
- `aimer_mise_a_jour` : `coeur_mise_a_jour` à `mises_a_jour.par`, au premier cœur d'une personne.
- Les données de chaque notification portent ce que la cloche et le push afficheront (voir les tâches 2 et 4 : `actorName`, `titre`, `mise_a_jour_id`).

- [ ] **Step 1 : lire le live.** Par `npx supabase db query --linked` (lecture seule) : `pg_get_functiondef` de `carnet_du_lieu`, `ecrire_au_carnet`, `basculer_coeur_mot`, `effacer_mot`, `aimer_lieu`, `coeurs_du_lieu`, `mises_a_jour_publiees`, `_notification_v2`, `notify`, `_is_staff`, `user_public_name` ; `information_schema.columns` de `coeurs_mot`, `coeurs_lieu`, `mises_a_jour`, `notifications`, `users` (dont `role`). Écrire le bloc `SCHEMA CHECKED` avec ce qui a été lu.
- [ ] **Step 2 : le test SQL qui échoue** — `supabase/tests/v2-nouveautes/478_…sql`, sur le modèle des tests de `supabase/tests/` (lire un exemple) : dans `BEGIN … ROLLBACK`, simuler deux joueurs et un admin (`set_config('request.jwt.claims', …)` comme les tests existants), une note ; vérifier : écrire (texte vide refusé, 2001 signes refusé), une réponse à une réponse remonte au mot d'origine, le cœur sur son mot refusé, le cœur sur sa note refusé, effacer par un autre joueur refusé et par l'équipe accepté, les réponses parties avec le mot, les notifications (l'admin n'est pas prévenu de son propre mot ; un admin répondu reçoit `comment_reply` seul), la note effacée emporte mots et cœurs. Il échoue tant que la migration n'existe pas — ne pas l'exécuter contre la prod : le contrôleur l'exécute après avoir appliqué la 478.
- [ ] **Step 3 : la migration** — tables, RLS, RPC, `mises_a_jour_publiees` et `_notification_v2` réécrites depuis le live, `REVOKE/GRANT`.
- [ ] **Step 4 :** relire la migration contre chaque définition live (diff mental fonction par fonction : ce qui est copié, ce qui change et pourquoi, dans le `-- WHY:`).
- [ ] **Step 5 : commit** — `feat(db): le carnet et les cœurs des mises à jour (478)`.

---

### Task 2: le push et le Hub — `send-push`, `catalogueNotifications`

**Files:**
- Modify: `supabase/functions/send-push/categories.ts`, `supabase/functions/send-push/payloads.ts`
- Test: `supabase/functions/send-push/payloads.test.ts`
- Modify: `apps/hub/src/lib/catalogueNotifications.ts`

**Interfaces:**
- Consumes: les données de notification de la tâche 1 (`actorName`, `titre`, `mise_a_jour_id`).
- Produces: `mot_mise_a_jour` et `coeur_mise_a_jour` en catégorie `important` ; leurs textes : `« <actorName> a commenté « <titre> » »` et `« <actorName> aime « <titre> » »` (repli sans nom : « Un Explorateur ») ; le lien vers la page « Nouveautés » (lire comment `mise_a_jour` construit déjà son lien dans `payloads.ts` et faire pareil).

- [ ] **Step 1 :** les tests qui échouent dans `payloads.test.ts` (les deux types, avec et sans nom) et `categoryOf` des deux types ; `deno test` comme le fichier l'indique (ou la commande documentée dans le dossier).
- [ ] **Step 2 :** le code ; le catalogue du Hub reçoit les deux types (nom, quand, pour qui), sur le modèle de `mise_a_jour`.
- [ ] **Step 3 :** tests verts ; `pnpm build` du Hub (depuis `apps/hub`).
- [ ] **Step 4 : commit** — `feat(push): les commentaires et les cœurs des mises à jour`.

Ne pas déployer l'edge function ni le Hub : la session principale s'en charge.

---

### Task 3: les composants du lieu deviennent communs

**Files:**
- Move: `apps/web-v2/src/features/lieu/components/Carnet.tsx`, `EcrireAuCarnet.tsx`, `Carnet.module.css` → `apps/web-v2/src/shared/ui/` ; `PastilleCoeurs` (de `CoeursLieu.tsx`) et la liste de `FeuilleCoeurs.tsx` → `shared/ui` (le fichier `CoeursLieu.tsx` garde `CoeursDesAuteurs`, propre au lieu, s'il n'a pas d'autre usage) ; la logique pure dont ils ont besoin (`lib/carnet.ts` `basculerCoeur`, `lib/coeurs.ts`) suit si elle n'est plus propre au lieu.
- Modify: `features/lieu/components/FicheLieu.tsx`, `app/routes/lieu.tsx` (la page du carnet et la feuille des cœurs), les tests du lieu qui importent ces fichiers (chemins seulement).
- Modify: `app/da/DaBriques.tsx` (une section par brique déplacée).
- Test: les tests existants du lieu ; un test par brique neuve de `shared/ui` si elle n'en a pas.

**Interfaces (produites) :**
- `Carnet` ne lit plus `useCarnet` : `Carnet({ carnet, actions, titre, chapo, lireTout })` où `carnet: Carnet` (le type `{ total, mots }`, déplacé dans un module partagé avec `Mot` et `Personne` s'ils sont dans `features/lieu/api/lireLieu.ts`), `actions: { ecrire(e: Ecrit): void; enCours: boolean; erreur: unknown; aimer(mot: number): void; effacer(mot: number): void }`, `titre`/`chapo` les textes d'en-tête (« Carnet de passage », « Ce que les Explorateurs ont laissé ici : conseils, souvenirs… » pour le lieu), `lireTout` le lien « Lire les N mots » ou rien. Le badge « est venu·e » ne s'affiche que si `mot.venu`.
- `PastilleCoeurs({ coeurs, peutAimer, onAimer, onVoir })` inchangée, déplacée ; `FeuilleCoeurs` reçoit `{ coeurs, onFermer, titre? }` au lieu de `{ id }` (le lieu lui passe `useCoeurs(id).coeurs`).
- `features/lieu` garde `useCarnet` et `useCoeurs` et fournit les données/actions : un petit `CarnetDuLieu({ id, limite })` (dans `features/lieu/components/`) remplace l'ancien appel `<Carnet id limite />`.

- [ ] **Step 1 :** lancer les tests du lieu et de la DA, noter qu'ils passent (base de comparaison).
- [ ] **Step 2 :** déplacer et réécrire les signatures ; adapter les appels du lieu ; rien ne change à l'écran.
- [ ] **Step 3 :** tests du lieu inchangés dans leurs attentes (seuls les chemins d'import bougent), tests DA, suite complète, tsc, lint, build.
- [ ] **Step 4 : commit** — `refactor(lieu): le carnet et les cœurs deviennent des briques communes`.

---

### Task 4: les cœurs et le carnet sous chaque note de « Nouveautés »

**Files:**
- Modify: `apps/web-v2/src/features/notifications/api/nouveautes.ts` (+ son lecteur et son test), `components/Nouveautes.tsx` (+ `.module.css`, test), et les fichiers de la cloche qui affichent les types de notification (lire `features/notifications/` pour trouver où `coeur_mot` / `comment_reply` sont rendus).
- Create: `features/notifications/hooks/useCarnetDeMiseAJour.ts`, `useCoeursDeMiseAJour.ts` (+ tests si le dossier en a pour ses hooks), et les appels RPC dans `api/`.

**Interfaces:**
- Consumes: les briques de la tâche 3 ; les RPC de la tâche 1 (`carnet_de_mise_a_jour`, `ecrire_sous_mise_a_jour`, `basculer_coeur_mot_mise_a_jour`, `effacer_mot_mise_a_jour`, `aimer_mise_a_jour`, `coeurs_de_mise_a_jour`) ; les champs neufs de `mises_a_jour_publiees` (`coeurs`, `miens`, `mots`, et de quoi savoir si la note est la mienne).
- Produces: `useCarnetDeMiseAJour(id: number, actif: boolean)` (même contrat que `useCarnet` : `{ carnet, ecrire, aimer, effacer }`, mise à jour optimiste du cœur de mot avec `basculerCoeur`) ; `useCoeursDeMiseAJour(id: number, actif: boolean)` (même contrat que `useCoeurs` : à volonté, optimiste, relecture à la fin d'une rafale). Photos : même envoi que le carnet du lieu (lire comment `ecrireAuCarnet` dans `features/lieu/api/lieu.ts` envoie les photos et le reprendre).

Comportement (spec) :
- La dernière note : la pastille de cœurs sous le texte, puis le carnet ouvert (titre « Commentaires », chapo « Ce que les Explorateurs en pensent… » — sinon reprendre les mots de la spec), tous les mots (`limite` nulle). La feuille des cœurs s'ouvre au toucher du compte.
- Une note précédente : ses comptes (« ♥ 12 · 3 mots ») et un bouton « Lire les commentaires » qui déplie la pastille et le carnet ; rien ne se charge avant (hooks `actif`).
- Sa propre note : pas d'envoi de cœur (`peutAimer` faux), comme son propre lieu.
- La cloche affiche `mot_mise_a_jour` et `coeur_mise_a_jour` (textes de la tâche 2) et mène à « Nouveautés ».

- [ ] **Step 1 :** les tests qui échouent : `Nouveautes.test.tsx` (pastille et carnet sous la dernière note ; une note précédente montre ses comptes et ne charge rien avant le toucher ; écrire, répondre, aimer une note, aimer un mot, effacer appellent les bonnes RPC) ; le lecteur lit les nouveaux champs ; la cloche affiche les deux types.
- [ ] **Step 2 :** le code.
- [ ] **Step 3 :** suite complète, tsc, lint, build.
- [ ] **Step 4 : commit** — `feat(nouveautes): les cœurs et le carnet de chaque mise à jour`.

---

### Task 5: mise en ligne (session principale)

- [ ] Appliquer la 478 (`npx supabase db push --linked`) ; lancer le test SQL de la tâche 1 contre la prod (il est en `ROLLBACK`) et vérifier qu'il passe.
- [ ] Déployer `send-push` (`npx supabase functions deploy send-push`).
- [ ] `pnpm dev` (web-v2), dans le navigateur, PC et largeur téléphone : un cœur sur la note, un mot avec une photo, une réponse, un cœur sur un mot (allumé puis éteint), effacer ; une note précédente se déplie ; la notification arrive dans la cloche d'un admin ; la fiche d'un lieu, son carnet et ses cœurs inchangés.
- [ ] Pythéas 1.17.0, `pnpm build`, Netlify (`.claude/rules/deploiement.md`), `scripts/sync-app-version.mjs` ; Hub rebuild et déploiement (catalogue des notifications).
- [ ] `_État.md` ; push.
