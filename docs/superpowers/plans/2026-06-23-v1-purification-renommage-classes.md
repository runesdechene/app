# Purification des factions + Renommage en Classes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer les 4 factions (camps compétitifs) en classes d'identité purement visuelles, sans toucher à `users.faction_id`, et livrer purification + renommage d'un bloc.

**Architecture:** Migrations SQL **additives** (neutralisation par court-circuit / valeurs par défaut, zéro DROP) + retraits/renommages côté front React. L'ancien monde tourne sous les users pendant le build ; la release (migrations prod + deploy Netlify) est **coordonnée** en fin de plan.

**Tech Stack:** React 19 + TS + Vite (apps/explore-web), Zustand, MapLibre GL, Supabase Postgres (RPC plpgsql), Netlify.

## Global Constraints

- **Migrations additives uniquement** : CREATE / colonnes nullable / UPDATE de données / RPC redéfinies. Zéro DROP, zéro NOT NULL sur colonne peuplée. Tout retrait définitif → noté dans `docs/db/cleanup-v1-identity.md`.
- **Numérotation migrations** : séquentielle à partir de **271** — le **270 est réservé** par le flyer (`270_flyer_account_source_and_rate_limit.sql`, appliqué prod via MCP mais sur branche flyer, pas mergé ; `schema_migrations` prod s'arrête à 269). On évite la collision.
- **`users.faction_id` CONSERVÉ** — porteur de la classe. Jamais touché.
- **Registre UI** : « type d'explorateur » / « classe ». Jamais « Ordre » / « Chevalier Errant » en label (réservés au lore/descriptions).
- **Mapping faction→classe** (par `id`, verbatim) : `faction-byzantine`=L'Archiviste 🟣 `#a93d76` · `faction-celtique`=Le Pèlerin 🟢 `#57b33d` · `faction-nordique`=Le Rôdeur 🔵 `#3c56be` · `faction-romaine`=Le Protecteur 🔴 `#c94436`.
- **Vérif (pas d'infra de tests unitaires UI ici)** : chaque task front se vérifie par `pnpm -C apps/explore-web run build` (typecheck Vite/tsc) **+ click-flow local** (`pnpm -C apps/explore-web dev`). Pas de deploy avant la phase finale coordonnée.
- **Redéfinir une RPC** = copier-coller la baseline ENTIÈRE puis retirer (jamais improviser). Lire l'ancienne version via `pg_get_functiondef` avant toute redéfinition.
- **Pas de DROP en prod sans vérif manuelle** (ce plan ne DROP rien — il neutralise).

---

## File Structure

**SQL (nouvelles migrations, `supabase/migrations/`)**
- `271_factions_to_classes_rename.sql` — UPDATE titres/descriptions/adjectifs des 4 factions.
- `272_neutralize_faction_bonuses.sql` — met les `bonus_*` à 0 + court-circuite `faction_tag_bonuses`.
- `273_strip_set_user_faction_side_effects.sql` — redéfinit `set_user_faction` sans bonus/underdog ; `get_factions_for_choice` sans tri d'équilibrage.
- `274_park_territory_names.sql` — `propose_territory_name` / `vote_territory_name` refusent poliment (parking).

**Front (`apps/explore-web/src/`)**
- `lib/map-layers.ts`, `workers/territoryWorker.ts`, `components/map/core/ExploreMap.tsx` — retrait couche territoire.
- `components/map/markers/OnlinePlayerMarkers.tsx`, `components/map/markers/VeilleurNamePills.tsx` — marqueurs neutres.
- `stores/mapStore.ts` + contrôle UI du toggle — retrait `factionColorMode`.
- `components/map/badges/FactionBar.tsx` (+ `.css`) + son montage dans la vue carte — retrait complet.
- `components/places/details/PlaceCourtView.tsx`, `PatronsList.tsx`, `CourtTensionBar.tsx`, `TerritoryPanel.tsx` — mécénat individuel.
- `components/auth/FactionModal.tsx` (+`.css`), `OnboardingModal.tsx`, `ProfileMenu.tsx`, `FactionMembersModal.tsx`, `components/map/modals/PlayerProfileModal.tsx`, `types/playerProfile.ts` — renommage libellés.
- Composant/écran qui propose/vote les noms de territoire — masquage UI.

**Docs**
- `docs/db/cleanup-v1-identity.md` — ajouter les retraits différés.

---

## Task 1 — Migration : renommage des 4 factions en classes (DB)

**Files:** Create `supabase/migrations/271_factions_to_classes_rename.sql`

**Interfaces:** Produces — `public.factions` rows avec `title`/`description`/`adjective` de classe (mêmes `id`, mêmes `color`).

- [ ] **Step 1 — Lire l'état actuel** (ne pas improviser les colonnes)

Run (MCP Supabase ou psql) : `select id, title, adjective, image_url from public.factions order by "order";`
Noter les valeurs actuelles (rollback).

- [ ] **Step 2 — Écrire la migration**

```sql
-- 271_factions_to_classes_rename.sql
-- Renomme les 4 factions en classes (identité visuelle). Additif : UPDATE de données,
-- id et color conservés. Rollback = restaurer les anciens titres.
update public.factions set
  title = 'L''Archiviste',
  adjective = 'Archiviste',
  description = 'L''Archiviste accueille ceux qui refusent que les choses disparaissent. Quand un lieu s''efface, c''est lui qui le retient ; quand une histoire s''éteint, c''est lui qui la rallume. Son combat n''est pas contre les hommes, mais contre l''Oubli lui-même.'
where id = 'faction-byzantine';

update public.factions set
  title = 'Le Pèlerin',
  adjective = 'Pèlerin',
  description = 'Le Pèlerin accueille les âmes contemplatives, ceux qui entendent une présence dans une source, un vieux chêne, une pierre levée — et qui s''inclinent là où d''autres ne voient qu''un décor. Il refuse que le monde oublie qu''il est encore vivant et sacré.'
where id = 'faction-celtique';

update public.factions set
  title = 'Le Rôdeur',
  adjective = 'Rôdeur',
  description = 'Le Rôdeur accueille les cœurs sans repos, ceux que l''horizon appelle et qui s''enfoncent là où les chemins s''effacent, pour débusquer les lieux que le monde a cessé de fouler. Quand une route s''oublie, c''est lui qui la rouvre.'
where id = 'faction-nordique';

update public.factions set
  title = 'Le Protecteur',
  adjective = 'Protecteur',
  description = 'Le Protecteur accueille les âmes loyales et constantes, ceux qui ne se contentent pas de trouver un lieu mais veillent sur lui, le défendent et le soignent pour qu''il ne retombe pas dans la nuit. Ce qu''il a juré de garder, l''Oubli ne le reprendra pas.'
where id = 'faction-romaine';
```

> `image_url` (emblème/bannière de classe) : laissé tel quel ici — sera mis à jour quand les assets ChatGPT seront prêts (UPDATE séparé). Si Uriel fournit les emblèmes avant, ajouter `image_url = '<url>'` à chaque bloc.

- [ ] **Step 3 — Vérifier (sans appliquer en prod encore)** : relire la migration, confirmer 4 UPDATE, 1 par `id`, apostrophes échappées (`''`).

- [ ] **Step 4 — Commit** (l'application en prod se fait en phase finale coordonnée)

```bash
git add supabase/migrations/271_factions_to_classes_rename.sql
git commit -m "feat(db): renomme les 4 factions en classes (mig 271, additif)"
```

---

## Task 2 — Migration : neutraliser les bonus de faction (DB)

**Files:** Create `supabase/migrations/272_neutralize_faction_bonuses.sql`

**Interfaces:** Produces — toutes les colonnes `bonus_*` de `factions` à 0 ; `faction_tag_bonuses` vidée de son effet.

- [ ] **Step 1 — Lire les colonnes bonus réelles**

Run : `select column_name from information_schema.columns where table_schema='public' and table_name='factions' and column_name like 'bonus_%';`
Et : `select count(*) from public.faction_tag_bonuses;`

- [ ] **Step 2 — Écrire la migration** (mettre à 0 toutes les colonnes bonus listées au Step 1 ; adapter la liste exacte)

```sql
-- 272_neutralize_faction_bonuses.sql
-- Identité pure : zéro bonus mécanique. Additif : on met les bonus à 0 (colonnes conservées),
-- et on vide l'effet des bonus par tag. Rollback = restaurer les valeurs.
update public.factions set
  bonus_energy = 0, bonus_conquest = 0, bonus_construction = 0,
  bonus_regen = 0, bonus_vitalite = 0;  -- AJUSTER à la liste réelle du Step 1

-- Bonus par tag : on neutralise sans DROP (parking). Vider les lignes (réversible via réinsertion).
delete from public.faction_tag_bonuses;
```

> Le `delete` est réversible (données re-générables) ; noté comme parking dans cleanup. Si une RPC lit encore `faction_tag_bonuses`, elle renverra 0 réduction — comportement voulu.

- [ ] **Step 3 — Commit**

```bash
git add supabase/migrations/272_neutralize_faction_bonuses.sql
git commit -m "feat(db): neutralise les bonus de faction (mig 272, identite pure)"
```

---

## Task 3 — Migration : `set_user_faction` sans effets de bord + choix sans équilibrage (DB)

**Files:** Create `supabase/migrations/273_strip_set_user_faction_side_effects.sql`

**Interfaces:** Consumes — baselines actuelles de `set_user_faction`, `get_factions_for_choice`. Produces — mêmes signatures, sans bonus/underdog/tri.

- [ ] **Step 1 — Récupérer les baselines ENTIÈRES** (règle : copier-coller puis retirer)

Run : `select pg_get_functiondef('public.set_user_faction'::regprocedure);`
Run : `select pg_get_functiondef('public.get_factions_for_choice'::regprocedure);`
(Si surcharges multiples, lister via `pg_proc` et prendre la bonne signature.)

- [ ] **Step 2 — Écrire la migration** : recoller chaque corps, puis **retirer** (a) toute application de bonus/regen, (b) tout appel à `get_underdog_faction_id` / logique Baroud d'Honneur, (c) dans `get_factions_for_choice`, retirer le `ORDER BY` d'équilibrage par effectif → ordre stable `ORDER BY "order"`. Conserver : cooldown de changement, mise à jour `faction_id`/`faction_changed_at`, sync éventuelle.

```sql
-- 273_strip_set_user_faction_side_effects.sql
-- Redéfinit set_user_faction (changement de CLASSE) sans bonus ni underdog,
-- et get_factions_for_choice sans tri d'équilibrage. Corps = baseline copiée, effets retirés.
-- (COLLER ici les CREATE OR REPLACE FUNCTION complets issus du Step 1, nettoyés.)
```

- [ ] **Step 3 — Vérifier** : diff mental vs baseline — seules les lignes bonus/underdog/tri retirées, tout le reste identique.

- [ ] **Step 4 — Commit**

```bash
git add supabase/migrations/273_strip_set_user_faction_side_effects.sql
git commit -m "feat(db): set_user_faction sans bonus/underdog + choix sans equilibrage (mig 273)"
```

---

## Task 4 — Migration : parquer les noms de territoires (DB)

**Files:** Create `supabase/migrations/274_park_territory_names.sql`

**Interfaces:** Produces — `propose_territory_name` / `vote_territory_name` refusent poliment ; données conservées.

- [ ] **Step 1 — Baselines** : `pg_get_functiondef` pour `propose_territory_name`, `vote_territory_name`.

- [ ] **Step 2 — Migration** : redéfinir chaque RPC pour qu'elle retourne une erreur douce / no-op (`RAISE EXCEPTION 'Fonctionnalité temporairement indisponible'` ou retour `json_build_object('parked', true)` selon le contrat front). Ne PAS toucher aux tables `territory_name_proposals` / `_votes` (conservées).

```sql
-- 274_park_territory_names.sql
-- Parking : la proposition/vote de noms de territoire est gelée jusqu'au SPEC 3.
-- Tables conservées. (COLLER les CREATE OR REPLACE retournant un parked/erreur douce.)
```

- [ ] **Step 3 — Commit**

```bash
git add supabase/migrations/274_park_territory_names.sql
git commit -m "feat(db): parque les noms de territoire jusqu'au SPEC 3 (mig 274)"
```

---

## Task 5 — Front : carte neutre (retrait couche territoire + marqueurs)

**Files:** Modify `lib/map-layers.ts`, `workers/territoryWorker.ts`, `components/map/core/ExploreMap.tsx`, `components/map/markers/OnlinePlayerMarkers.tsx`, `components/map/markers/VeilleurNamePills.tsx`

**Interfaces:** Consumes — rien des tasks DB (le front ne dépend pas du rename pour compiler). Produces — carte sans couche territoire ni couleur de faction.

- [ ] **Step 1 — Retirer la couche territoire** : dans `ExploreMap.tsx`, retirer l'ajout des layers issus de `buildTerritoryFillLayer`/`buildTerritoryPatternLayer` et le worker `territoryWorker`. Dans `map-layers.ts`, retirer (ou court-circuiter) ces builders. Supprimer l'import worker.

- [ ] **Step 2 — Marqueurs neutres** : dans `OnlinePlayerMarkers.tsx` et `VeilleurNamePills.tsx`, remplacer l'usage de `factionColor` par la couleur neutre par défaut `#C19A6B` (constante locale `NEUTRAL_MARKER_COLOR`).

- [ ] **Step 3 — Build** : `pnpm -C apps/explore-web run build` → attendu : typecheck PASS (corriger toute référence orpheline à la couche territoire).

- [ ] **Step 4 — Click-flow local** : `pnpm -C apps/explore-web dev` → la carte s'affiche, aucun blob coloré, marqueurs en sépia, pas de crash console.

- [ ] **Step 5 — Commit**

```bash
git add apps/explore-web/src/lib/map-layers.ts apps/explore-web/src/workers/territoryWorker.ts apps/explore-web/src/components/map/core/ExploreMap.tsx apps/explore-web/src/components/map/markers/OnlinePlayerMarkers.tsx apps/explore-web/src/components/map/markers/VeilleurNamePills.tsx
git commit -m "feat(map): carte neutre, retrait couche territoire + couleur faction"
```

---

## Task 6 — Front : retrait du toggle `factionColorMode`

**Files:** Modify `stores/mapStore.ts` + le composant UI qui bascule le toggle (chercher `factionColorMode` / `setFactionColorMode`).

**Interfaces:** Consumes — Task 5 (carte déjà neutre). Produces — plus de toggle ni d'état `factionColorMode`.

- [ ] **Step 1 — Localiser les usages** : `grep -rn "factionColorMode" apps/explore-web/src`.

- [ ] **Step 2 — Retirer** l'état `factionColorMode` du `mapStore` et le contrôle UI (bouton/switch) qui l'affiche. Retirer la persistance localStorage associée.

- [ ] **Step 3 — Build + click-flow** : `pnpm -C apps/explore-web run build` PASS ; le bouton de mode a disparu, pas de référence morte.

- [ ] **Step 4 — Commit**

```bash
git add -A apps/explore-web/src
git commit -m "feat(map): retire le toggle factionColorMode (carte neutre par defaut)"
```

---

## Task 7 — Front : table rase de la Coupe (retrait `FactionBar`)

**Files:** Delete usage of `components/map/badges/FactionBar.tsx` (+ `.css`) ; modify le parent qui le monte (vue carte).

**Interfaces:** Consumes — Task 6. Produces — plus de scoreboard ni de bandeau victoire à l'écran.

- [ ] **Step 1 — Démonter** : retirer `<FactionBar />` de son parent (chercher `FactionBar` dans la vue carte). Retirer l'import. Supprimer les fichiers `FactionBar.tsx` + `FactionBar.css` (ce sont nos ajouts, suppression assumée — pas une donnée user).

- [ ] **Step 2 — Vérifier les RPC orphelines** : `get_coupe_state` n'est plus appelée par le front (laisser la RPC en base, intacte). `CoupeModal` : si plus rien ne l'ouvre, retirer son montage aussi (ou laisser si ouvert ailleurs — vérifier `grep -rn CoupeModal`).

- [ ] **Step 3 — Build + click-flow** PASS ; carte sans bandeau ni jauges.

- [ ] **Step 4 — Commit**

```bash
git add -A apps/explore-web/src
git commit -m "feat(coupe): table rase du scoreboard faction (retrait FactionBar)"
```

---

## Task 8 — Front : mécénat individuel (Cour sans faction)

**Files:** Modify `components/places/details/PlaceCourtView.tsx`, `PatronsList.tsx`, `CourtTensionBar.tsx`, `TerritoryPanel.tsx`

**Interfaces:** Produces — Cour = classement mécènes par points, sans faction/tension.

- [ ] **Step 1 — Retirer la tension faction** : dans `PlaceCourtView.tsx`/`CourtTensionBar.tsx`, retirer l'affichage de la « tension » entre factions. Conserver le classement des mécènes par points (top = principal).

- [ ] **Step 2 — Badges neutres** : dans `PatronsList.tsx`, retirer la couleur/emblème de faction sur les badges mécènes (identité = nom + points). Si `TerritoryPanel.tsx` n'a plus de sens sans faction, le retirer de son parent (cf. TODO mémoire « virer TerritoryPanel »).

- [ ] **Step 3 — Build + click-flow** : ouvrir un lieu → onglet Cour/Mécénat affiche un classement individuel propre, pas de référence faction.

- [ ] **Step 4 — Commit**

```bash
git add -A apps/explore-web/src
git commit -m "feat(mecenat): Cour individuelle, retrait dimension faction/tension"
```

---

## Task 9 — Front : renommage des libellés faction → classe

**Files:** Modify `components/auth/FactionModal.tsx` (+`.css`), `OnboardingModal.tsx`, `ProfileMenu.tsx`, `FactionMembersModal.tsx`, `components/map/modals/PlayerProfileModal.tsx`, `types/playerProfile.ts`

**Interfaces:** Consumes — Task 3 (`get_factions_for_choice` sans tri) + Task 1 (titres de classe en DB). Produces — UI parlant « type d'explorateur / classe ».

- [ ] **Step 1 — Localiser les strings** : `grep -rn "Faction\|Maison\|faction" apps/explore-web/src/components/auth apps/explore-web/src/components/map/modals`.

- [ ] **Step 2 — Renommer** (user-facing) : « Choisissez votre Faction » → « Choisis ton type d'explorateur » ; « Rejoindre une faction » → « Choisir ta classe » ; « Devenir un sans-bannière » → garder le sens (sans classe) ; retirer du `FactionModal` tout affichage de bonus + Baroud d'Honneur (underdog). Le message de changement de classe « pèse » (confirmation). Garder les libellés `faction_id` internes inchangés.

- [ ] **Step 3 — Profil** : `PlayerProfileModal.tsx` + `types/playerProfile.ts` — libellé « Classe » au lieu de « Faction » pour l'affichage du badge.

- [ ] **Step 4 — Build + click-flow** : écran de choix montre les 4 classes (titres + descriptions de classe), aucun bonus affiché, profil dit « Classe ».

- [ ] **Step 5 — Commit**

```bash
git add -A apps/explore-web/src
git commit -m "feat(classes): renommage libelles faction -> type d'explorateur/classe"
```

---

## Task 10 — Front : masquer la proposition/vote de noms de territoire

**Files:** Modify le(s) composant(s) qui proposent/votent des noms de territoire (chercher `propose_territory_name` / `territory` UI).

**Interfaces:** Consumes — Task 4 (RPC parquées). Produces — entrée UI masquée.

- [ ] **Step 1 — Localiser** : `grep -rn "propose_territory_name\|territory_name\|nom du territoire" apps/explore-web/src`.

- [ ] **Step 2 — Masquer** le bouton/écran de proposition/vote (feature gated off). Ne rien casser si une RPC parquée renvoie le `parked`.

- [ ] **Step 3 — Build + click-flow** PASS ; plus d'entrée de nommage de territoire.

- [ ] **Step 4 — Commit**

```bash
git add -A apps/explore-web/src
git commit -m "feat(territoire): masque le nommage de territoire (parke jusqu'au SPEC 3)"
```

---

## Task 11 — Dette + Release coordonnée (migrations prod + deploy)

**Files:** Modify `docs/db/cleanup-v1-identity.md`

- [ ] **Step 1 — Tracer la dette** : ajouter à `docs/db/cleanup-v1-identity.md` les retraits différés : colonnes `factions.bonus_*`, `faction_tag_bonuses`, `place_influence`, `places.faction_id`/`claimed_*`, RPC `get_underdog_faction_id`, tables `territory_name_*`, `get_coupe_state`/`coupe_seasons` (réévalués au SPEC 2/3). Commit.

- [ ] **Step 2 — Build final** : `pnpm -C apps/explore-web run build` PASS.

- [ ] **Step 3 — Test local complet** : `pnpm -C apps/explore-web dev` — parcours : carte neutre, ouvrir un lieu (Cour individuelle), écran de choix (4 classes, pas de bonus), profil (« Classe »), Dortoir (chat OK). Aucun crash. (Mémoire : build OK ≠ runtime OK — ce test est obligatoire.)

- [ ] **Step 4 — Appliquer les migrations prod** (additives, réversibles) : `pnpm dlx supabase db push` (migrations 271→274). Vérifier manuellement : `select id, title from public.factions;` montre les 4 classes ; `set_user_faction` fonctionne.

- [ ] **Step 5 — Deploy front** : depuis `apps/explore-web`, `netlify deploy --prod --dir "<abs>/apps/explore-web/dist" --message "feat: purification factions + classes"`.

- [ ] **Step 6 — Vérif prod** : `https://app.runesdechene.com` 200 ; carte neutre, écran de choix = classes. Pousser la branche.

```bash
git add docs/db/cleanup-v1-identity.md
git commit -m "docs(db): dette de cleanup post-purification + release classes"
git push origin v1-refonte-identite
```

---

## Self-Review (couverture spec)

- Carte neutre (spec 2.1) → Task 5, 6 ✓
- Coupe table rase (2.2) → Task 7 ✓
- Mécénat individuel (2.3) → Task 8 ✓
- Baroud/underdog (2.4) → Task 3 (+ retrait UI Task 9) ✓
- Bonus neutralisés (2.5) → Task 2 ✓
- Noms territoire parqués (2.6) → Task 4 (DB) + Task 10 (UI) ✓
- Dortoir conservé (3) → non touché (volontaire) ✓
- `users.faction_id` / `set_user_faction` conservés (3) → Task 3 ✓
- Renommage classes (4) → Task 1 (DB) + Task 9 (UI) ✓
- Méthode additive + dette (5) → Task 11 ✓

**Dépendance externe** : emblèmes/bannières de classe (assets ChatGPT) — UPDATE `image_url` à faire quand prêts (non bloquant pour la livraison ; les couleurs/titres suffisent).
