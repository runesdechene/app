# Grades des Compagnies — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à chaque membre d'une Compagnie un grade visible (Seigneur / Co-seigneur / Officier / Membre) calculé par sa contribution à la Coupe de la saison, avec libellés genrés et personnalisables par Compagnie, et accorder les pouvoirs de gouvernance au top 5.

**Architecture:** Le grade = **position du membre dans le classement déjà calculé par `get_faction_detail`** (mérite Coupe saison + couronnes de fondation pleines + conquises ÷10). 1er → Seigneur, 2e → Co-seigneur, 3-5 → Officier, reste → Membre, allié → aucun grade. Tout se branche sur l'existant (`_user_faction_coupe`, `_faction_chef`, `coupe_seasons`) : **Seigneur ≡ Chef actuel**, zéro nouvelle source de vérité. Les libellés sont résolus par un helper `_grade_label(faction_id, rank, gender)` avec fallback sur un thème *Noblesse* codé en dur (aucun seeding ni backfill) ; seules les surcharges custom sont stockées dans `faction_grade_labels`.

**Tech Stack:** Postgres / Supabase (RPC `SECURITY DEFINER`, migrations numérotées) · React 18 + Vite + TS strict · Zustand · `supabase.rpc` inline.

## Global Constraints

- **TypeScript strict** — pas de `any`, pas de `console.log` en prod, pas de code mort.
- **Migrations SQL** numérotées dans `supabase/migrations/`, prochain numéro = **303** et suivants. **ADDITIF uniquement** (redéfinitions backward-compatibles ; on ne casse pas la prod live V0.10).
- **Workflow DB obligatoire** : avant toute redéfinition d'une RPC existante, **lire la définition courante** (grep la dernière migration qui la définit) et **copier le corps verbatim** avant d'insérer le delta. Ne JAMAIS inventer un nom de colonne ni improviser un corps de RPC.
- **Appliquer les migrations** via `pnpm dlx supabase db push` (depuis la racine du monorepo).
- **Terminologie** : user-facing = « Compagnie » / « grade » ; code/DB = `faction*`. Icône Couronne = 🪙 (monnaie), jamais 👑.
- **UI sobre** : un mot + une couleur de Compagnie, jamais de blason RPG. Le grade s'affiche dans le **Hall** et le **profil**, **JAMAIS sur le marqueur de carte** (pilule sépia = nom du veilleur, FIGÉE).
- **Couleur de Compagnie** lisible via `readableInk` (texte/bordure) — `apps/explore-web/src/lib/textFormat.ts`.
- **Build de vérif** : `pnpm --filter explore-web build` (= `tsc && vite build`) doit passer avant tout commit front.

---

## Décisions produit figées (session 25/06 avec Uriel)

| Sujet | Décision |
|---|---|
| Échelle | **4 grades** : Seigneur (rang 1) · Co-seigneur (rang 2) · Officiers (rangs 3-5) · Membres (reste) |
| Métrique de classement | **TRANCHÉ (Uriel 25/06)** : on suit l'ordre déjà calculé par `get_faction_detail` (Coupe saison + fondation pleine + conquis ÷10). **Seigneur = le Chef actuel** : le titre « Chef de Compagnie » est purement et simplement **remplacé** par « Seigneur ». |
| Fondateur historique | Badge **honorifique distinct du grade**, affiché pour `isFounder` (déjà dans le payload), libellé « Fondateur historique ». Honore le créateur même s'il se fait dépasser (méritocratie). « À la rigueur » = nice-to-have, livrable au Lot 3. |
| Investissement de fondation dans le classement | **TRANCHÉ (Uriel 25/06, révisé en cours de test)** : `crowns_invested` compte **chaque saison** (plein, = baseline 302). Le gate « saison de fondation » a été retiré : il s'ancrait sur `factions.created_at`, ce qui excluait les Compagnies créées avant le lancement (ex. Lys de Fer, fév. → le fondateur perdait son avance dès la 1ʳᵉ saison Compagnies). L'avance du fondateur **s'érode au mérite** sans être verrouillée. Décroissance multi-saison = à revisiter plus tard si l'avance paraît trop forte. |
| Pouvoirs | **Top 5 (rang ≤ 3)** : éditer l'identité + les libellés. **Exclure** reste **Seigneur seul (rang 1)** (garde-fou anti-abus — à confirmer). |
| Libellés | **Personnalisables** par Compagnie. Défaut = thème *Noblesse* (fallback codé en dur). |
| Genre | `users.title_gender` (`'m'`/`'f'`/`'n'`, **défaut `'m'`**). Réglé **au profil** (pas à l'onboarding). Chacun choisit la version affichée. |
| Affichage | Hall + profil. Pas le marqueur. |
| Héraut de montée (célébration chat) | **Lot 6, différé** — risque de spam avec un classement live ; design à valider avant implémentation. |

---

## File Structure

**Nouveaux fichiers** *(numéros réels = 305-308 : 303/304 étaient déjà pris par `303_defi_collectif` + `304_gold_note`. Les en-têtes de tâches ci-dessous disent 303-306 par historique — lire +2.)*
- `supabase/migrations/305_title_gender.sql` — colonne `users.title_gender` + RPC `set_title_gender`.
- `supabase/migrations/306_faction_grade_labels.sql` — table `faction_grade_labels` + helpers `_grade_label`, `_member_grade_rank` + `_faction_chef` (règle fondation = saison de fondation).
- `supabase/migrations/307_faction_detail_grades.sql` — redéfinit `get_faction_detail` pour exposer `gradeRank` + `gradeLabel`.
- `supabase/migrations/308_grade_powers_and_labels_rpc.sql` — gate `update_faction_identity` (rang≤3) + RPC `set_faction_grade_labels` (`remove_faction_member` laissé intact = déjà Chef-only).

**Fichiers modifiés (front)**
- `apps/explore-web/src/stores/playerStore.ts` — champ `titleGender` + setter.
- `apps/explore-web/src/components/auth/ProfileMenu.tsx` — sélecteur de genre du titre.
- `apps/explore-web/src/stores/factionGroupStore.ts` — `FactionMember.gradeRank/gradeLabel` + action `setGradeLabels`.
- `apps/explore-web/src/components/factions/FactionHallModal.tsx` — pilule de grade sous le nom + bloc d'édition des libellés (gouvernance).
- `apps/explore-web/src/components/factions/FactionHallModal.css` (ou le CSS associé) — style `.faction-hall-rank-grade`.
- `apps/explore-web/src/components/map/modals/PlayerProfileModal.tsx` — grade à côté du bloc « Membre de la Compagnie ».

---

## Lot 1 — Gendrage du titre (`title_gender`)

### Task 1 : Colonne `users.title_gender` + RPC `set_title_gender`

**Files:**
- Create: `supabase/migrations/303_title_gender.sql`

**Interfaces:**
- Produces: colonne `public.users.title_gender text` (`'m'`/`'f'`/`'n'`, défaut `'m'`) ; RPC `public.set_title_gender(p_gender text) returns json`.

- [ ] **Step 1 : Écrire la migration**

```sql
-- 303_title_gender.sql
-- WHY : accorder les libellés de grade (Seigneur/Dame…) au genre choisi par le joueur.
-- Préférence d'affichage personnelle, réglée au profil, défaut masculin (décision Uriel 25/06).
-- Réutilisable ensuite partout (classes, hauts-faits, toasts). ADDITIF.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS title_gender text NOT NULL DEFAULT 'm'
  CHECK (title_gender IN ('m','f','n'));

CREATE OR REPLACE FUNCTION public.set_title_gender(p_gender text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF p_gender NOT IN ('m','f','n') THEN RETURN json_build_object('error','bad_gender'); END IF;
  UPDATE public.users SET title_gender = p_gender WHERE id = auth.uid()::text;
  RETURN json_build_object('success', true, 'titleGender', p_gender);
END;$$;

GRANT EXECUTE ON FUNCTION public.set_title_gender(text) TO authenticated, service_role;
```

- [ ] **Step 2 : Appliquer la migration**

Run: `pnpm dlx supabase db push`
Expected: migration 303 appliquée, aucune erreur.

- [ ] **Step 3 : Vérifier la colonne et le défaut**

Run (via MCP `execute_sql` ou psql) :
```sql
SELECT column_name, column_default, is_nullable
FROM information_schema.columns
WHERE table_name='users' AND column_name='title_gender';
```
Expected: une ligne, `column_default` = `'m'::text`, `is_nullable` = `NO`.

- [ ] **Step 4 : Vérifier la RPC (valeur valide + invalide)**

Run :
```sql
SELECT public.set_title_gender('f');   -- attendu : {"success":true,"titleGender":"f"} si appelé authentifié
SELECT public.set_title_gender('x');   -- attendu : {"error":"bad_gender"}
```
Expected: succès sur `'f'`, erreur `bad_gender` sur `'x'`.

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/303_title_gender.sql
git commit -m "feat(grades): add users.title_gender + set_title_gender RPC"
```

### Task 2 : Sélecteur de genre du titre au profil

**Files:**
- Modify: `apps/explore-web/src/stores/playerStore.ts`
- Modify: `apps/explore-web/src/components/auth/ProfileMenu.tsx`

**Interfaces:**
- Consumes: RPC `set_title_gender(p_gender)` (Task 1).
- Produces: `usePlayerStore().titleGender: 'm'|'f'|'n'` + `setTitleGender(g)`.

- [ ] **Step 1 : Ajouter le champ au playerStore**

Dans `playerStore.ts`, ajouter au type d'état `titleGender: 'm' | 'f' | 'n'` (défaut `'m'`) et l'action :
```ts
setTitleGender: (g: 'm' | 'f' | 'n') => set({ titleGender: g }),
```
Si le store hydrate le profil depuis une RPC de chargement (`get_my_profile`/équivalent), mapper le champ `title_gender` → `titleGender` au chargement (sinon défaut `'m'`). *(Lire le store : repérer où `brouillerPistes` est hydraté et suivre le même point d'entrée.)*

- [ ] **Step 2 : Ajouter le sélecteur dans ProfileMenu (pattern `brouillerPistes`)**

Dans `ProfileMenu.tsx`, juste après le groupe `brouillerPistes` (≈ lignes 119-137), ajouter un groupe à 3 boutons calqué sur l'existant :
```tsx
{/* — Comment veux-tu être titré·e ? (accorde Seigneur/Dame…) — */}
<div className="profile-dropdown-calendar">
  <span className="profile-dropdown-calendar-label">Mon titre</span>
  <div className="profile-dropdown-calendar-toggle">
    {([
      ['m', 'Masculin'],
      ['f', 'Féminin'],
      ['n', 'Neutre'],
    ] as const).map(([val, lbl]) => (
      <button
        key={val}
        type="button"
        className={titleGender === val ? 'is-active' : ''}
        disabled={savingTitleGender}
        onClick={() => setTitleGender(val)}
      >
        {titleGender === val ? '✓ ' : ''}{lbl}
      </button>
    ))}
  </div>
</div>
```
Et la fonction de sauvegarde (calquée sur `setBrouiller`, ≈ lignes 25-42) :
```tsx
const [savingTitleGender, setSavingTitleGender] = useState(false)
const titleGender = usePlayerStore((s) => s.titleGender)

async function setTitleGender(value: 'm' | 'f' | 'n') {
  if (savingTitleGender || value === titleGender) return
  setSavingTitleGender(true)
  const prev = titleGender
  usePlayerStore.getState().setTitleGender(value) // optimiste
  const { error } = await supabase.rpc('set_title_gender', { p_gender: value })
  if (error) usePlayerStore.getState().setTitleGender(prev) // revert
  setSavingTitleGender(false)
}
```

- [ ] **Step 3 : Build**

Run: `pnpm --filter explore-web build`
Expected: build OK (tsc + vite), zéro erreur TS.

- [ ] **Step 4 : Vérif manuelle (pnpm dev)**

Run: `pnpm --filter explore-web dev` → ouvrir le menu profil → cliquer Féminin → recharger la page.
Expected: le choix « Féminin » persiste après reload (lu depuis la DB).

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/stores/playerStore.ts apps/explore-web/src/components/auth/ProfileMenu.tsx
git commit -m "feat(grades): title gender selector in profile menu"
```

---

## Lot 2 — Calcul des grades (backend)

### Task 3 : Table libellés + helpers `_grade_label` et `_member_grade_rank`

**Files:**
- Create: `supabase/migrations/304_faction_grade_labels.sql`

**Interfaces:**
- Consumes: `coupe_seasons`, `faction_members`, `users`, `factions`, `public._user_faction_coupe(text,text,timestamptz,timestamptz)` (existants), corps de `_faction_chef` (mig 302).
- Produces:
  - table `public.faction_grade_labels(faction_id text, rank int, label_m text, label_f text, label_n text, PRIMARY KEY(faction_id, rank))` — **surcharges uniquement**.
  - `public._grade_label(p_faction_id text, p_rank int, p_gender text) returns text` — libellé résolu (custom sinon fallback Noblesse) ; **NULL si `p_rank` NULL**.
  - `public._member_grade_rank(p_user_id text, p_faction_id text) returns int` — `1..4`, **NULL si allié ou non-membre**.
  - `public._faction_chef(p_faction_id text) returns text` **redéfini** : investissement de fondation pesé seulement la saison de fondation (cohérent grades ↔ Chef).
- **Règle de classement partagée** (Task 3, 4 et `_faction_chef`) : `_user_faction_coupe(saison) + (fondation_cette_saison ? crowns_invested : 0) + crowns_conquered/10.0`, tri secondaire `joined_at ASC`. `fondation_cette_saison = (factions.created_at >= v_from AND factions.created_at < v_to)`.

- [ ] **Step 1 : Écrire la migration**

```sql
-- 304_faction_grade_labels.sql
-- WHY : grades des Compagnies. Le grade = position du membre dans le classement de la Compagnie.
-- 1er=Seigneur, 2e=Co-seigneur, 3-5=Officier, reste=Membre, allié=aucun. Classement = mérite Coupe
-- saison + (fondation SI saison de fondation) + conquis ÷10 → la fondation ne reseat plus le fondateur
-- à chaque saison (décision Uriel 25/06). _faction_chef redéfini avec la MÊME règle (Seigneur = Chef).
-- Libellés personnalisables (surcharges stockées ici), sinon fallback thème Noblesse codé en dur
-- (zéro seeding/backfill). ADDITIF (redéfinitions backward-compatibles, mêmes signatures).

CREATE TABLE IF NOT EXISTS public.faction_grade_labels (
  faction_id text NOT NULL REFERENCES public.factions(id) ON DELETE CASCADE,
  rank       int  NOT NULL CHECK (rank BETWEEN 1 AND 4),
  label_m    text NOT NULL,
  label_f    text NOT NULL,
  label_n    text,
  PRIMARY KEY (faction_id, rank)
);
ALTER TABLE public.faction_grade_labels ENABLE ROW LEVEL SECURITY;
-- Lecture publique (les libellés sont du contenu affiché à tous) ; écriture via RPC SECURITY DEFINER only.
DROP POLICY IF EXISTS faction_grade_labels_read ON public.faction_grade_labels;
CREATE POLICY faction_grade_labels_read ON public.faction_grade_labels FOR SELECT USING (true);

-- ── Libellé résolu : surcharge custom sinon fallback Noblesse. NULL si rang NULL (allié). ──
CREATE OR REPLACE FUNCTION public._grade_label(p_faction_id text, p_rank int, p_gender text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_rank IS NULL THEN NULL ELSE COALESCE(
    (SELECT CASE COALESCE(p_gender,'m')
              WHEN 'f' THEN label_f
              WHEN 'n' THEN COALESCE(label_n, label_m)
              ELSE label_m END
       FROM public.faction_grade_labels
       WHERE faction_id = p_faction_id AND rank = p_rank),
    CASE p_rank
      WHEN 1 THEN CASE COALESCE(p_gender,'m') WHEN 'f' THEN 'Dame'    WHEN 'n' THEN 'Seigneur·e'    ELSE 'Seigneur'    END
      WHEN 2 THEN CASE COALESCE(p_gender,'m') WHEN 'f' THEN 'Co-dame' WHEN 'n' THEN 'Co-seigneur·e' ELSE 'Co-seigneur' END
      WHEN 3 THEN CASE COALESCE(p_gender,'m') WHEN 'f' THEN 'Officière' WHEN 'n' THEN 'Officier·ère' ELSE 'Officier' END
      ELSE 'Membre'
    END
  ) END;
$$;

-- ── Rang de grade d'un membre (1..4), NULL si allié/non-membre. ──
-- Ordre = Coupe saison + (fondation SI saison de fondation) + conquis ÷10. Fondation comptée
-- seulement la saison où la Compagnie a été créée → pas de privilège permanent (décision Uriel 25/06).
CREATE OR REPLACE FUNCTION public._member_grade_rank(p_user_id text, p_faction_id text)
RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_from timestamptz; v_to timestamptz; v_pos int; v_founded boolean;
BEGIN
  -- allié (2e adhésion) ou non-membre principal → aucun grade
  IF NOT EXISTS (
    SELECT 1 FROM faction_members m JOIN users u ON u.id = m.user_id
    WHERE m.faction_id = p_faction_id AND m.user_id = p_user_id
      AND u.faction_id = p_faction_id
  ) THEN RETURN NULL; END IF;

  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;
  SELECT (created_at >= v_from AND created_at < v_to) INTO v_founded
  FROM factions WHERE id = p_faction_id;

  SELECT pos INTO v_pos FROM (
    SELECT m.user_id,
      ROW_NUMBER() OVER (ORDER BY (
        public._user_faction_coupe(m.user_id, p_faction_id, v_from, v_to)
        + CASE WHEN v_founded THEN m.crowns_invested ELSE 0 END
        + m.crowns_conquered / 10.0
      ) DESC, m.joined_at ASC) AS pos
    FROM faction_members m JOIN users u ON u.id = m.user_id
    WHERE m.faction_id = p_faction_id AND u.faction_id = p_faction_id   -- principaux seulement
  ) ranked
  WHERE ranked.user_id = p_user_id;

  RETURN CASE WHEN v_pos = 1 THEN 1 WHEN v_pos = 2 THEN 2 WHEN v_pos <= 5 THEN 3 ELSE 4 END;
END;$$;

-- ── _faction_chef redéfini : MÊME règle (fondation pesée seulement la saison de fondation). ──
-- Corps = mig 302 + la garde v_founded. Seigneur = Chef → ils DOIVENT partager l'ordre.
CREATE OR REPLACE FUNCTION public._faction_chef(p_faction_id text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_from timestamptz; v_to timestamptz; v_chef text; v_founded boolean;
BEGIN
  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;
  SELECT (created_at >= v_from AND created_at < v_to) INTO v_founded
  FROM factions WHERE id = p_faction_id;
  SELECT m.user_id INTO v_chef
  FROM faction_members m JOIN users u ON u.id = m.user_id
  WHERE m.faction_id = p_faction_id
    AND u.faction_id = p_faction_id          -- principale uniquement : l'allié ne règne pas
  ORDER BY (
    public._user_faction_coupe(m.user_id, p_faction_id, v_from, v_to)
    + CASE WHEN v_founded THEN m.crowns_invested ELSE 0 END
    + m.crowns_conquered / 10.0
  ) DESC, m.joined_at ASC
  LIMIT 1;
  RETURN v_chef;
END;$$;

GRANT EXECUTE ON FUNCTION public._grade_label(text,int,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._member_grade_rank(text,text) TO authenticated, service_role;
```

- [ ] **Step 2 : Appliquer**

Run: `pnpm dlx supabase db push`
Expected: migration 304 appliquée.

- [ ] **Step 3 : Vérifier le fallback de libellé (sans surcharge)**

Run :
```sql
SELECT public._grade_label('f-does-not-exist', 1, 'f') AS r1,  -- 'Dame'
       public._grade_label('f-does-not-exist', 3, 'm') AS r3,  -- 'Officier'
       public._grade_label('f-does-not-exist', 4, 'n') AS r4,  -- 'Membre'
       public._grade_label('f-does-not-exist', NULL, 'm') AS rnull; -- NULL
```
Expected: `Dame`, `Officier`, `Membre`, `NULL`.

- [ ] **Step 4 : Vérifier le rang sur une vraie Compagnie**

Run (remplacer `<FID>` par un id de Compagnie réel avec ≥ 2 membres principaux) :
```sql
SELECT m.user_id, public._member_grade_rank(m.user_id, '<FID>') AS rank
FROM faction_members m JOIN users u ON u.id = m.user_id
WHERE m.faction_id = '<FID>' AND u.faction_id = '<FID>'
ORDER BY rank;
```
Expected: exactement un `rank=1` (= le Chef), un `rank=2`, jusqu'à 3 en `rank=3`, le reste `rank=4`. Un allié de cette Compagnie (s'il existe) renvoie `NULL`. Le `rank=1` doit correspondre à `public._faction_chef('<FID>')`.

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/304_faction_grade_labels.sql
git commit -m "feat(grades): faction_grade_labels table + _grade_label/_member_grade_rank helpers"
```

### Task 4 : Exposer `gradeRank` + `gradeLabel` dans `get_faction_detail`

**Files:**
- Create: `supabase/migrations/305_faction_detail_grades.sql`
- Modify: `apps/explore-web/src/stores/factionGroupStore.ts:42-58` (type `FactionMember`)

**Interfaces:**
- Consumes: `_grade_label` (Task 3), `users.title_gender` (Task 1), corps de `get_faction_detail` mig 302.
- Produces: chaque membre de `get_faction_detail.members[]` porte `gradeRank: int|null` + `gradeLabel: string|null`.

- [ ] **Step 1 : Lire la baseline**

Run: ouvrir `supabase/migrations/302_founding_investment_full_weight.sql` (corps complet de `get_faction_detail` ci-dessus dans ce repo). Copier le corps verbatim comme base de la 305.

- [ ] **Step 2 : Écrire la migration (delta = title_gender dans `mem`, `principal_pos` dans une CTE, 2 clés JSON)**

```sql
-- 305_faction_detail_grades.sql
-- WHY : exposer le grade de chaque membre (rang 1..4 + libellé résolu/genré) dans get_faction_detail,
-- pour l'afficher dans le Hall/profil et gater les pouvoirs côté front. Le rang suit l'ordre déjà
-- utilisé pour le tri des membres (mig 302). Corps = mig 302 + (u.title_gender) + CTE de rang + 2 clés.
-- ADDITIF (redéfinition backward-compatible : on n'ôte aucune clé existante).

CREATE OR REPLACE FUNCTION public.get_faction_detail(p_faction_id text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_from timestamptz; v_to timestamptz; v_members json; v_total int; v_f public.factions%ROWTYPE;
  v_visit int := _barem('coupe.visit_gps', 3);
  v_add   int := _barem('coupe.add_place', 7);
  v_plant int := _barem('coupe.plant_flag', 2);
  v_photo int := _barem('coupe.photo', 1);
  v_e_ve  int := _barem('coupe.enigma_very_easy', 1);
  v_e_e   int := _barem('coupe.enigma_easy', 1);
  v_e_m   int := _barem('coupe.enigma_medium', 1);
  v_e_h   int := _barem('coupe.enigma_hard', 1);
  v_mc int; v_founded boolean;
BEGIN
  SELECT * INTO v_f FROM factions WHERE id = p_faction_id;
  IF v_f.id IS NULL THEN RETURN json_build_object('error','not_found'); END IF;
  SELECT started_at, COALESCE(ended_at, now()) INTO v_from, v_to
  FROM coupe_seasons ORDER BY (ended_at IS NULL) DESC, started_at DESC LIMIT 1;
  -- fondation comptée seulement la saison où la Compagnie a été créée (pas de privilège permanent)
  v_founded := (v_f.created_at >= v_from AND v_f.created_at < v_to);

  WITH iv AS (
    SELECT user_id, started_at, COALESCE(ended_at, now()) AS ended_at
    FROM faction_banner_history WHERE faction_id = p_faction_id
  ),
  mem AS (
    SELECT
      m.user_id,
      COALESCE(u.display_name, u.first_name, 'Veilleur') AS name,
      u.avatar_url, m.joined_at, m.is_founder, m.crowns_invested, m.crowns_conquered,
      COALESCE(u.title_gender, 'm') AS title_gender,
      (u.faction_id IS DISTINCT FROM p_faction_id) AS is_ally,
      (SELECT count(DISTINCT pe.place_id) FROM place_explorers pe
        WHERE pe.user_id = m.user_id AND pe.visited_at >= v_from AND pe.visited_at < v_to
          AND EXISTS (SELECT 1 FROM iv WHERE iv.user_id = m.user_id AND pe.visited_at >= iv.started_at AND pe.visited_at < iv.ended_at))::int AS n_vis,
      (SELECT count(*) FROM places p
        WHERE p.author_id = m.user_id AND p.created_at >= v_from AND p.created_at < v_to
          AND EXISTS (SELECT 1 FROM iv WHERE iv.user_id = m.user_id AND p.created_at >= iv.started_at AND p.created_at < iv.ended_at))::int AS n_add,
      (SELECT count(*) FROM veille_history vh
        WHERE vh.user_id = m.user_id AND vh.planted_at >= v_from AND vh.planted_at < v_to
          AND EXISTS (SELECT 1 FROM iv WHERE iv.user_id = m.user_id AND vh.planted_at >= iv.started_at AND vh.planted_at < iv.ended_at))::int AS n_plant,
      (SELECT count(DISTINCT pc.place_id) FROM place_contributions pc
        WHERE pc.user_id = m.user_id AND pc.type = 'photo' AND pc.created_at >= v_from AND pc.created_at < v_to
          AND EXISTS (SELECT 1 FROM iv WHERE iv.user_id = m.user_id AND pc.created_at >= iv.started_at AND pc.created_at < iv.ended_at))::int AS n_photo,
      (SELECT COALESCE(
          count(*) FILTER (WHERE e.difficulty = 'very_easy') * v_e_ve
        + count(*) FILTER (WHERE e.difficulty = 'easy')      * v_e_e
        + count(*) FILTER (WHERE e.difficulty = 'medium')    * v_e_m
        + count(*) FILTER (WHERE e.difficulty = 'hard')      * v_e_h, 0)
        FROM enigma_responses er JOIN enigmas e ON e.id = er.enigma_id
        WHERE er.user_id = m.user_id AND er.correct = TRUE
          AND er.responded_at >= v_from AND er.responded_at < v_to
          AND EXISTS (SELECT 1 FROM iv WHERE iv.user_id = m.user_id AND er.responded_at >= iv.started_at AND er.responded_at < iv.ended_at))::int AS enig_pts
    FROM faction_members m JOIN users u ON u.id = m.user_id
    WHERE m.faction_id = p_faction_id
  ),
  mem_pts AS (
    SELECT *, n_vis * v_visit AS vis_pts, n_add * v_add AS add_pts,
      n_plant * v_plant AS plant_pts, n_photo * v_photo AS photo_pts
    FROM mem
  ),
  ranked AS (
    SELECT mp.*,
      CASE WHEN is_ally THEN NULL ELSE
        ROW_NUMBER() OVER (
          PARTITION BY is_ally
          ORDER BY (vis_pts + add_pts + plant_pts + photo_pts + enig_pts
                    + CASE WHEN v_founded THEN crowns_invested ELSE 0 END
                    + crowns_conquered / 10.0) DESC, joined_at ASC)
      END AS principal_pos
    FROM mem_pts mp
  ),
  graded AS (
    SELECT r.*,
      CASE WHEN principal_pos IS NULL THEN NULL
           WHEN principal_pos = 1 THEN 1
           WHEN principal_pos = 2 THEN 2
           WHEN principal_pos <= 5 THEN 3
           ELSE 4 END AS grade_rank
    FROM ranked r
  )
  SELECT
    COALESCE(json_agg(json_build_object(
      'userId', user_id, 'name', name, 'avatarUrl', avatar_url,
      'joinedAt', joined_at, 'isFounder', is_founder, 'isAlly', is_ally,
      'crownsInvested', crowns_invested, 'crownsConquered', crowns_conquered,
      'coupe', (vis_pts + add_pts + plant_pts + photo_pts + enig_pts),
      'gradeRank', grade_rank,
      'gradeLabel', public._grade_label(p_faction_id, grade_rank, title_gender),
      'breakdown', jsonb_strip_nulls(jsonb_build_object(
        'enigmes', NULLIF(enig_pts, 0), 'visites', NULLIF(vis_pts, 0),
        'ajouts',  NULLIF(add_pts, 0), 'veilles', NULLIF(plant_pts, 0), 'photos', NULLIF(photo_pts, 0)
      ))
    ) ORDER BY is_ally ASC, (vis_pts + add_pts + plant_pts + photo_pts + enig_pts + CASE WHEN v_founded THEN crowns_invested ELSE 0 END + crowns_conquered / 10.0) DESC, joined_at ASC), '[]'::json),
    COALESCE(sum(vis_pts + add_pts + plant_pts + photo_pts + enig_pts), 0)::int
  INTO v_members, v_total
  FROM graded;

  v_mc := (SELECT count(*) FROM faction_members WHERE faction_id = p_faction_id);

  RETURN json_build_object(
    'id', v_f.id, 'name', v_f.title, 'color', v_f.color, 'imageUrl', v_f.image_url,
    'description', v_f.description, 'tags', to_json(v_f.tags),
    'emblemIcon', v_f.emblem_icon, 'emblemMono', v_f.emblem_mono, 'publicSlug', v_f.public_slug,
    'createdBy', v_f.created_by, 'isOfficial', (v_f.created_by IS NULL),
    'memberCount', v_mc,
    'locked', public._faction_is_locked(p_faction_id),
    'totalCoupe', v_total,
    'totalCrowns', (SELECT COALESCE(sum(crowns_invested + crowns_conquered), 0)
                    FROM faction_members WHERE faction_id = p_faction_id),
    'members', v_members
  );
END;$$;
```

- [ ] **Step 3 : Appliquer**

Run: `pnpm dlx supabase db push`
Expected: migration 305 appliquée.

- [ ] **Step 4 : Vérifier la sortie JSON**

Run (remplacer `<FID>`) :
```sql
SELECT jsonb_pretty((public.get_faction_detail('<FID>')::jsonb)->'members');
```
Expected: chaque membre a `gradeRank` (1..4 ou null) et `gradeLabel` (ex. `"Seigneur"`, `"Officier"`, `"Membre"`, null pour un allié). Le 1ᵉʳ membre principal a `gradeRank: 1` et `gradeLabel` cohérent avec son `title_gender`.

- [ ] **Step 5 : Étendre le type TS `FactionMember`**

Dans `factionGroupStore.ts` (≈ lignes 42-58), ajouter à l'interface `FactionMember` :
```ts
  /** Rang de grade dans la Compagnie : 1=Seigneur, 2=Co-seigneur, 3=Officier, 4=Membre. null = allié/sans grade. */
  gradeRank?: number | null
  /** Libellé du grade, résolu (custom Compagnie sinon défaut) et accordé au genre. null = allié. */
  gradeLabel?: string | null
```

- [ ] **Step 6 : Build**

Run: `pnpm --filter explore-web build`
Expected: build OK.

- [ ] **Step 7 : Commit**

```bash
git add supabase/migrations/305_faction_detail_grades.sql apps/explore-web/src/stores/factionGroupStore.ts
git commit -m "feat(grades): expose gradeRank/gradeLabel in get_faction_detail + FactionMember type"
```

---

## Lot 3 — Affichage des grades (front)

### Task 5 : Pilule de grade dans le Hall + le profil

**Files:**
- Modify: `apps/explore-web/src/components/factions/FactionHallModal.tsx:271` (et la zone badges 272-277)
- Modify: `apps/explore-web/src/components/factions/FactionHallModal.css` (ou le CSS chargé par ce composant)
- Modify: `apps/explore-web/src/components/map/modals/PlayerProfileModal.tsx:328-356`

**Interfaces:**
- Consumes: `FactionMember.gradeLabel/gradeRank` (Task 4), `readableInk` (`lib/textFormat.ts`).

- [ ] **Step 1 : Remplacer le badge « Chef » par la pilule de grade + badge Fondateur**

Dans `FactionHallModal.tsx`, le badge existant `♛ Chef de Compagnie` (lignes 272-274) est **remplacé** par la pilule de grade (décision Uriel : « Chef de Compagnie » → « Seigneur »). On garde l'icône ♛ pour le rang 1 uniquement. Juste après la ligne du nom (`<div className="faction-hall-rank-name">{m.name}</div>`, ligne 271), à la place du bloc Chef :
```tsx
{m.gradeLabel && (
  <span className="faction-hall-rank-grade" style={{ color: ink }}>
    {m.gradeRank === 1 ? '♛ ' : ''}{m.gradeLabel}
  </span>
)}
{m.isFounder && (
  <span className="faction-hall-rank-founder">Fondateur historique</span>
)}
```
Le badge Allié (lignes 275-277) reste inchangé. Supprimer l'ancien bloc Chef et la variable `chefId`/le compteur de rang associé (lignes 161-170) **s'ils ne servent plus** qu'à ce badge — sinon les laisser (pas de code mort introduit, pas de code utile retiré).
*(`ink` est déjà calculé via `readableInk(detail.color)` — lignes 186-187.)*

- [ ] **Step 2 : Style sobre de la pilule**

Dans le CSS du Hall, ajouter (typographie discrète, pas de fond clinquant — règle UI sobre) :
```css
.faction-hall-rank-grade {
  display: inline-block;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  opacity: 0.85;
  margin-top: 2px;
}
.faction-hall-rank-founder {
  display: inline-block;
  font-size: 11px;
  font-weight: 500;
  opacity: 0.6;
  margin-top: 1px;
  font-style: italic;
}
```

- [ ] **Step 3 : Afficher le grade dans le profil joueur**

Dans `PlayerProfileModal.tsx`, dans le bloc « Membre de la Compagnie {factionTitle} » (lignes 328-356), ajouter le grade du joueur **s'il est exposé par le payload du profil**. ⚠️ `get_player_profile` ne renvoie PAS le grade aujourd'hui. Deux options — choisir la plus simple selon le payload existant :
  - **Option A (préférée, zéro RPC)** : si le profil affiché est celui d'un membre d'une Compagnie déjà chargée dans `factionGroupStore` (Hall ouvert), lire `gradeLabel` depuis `useFactionGroupStore` en cherchant `members.find(x => x.userId === profile.userId)`.
  - **Option B** : étendre `get_player_profile` pour renvoyer `companyGradeLabel` via `public._grade_label(faction_id, public._member_grade_rank(user_id, faction_id), title_gender)` (nouvelle migration 30x — lire la baseline de `get_player_profile` avant). À faire seulement si l'option A ne couvre pas le cas « profil ouvert hors Hall ».

Rendu (sous le nom de la Compagnie) :
```tsx
{companyGradeLabel && (
  <span className="player-company-grade">{companyGradeLabel}</span>
)}
```

- [ ] **Step 4 : Build**

Run: `pnpm --filter explore-web build`
Expected: build OK.

- [ ] **Step 5 : Vérif manuelle**

Run: `pnpm --filter explore-web dev` → ouvrir le Hall d'une Compagnie à ≥ 2 membres.
Expected: le 1ᵉʳ membre affiche « Seigneur » (ou son féminin), le 2ᵉ « Co-seigneur », les 3 suivants « Officier », le reste « Membre ». Un allié n'affiche **aucun** grade. Le marqueur de carte reste inchangé (pilule sépia = nom).

- [ ] **Step 6 : Commit**

```bash
git add apps/explore-web/src/components/factions/FactionHallModal.tsx apps/explore-web/src/components/factions/FactionHallModal.css apps/explore-web/src/components/map/modals/PlayerProfileModal.tsx
git commit -m "feat(grades): show grade label in faction hall + player profile"
```

---

## Lot 4 — Pouvoirs de gouvernance + personnalisation des libellés

### Task 6 : Gater les pouvoirs sur le grade + RPC `set_faction_grade_labels`

**Files:**
- Create: `supabase/migrations/306_grade_powers_and_labels_rpc.sql`

**Interfaces:**
- Consumes: `_member_grade_rank` (Task 3), corps courants de `update_faction_identity` et `remove_faction_member`.
- Produces: RPC `public.set_faction_grade_labels(p_faction_id text, p_labels jsonb) returns json` ; `update_faction_identity` gated `rank ≤ 3` ; `remove_faction_member` gated `rank = 1`.

- [ ] **Step 1 : Lire les baselines**

Run: grep la dernière migration définissant `update_faction_identity` et `remove_faction_member` :
```bash
grep -rl "FUNCTION public.update_faction_identity" "supabase/migrations" | sort | tail -1
grep -rl "FUNCTION public.remove_faction_member" "supabase/migrations" | sort | tail -1
```
Ouvrir ces deux fichiers, copier les corps **verbatim** comme base des redéfinitions. *(Ne pas inventer le corps — règle DB.)*

- [ ] **Step 2 : Écrire la migration**

Pour `update_faction_identity` et `remove_faction_member` : repartir du corps lu au Step 1, et **remplacer le contrôle d'autorisation existant** (probablement « caller == chef ») par le gate sur le grade. Insérer en tête du corps, après le check `auth.uid()` :

```sql
-- 306_grade_powers_and_labels_rpc.sql
-- WHY : accorder les pouvoirs de gouvernance au top 5 (grade rang ≤ 3 = Seigneur+Co-seigneur+Officiers)
-- pour l'édition de l'identité et des libellés de grade ; l'exclusion reste au Seigneur (rang 1).
-- + RPC d'édition des libellés personnalisés. ADDITIF (redéfinitions backward-compatibles).

-- ── Éditer l'identité : gouvernance (rang ≤ 3) ──
-- (corps = baseline lue au Step 1, seul le contrôle d'accès change)
CREATE OR REPLACE FUNCTION public.update_faction_identity(/* … signature verbatim de la baseline … */)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE /* … déclarations verbatim … */
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error','unauthorized'); END IF;
  IF COALESCE(public._member_grade_rank(p_user_id, p_faction_id), 99) > 3 THEN
    RETURN json_build_object('error','not_governing'); END IF;
  -- … suite du corps verbatim (validation des champs, UPDATE factions, RETURN) …
END;$$;

-- ── Exclure un membre : Seigneur seul (rang 1) ──
CREATE OR REPLACE FUNCTION public.remove_faction_member(/* … signature verbatim … */)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE /* … verbatim … */
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error','unauthorized'); END IF;
  IF COALESCE(public._member_grade_rank(p_user_id, p_faction_id), 99) <> 1 THEN
    RETURN json_build_object('error','not_lord'); END IF;
  -- … suite du corps verbatim …
END;$$;

-- ── Éditer les libellés de grade (rang ≤ 3). p_labels = [{rank,label_m,label_f,label_n}] ──
CREATE OR REPLACE FUNCTION public.set_faction_grade_labels(p_faction_id text, p_labels jsonb)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_uid text := auth.uid()::text; v_row jsonb; v_rank int;
BEGIN
  IF v_uid IS NULL THEN RETURN json_build_object('error','unauthorized'); END IF;
  IF COALESCE(public._member_grade_rank(v_uid, p_faction_id), 99) > 3 THEN
    RETURN json_build_object('error','not_governing'); END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_labels) LOOP
    v_rank := (v_row->>'rank')::int;
    IF v_rank IS NULL OR v_rank < 1 OR v_rank > 4 THEN CONTINUE; END IF;
    INSERT INTO public.faction_grade_labels(faction_id, rank, label_m, label_f, label_n)
    VALUES (
      p_faction_id, v_rank,
      LEFT(btrim(COALESCE(v_row->>'label_m','')), 30),
      LEFT(btrim(COALESCE(v_row->>'label_f', v_row->>'label_m','')), 30),
      NULLIF(LEFT(btrim(COALESCE(v_row->>'label_n','')), 30), '')
    )
    ON CONFLICT (faction_id, rank) DO UPDATE
      SET label_m = EXCLUDED.label_m, label_f = EXCLUDED.label_f, label_n = EXCLUDED.label_n;
  END LOOP;
  RETURN json_build_object('success', true);
END;$$;

GRANT EXECUTE ON FUNCTION public.set_faction_grade_labels(text,jsonb) TO authenticated, service_role;
```

- [ ] **Step 3 : Appliquer**

Run: `pnpm dlx supabase db push`
Expected: migration 306 appliquée.

- [ ] **Step 4 : Vérifier le gate (négatif + positif)**

Run (en tant que membre `rank=4` d'une Compagnie `<FID>`) :
```sql
SELECT public.update_faction_identity(/* args minimaux valides */); -- attendu : {"error":"not_governing"}
SELECT public.set_faction_grade_labels('<FID>', '[{"rank":1,"label_m":"Roi","label_f":"Reine"}]'::jsonb);
-- attendu en tant que rang ≤ 3 : {"success":true} ; en tant que rang 4 : {"error":"not_governing"}
```
Puis vérifier la surcharge :
```sql
SELECT public._grade_label('<FID>', 1, 'f'); -- attendu : 'Reine'
```
Expected: gate refuse les non-gouvernants ; la surcharge custom prend le pas sur le fallback.

- [ ] **Step 5 : Commit**

```bash
git add supabase/migrations/306_grade_powers_and_labels_rpc.sql
git commit -m "feat(grades): gate identity/exclude on grade + set_faction_grade_labels RPC"
```

### Task 7 : UI d'édition des libellés (Hall, gouvernance)

**Files:**
- Modify: `apps/explore-web/src/stores/factionGroupStore.ts` (action `setGradeLabels`)
- Modify: `apps/explore-web/src/components/factions/FactionHallModal.tsx` (bloc d'édition, footer gouvernance)

**Interfaces:**
- Consumes: RPC `set_faction_grade_labels(p_faction_id, p_labels)` (Task 6).
- Produces: `useFactionGroupStore().setGradeLabels(factionId, labels)`.

- [ ] **Step 1 : Action store (pattern `removeMember`, lignes 285-296)**

Dans `factionGroupStore.ts`, ajouter à l'interface d'état et à l'impl :
```ts
setGradeLabels: (
  factionId: string,
  labels: { rank: number; label_m: string; label_f: string; label_n?: string }[],
) => Promise<ActionResult>
```
Impl :
```ts
setGradeLabels: async (factionId, labels) => {
  const { data, error } = await supabase.rpc('set_faction_grade_labels', {
    p_faction_id: factionId,
    p_labels: labels,
  })
  if (error) return { error: error.message }
  return data as ActionResult
},
```

- [ ] **Step 2 : Bloc d'édition dans le Hall (visible si gouvernant)**

Dans `FactionHallModal.tsx`, déterminer si le viewer gouverne :
```ts
const myUserId = usePlayerStore((s) => s.userId)
const myGradeRank = detail?.members.find((m) => m.userId === myUserId)?.gradeRank ?? 99
const canGovern = myGradeRank <= 3
```
Ajouter, dans la zone d'édition existante (à côté du bouton « Éditer » chef, lignes 330+), un sous-panneau « Renommer les grades » visible si `canGovern` : 4 lignes (rang 1→4), chaque ligne = 2 champs texte (masculin / féminin) + 1 champ neutre optionnel, pré-remplis avec les `gradeLabel` courants par rang (ou le fallback). Bouton « Enregistrer » → `setGradeLabels(detail.id, rows)` puis `reload()`.

*(Optionnel — thèmes 1-clic : 5 boutons (Noblesse, Confrérie, Équipage, Légion, Ordre) qui pré-remplissent les 4 lignes avant enregistrement. Peut être ajouté en suivi ; le sur-mesure couvre le besoin minimal.)*

- [ ] **Step 3 : Build**

Run: `pnpm --filter explore-web build`
Expected: build OK.

- [ ] **Step 4 : Vérif manuelle**

Run: `pnpm --filter explore-web dev` → Hall en tant que Seigneur → renommer le rang 1 en « Roi/Reine » → enregistrer.
Expected: le grade affiché passe à « Roi » (ou « Reine » selon le genre du membre) après reload ; un membre `rank=4` ne voit pas le panneau d'édition.

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/stores/factionGroupStore.ts apps/explore-web/src/components/factions/FactionHallModal.tsx
git commit -m "feat(grades): grade label editor for governing members in hall"
```

---

## Lot 5 (différé) — Héraut de montée (célébration chat)

> **À NE PAS implémenter sans décision d'Uriel.** Le classement est **live** (recalculé à la lecture) : célébrer chaque changement de rang dans le chat = **spam** (le top 5 bouge à chaque action). Trois options à trancher d'abord :
> 1. **Débounce par snapshot quotidien** : colonne `faction_members.last_grade_rank`, un cron pg_cron compare le rang du jour au snapshot, n'émet une ligne héraut (`chat_messages`, `channel = faction_id`, `user_name = 'Le Héraut'`) **que sur une montée**, jamais sur une descente (règle « on annonce les montées, jamais les descentes »). Coût : 1 colonne + 1 cron + 1 insert serveur.
> 2. **Seulement l'accession au sommet** : héraut uniquement quand quelqu'un **devient Seigneur** (changement de Chef) — événement rare, fort, déjà détectable.
> 3. **Pas de héraut** : le grade vit dans le Hall/profil, sans bruit chat.
>
> Reco XO : **option 2** pour le lancement (signal fort, zéro spam), option 1 plus tard si on veut animer davantage. Pas d'abstraction « message système » existante → insert direct dans `chat_messages` (cf. pattern `ChatPanel.tsx:136-139`).

---

## Self-Review

**1. Couverture spec / décisions** :
- 4 grades + métrique Coupe saison → Task 3 (`_member_grade_rank`) + Task 4 (`get_faction_detail`). ✅
- Libellés personnalisables + fallback Noblesse → Task 3 (`_grade_label` + table) + Task 6/7 (édition). ✅
- Genre du titre, défaut `'m'`, au profil → Task 1 + Task 2. ✅
- Pouvoirs au top 5 (rang ≤ 3) → Task 6. ✅
- Affichage Hall + profil, pas le marqueur → Task 5. ✅
- Allié sans grade → géré dans `_member_grade_rank` (NULL) et `get_faction_detail` (principal_pos NULL). ✅
- Célébration chat → Lot 5 explicitement différé avec décision à prendre. ✅ (assumé non-livré au MVP)

**2. Placeholders** : les seuls `/* verbatim */` sont au Task 6, **intentionnels et balisés** (« copier la baseline lue au Step 1 ») — conforme à la règle DB « ne jamais improviser une RPC ». Toute autre étape contient le code complet.

**3. Cohérence des types** : `gradeRank`/`gradeLabel` définis identiquement au Task 4 (SQL) et consommés au Task 5/7 (TS) ; `_member_grade_rank` (1..4, NULL) cohérent entre Task 3, 4 et 6 ; ordre de tri identique (Coupe + `crowns_invested` + `crowns_conquered/10.0`) au Task 3, au Task 4 et à la baseline mig 302.

**Aucun point ouvert.** Métrique tranchée (Uriel 25/06) : ordre Hall, Seigneur = Chef (titre « Chef de Compagnie » remplacé par « Seigneur »). Fondateur historique = badge honorifique séparé (`isFounder`), ajouté au Lot 3.
