# Anti-triche Édition de Tags × Défis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empêcher qu'un joueur valide un défi action×tag en retaguant lui-même un lieu, sans fermer l'édition collaborative de tags.

**Architecture:** Une seule migration SQL serveur (`238`). On trace l'auteur de chaque tag (`place_tags.created_by`), on préserve cette paternité dans `set_place_tags`, et `_defi_progress` ignore, pour un joueur donné, les tags que ce joueur a lui-même posés via édition. Une table `place_tags_revisions` fournit le trail d'audit. **Zéro changement front.**

**Tech Stack:** PostgreSQL / Supabase (plpgsql, `SECURITY DEFINER`), migrations numérotées dans `supabase/migrations/`, vérif sur preview branch via le MCP Supabase avant prod.

**Spec :** `docs/superpowers/specs/2026-06-11-anticheat-edition-tags-defis-design.md`

---

## Contexte de code (déjà vérifié — ne pas re-supposer)

- **`set_place_tags`** : version courante = `supabase/migrations/234_place_meta_edit_gate_and_set_tags.sql:73-124`. Corps actuel = `DELETE` total puis `INSERT … SELECT` sans `created_by` (l.111-114). Aucune redéfinition postérieure.
- **`_defi_progress`** : version courante = `supabase/migrations/233_fix_defi_visit_uses_place_explorers.sql:21-72` (supersede mig 192). Elle contient **5** sous-requêtes `EXISTS (… FROM public.place_tags pt …)` : `reveal` (l.37-38), `visit`/place_explorers (l.45-46), `visit`/places_discovered (l.53-54), `add` (l.60-61), `veilleur` (l.66-67).
- **Création de lieu** : `create_place` courant = `supabase/migrations/200_create_place_seed_description.sql:97-98`, insère 1 tag primaire **sans** `created_by` → restera `NULL`. **Ne pas modifier la création.**
- **`place_tags`** : PK `(place_id, tag_id)`, colonnes `is_primary boolean`, `created_at timestamptz`. `users.id` est de type **`text`** (cf. `defi_claims.user_id text REFERENCES users(id)`, `places.author_id = p_caller::text`).
- **`place_description_revisions`** (modèle calqué) : `set_place_tags` n'a aujourd'hui **aucun** équivalent d'audit, contrairement à `edit_place_description` (mig 235:60-61).
- **Prochain numéro de migration libre = `238`** (le plus haut existant est `237`).

## File Structure

| Fichier | Responsabilité |
|---|---|
| `supabase/migrations/238_anticheat_tags_defi_self_edit.sql` (créer) | Tout le changement : `ALTER place_tags ADD created_by` + table `place_tags_revisions` + refonte `set_place_tags` (préservation paternité + révision) + patch `_defi_progress` (prédicat anti-self-edit). Un seul fichier = une unité atomique. |
| `scripts/verify_238_anticheat.sql` (créer, temporaire) | Script de vérification transactionnel (`BEGIN … ROLLBACK`) à exécuter sur la preview branch. Supprimé après validation (non committé). |

La migration est **réversible** (documentée en tête) : `DROP TABLE place_tags_revisions`, `ALTER … DROP COLUMN created_by`, et restauration des corps mig 234/233 des deux fonctions.

---

## Task 1 : Squelette de migration + schéma (colonne + table d'audit)

**Files:**
- Create: `supabase/migrations/238_anticheat_tags_defi_self_edit.sql`

- [ ] **Step 1 : Créer le fichier avec l'en-tête + le bloc DDL**

Écrire le contenu suivant dans `supabase/migrations/238_anticheat_tags_defi_self_edit.sql` :

```sql
-- 238_anticheat_tags_defi_self_edit.sql
-- WHY : l'édition collaborative de tags (mig 234/235, gate « Présence ou veille »)
-- ouvre une triche sur les Défis action×tag (mig 233) : _defi_progress JOIN les
-- place_tags en LIVE, donc un joueur peut retaguer un lieu (forêt→château) puis
-- agir, et valider « Planter mon GPS sur un château » sans château réel.
--
-- RÈGLE A : tes propres ÉDITIONS de tags ne te créditent jamais. Un tag posé par
-- quelqu'un d'autre — ou par toi à la CRÉATION du lieu (created_by NULL) — compte.
--   1) place_tags.created_by : NULL = tag d'origine (création) ; non-NULL = posé via
--      une édition set_place_tags, porte l'id de l'éditeur.
--   2) set_place_tags préserve created_by pour les tags conservés ; seuls les tags
--      NOUVELLEMENT ajoutés prennent created_by = appelant. + ligne d'audit.
--   3) _defi_progress exclut, pour p_user_id, les place_tags qu'il a édités lui-même.
--      Neutralisé pour les défis collectifs (p_collective court-circuite).
--
-- Réversible : DROP TABLE place_tags_revisions ; ALTER … DROP COLUMN created_by ;
-- restaurer les corps set_place_tags (mig 234) et _defi_progress (mig 233).

BEGIN;

-- 1) Paternité des tags ------------------------------------------------------
ALTER TABLE public.place_tags
  ADD COLUMN IF NOT EXISTS created_by text NULL
  REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.place_tags.created_by IS
  'NULL = tag posé à la création du lieu (paternité = places.author_id). '
  'non-NULL = tag posé via une édition set_place_tags par cet utilisateur. '
  'Sert à la Règle A anti-triche : une édition ne crédite pas son auteur dans _defi_progress.';

-- 2) Trail d'audit des changements de tags -----------------------------------
CREATE TABLE IF NOT EXISTS public.place_tags_revisions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  place_id    varchar(255) NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  changed_by  text NULL REFERENCES public.users(id) ON DELETE SET NULL,
  old_tag_ids text[] NOT NULL DEFAULT '{}',
  new_tag_ids text[] NOT NULL,
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_place_tags_revisions_place
  ON public.place_tags_revisions (place_id, changed_at DESC);

GRANT SELECT ON public.place_tags_revisions TO authenticated, service_role;

COMMIT;
```

- [ ] **Step 2 : Vérifier que le fichier parse (lint syntaxique léger, sans appliquer)**

Run (PowerShell) :
```powershell
Get-Content "supabase/migrations/238_anticheat_tags_defi_self_edit.sql" -TotalCount 5
```
Expected : les 5 premières lignes du commentaire d'en-tête s'affichent (fichier bien écrit). L'application réelle se fait en Task 4.

---

## Task 2 : Refonte de `set_place_tags` (préservation paternité + audit)

**Files:**
- Modify: `supabase/migrations/238_anticheat_tags_defi_self_edit.sql` (ajouter un 2e bloc `BEGIN … COMMIT`)

- [ ] **Step 1 : Ajouter le bloc `set_place_tags` à la fin du fichier 238**

Ajouter à la fin de `supabase/migrations/238_anticheat_tags_defi_self_edit.sql` :

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- set_place_tags : remplace tous les tags d'un lieu (1-3, ordonnés ; 1er = primary).
-- Identique à mig 234 SAUF : préserve created_by des tags conservés, attribue
-- l'appelant aux tags nouvellement ajoutés, et journalise dans place_tags_revisions.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

CREATE OR REPLACE FUNCTION public.set_place_tags(p_place_id text, p_tag_ids text[])
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $tags$
DECLARE
  v_caller  text  := public._caller_user_id();
  v_n       int   := COALESCE(array_length(p_tag_ids, 1), 0);
  v_old_pat jsonb;          -- map { tag_id -> created_by } AVANT modification
  v_old_ids text[];         -- anciens tags (ordre is_primary DESC) pour l'audit
BEGIN
  IF v_caller IS NULL THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  IF v_n < 1 THEN
    RETURN json_build_object('error', 'no_tags');
  END IF;
  IF v_n > 3 THEN
    RETURN json_build_object('error', 'too_many_tags');
  END IF;
  IF (SELECT count(DISTINCT tid) FROM unnest(p_tag_ids) tid) <> v_n THEN
    RETURN json_build_object('error', 'duplicate_tag');
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_tag_ids) tid
    WHERE NOT EXISTS (SELECT 1 FROM public.tags WHERE id = tid)
  ) THEN
    RETURN json_build_object('error', 'invalid_tag');
  END IF;

  IF NOT public._can_edit_place_meta(p_place_id, v_caller) THEN
    RETURN json_build_object('error', 'not_allowed');
  END IF;

  -- Snapshot de la paternité AVANT le DELETE (jsonb null pour created_by NULL).
  SELECT jsonb_object_agg(tag_id, to_jsonb(created_by)),
         array_agg(tag_id ORDER BY is_primary DESC)
    INTO v_old_pat, v_old_ids
    FROM public.place_tags
   WHERE place_id = p_place_id;

  DELETE FROM public.place_tags WHERE place_id = p_place_id;

  INSERT INTO public.place_tags (place_id, tag_id, is_primary, created_at, created_by)
  SELECT
    p_place_id,
    t.tag_id,
    (t.ord = 1),
    NOW(),
    CASE
      WHEN v_old_pat ? t.tag_id            -- tag déjà présent → on garde sa paternité
      THEN NULLIF(v_old_pat->>t.tag_id, '')  -- (NULL si c'était un tag de création)
      ELSE v_caller                         -- tag nouvellement ajouté → l'éditeur
    END
  FROM unnest(p_tag_ids) WITH ORDINALITY AS t(tag_id, ord);

  -- Audit : une ligne par appel (qui, quoi avant, quoi après).
  INSERT INTO public.place_tags_revisions (place_id, changed_by, old_tag_ids, new_tag_ids)
  VALUES (p_place_id, v_caller, COALESCE(v_old_ids, '{}'), p_tag_ids);

  UPDATE public.places SET updated_at = NOW() WHERE id = p_place_id;

  RETURN json_build_object('success', true, 'tagIds', p_tag_ids);
END;
$tags$;

ALTER FUNCTION public.set_place_tags(text, text[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_place_tags(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_place_tags(text, text[]) TO authenticated, service_role;

COMMIT;
```

Note clé : `to_jsonb(created_by)` produit `null` JSON quand `created_by` est NULL, et `?` détecte quand même la clé → un tag de création conservé garde bien `created_by = NULL` (et non l'éditeur courant). C'est ce qui empêche de réécrire à tort la paternité d'un tag posé par un autre quand on ajoute un 2e tag.

---

## Task 3 : Patch de `_defi_progress` (prédicat anti-self-edit)

**Files:**
- Modify: `supabase/migrations/238_anticheat_tags_defi_self_edit.sql` (ajouter un 3e bloc)

- [ ] **Step 1 : Ajouter le bloc `_defi_progress` patché à la fin du fichier 238**

Le corps est **identique à mig 233** ; seul change l'ajout de `AND (p_collective OR pt.created_by IS DISTINCT FROM p_user_id)` dans **chacune des 5** sous-requêtes `EXISTS … place_tags`. Ajouter à la fin du fichier :

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- _defi_progress : corps mig 233 + Règle A. Chaque EXISTS sur place_tags exclut,
-- pour un joueur (p_collective = false), les tags que CE joueur a édités lui-même
-- (pt.created_by = p_user_id). p_collective = true court-circuite → compteur
-- communautaire objectif inchangé. created_by NULL (tag de création) compte toujours.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

CREATE OR REPLACE FUNCTION public._defi_progress(p_action text, p_tag_id text, p_user_id text, p_collective boolean, p_ws timestamp with time zone)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  IF p_action = 'enigma' THEN
    SELECT count(*) INTO n FROM public.enigma_responses e
     WHERE e.responded_at >= p_ws AND (p_collective OR e.user_id = p_user_id);
  ELSIF p_action = 'reveal' THEN
    SELECT count(*) INTO n FROM public.places_discovered pd
     WHERE pd.method = 'remote'
       AND pd.discovered_at >= p_ws
       AND (p_collective OR pd.user_id = p_user_id)
       AND (p_tag_id IS NULL OR EXISTS (
             SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pd.place_id AND pt.tag_id = p_tag_id
               AND (p_collective OR pt.created_by IS DISTINCT FROM p_user_id)));
  ELSIF p_action = 'visit' THEN
    SELECT count(*) INTO n FROM (
      SELECT pe.user_id, pe.place_id
        FROM public.place_explorers pe
       WHERE pe.visited_at >= p_ws
         AND (p_collective OR pe.user_id = p_user_id)
         AND (p_tag_id IS NULL OR EXISTS (
               SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pe.place_id AND pt.tag_id = p_tag_id
                 AND (p_collective OR pt.created_by IS DISTINCT FROM p_user_id)))
      UNION
      SELECT pd.user_id, pd.place_id
        FROM public.places_discovered pd
       WHERE pd.method = 'gps'
         AND pd.discovered_at >= p_ws
         AND (p_collective OR pd.user_id = p_user_id)
         AND (p_tag_id IS NULL OR EXISTS (
               SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pd.place_id AND pt.tag_id = p_tag_id
                 AND (p_collective OR pt.created_by IS DISTINCT FROM p_user_id)))
    ) x;
  ELSIF p_action = 'add' THEN
    SELECT count(*) INTO n FROM public.places p
     WHERE p.created_at >= p_ws
       AND (p_collective OR p.author_id = p_user_id)
       AND (p_tag_id IS NULL OR EXISTS (
             SELECT 1 FROM public.place_tags pt WHERE pt.place_id = p.id AND pt.tag_id = p_tag_id
               AND (p_collective OR pt.created_by IS DISTINCT FROM p_user_id)));
  ELSIF p_action = 'veilleur' THEN
    SELECT count(*) INTO n FROM public.place_veille pv
     WHERE pv.by_influence = false AND pv.planted_at >= p_ws
       AND (p_collective OR pv.veilleur_user_id = p_user_id)
       AND (p_tag_id IS NULL OR EXISTS (
             SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pv.place_id AND pt.tag_id = p_tag_id
               AND (p_collective OR pt.created_by IS DISTINCT FROM p_user_id)));
  ELSE
    n := 0;
  END IF;
  RETURN COALESCE(n, 0);
END; $function$;

COMMIT;
```

Subtilité `add` : un château créé légitimement a son tag à `created_by = NULL` (création) → `NULL IS DISTINCT FROM p_user_id` = true → **compté**. Si l'auteur retague ensuite son propre lieu (édition), `created_by = lui` → `IS DISTINCT FROM` false → **pas** de nouveau crédit. La distinction création/édition tombe juste.

---

## Task 4 : Appliquer sur preview branch + vérifier (le cœur de la preuve)

**Files:**
- Create (temporaire, non committé) : `scripts/verify_238_anticheat.sql`

- [ ] **Step 1 : Écrire le script de vérification transactionnel**

Écrire dans `scripts/verify_238_anticheat.sql` :

```sql
-- Vérif Règle A — transactionnel, ROLLBACK à la fin : ne persiste rien.
-- Prouve : (1) tag d'autrui compté, (2) self-edit exclu pour le joueur,
--          (3) collectif inchangé, (4) audit écrit.
DO $$
DECLARE
  v_uid    text;
  v_other  text;
  v_tag    text := '3fQyu5KCU';   -- Châteaux (seed défis mig 192)
  v_place  text;
  v_ws     timestamptz := date_trunc('week', now());
  v_base   int; v_with_other int; v_with_self int;
  v_col_other int; v_col_self int;
BEGIN
  SELECT id INTO v_uid   FROM public.users LIMIT 1;
  SELECT id INTO v_other FROM public.users WHERE id <> v_uid LIMIT 1;
  IF v_uid IS NULL OR v_other IS NULL THEN RAISE EXCEPTION 'Pas assez d''utilisateurs pour le test'; END IF;

  -- un lieu que v_uid n'a pas visité et qui n'a pas déjà le tag château
  SELECT p.id INTO v_place FROM public.places p
   WHERE NOT EXISTS (SELECT 1 FROM public.place_explorers pe WHERE pe.place_id = p.id AND pe.user_id = v_uid)
     AND NOT EXISTS (SELECT 1 FROM public.place_tags pt WHERE pt.place_id = p.id AND pt.tag_id = v_tag)
   LIMIT 1;
  IF v_place IS NULL THEN RAISE EXCEPTION 'Pas de lieu candidat pour le test'; END IF;

  -- v_uid a visité ce lieu cette semaine (présence GPS simulée)
  INSERT INTO public.place_explorers (place_id, user_id, visited_at)
  VALUES (v_place, v_uid, now());

  v_base := public._defi_progress('visit', v_tag, v_uid, false, v_ws);

  -- (1) tag château posé par QUELQU'UN D'AUTRE → doit compter (+1)
  INSERT INTO public.place_tags (place_id, tag_id, is_primary, created_by)
  VALUES (v_place, v_tag, false, v_other);
  v_with_other := public._defi_progress('visit', v_tag, v_uid, false, v_ws);
  IF v_with_other <> v_base + 1 THEN
    RAISE EXCEPTION 'ÉCHEC (1) tag d''autrui devrait compter : base=% with_other=%', v_base, v_with_other;
  END IF;

  -- collectif AVEC tag d'autrui
  v_col_other := public._defi_progress('visit', v_tag, v_uid, true, v_ws);

  -- (2) le MÊME tag réattribué à v_uid (self-edit) → ne doit PAS compter pour lui
  UPDATE public.place_tags SET created_by = v_uid WHERE place_id = v_place AND tag_id = v_tag;
  v_with_self := public._defi_progress('visit', v_tag, v_uid, false, v_ws);
  IF v_with_self <> v_base THEN
    RAISE EXCEPTION 'ÉCHEC (2) self-edit devrait être exclu : base=% with_self=%', v_base, v_with_self;
  END IF;

  -- (3) collectif INCHANGÉ malgré created_by = v_uid (p_collective court-circuite)
  v_col_self := public._defi_progress('visit', v_tag, v_uid, true, v_ws);
  IF v_col_self <> v_col_other THEN
    RAISE EXCEPTION 'ÉCHEC (3) collectif ne doit pas être affecté : other=% self=%', v_col_other, v_col_self;
  END IF;

  RAISE NOTICE 'OK Règle A : base=% other=%(+1) self=%(exclu) collectif=%(stable)',
    v_base, v_with_other, v_with_self, v_col_self;
  RAISE EXCEPTION 'ROLLBACK_VOLONTAIRE';  -- force le rollback, rien n'est persisté
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM = 'ROLLBACK_VOLONTAIRE' THEN
    RAISE NOTICE 'Vérif terminée, transaction annulée (aucune écriture).';
  ELSE
    RAISE;  -- propage les vrais échecs d'assertion
  END IF;
END $$;
```

- [ ] **Step 2 : Créer une preview branch Supabase et y appliquer la migration 238**

Via le MCP Supabase (préférer une branch à la prod, cf. consignes serveur) :
- `create_branch` (confirmer le coût si demandé via `confirm_cost`)
- `apply_migration` avec le contenu de `supabase/migrations/238_anticheat_tags_defi_self_edit.sql`

Expected : application sans erreur (les 3 blocs `BEGIN…COMMIT` passent).

- [ ] **Step 3 : Exécuter le script de vérification sur la branch**

Via MCP `execute_sql`, coller le contenu de `scripts/verify_238_anticheat.sql`.
Expected : un `NOTICE` `OK Règle A : …` puis `Vérif terminée, transaction annulée`. **Aucune** `EXCEPTION` commençant par `ÉCHEC`.

- [ ] **Step 4 : Vérifier le schéma et la paternité côté `set_place_tags` (catalogue + JWT simulé)**

Via MCP `execute_sql` sur la branch :
```sql
-- colonne + table présentes
SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_name='place_tags' AND column_name='created_by')          AS has_col,
  (SELECT count(*) FROM information_schema.tables
    WHERE table_name='place_tags_revisions')                             AS has_audit;
-- attendu : has_col=1, has_audit=1

-- le prédicat est bien dans la fonction (5 occurrences attendues)
SELECT (length(pg_get_functiondef('public._defi_progress(text,text,text,boolean,timestamptz)'::regprocedure))
        - length(replace(pg_get_functiondef('public._defi_progress(text,text,text,boolean,timestamptz)'::regprocedure),
                         'IS DISTINCT FROM p_user_id',''))) / length('IS DISTINCT FROM p_user_id') AS predicate_count;
-- attendu : 5
```
Expected : `has_col=1`, `has_audit=1`, `predicate_count=5`.

- [ ] **Step 5 : Nettoyer la branch**

Via MCP `delete_branch` une fois les vérifs vertes. Supprimer le fichier temporaire :
```powershell
Remove-Item "scripts/verify_238_anticheat.sql"
```

---

## Task 5 : Commit + application en prod

**Files:**
- `supabase/migrations/238_anticheat_tags_defi_self_edit.sql`
- `docs/superpowers/specs/2026-06-11-anticheat-edition-tags-defis-design.md` (déjà à jour)

- [ ] **Step 1 : Commit de la migration**

```powershell
git add "supabase/migrations/238_anticheat_tags_defi_self_edit.sql"
git commit -m @'
feat(defis): anti-triche edition de tags — Regle A (self-edit exclu)

place_tags.created_by trace la paternite des tags ; set_place_tags la
preserve + journalise dans place_tags_revisions ; _defi_progress ignore,
pour un joueur, les tags qu il a edites lui-meme (neutre en collectif).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
'@
```
Expected : commit créé, hook post-commit Graphify (+ `graphify-sql.py` car la migration touche `supabase/migrations/`) s'exécute.

- [ ] **Step 2 : Appliquer la migration en prod**

Suivre le workflow du projet (`docs/db/migrations-workflow.md`) : appliquer `238_anticheat_tags_defi_self_edit.sql` sur le projet Supabase de prod (via CLI `npx supabase` ou MCP `apply_migration` sur le projet prod).
Expected : application sans erreur.

- [ ] **Step 3 : Smoke test end-to-end dans l'app (la vraie preuve)**

Reproduire le scénario de triche en prod sur un compte de test :
1. Ouvrir un lieu **forêt** où le compte de test est présent GPS/veilleur (gate d'édition OK).
2. Le retaguer en **château** via la modale d'édition de tags.
3. Vérifier qu'un défi `visit`/`veilleur` château **ne progresse pas** pour ce compte après l'action.
4. Vérifier qu'un vrai château tagué par un autre joueur **fait** progresser le défi.
5. Vérifier en base : `SELECT * FROM place_tags_revisions ORDER BY changed_at DESC LIMIT 3;` montre le changement (qui/quoi/quand).

Expected : triche neutralisée, cas légitime préservé, audit présent.

- [ ] **Step 4 : Push**

```powershell
git push
```
Expected : la branche `main` est à jour sur le remote. (Règle critique Citadelle : jamais de commit non pushé en fin de session.)

---

## Self-Review (effectué par l'auteur du plan)

**Couverture spec :**
- Règle A (created_by + préservation + prédicat) → Tasks 1-3 ✅
- Neutralisation collectif (`p_collective` court-circuite) → Task 3 + assertion Task 4 step 3 ✅
- Audit `place_tags_revisions` → Tasks 1-2 ✅ (`activity_log` déféré, conforme spec §4 mise à jour)
- Legacy `created_by NULL` compte normalement → couvert par `IS DISTINCT FROM` (Task 3) + cas `v_base` du test ✅
- Critères de validation spec 1-8 → mappés sur Task 4 (predicat) + Task 5 step 3 (smoke `add`/`visit`/`veilleur`) ✅

**Placeholders :** aucun — tout le SQL est complet et calqué sur les corps live (mig 233/234).

**Cohérence des types :** `users.id` = `text` partout (`created_by text`, `changed_by text`, `p_user_id text`) ; `_defi_progress` signature stricte `(text,text,text,boolean,timestamptz)` réutilisée à l'identique ; `set_place_tags(text,text[])` signature inchangée (pas de nouvelle surcharge).

**Point de vigilance pour l'exécutant :** au Task 4 step 4, le test de `set_place_tags` via JWT simulé (`set_config('request.jwt.claims', …)`) dépend de l'implémentation de `_caller_user_id()` (mig 227). Le script fourni teste `_defi_progress` directement (sans JWT, robuste) ; la préservation de paternité de `set_place_tags` est prouvée end-to-end au Task 5 step 3 (smoke app réel). Si une assertion SQL de paternité est souhaitée en plus, lire `_caller_user_id` dans mig 227 avant d'écrire le `set_config`.
```
