# Revendiquer par GPS — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sur place, la carte propose « Marquer ma visite » ; la visite est la fête de `Recompense` ;
la revendication devient un écran « Plante ton étendard » puis « Conquis ! » animé, depuis la carte
comme depuis la fiche.

**Architecture:** une migration (537) fait rendre à `visiter_lieu` la récompense et à
`_revendiquer` l'ancien tenant et le rang. Côté V2, une nouvelle feature `features/revendication/`
porte le parcours (calque posé sur l'écran de départ) : visite → étendard → conquête ; la carte et la
fiche l'ouvrent. `FenetreRevendication` disparaît.

**Tech Stack:** React 19 + TS strict, TanStack Query, CSS modules, Vitest + Testing Library, MapLibre
(carte), Supabase (plpgsql).

**Spec:** `docs/superpowers/specs/2026-10-21-revendiquer-gps-design.md` — à lire avant chaque tâche.
Maquettes Figma (fichier App v2 `MKqyVhDPreg06PMEAaDxde`) : `679:1732`, `682:1720`, `679:1676`,
`678:1676` (animée : lire ses images clés et l'annotation `678:1775` pour les durées), `679:1810`.

## Global Constraints

- pnpm uniquement ; TS strict : ni `any`, ni `@ts-ignore`, ni `as unknown as` ; pas de `console.log`.
- Composant nouveau rangé dans son sous-dossier ; > 700 lignes → découper ; sans état → `lib/`.
- Migration : numérotée `537_…`, `-- WHY:` en tête, chaque `CREATE OR REPLACE` part de la définition
  **live** copiée entière (`docs/db/migrations-workflow.md`) ; appliquée par
  `npx supabase db push --linked`, puis vérifiée en prod.
- Portée : `PORTEE_M = 200` (`features/lieu/lib/distance.ts`) ; nom de revendication : 40 caractères.
- Textes exacts : « Marquer ma visite » · « Ton {n}ᵉ lieu visité ! » (« Ton 1ᵉʳ lieu visité ! ») ·
  « Revendiquer ce lieu » · « Revenir à la carte » · « PLANTE TON ÉTENDARD » · « Revendique ce lieu :
  ton nom y flottera, jusqu'à ce qu'un autre vienne le reprendre. » · « Nom de ta revendication » ·
  « Planter mon étendard » · « Pas maintenant — revenir à la carte » · « CONQUIS ! » ·
  « PRIS À {NOM} » · « « {nom} » flotte sur ce lieu, jusqu'à ce qu'un autre vienne le reprendre. » ·
  « Ton {n}ᵉ lieu conquis » (« Ton 1ᵉʳ lieu conquis ») · « On te préviendra si quelqu'un vient te le
  reprendre. » · « VOIR LE LIEU → ».
- Couleurs, polices, parchemin : jetons de `tokens.css` / `packages/da`, jamais en dur ; un jeton
  absent s'ajoute (`.claude/rules/interface.md`).
- Mouvement réduit (`prefers-reduced-motion: reduce`) : tout est à sa place, rien ne bouge.

## Review Focus

- Double toucher sur « Planter mon étendard » : une seule revendication part (bouton inactif pendant
  l'envoi) — test tâche 6.
- Refus du serveur à l'écran 3 (« Pas sur place », « Visite trop ancienne ») : on reste sur l'écran,
  le message existant s'affiche, pas d'écran « Conquis ! » — test tâche 6.
- Visite refusée depuis le bouton flottant (« Trop loin ») : message sous le bouton, aucune fête —
  test tâche 8.
- Position qui oscille autour de 200 m : un lieu à exactement 200 m est à portée (bornes cohérentes
  avec `etatVisite`) — test tâche 3.
- Nom de 41 caractères collé dans le champ : coupé à 40 (`Champ max={40}`) — test tâche 6.

---

### Task 1: Migration 537 — la récompense de visite, l'ancien tenant, le rang

**Files:**
- Create: `supabase/migrations/537_revendiquer_par_gps.sql`

**Interfaces:**
- Produces (JSON rendus) :
  - `visiter_lieu(p_id, p_lat, p_lng)` → `{ visiteLe, rang, gain, niveau, avant, apres }` ; `rang` =
    nombre de mes lignes `place_explorers` où `NOT a_distance` ; `gain` = XP réellement gagnée par
    cet appel (0 sur une revisite) ; `niveau/avant/apres` calculés comme `percer_enigme` (470,
    l. 60-85 : `_level_from_xp`, `_xp_for_level`, jauge remise à 0 si changement de niveau).
  - `revendiquer_lieu(...)` → `{ nom, prisA, rang }` ; seul, `p_nom` non vide est **gardé** (retirer
    `v_nom := NULL` du cas seul) ; en groupe, refus inchangé si vide.
  - `_revendiquer(...)` → ajoute `prisA` = `user_public_name` de `v_avant` si `v_avant` non nul et
    différent de moi, sinon `null` ; `rang` = `count(DISTINCT place_id)` de `revendications` où
    `user_id = p_moi` (après l'insertion). Branche « déjà tenant » : mêmes clés, `prisA` null.

- [ ] **Step 1:** Copier les définitions live de `visiter_lieu`, `revendiquer_lieu`, `_revendiquer`
  (`pg_get_functiondef`) dans le fichier, `-- WHY:` + `-- SCHEMA CHECKED (date, live)` en tête.
- [ ] **Step 2:** Apporter les changements de l'Interfaces block ; `GRANT`/`REVOKE` inchangés.
- [ ] **Step 3:** `npx supabase db push --linked` → « Applying migration 537… » sans erreur.
- [ ] **Step 4:** Vérifier en prod (SQL) : `pg_get_functiondef` des trois fonctions contient
  `'prisA'`, `'rang'`, et `revendiquer_lieu` ne contient plus `v_nom := NULL`.
- [ ] **Step 5:** Commit `feat(revendication): la visite rend sa récompense, la revendication l'ancien tenant et le rang (mig 537)` ;
  rebuild Graphify SQL (`python3 scripts/graphify-sql.py`) si le hook ne l'a pas fait.

### Task 2: API front — lire les nouveaux retours

**Files:**
- Modify: `apps/web-v2/src/features/lieu/api/lieu.ts` (`visiterLieu`, `revendiquerLieu`)
- Modify: `apps/web-v2/src/features/lieu/api/lireLieu.ts` (lecteur `lireConquete`)
- Modify: `apps/web-v2/src/features/lieu/hooks/useVisite.ts`
- Test: `apps/web-v2/src/features/lieu/api/lireLieu.test.ts`

**Interfaces:**
- Consumes: JSON de la tâche 1.
- Produces:
  - `visiterLieu(id, lat, lng): Promise<Recompense>` (type `Recompense` existant, `lireRecompense`).
  - `type Conquete = { nom: string; prisA: string | null; rang: number }`,
    `lireConquete(json: unknown): Conquete`, `revendiquerLieu(...): Promise<Conquete>`.
  - `useVisite(id).visiter(p): Promise<Recompense>`.

- [ ] **Step 1:** Test `lireConquete` : `{nom:'La Garde du Comté', prisA:'Remy', rang:4}` → identique ;
  `{nom:'Uriel', prisA:null, rang:1}` → `prisA === null`.
- [ ] **Step 2:** `pnpm --filter web-v2 test lireLieu` → FAIL (`lireConquete` absent).
- [ ] **Step 3:** Implémenter ; adapter les appelants (`BoutonVisite` ignore toujours le retour).
- [ ] **Step 4:** `pnpm --filter web-v2 test` et `pnpm --filter web-v2 typecheck` → PASS.
- [ ] **Step 5:** Commit.

### Task 3: Le lieu à portée, et la position partagée

**Files:**
- Move: `features/lieu/hooks/usePosition.ts` → `apps/web-v2/src/shared/hooks/usePosition.ts`
  (mettre à jour ses imports, dont `BoutonVisite` ; `Position` reste exporté par `etatVisite`)
- Create: `apps/web-v2/src/features/revendication/lib/lieuAPortee.ts`
- Test: `apps/web-v2/src/features/revendication/lib/lieuAPortee.test.ts`

**Interfaces:**
- Produces: `lieuAPortee(position: Position, lieux: LieuCarte[]): { lieu: LieuCarte; distance: string } | null`
  — le plus proche à `distanceM <= PORTEE_M`, `nature === 'lieu'`, `revendication?.moi !== true` ;
  `distance` = `libelleDistance(m)` ; `null` si position `'inconnue'`/`'refusee'`.

- [ ] **Step 1:** Tests : position inconnue → null ; deux lieux à 50 et 120 m → celui à 50 m ; un
  lieu à exactement 200 m → retenu ; à 201 m → null ; une curiosité à 10 m → ignorée ; un lieu que
  je tiens (`revendication: {nom:'x', moi:true}`) → ignoré ; un lieu `etat: 'inconnu'` → retenu.
- [ ] **Step 2:** Lancer → FAIL. **Step 3:** Implémenter (fonction pure). **Step 4:** PASS.
- [ ] **Step 5:** Commit.

### Task 4: L'étendard

**Files:**
- Create: `apps/web-v2/src/assets/ui/etendard.svg` (NAS `\\EGIDE\Runes de Chêne\VISUELS\LA CARTE\etendard.svg`,
  métadonnées Inkscape retirées, `fill="currentColor"` pour prendre l'encre)
- Modify: `apps/web-v2/src/assets/ui/README.md` (une ligne : usage, taille)

- [ ] **Step 1:** Copier, nettoyer, vérifier qu'il s'affiche dans `/v2/da` (une ligne dans la
  planche des icônes si elle les liste). **Step 2:** Commit.

### Task 5: « Conquis ! » — l'écran animé

**Files:**
- Create: `apps/web-v2/src/features/revendication/components/Conquete/Conquete.tsx` (+ `.module.css`)
- Test: `…/Conquete/Conquete.test.tsx`

**Interfaces:**
- Produces: `Conquete({ lieu: string; conquete: Conquete; onVoirLeLieu: () => void; onFermer: () => void })`.
  Les durées et courbes sont celles de la maquette `678:1676` (annotation `678:1775`) : chute 0–0,45 s
  (accélération), impact 0,45 s (tressaillement 0,2 s, deux anneaux d'encre), balancement autour du
  pied jusqu'à 1,42 s, « CONQUIS ! » frappé 0,47–0,8 s (échelle 1,9 → 1), cascade du texte
  0,85–1,7 s, « VOIR LE LIEU → » 1,7 s. `navigator.vibrate?.(40)` à 450 ms. Fond : le parchemin de
  l'appli. Une croix ferme (comme `Recompense`).

- [ ] **Step 1:** Tests : rend « CONQUIS ! », « PRIS À REMY » quand `prisA:'Remy'`, aucune ligne
  « PRIS À » quand `prisA:null`, « « La Garde du Comté » flotte sur ce lieu… », « Ton 4ᵉ lieu
  conquis », « Ton 1ᵉʳ lieu conquis » pour `rang:1`, la phrase d'enjeu ; « VOIR LE LIEU → » appelle
  `onVoirLeLieu` ; la croix appelle `onFermer`.
- [ ] **Step 2:** FAIL. **Step 3:** Implémenter (CSS `@keyframes`, pivot au pied de la hampe :
  `transform-origin: 50% 100%` ; `@media (prefers-reduced-motion: reduce)` → `animation: none`).
- [ ] **Step 4:** PASS. **Step 5:** Commit.

### Task 6: « Plante ton étendard » — le nom, les compagnons, l'envoi

**Files:**
- Create: `apps/web-v2/src/features/revendication/components/PlanteTonEtendard/PlanteTonEtendard.tsx` (+ `.module.css`)
- Modify: `apps/web-v2/src/features/lieu/hooks/useRevendication.ts` (retirer la requête `noms`,
  `revendiquer` rend `Promise<Conquete>`) ; `features/lieu/api/lieu.ts` (retirer `fetchNomsExpedition`)
- Test: `…/PlanteTonEtendard/PlanteTonEtendard.test.tsx`

**Interfaces:**
- Consumes: `useRevendication(id, true)` → `{ compagnons, compagnies, revendiquer(ids, nom|null, pour|null): Promise<Conquete>, enCours, erreur }`.
- Produces: `PlanteTonEtendard({ fiche: { id: string; nom: string }; monNom: string; onConquis: (c: Conquete) => void; onFermer: () => void })`.
  Au toucher de « Planter mon étendard », jouer `new Audio('/res/etendard-plante.mp3')` (déjà dans
  `public/res/`) dans le geste, puis `revendiquer`.

- [ ] **Step 1:** Tests (mock de `useRevendication`) :
  - champ pré-rempli `monNom` ; pastilles : `monNom` puis chaque Compagnie ;
  - toucher « La Garde du Comté » → champ = « La Garde du Comté », envoi `pour = id` ; retoucher le
    champ → envoi `pour = null` ;
  - champ vidé, seul → envoi `nom = null` ;
  - sans compagnons, pas de ligne « Avec toi » ; avec deux présents → avatars décochés ; en cocher
    un → champ vidé s'il valait `monNom`, pastille `monNom` absente, bouton inactif tant que vide ;
  - un nom de 41 caractères tapé → 40 gardés ;
  - double toucher → `revendiquer` appelé une fois (bouton inactif pendant `enCours`) ;
  - `revendiquer` rejette avec `erreur` « Tu n'es plus sur place… » → message affiché, `onConquis`
    non appelé ;
  - succès → `onConquis({nom, prisA, rang})`.
- [ ] **Step 2:** FAIL. **Step 3:** Implémenter avec `Champ`, `PastilleChoix`, `Avatar`, `Button`
  (pied bloqué en bas, cascade d'apparition de la maquette `679:1676`).
- [ ] **Step 4:** PASS. **Step 5:** Commit.

### Task 7: Le parcours — visite, étendard, conquête

**Files:**
- Create: `apps/web-v2/src/features/revendication/components/ParcoursRevendication/ParcoursRevendication.tsx` (+ `.module.css`)
- Test: `…/ParcoursRevendication/ParcoursRevendication.test.tsx`

**Interfaces:**
- Consumes: `Recompense` (shared/ui), `useFiche(id)` (photo, type, nature, `moi`), tâches 5 et 6.
- Produces: `ParcoursRevendication({ id: string; recompense: Recompense; onFermer: () => void; onVoirLeLieu: () => void })`
  — calque plein écran, étapes `'visite' | 'etendard' | 'conquete'`. À l'étape visite, la phrase
  `Ton {rang}ᵉ lieu visité !` (`gain === 0` : tournure de revisite au choix du constructeur, dans la
  ligne de `phraseRang`) ; « Revendiquer ce lieu » seulement si `nature === 'lieu'` et que je ne
  tiens pas le lieu ; sinon `Recompense` sans bouton d'action (ou son bouton = « Revenir »).

- [ ] **Step 1:** Tests : étape visite affiche la phrase du rang et « Revendiquer ce lieu » ; pas de
  bouton pour une curiosité ni pour un lieu que je tiens ; « Revendiquer ce lieu » → écran étendard ;
  `onConquis` → écran « CONQUIS ! » ; « Revenir à la carte » → `onFermer`.
- [ ] **Step 2:** FAIL. **Step 3:** Implémenter (si `Recompense` doit accepter « pas d'action »,
  l'y ajouter en gardant Découvrir et Ajouter inchangés). **Step 4:** PASS. **Step 5:** Commit.

### Task 8: La carte — le bouton flottant

**Files:**
- Create: `apps/web-v2/src/features/revendication/components/BoutonAPortee/BoutonAPortee.tsx` (+ `.module.css`)
- Modify: `apps/web-v2/src/features/carte/components/CarteScreen.tsx` (le poser, ouvrir le parcours)
- Modify: `apps/web-v2/src/features/carte/lib/calques.ts` / `nouveaux.ts` (l'anneau qui pulse sur le
  lieu à portée : le même calque d'anneau que les lieux neufs, un lieu de plus)
- Test: `…/BoutonAPortee/BoutonAPortee.test.tsx`

**Interfaces:**
- Consumes: `usePosition` (sans `demander` : seulement si déjà autorisée), `lieuAPortee`,
  `useVisite`, `ParcoursRevendication`.
- Produces: `BoutonAPortee({ lieux: LieuCarte[]; onVisite: (id: string, r: Recompense) => void })`.

- [ ] **Step 1:** Tests : rien sans position ; « Marquer ma visite » + « {nom} · à {distance} » quand
  un lieu est à portée ; toucher → `visiter` puis `onVisite(id, recompense)` ; refus « Trop loin » →
  message sous le bouton, `onVisite` non appelé.
- [ ] **Step 2:** FAIL. **Step 3:** Implémenter ; dans `CarteScreen`, ouvrir `ParcoursRevendication`
  au retour ; « VOIR LE LIEU » navigue vers la fiche. Garder `CarteScreen` sous 700 lignes.
- [ ] **Step 4:** PASS. **Step 5:** Commit.

### Task 9: La fiche — même parcours, l'ancienne fenêtre disparaît

**Files:**
- Modify: `apps/web-v2/src/app/routes/lieu.tsx` (`onVisite` reçoit la `Recompense` et ouvre
  `ParcoursRevendication` ; l'état `'revendiquer'` du calque disparaît)
- Modify: `apps/web-v2/src/features/lieu/components/BoutonVisite.tsx` (`onVisite: (r: Recompense) => void`)
- Delete: `features/lieu/components/FenetreRevendication.tsx`, `.module.css`, `.test.tsx`
- Test: `apps/web-v2/src/features/lieu/components/BoutonVisite.test.tsx`

- [ ] **Step 1:** Adapter le test de `BoutonVisite` : `onVisite` reçoit la récompense.
- [ ] **Step 2:** FAIL. **Step 3:** Implémenter ; supprimer la fenêtre et tout import mort (grep
  `FenetreRevendication`, `fetchNomsExpedition` → zéro résultat). **Step 4:** PASS.
- [ ] **Step 5:** Commit.

### Task 10: Vérifier dans le navigateur, construire

- [ ] **Step 1:** `pnpm --filter web-v2 dev` ; simuler la position (DevTools → Sensors) près d'un lieu :
  bouton flottant → fête → étendard (pastilles, compagnons absents) → « CONQUIS ! » (son, animation
  à l'œil contre la maquette `678:1676`) → croix → pilule sur la carte. Depuis une fiche : même
  parcours. Mouvement réduit activé : tout immobile. Captures montrées à Uriel.
- [ ] **Step 2:** `pnpm --filter web-v2 test`, `typecheck`, `lint`, `build` → OK.
- [ ] **Step 3:** Commit des derniers réglages. Le déploiement suit `.claude/rules/deploiement.md`
  (version montée), sur décision d'Uriel.
