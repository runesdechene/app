# Grades libres des Compagnies — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Remplacer l'échelle de grades figée (4 grades 1/1/3/reste) par une échelle **définie par chaque Compagnie** : 2 à 6 grades, chacun avec ses libellés (m/f/n) et une capacité « top N », dernier grade = « le reste », seuil de gouvernance réglé par le Chef.

**Architecture:** Évolution additive du système livré 25/06 (migs 305-308, prod). On ajoute `faction_grade_labels.capacity` + `factions.govern_grades`, on réécrit le calcul de grade (parcours de capacités au lieu du mapping 1/2/3-5/reste), `get_faction_detail` expose la structure, une RPC `set_faction_grades` remplace l'écriture, et l'éditeur de grades (vue plein-modale déjà en place) devient un éditeur de structure (ajout/retrait/capacités/seuil).

**Tech Stack:** Postgres/Supabase (RPC SECURITY DEFINER, migrations) · React 18 + TS strict · Zustand · `supabase.rpc` inline.

## Global Constraints

- **Spec** : `apps/explore-web/docs/superpowers/specs/2026-06-26-grades-libres-design.md`. Valeurs verbatim ci-dessous.
- **TS strict**, pas de `any`, pas de `console.log`, pas de code mort. `console.warn` toléré (pattern établi).
- **Migrations ADDITIVES**, numérotées. ⚠️ **VÉRIFIER LE PROCHAIN NUMÉRO LIBRE EN PROD** avant d'écrire (`SELECT max(version) FROM supabase_migrations.schema_migrations`) — collision déjà rencontrée (303/304). Prod ≥ 309. Prochain probable = **310**.
- **SQL = contrôleur** : écrit + appliqué via Supabase MCP (`apply_migration`) avec GO Uriel, idempotent. **Front = subagents** + build `pnpm --filter explore-web build`.
- **Min 2 grades, max 6.** Dernier grade = catch-all (`capacity = NULL`), renommable, non supprimable.
- **Défaut** (Compagnie sans lignes) = `Seigneur:1 · Co-seigneur:1 · Officier:3 · Membre:reste`. Libellés custom existants conservés, capacités backfill `1/1/3/NULL`.
- **Gouvernance** : pouvoirs (éditer identité/grades, inviter, exclure) = grade position ≤ `factions.govern_grades` (défaut 2, clamp `[1, N-1]`). **Changer `govern_grades` = Chef seul.** **Supprimer la Compagnie = Chef seul** (`_member_grade_rank = 1`).
- **Classement inchangé** : `_user_faction_coupe(saison) + crowns_invested + crowns_conquered/10`, tri `joined_at ASC`, principaux uniquement (allié = pas de grade).
- **UI sobre**, libellés cap 30 chars. Branche : `grades-compagnies` (continue le chantier grades non encore déployé).

---

## File Structure

**Migrations (contrôleur, numéros à confirmer ≥310)**
- `310_grades_libres_schema.sql` — `faction_grade_labels.capacity` + `factions.govern_grades` + backfill capacités.
- `311_grades_libres_compute.sql` — `_member_grade_rank` (parcours capacités) + `_grade_label` (inchangé, vérif).
- `312_grades_libres_faction_detail.sql` — `get_faction_detail` : grade par membre (inline depuis `principal_pos`) + bloc `grades` + `governGrades`.
- `313_grades_libres_write_and_powers.sql` — `set_faction_grades` (remplace `set_faction_grade_labels`) + gates `update_faction_identity`/`remove_faction_member` (≤ govern) + `delete_faction` (Chef).

**Front (subagents)**
- `apps/explore-web/src/stores/factionGroupStore.ts` — types `FactionGrade`, `FactionDetail.grades/governGrades`, action `setGrades` (remplace `setGradeLabels`).
- `apps/explore-web/src/components/factions/FactionHallModal.tsx` — vue `grades` : éditeur de structure (lignes add/remove, capacité, seuil Chef).
- `apps/explore-web/src/components/factions/FactionHallModal.css` — styles éditeur.
- `apps/explore-web/src/components/factions/FactionCreateForm.tsx` — `canDelete` passé par le Hall = Chef (déjà via prop), vérifier le câblage.

---

## Lot A — Backend (contrôleur)

### Task 1 : Schéma (capacity + govern_grades + backfill)

**Files:** Create `supabase/migrations/310_grades_libres_schema.sql`

- [ ] **Step 1 : Vérifier le prochain numéro libre**

Run (MCP execute_sql) : `SELECT max(version) FROM supabase_migrations.schema_migrations;`
Expected : une valeur ≥ 309. Le fichier prend `max+1` (probable 310). Adapter les noms si besoin.

- [ ] **Step 2 : Écrire la migration**

```sql
-- 310_grades_libres_schema.sql
-- WHY : grades libres — capacité par grade (top N) + seuil de gouvernance réglable.
-- ADDITIF. Backfill : les lignes existantes (rang 1-4) reçoivent capacités 1/1/3/NULL.
ALTER TABLE public.faction_grade_labels ADD COLUMN IF NOT EXISTS capacity int;
ALTER TABLE public.factions ADD COLUMN IF NOT EXISTS govern_grades int NOT NULL DEFAULT 2;

-- Backfill capacités sur les Compagnies ayant déjà des lignes custom (rang 4 = catch-all NULL).
UPDATE public.faction_grade_labels SET capacity = CASE rank WHEN 1 THEN 1 WHEN 2 THEN 1 WHEN 3 THEN 3 ELSE NULL END
WHERE capacity IS NULL;
```

- [ ] **Step 3 : Appliquer + vérifier**

Run (MCP) : appliquer, puis
```sql
SELECT column_name FROM information_schema.columns WHERE table_name='faction_grade_labels' AND column_name='capacity';
SELECT govern_grades FROM factions LIMIT 1;
```
Expected : colonne `capacity` présente ; `govern_grades` = 2.

- [ ] **Step 4 : Commit** `git commit -m "feat(grades): schema grades libres (capacity + govern_grades)"`

### Task 2 : `_member_grade_rank` (parcours de capacités)

**Files:** Create `supabase/migrations/311_grades_libres_compute.sql`

**Interfaces:** Produces `public._member_grade_rank(text,text) → int|NULL` (position de grade 1..N ; défaut 1/1/3-5/reste si aucune ligne custom).

- [ ] **Step 1 : Écrire la migration**

```sql
-- 311_grades_libres_compute.sql
-- WHY : grade = parcours des capacités du haut sur la position de classement. Défaut si aucune
-- ligne custom (1/1/3/reste = comportement 25/06). _grade_label inchangé (lit la ligne au rang).
CREATE OR REPLACE FUNCTION public._member_grade_rank(p_user_id text, p_faction_id text)
RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_from timestamptz; v_to timestamptz; v_pos int; v_acc int := 0; v_n int; v_rec record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM faction_members m JOIN users u ON u.id = m.user_id
    WHERE m.faction_id = p_faction_id AND m.user_id = p_user_id AND u.faction_id = p_faction_id
  ) THEN RETURN NULL; END IF;

  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;

  SELECT pos INTO v_pos FROM (
    SELECT m.user_id, ROW_NUMBER() OVER (ORDER BY (
        public._user_faction_coupe(m.user_id, p_faction_id, v_from, v_to)
        + m.crowns_invested + m.crowns_conquered / 10.0) DESC, m.joined_at ASC) AS pos
    FROM faction_members m JOIN users u ON u.id = m.user_id
    WHERE m.faction_id = p_faction_id AND u.faction_id = p_faction_id
  ) ranked WHERE ranked.user_id = p_user_id;
  IF v_pos IS NULL THEN RETURN NULL; END IF;

  SELECT count(*) INTO v_n FROM faction_grade_labels WHERE faction_id = p_faction_id;
  IF v_n = 0 THEN
    RETURN CASE WHEN v_pos = 1 THEN 1 WHEN v_pos = 2 THEN 2 WHEN v_pos <= 5 THEN 3 ELSE 4 END;
  END IF;

  FOR v_rec IN SELECT rank, capacity FROM faction_grade_labels WHERE faction_id = p_faction_id ORDER BY rank LOOP
    IF v_rec.capacity IS NULL THEN RETURN v_rec.rank; END IF;       -- catch-all
    v_acc := v_acc + v_rec.capacity;
    IF v_pos <= v_acc THEN RETURN v_rec.rank; END IF;
  END LOOP;
  RETURN v_n;  -- sécurité (pas de catch-all explicite)
END;$$;
GRANT EXECUTE ON FUNCTION public._member_grade_rank(text,text) TO authenticated, service_role;
```

- [ ] **Step 2 : Appliquer + vérifier sur faction-byzantine (14 membres, défaut)**

Run (MCP) :
```sql
SELECT m.user_id, public._member_grade_rank(m.user_id,'faction-byzantine') AS g
FROM faction_members m JOIN users u ON u.id=m.user_id
WHERE m.faction_id='faction-byzantine' AND u.faction_id='faction-byzantine' ORDER BY g;
```
Expected : 1×grade1, 1×grade2, 3×grade3, reste grade4 (= défaut, byzantine n'a pas de lignes custom).

- [ ] **Step 3 : Commit** `git commit -m "feat(grades): _member_grade_rank par parcours de capacités"`

### Task 3 : `get_faction_detail` (grade inline + structure)

**Files:** Create `supabase/migrations/312_grades_libres_faction_detail.sql`

**Interfaces:** Produces — par membre : `gradeRank` + `gradeLabel` ; + clés `grades` (`[{position, labelM, labelF, labelN, capacity}]`, catch-all en dernier) et `governGrades`.

- [ ] **Step 1 : Lire la baseline** (`supabase/migrations/307_faction_detail_grades.sql`, redéfinie 26/06 sans gate fondation). Copier le corps. Deltas :
  1. CTE `gbounds` (bornes cumulées des grades, défaut si aucune ligne).
  2. Le `grade_rank` par membre vient de `gbounds` joint sur `principal_pos` (PAS d'appel `_member_grade_rank` par membre — perf O(N²) avec `_user_faction_coupe`).
  3. Nouvelles clés `grades` + `governGrades` dans le RETURN.

- [ ] **Step 2 : Écrire la migration** — corps = 307 + ces deltas :

Remplacer le CTE `graded` par :
```sql
  gbounds AS (
    -- bornes cumulées : grade pour position P = MIN(rank) où cum_upper >= P. Catch-all = ∞.
    SELECT rank, SUM(COALESCE(capacity, 2147483647)) OVER (ORDER BY rank) AS cum_upper
    FROM faction_grade_labels WHERE faction_id = p_faction_id
    UNION ALL
    SELECT * FROM (VALUES (1,1),(2,2),(3,5),(4,2147483647)) AS d(rank,cum_upper)
    WHERE NOT EXISTS (SELECT 1 FROM faction_grade_labels WHERE faction_id = p_faction_id)
  ),
  graded AS (
    SELECT r.*,
      CASE WHEN principal_pos IS NULL THEN NULL
           ELSE (SELECT MIN(gb.rank) FROM gbounds gb WHERE gb.cum_upper >= r.principal_pos) END AS grade_rank
    FROM ranked r
  )
```
Dans le `json_build_object` par membre, `gradeRank`/`gradeLabel` inchangés (lisent `grade_rank` + `_grade_label(p_faction_id, grade_rank, title_gender)`).

Remplacer l'ancien bloc `gradeLabels` du RETURN par :
```sql
    'governGrades', (SELECT govern_grades FROM factions WHERE id = p_faction_id),
    'grades', COALESCE((
      SELECT json_agg(json_build_object(
        'position', g.rank, 'labelM', public._grade_label(p_faction_id, g.rank, 'm'),
        'labelF', public._grade_label(p_faction_id, g.rank, 'f'),
        'labelN', public._grade_label(p_faction_id, g.rank, 'n'), 'capacity', g.capacity
      ) ORDER BY g.rank) FROM faction_grade_labels g WHERE g.faction_id = p_faction_id),
      -- défaut si aucune ligne custom
      '[{"position":1,"labelM":"Seigneur","labelF":"Dame","labelN":"Seigneur·e","capacity":1},
        {"position":2,"labelM":"Co-seigneur","labelF":"Co-dame","labelN":"Co-seigneur·e","capacity":1},
        {"position":3,"labelM":"Officier","labelF":"Officière","labelN":"Officier·ère","capacity":3},
        {"position":4,"labelM":"Membre","labelF":"Membre","labelN":"Membre","capacity":null}]'::json
    ),
```

- [ ] **Step 3 : Appliquer + vérifier** sur faction-byzantine :
```sql
SELECT jsonb_pretty((public.get_faction_detail('faction-byzantine')::jsonb)->'grades');
SELECT (public.get_faction_detail('faction-byzantine')::jsonb)->>'governGrades';
SELECT json_agg((m->>'gradeLabel')) FROM json_array_elements((public.get_faction_detail('faction-byzantine')->'members')) m;
```
Expected : `grades` = la structure défaut (4 entrées) ; `governGrades` = 2 ; labels membres cohérents (Seigneur/Co-seigneur/Officier×3/Membre…, allié null).

- [ ] **Step 4 : Commit** `git commit -m "feat(grades): get_faction_detail expose structure de grades + governGrades"`

### Task 4 : `set_faction_grades` + gates de pouvoirs

**Files:** Create `supabase/migrations/313_grades_libres_write_and_powers.sql`

**Interfaces:** Produces `set_faction_grades(p_faction_id text, p_grades jsonb, p_govern_grades int) → json`. Modifie les gates de `update_faction_identity`, `remove_faction_member`, `delete_faction`.

- [ ] **Step 1 : Lire les baselines** des 3 RPC à re-gater :
  - `update_faction_identity` : dernière déf = `308_grade_powers_and_labels_rpc.sql` (gate `_member_grade_rank > 3`).
  - `remove_faction_member` : `270_factions_creatable_schema.sql` (gate `_faction_chef != caller`).
  - `delete_faction` : grep la dernière déf (`grep -rl "FUNCTION public.delete_faction" supabase/migrations | sort | tail -1`).

- [ ] **Step 2 : Écrire la migration**

```sql
-- 313_grades_libres_write_and_powers.sql
-- WHY : écriture de la structure de grades (remplace set_faction_grade_labels) + gates alignés
-- sur le seuil govern_grades. Suppression = Chef (grade 1). ADDITIF.

-- ── Écriture de la structure complète (libellés + capacités + seuil) ──
CREATE OR REPLACE FUNCTION public.set_faction_grades(p_faction_id text, p_grades jsonb, p_govern_grades int)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid text := auth.uid()::text; v_rank int; v_govern int; v_n int; v_idx int := 0; v_row jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN json_build_object('error','unauthorized'); END IF;
  v_rank := public._member_grade_rank(v_uid, p_faction_id);
  SELECT govern_grades INTO v_govern FROM factions WHERE id = p_faction_id;
  IF v_rank IS NULL OR v_rank > COALESCE(v_govern, 2) THEN RETURN json_build_object('error','not_governing'); END IF;

  v_n := jsonb_array_length(p_grades);
  IF v_n IS NULL OR v_n < 2 OR v_n > 6 THEN RETURN json_build_object('error','bad_grade_count'); END IF;

  DELETE FROM faction_grade_labels WHERE faction_id = p_faction_id;
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_grades) LOOP
    v_idx := v_idx + 1;
    INSERT INTO faction_grade_labels(faction_id, rank, label_m, label_f, label_n, capacity) VALUES (
      p_faction_id, v_idx,
      LEFT(btrim(COALESCE(v_row->>'label_m','')), 30),
      LEFT(btrim(COALESCE(v_row->>'label_f', v_row->>'label_m','')), 30),
      NULLIF(LEFT(btrim(COALESCE(v_row->>'label_n','')), 30), ''),
      CASE WHEN v_idx = v_n THEN NULL ELSE GREATEST(1, COALESCE((v_row->>'capacity')::int, 1)) END
    );
  END LOOP;

  -- seuil de gouvernance : seulement le Chef (grade 1) peut le changer ; clamp [1, n-1]
  IF v_rank = 1 AND p_govern_grades IS NOT NULL THEN
    UPDATE factions SET govern_grades = LEAST(GREATEST(p_govern_grades, 1), v_n - 1) WHERE id = p_faction_id;
  END IF;
  RETURN json_build_object('success', true);
END;$$;
GRANT EXECUTE ON FUNCTION public.set_faction_grades(text,jsonb,int) TO authenticated, service_role;

-- ── update_faction_identity : gate ≤ govern_grades (corps = baseline 308, seul le check change) ──
-- Copier le corps verbatim de 308 ; remplacer la ligne not_governing par :
--   IF COALESCE(public._member_grade_rank(p_user_id, p_faction_id), 99)
--      > COALESCE((SELECT govern_grades FROM factions WHERE id=p_faction_id),2)
--   THEN RETURN json_build_object('error','not_governing'); END IF;
-- (reste du corps inchangé.)

-- ── remove_faction_member : gate ≤ govern_grades (corps = baseline 270) ──
-- Remplacer le check chef par le même gate ≤ govern_grades.

-- ── delete_faction : gate Chef (grade 1) au lieu de fondateur (corps = baseline lue Step 1) ──
-- Remplacer le check created_by/founder par :
--   IF COALESCE(public._member_grade_rank(<param user>, p_faction_id), 99) <> 1
--   THEN RETURN json_build_object('error','not_chef'); END IF;
-- (garder les autres garde-fous existants, ex. officielle non supprimable si présent.)
```
*(Les 3 redéfinitions : copier la baseline ENTIÈRE de chaque RPC, n'échanger QUE le contrôle d'accès. Ne pas inventer le corps.)*

- [ ] **Step 3 : Appliquer + vérifier**

Run (MCP) :
```sql
-- structure custom sur byzantine (en tant que Chef — via service ; ici on teste la validation/forme)
SELECT public.set_faction_grades('faction-byzantine',
  '[{"label_m":"Roi","label_f":"Reine","capacity":1},{"label_m":"Duc","label_f":"Duchesse","capacity":2},{"label_m":"Sujet","label_f":"Sujette"}]'::jsonb, 2);
SELECT jsonb_pretty((public.get_faction_detail('faction-byzantine')::jsonb)->'grades');
-- attendu : 3 grades, capacités 1/2/NULL, govern clamp à 2 (n-1=2). Puis remettre le défaut :
DELETE FROM faction_grade_labels WHERE faction_id='faction-byzantine';
UPDATE factions SET govern_grades=2 WHERE id='faction-byzantine';
```
Expected : structure custom écrite (1/2/catch-all), `governGrades`=2 ; cleanup remet byzantine au défaut.

- [ ] **Step 4 : Commit** `git commit -m "feat(grades): set_faction_grades + gates govern + delete=Chef"`

---

## Lot B — Front (subagents)

### Task 5 : Types + store

**Files:** Modify `apps/explore-web/src/stores/factionGroupStore.ts`

- [ ] **Step 1** : ajouter le type et étendre `FactionDetail` :
```ts
export interface FactionGrade {
  position: number
  labelM: string
  labelF: string
  labelN: string | null
  capacity: number | null   // null = « le reste » (catch-all, toujours en dernier)
}
```
Dans `FactionDetail` : remplacer `gradeLabels?` par :
```ts
  grades?: FactionGrade[]
  governGrades?: number
```

- [ ] **Step 2** : remplacer l'action `setGradeLabels` par `setGrades` :
```ts
setGrades: (
  factionId: string,
  grades: { label_m: string; label_f: string; label_n?: string; capacity?: number | null }[],
  governGrades: number,
) => Promise<ActionResult>
```
Impl :
```ts
setGrades: async (factionId, grades, governGrades) => {
  const { data, error } = await supabase.rpc('set_faction_grades', {
    p_faction_id: factionId, p_grades: grades, p_govern_grades: governGrades,
  })
  if (error) return { error: error.message }
  return data as ActionResult
},
```
Mettre à jour la déclaration dans l'interface d'état (mirror de `removeMember`).

- [ ] **Step 3** : build `pnpm --filter explore-web build`. **Step 4** : commit.

### Task 6 : Éditeur de structure (vue grades du Hall)

**Files:** Modify `apps/explore-web/src/components/factions/FactionHallModal.tsx` + `FactionHallModal.css`

La vue `view === 'grades'` (déjà plein-modale) devient un éditeur de **structure**. Remplacer l'état `gradeRows` (libellés seuls) par des lignes `{ labelM, labelF, labelN, capacity }` initialisées depuis `detail.grades` (fallback défaut). Comportement :
- Liste ordonnée. Chaque ligne : 3 champs libellés + un champ **nombre** « couvre N membres » — SAUF la dernière (catch-all) qui affiche « le reste » sans champ nombre ni ✕.
- Bouton **`+ Ajouter un grade`** (si < 6) insère une ligne AVANT le catch-all (capacity défaut 1).
- Bouton **`✕`** par ligne non-catch-all (si total > 2) la retire.
- Si le viewer est **Chef** (`detail.members.find(m=>m.userId===myUserId)?.gradeRank === 1`) : un `<select>` **« Les grades 1 à N gouvernent »** (`governGrades`, options 1..length-1), prérempli `detail.governGrades`. Masqué sinon (on renvoie la valeur courante inchangée).
- « Enregistrer les grades » → `setGrades(detail.id, rows.map(...sans le champ position...), governValue)` → succès : `setView('roster')` + `reload()`. Gérer `bad_grade_count`/`not_governing`.

État local recommandé :
```ts
const [rows, setRows] = useState<{ labelM: string; labelF: string; labelN: string; capacity: number | null }[]>([])
const [govern, setGovern] = useState(2)
// init depuis detail.grades (useEffect sur detail?.id), fallback défaut 1/1/3/reste.
```
Payload d'envoi : `rows.map(r => ({ label_m: r.labelM, label_f: r.labelF, label_n: r.labelN || undefined, capacity: r.capacity }))` (la dernière ligne aura `capacity` ignorée serveur).

CSS : réutiliser `.faction-hall-grade-*`. Ajouter une rangée capacité + boutons add/remove sobres.

- [ ] Build + vérif manuelle (Hall → ✦ Grades : ajouter/retirer un grade, régler une capacité, le seuil en tant que Chef, enregistrer, rouvrir → structure persistée). Commit.

### Task 7 : Bouton supprimer = Chef

**Files:** Modify `apps/explore-web/src/components/factions/FactionHallModal.tsx`

- [ ] La prop `canDelete` passée à `<FactionCreateForm>` (vue identité) doit valoir **Chef** (grade 1) ET Compagnie créée : `canDelete={detail.createdBy === userId ? false : false}` — non : `canDelete={myGradeRank === 1 && !detail.isOfficial}`. *(Le serveur gate déjà `delete_faction` sur le Chef ; le front aligne l'affichage du bouton.)* Build + commit.

---

## Self-Review

**Spec coverage :** structure variable 2-6 (Task 4 validation + Task 6 UI) ✅ ; capacités top-N (Task 2 parcours + Task 4 écriture) ✅ ; catch-all dernier non supprimable (Task 4 force NULL + Task 6 UI) ✅ ; défaut 1/1/3/reste (Task 2 + Task 3 fallback) ✅ ; libellés conservés + backfill (Task 1) ✅ ; gouvernance seuil + Chef (Task 4 gates + Task 6 sélecteur) ✅ ; delete=Chef (Task 4) ✅ ; get_faction_detail expose structure (Task 3) ✅ ; max 6 (Task 4 + Task 6) ✅.

**Placeholders :** les 3 redéfinitions du Task 4 (update_identity/remove_member/delete) sont décrites comme « copier baseline + échanger le check » — **intentionnel** (règle DB : ne jamais inventer un corps de RPC). Tout le reste a le code complet.

**Type consistency :** `FactionGrade` (Task 5) = `{position,labelM,labelF,labelN,capacity}` cohérent avec le JSON `grades` (Task 3) ; `setGrades(factionId, grades, governGrades)` (Task 5) ↔ `set_faction_grades(p_faction_id,p_grades,p_govern_grades)` (Task 4) ; `gradeRank` per membre (Task 3) ↔ `_member_grade_rank` (Task 2).

**Point perf noté :** Task 3 calcule le grade inline (via `gbounds` + `principal_pos`), PAS par appel `_member_grade_rank` par membre — évite O(N²) sur `_user_faction_coupe`.
