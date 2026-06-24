# Économie & Coupe des Compagnies — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development ou
> superpowers:executing-plans. Steps en cases à cocher (`- [ ]`).

**Goal:** Donner aux Compagnies des sources de Coupe saines + un toggle de bannière active utilisable + l'affichage des Couronnes investies, sur le moteur faction.

**Architecture:** Mécanique = `faction*` (DB/RPC), user-facing = « Compagnie ». La Coupe d'une Compagnie = somme du Coupe de ses membres dont c'est la bannière active (`users.faction_id`), via `_user_coupe_score` agrégé. Le toggle réutilise `set_active_faction` (déjà en prod). Migrations **additives** appliquées via MCP `apply_migration` (DB partagée prod).

**Tech Stack:** Supabase Postgres (plpgsql, SECURITY DEFINER), React + Zustand (apps/explore-web), branche `v1-factions-creables`.

## Global Constraints

- User-facing = **« Compagnie »** ; code/DB = `faction*`. Jamais « faction » à l'écran.
- **Vérification** (pas de pytest ici) : `pnpm -C apps/explore-web exec tsc --noEmit` doit passer (exit 0) ; SQL vérifié par smoke-query MCP ; runtime = click-flow Uriel (pas de deploy auto).
- Migrations **ADDITIVES uniquement** (sûres pour le live). Rien de breaking sans release coordonnée.
- Couleurs/tokens parchemin existants (`var(--color-parchment/ink)`), pas de hex inventé hors palette.
- Commit par tâche. Push seulement en fin de session / sur demande.

---

### Task 1 — Barème Coupe : photo 1ʳᵉ/lieu + retrait du carnet mort (mig 273)

**Files:**
- Create: `supabase/migrations/273_coupe_barem_photo_first_drop_carnet.sql`
- Apply: via MCP `apply_migration` (project `ukpapqssgsxirsgmcvof`)

**Interfaces:**
- Modifie `public._user_coupe_score(text, timestamptz, timestamptz) RETURNS integer` (mêmes signature/retour). Consommé par `list_factions`, `get_faction_detail`, `_faction_chef`, `get_coupe_state`.

- [ ] **Step 1 — Relire la def LIVE** (ne jamais réécrire de mémoire)

Run (MCP execute_sql): `SELECT pg_get_functiondef('public._user_coupe_score(text,timestamptz,timestamptz)'::regprocedure);`
Expected: la def actuelle (terme `coupe.carnet` * count(carnet), terme `coupe.photo` * count(photo)).

- [ ] **Step 2 — Écrire la migration** (copie de la baseline, 2 deltas)

Deltas vs baseline :
1. **Photo** : `COUNT(*)` → `COUNT(DISTINCT place_id)` sur `place_contributions WHERE type='photo'` (seule la 1ʳᵉ photo d'un membre sur un lieu compte).
2. **Carnet** : **retirer entièrement** le terme `place_contributions type='carnet' * _barem('coupe.carnet',3)` (type mort, récits = `description` exclus volontairement).

Le fichier `273_*.sql` = `CREATE OR REPLACE FUNCTION public._user_coupe_score(...)` avec la baseline relue au Step 1, ces 2 deltas appliqués, le reste identique (discover_remote 0, visit_gps, add_place, plant_flag, énigmes par difficulté).

- [ ] **Step 3 — Appliquer en prod**

MCP `apply_migration` name=`273_coupe_barem_photo_first_drop_carnet`, query = contenu du fichier.
Expected: `{"success":true}`.

- [ ] **Step 4 — Smoke-test**

Run (MCP execute_sql) sur un user ayant ≥2 photos sur un même lieu :
`SELECT public._user_coupe_score('<uid>', NULL, NULL);` puis vérifier que 2 photos sur le même lieu ne donnent qu'+1 (pas +2). Vérifier que `list_factions(NULL)` renvoie toujours du JSON valide.

- [ ] **Step 5 — Commit**

```bash
git add supabase/migrations/273_coupe_barem_photo_first_drop_carnet.sql
git commit -m "feat(coupe): photo = 1ère par lieu seulement + retrait du carnet mort (mig 273)"
```

---

### Task 2 — Toggle de bannière active (Hall + FactionBar)

**Files:**
- Modify: `apps/explore-web/src/components/factions/FactionHallModal.tsx`
- Modify: `apps/explore-web/src/components/factions/FactionHallModal.css`
- Modify: `apps/explore-web/src/components/map/badges/FactionBar.tsx`

**Interfaces:**
- Consomme `useFactionGroupStore`: `switchBanner(userId, factionId)` (déjà câblé sur `set_active_faction`, sync playerStore), `activeFactionId`, `myFactions`.

- [ ] **Step 1 — Hall : bouton « Porter ces couleurs »**

Dans `FactionHallModal.tsx`, lire `activeFactionId` + `switchBanner` du store, et `const isActive = activeFactionId === factionId`. Dans le footer membre (branche `isMember`), avant « Quitter », ajouter si membre & pas active :

```tsx
{isMember && !isActive && (
  <button className="faction-hall-setactive" style={{ background: detail.color }}
    onClick={async () => { if (userId) await switchBanner(userId, factionId) }}>
    ⚑ Porter ces couleurs
  </button>
)}
{isMember && isActive && (
  <span className="faction-hall-activebadge" style={{ color: detail.color }}>⚑ Bannière active</span>
)}
```

CSS (`FactionHallModal.css`) :
```css
.faction-hall-setactive { border:none; cursor:pointer; padding:8px 14px; border-radius:12px;
  color:#fff; font-family:var(--font-accent,Helvetica,sans-serif); font-size:12px; font-weight:700; }
.faction-hall-activebadge { font-family:var(--font-accent,Helvetica,sans-serif); font-size:12px;
  font-weight:700; letter-spacing:.04em; }
```

- [ ] **Step 2 — FactionBar : marquer la Compagnie active**

Dans `FactionBar.tsx`, la chip d'une Compagnie dont `faction.factionId === userFactionId` a déjà la classe `faction-chip-mine`. Ajouter un repère « ⚑ » visible dans la chip active : après `faction-chip-name`, `{isMine && <span className="faction-chip-active" title="Ta bannière active">⚑</span>}`. CSS `.faction-chip-active{ font-size:11px; margin-left:2px; }`.

- [ ] **Step 3 — tsc**

Run: `pnpm -C apps/explore-web exec tsc --noEmit` → exit 0.

- [ ] **Step 4 — Commit**

```bash
git add apps/explore-web/src/components/factions/FactionHallModal.tsx apps/explore-web/src/components/factions/FactionHallModal.css apps/explore-web/src/components/map/badges/FactionBar.tsx
git commit -m "feat(factions): toggle de bannière active (Hall « Porter ces couleurs » + repère FactionBar)"
```

---

### Task 3 — Afficher la bannière active à l'écran d'énigme

**Files:**
- Locate + Modify: le composant de l'énigme du jour.

**Interfaces:**
- Consomme `usePlayerStore`: `userFactionTitle`, `userFactionColor` (= Compagnie active, posés par `syncActiveToPlayer`).

- [ ] **Step 1 — Localiser le composant énigme**

Run: `grep -rln "énigme\|enigma" apps/explore-web/src/components --include=*.tsx | grep -iE "enigma|enigme"`
Identifier l'écran où on lance/résout l'énigme du jour (ex. `DailyEnigmaCard` / `EnigmaModal`).

- [ ] **Step 2 — Ajouter le bandeau « ⚔️ pour {Compagnie} »**

En haut du composant, si `userFactionTitle` est non nul :
```tsx
{userFactionTitle && (
  <div style={{ fontFamily:'var(--font-accent,sans-serif)', fontSize:13, color: userFactionColor || 'var(--color-ink)' }}>
    ⚔️ pour {userFactionTitle}
  </div>
)}
```
(But : que le joueur sache où vont ses points, sans avoir à toggler.)

- [ ] **Step 3 — tsc + Commit**

Run: `pnpm -C apps/explore-web exec tsc --noEmit` → exit 0.
```bash
git commit -am "feat(factions): écran d'énigme affiche la Compagnie active créditée"
```

---

### Task 4 — Couronnes investies : colonne + total Compagnie affiché

**Files:**
- Create: `supabase/migrations/274_faction_conquered_crowns.sql`
- Modify: `apps/explore-web/src/stores/factionGroupStore.ts` (type `FactionDetail`)
- Modify: `apps/explore-web/src/components/factions/FactionHallModal.tsx`

**Interfaces:**
- Ajoute `faction_members.crowns_conquered int NOT NULL DEFAULT 0` (distinct de `crowns_invested` = avantage Chef du fondateur).
- `get_faction_detail` renvoie en plus `totalCrowns` (= somme `crowns_invested + crowns_conquered` des membres).

- [ ] **Step 1 — Migration colonne + get_faction_detail**

`274_*.sql` :
```sql
ALTER TABLE public.faction_members ADD COLUMN IF NOT EXISTS crowns_conquered int NOT NULL DEFAULT 0;
```
Puis `CREATE OR REPLACE FUNCTION public.get_faction_detail(...)` (copie de la version mig 272) en ajoutant au `json_build_object` final :
```sql
'totalCrowns', (SELECT COALESCE(sum(crowns_invested + crowns_conquered),0)
                FROM faction_members WHERE faction_id = p_faction_id),
```

- [ ] **Step 2 — Appliquer + smoke**

MCP `apply_migration` name=`274_faction_conquered_crowns`. Puis `SELECT public.get_faction_detail('faction-byzantine')->'totalCrowns';` → doit renvoyer un entier (≥200, le fondateur).

- [ ] **Step 3 — Store: type FactionDetail**

Dans `factionGroupStore.ts`, ajouter à `FactionDetail` : `totalCrowns: number`.

- [ ] **Step 4 — Hall: afficher le total**

Dans `FactionHallModal.tsx`, dans `.faction-hall-totals`, ajouter une 3ᵉ entrée :
```tsx
<span>🪙 <b>{detail.totalCrowns.toLocaleString('fr-FR')}</b> investies</span>
```

- [ ] **Step 5 — tsc + Commit**

Run: `pnpm -C apps/explore-web exec tsc --noEmit` → exit 0.
```bash
git add supabase/migrations/274_faction_conquered_crowns.sql apps/explore-web/src/stores/factionGroupStore.ts apps/explore-web/src/components/factions/FactionHallModal.tsx
git commit -m "feat(factions): total Couronnes investies de la Compagnie (colonne + Hall)"
```

---

### Task 5 — Conquête à l'or → Coupe (tranche + cap/jour) — LE PLUS LOURD

**Files:**
- Create: `supabase/migrations/275_faction_gold_conquest.sql` *(⚠️ 275 est pris par companies abandonné — utiliser `276_faction_gold_conquest.sql`)*
- Modify: barème `app_settings` + `invest_crowns` + agrégation Coupe (`list_factions`, `get_faction_detail`).

**Interfaces:**
- `app_settings`: `coupe.gold_per_tranche='10'`, `coupe.gold_daily_cap='10'`.
- `invest_crowns` : à chaque investissement, accumuler `p_amount` dans `faction_members.crowns_conquered` de la **Compagnie active du payeur** + journaliser pour le cap/jour.

- [ ] **Step 1 — Relire `invest_crowns` LIVE** (archéologie obligatoire)

Run (MCP): `SELECT pg_get_functiondef('public.invest_crowns(text,text,uuid,integer,text)'::regprocedure);`
Comprendre : où l'investissement est stocké, s'il y a un timestamp, comment le bénéficiaire/lieu sont gérés. **Décider le point d'insertion** du delta.

- [ ] **Step 2 — Décider le tracking du cap/jour**

Le cap est **par membre/jour**. Choisir la source datée :
- soit une table légère `faction_gold_log(user_id, faction_id, day date, amount int, PRIMARY KEY(user_id,faction_id,day))` incrémentée par `invest_crowns` (UPSERT `amount += LEAST(p_amount, reste avant cap*tranche)`).
- La Coupe-or d'un membre sur la saison = `SUM(LEAST(amount, gold_daily_cap*gold_per_tranche)) / gold_per_tranche` par jour.

Écrire `276_*.sql` : table + `app_settings` + `CREATE OR REPLACE invest_crowns` (copie baseline + delta : si le payeur a une `faction_id` active, `crowns_conquered += p_amount` et UPSERT `faction_gold_log`).

- [ ] **Step 3 — Intégrer la Coupe-or dans le score Compagnie**

Ajouter au calcul de `list_factions."score"` et `get_faction_detail."totalCoupe"` un terme :
```sql
+ COALESCE((SELECT SUM(LEAST(g.amount, cap*tranche)) / NULLIF(tranche,0)
            FROM faction_gold_log g
            WHERE g.faction_id = f.id AND g.day >= v_from::date AND g.day < v_to::date), 0)::int
```
(avec `tranche`/`cap` lus depuis `app_settings`). Le membre crédite la Compagnie qui était active au moment du don (stocké dans `faction_gold_log.faction_id`).

- [ ] **Step 4 — Appliquer + smoke**

MCP `apply_migration`. Test : investir (via app) X🪙 sous une bannière, vérifier `crowns_conquered`, `faction_gold_log`, et que `list_factions` ajoute `floor(min(X,cap*tranche)/tranche)` au score. Vérifier le cap (investir > cap*tranche en un jour ne dépasse pas le cap).

- [ ] **Step 5 — Commit**

```bash
git add supabase/migrations/276_faction_gold_conquest.sql
git commit -m "feat(coupe): conquête à l'or → Coupe Compagnie (tranche + cap/jour, mig 276)"
```

---

## Self-Review

- **Couverture spec** : §1 bannière active → Tasks 2,3 ; §2 barème (photo/carnet) → Task 1, conquête-or → Task 5 ; §3 Couronnes investies (total + distinction) → Tasks 4,5 ; §4 affichages → Tasks 2,3,4. ✓
- **Distinction crowns_invested (Chef 1:1) vs crowns_conquered (score via tranche)** : respectée — Task 4 crée `crowns_conquered`, Task 5 l'alimente, le score Compagnie prend l'or via tranche, le Chef garde `crowns_invested` 1:1. ✓
- **Numéro migration** : 275 est mort (companies abandonné) → la conquête-or = **276**. ✓
- **Ordre** : Task 5 dépend de `crowns_conquered` (Task 4) → exécuter 1→5 dans l'ordre.

## Note d'exécution
Task 5 est la plus lourde (cap/jour stateful + archéologie `invest_crowns`). Si on veut livrer vite l'utilisable, **Tasks 1-4 d'abord** (toggle + barème + affichages), Task 5 ensuite comme lot séparé.
