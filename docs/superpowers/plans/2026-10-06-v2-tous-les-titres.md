# Tous les titres — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une coupe à côté de la cloche ouvre le panneau « Tous les titres » (chemins vivants avec
progression, « D'une autre époque »), chaque titre s'explique au toucher ; un nouveau chemin
« Les lieux enrichis » récompense ceux qui enrichissent les lieux des autres.

**Architecture:** une migration (430) ajoute le compteur `places_enriched` à `get_user_titles`,
quatre titres, et une fonction en lecture seule `get_mes_titres()` qui range tout par chemin. Le
front lit ce JSON (`shared/lib/lire`), l'affiche dans une nouvelle zone `features/titres/`, et la
coquille ajoute la coupe et la route `titres` (comme `notifications`).

**Tech Stack:** Supabase (PL/pgSQL), React 19, TanStack Query, React Router, CSS Modules, Vitest +
Testing Library, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-06-v2-tous-les-titres-design.md` (maquettes Figma 112:107,
« Titres — 1 » à « 3c »).

## Global Constraints

- **pnpm** uniquement ; `npx supabase` (ou `pnpm dlx supabase`) seulement pour la base.
- **TS strict** : pas de `any`, `@ts-ignore`, `as unknown as`. Le JSON de la base se lit avec `shared/lib/lire`, jamais par « cast ».
- Migration **430** (réservée : l'autre session prend 427-429). En tête `-- WHY:`. Tout `CREATE OR REPLACE` part de la définition **live** (`pg_get_functiondef`) copiée entière. Canal unique : `npx supabase db push --linked`, appliquée par moi, puis vérifiée en prod.
- Un nom de colonne ne se devine pas : `information_schema` avant d'écrire le SQL.
- Composant dans son sous-dossier dès la création ; sans état React → `lib/`, avec → `hooks/`. Pas de `console.log`. En-tête de fichier `QUOI / POURQUOI / ATTENTION` comme le reste de la V2.
- Les chemins vivants, dans cet ordre : `level`, `places_visited`, `places_added`, `places_enriched`. Écrits à un seul endroit : la migration.
- Titres d'enrichissement : **Glaneur 1 · Copiste 10 · Enlumineur 50 · Gardien des Mémoires 200**.
- Textes exacts : « Tous les titres » (titre du panneau et `aria-label` du bouton), « N titres obtenus sur M », « Touche un titre pour savoir comment il se gagne. Tu en portes trois sur ton profil. », « D'une autre époque », « Gagnés dans l'ancienne version du jeu. Ils restent à toi et se portent toujours. »
- Pas de bouton « Porter ce titre ». Pas de bloc « Offerts ».
- Commit à chaque tâche qui marche (Conventional Commits, fin `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), **push à la fin de chaque tâche**.

## Review Focus

- **Un Explorateur tout neuf** (niveau 1, 0 visite) : chaque chemin s'affiche, aucun titre obtenu, le prochain est le premier palier ; « D'une autre époque » ne montre que Novice (seuil 0). Vérifié en base à la tâche 1 (step 4), et « le prochain est le premier palier » testé à la tâche 3.
- **Un chemin entièrement gagné** : pas de barre, pas de « prochain ». Test `prochain` à la tâche 3 ; le panneau n'affiche une barre que pour `prochain(chemin)` (tâche 4).
- **Le compteur dépasse un seuil non encore recalculé** : impossible, `obtenu` vient de `get_user_titles` (même règle) — mais si `compteur >= min` et `obtenu` faux, on affiche ce que dit la base (`obtenu`). Le front ne recalcule jamais. Test dans la tâche 3.
- **Une condition illisible dans « D'une autre époque »** : la feuille dit « Gagné en jouant. » au lieu de tomber. Test dans la tâche 2 (lecture) et 4 (feuille).
- **Le panneau ouvert par-dessus un détail** se ferme sur l'onglet, comme les notifications. Test dans la tâche 5.

---

### Task 1: La base — compteur, titres, `get_mes_titres()`

**Files:**
- Create: `supabase/migrations/430_tous_les_titres.sql`

**Interfaces:**
- Produces: `get_mes_titres()` RPC, sans argument, rend :
  `{ obtenus: int, total: int, chemins: [{ stat: text, compteur: int, titres: [{ id: int, nom: text, min: int, obtenu: bool, porte: bool }] }], autreEpoque: [{ id: int, nom: text, condition: { stat, min }, porte: bool }] }`
- `get_user_titles(text)` garde sa forme et gagne `stats.places_enriched`.

- [ ] **Step 1: Vérifier les colonnes et récupérer la définition live**

Dans le SQL Editor Supabase (ou `npx supabase db query --linked`) :

```sql
SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND (
  (table_name = 'versions_lieu' AND column_name IN ('place_id', 'auteur'))
  OR (table_name = 'places' AND column_name IN ('id', 'author_id'))
  OR (table_name = 'users' AND column_name = 'displayed_title_ids_v3')
  OR (table_name = 'titles' AND column_name IN ('id', 'name', 'type', 'order', 'condition')));
SELECT pg_get_functiondef('public.get_user_titles(text)'::regprocedure);
SELECT max("order") FROM titles WHERE type = 'general';
SELECT name FROM titles WHERE name IN ('Glaneur', 'Copiste', 'Enlumineur', 'Gardien des Mémoires');
```

Attendu : `versions_lieu.auteur` et `places.author_id` en `text` ; `max(order)` < 90 ; aucun des quatre noms n'existe. Si un type diffère, adapter les comparaisons (`::text`). Si `max(order)` ≥ 90, prendre les quatre ordres suivants.

- [ ] **Step 2: Écrire la migration**

`supabase/migrations/430_tous_les_titres.sql` :

```sql
-- WHY: la page « Tous les titres » (spec 2026-10-06-v2-tous-les-titres-design). Un nouveau chemin
--      récompense l'enrichissement : places_enriched = lieux des autres où l'on a écrit au moins une
--      version (versions_lieu, historique V1 compris depuis la mig 416), comptés une fois chacun.
--      get_mes_titres() range tous les titres par chemin pour la page, en lecture seule.
-- SCHEMA CHECKED (06/10/2026) : versions_lieu(place_id, auteur) ; places(id, author_id) ;
--      users(displayed_title_ids_v3 int[]) ; titles(id, name, type, "order", icon, unlocks,
--      condition, description). get_user_titles : définition live copiée entière (pg_get_functiondef).

-- 1. get_user_titles : définition LIVE copiée entière, avec trois ajouts marqués « 430 ».
--    (Coller ici la sortie de pg_get_functiondef du Step 1, en CREATE OR REPLACE, puis :)
--    a) dans DECLARE :            v_places_enriched INT;
--    b) après le compte de v_places_added :
--         -- 430 : lieux des autres enrichis, une fois chacun
--         SELECT COUNT(DISTINCT v.place_id) INTO v_places_enriched
--         FROM public.versions_lieu v JOIN public.places p ON p.id = v.place_id
--         WHERE v.auteur = p_user_id AND p.author_id IS DISTINCT FROM p_user_id;
--    c) dans le CASE de 'unlocked', avant ELSE :
--         WHEN t.condition->>'stat' = 'places_enriched'    THEN v_places_enriched >= (t.condition->>'min')::INT
--    d) dans 'stats' :            'places_enriched', v_places_enriched
--    Rien d'autre ne change (le GRANT existant reste valable avec CREATE OR REPLACE).

-- 2. Les quatre titres du chemin « Les lieux enrichis »
INSERT INTO public.titles (name, type, faction_id, "order", icon, unlocks, condition, description) VALUES
  ('Glaneur',              'general', NULL, 90, '🌾', '{}'::text[], '{"stat":"places_enriched","min":1}'::jsonb,   'Tu as enrichi ton premier lieu.'),
  ('Copiste',              'general', NULL, 91, '🪶', '{}'::text[], '{"stat":"places_enriched","min":10}'::jsonb,  'Tu as enrichi 10 lieux.'),
  ('Enlumineur',           'general', NULL, 92, '🖋️', '{}'::text[], '{"stat":"places_enriched","min":50}'::jsonb,  'Tu as enrichi 50 lieux.'),
  ('Gardien des Mémoires', 'general', NULL, 93, '🗝️', '{}'::text[], '{"stat":"places_enriched","min":200}'::jsonb, 'Tu as enrichi 200 lieux.');

-- 3. La page : tous mes titres, rangés par chemin vivant ; les chemins refermés ne montrent que
--    ce qui est déjà gagné (« D'une autre époque »). Les chemins vivants ne sont écrits qu'ici.
CREATE FUNCTION public.get_mes_titres()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi     text := auth.uid()::text;
  v_vivants text[] := ARRAY['level', 'places_visited', 'places_added', 'places_enriched'];
  v_titres  json;
  v_obtenus int[];
  v_portes  int[];
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'non connecté';
  END IF;
  v_titres := public.get_user_titles(v_moi);
  SELECT COALESCE(array_agg((e->>'id')::int), '{}') INTO v_obtenus
    FROM json_array_elements(v_titres->'unlockedGeneralTitles') e;
  SELECT COALESCE(displayed_title_ids_v3, '{}') INTO v_portes FROM users WHERE id = v_moi;

  RETURN json_build_object(
    'obtenus', cardinality(v_obtenus),
    'total', (SELECT count(*) FROM titles t
               WHERE t.type = 'general'
                 AND (t.condition->>'stat' = ANY (v_vivants) OR t.id = ANY (v_obtenus))),
    'chemins', (SELECT json_agg(json_build_object(
        'stat', c.stat,
        'compteur', COALESCE((v_titres->'stats'->>c.stat)::int, 0),
        'titres', (SELECT COALESCE(json_agg(json_build_object(
                      'id', t.id, 'nom', t.name, 'min', (t.condition->>'min')::int,
                      'obtenu', t.id = ANY (v_obtenus), 'porte', t.id = ANY (v_portes))
                    ORDER BY (t.condition->>'min')::int), '[]'::json)
                   FROM titles t WHERE t.type = 'general' AND t.condition->>'stat' = c.stat))
      ORDER BY c.ordre)
      FROM unnest(v_vivants) WITH ORDINALITY AS c(stat, ordre)),
    'autreEpoque', (SELECT COALESCE(json_agg(json_build_object(
        'id', t.id, 'nom', t.name, 'condition', t.condition, 'porte', t.id = ANY (v_portes))
      ORDER BY t."order"), '[]'::json)
      FROM titles t
      WHERE t.type = 'general' AND t.id = ANY (v_obtenus)
        AND NOT (t.condition->>'stat' = ANY (v_vivants)))
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_mes_titres() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_mes_titres() TO authenticated;
```

Remplacer le bloc de commentaires « 1. » par la définition live complétée (a, b, c, d) : le fichier final ne contient pas d'instruction en commentaire, seulement le `CREATE OR REPLACE FUNCTION public.get_user_titles(...)` complet.

- [ ] **Step 3: Appliquer**

Run: `npx supabase db push --linked` (depuis la racine du dépôt ; `pnpm dlx supabase db push --linked` si npx casse)
Expected: `Applying migration 430_tous_les_titres.sql...` puis `Finished supabase db push.`

- [ ] **Step 4: Vérifier en prod**

```sql
-- Le compteur existe et la règle n'a pas bougé pour le reste :
SELECT (get_user_titles(u.id)->'stats'->>'places_enriched')::int AS enrichis,
       json_array_length(get_user_titles(u.id)->'unlockedGeneralTitles') AS obtenus
FROM users u WHERE u.display_name ILIKE 'Uriel%' LIMIT 1;
-- Quelques Explorateurs qui ont enrichi : des nombres plausibles, pas de doublons par lieu.
SELECT v.auteur, count(DISTINCT v.place_id) FROM versions_lieu v JOIN places p ON p.id = v.place_id
WHERE p.author_id IS DISTINCT FROM v.auteur GROUP BY v.auteur ORDER BY 2 DESC LIMIT 5;
```

Puis `get_mes_titres()` au nom d'Uriel, dans une seule transaction du SQL Editor :

```sql
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object('sub', '<id d''Uriel>', 'role', 'authenticated')::text, true);
SELECT get_mes_titres();
ROLLBACK;
```

Expected : `obtenus` = le `obtenus` de la première requête ; quatre `chemins` dans l'ordre level, places_visited, places_added, places_enriched ; `autreEpoque` contient Novice. Un Explorateur tout neuf (prendre un compte créé récemment, même méthode) : aucun titre `obtenu` dans les chemins, `autreEpoque` = Novice seul.

- [ ] **Step 4b: Régénérer les types**

Run: `pnpm --filter web-v2 gen:types`
Expected: `apps/web-v2/src/shared/supabase/database.types.ts` contient `get_mes_titres: { Args: never; Returns: Json }` (ou `Args: Record<PropertyKey, never>`). L'ajouter au commit.

- [ ] **Step 5: Commit et push**

```bash
git add supabase/migrations/430_tous_les_titres.sql apps/web-v2/src/shared/supabase/database.types.ts
git commit -m "feat(v2): les titres des lieux enrichis et get_mes_titres (mig 430)"
git push
```

---

### Task 2: Lire une condition, une phrase pour l'enrichissement

**Files:**
- Modify: `apps/web-v2/src/features/compte/lib/conditionTitre.ts`
- Modify: `apps/web-v2/src/features/compte/lib/conditionTitre.test.ts`
- Modify: `apps/web-v2/src/features/compte/api/lireProfil.ts:84-99`

**Interfaces:**
- Produces: `lireCondition(v: unknown): ConditionTitre | null` (exportée de `conditionTitre.ts`) ; `phraseCondition` connaît `places_enriched`.

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter à `conditionTitre.test.ts` (et `lireCondition` à l'import) :

```ts
test('enrichir des lieux se dit aussi', () => {
  expect(phraseCondition({ stat: 'places_enriched', min: 10 })).toBe(
    'Débloqué en enrichissant 10 lieux.',
  )
  expect(phraseCondition({ stat: 'places_enriched', min: 1 })).toBe('Débloqué en enrichissant 1 lieu.')
})

test('une condition se lit depuis la base, ou devient null si elle est illisible', () => {
  expect(lireCondition({ stat: 'plantages', min: 30 })).toEqual({ stat: 'plantages', min: 30 })
  expect(lireCondition({ stat: 'plantages' })).toBeNull()
  expect(lireCondition(null)).toBeNull()
})
```

- [ ] **Step 2: Vérifier qu'ils échouent**

Run: `pnpm --filter web-v2 exec vitest run src/features/compte/lib/conditionTitre.test.ts`
Expected: FAIL (`lireCondition` n'est pas exportée ; « Gagné en jouant. » au lieu de la phrase).

- [ ] **Step 3: Implémenter**

Dans `conditionTitre.ts` : ajouter à `PHRASES`, après `places_added` :

```ts
  places_enriched: (n) => `en enrichissant ${lieux(n)}`,
```

et à la fin du fichier (avec `import { nombre, chaine, objet } from '@/shared/lib/lire'` en tête) :

```ts
// Une condition illisible ne fait pas tomber l'écran : le titre s'affiche, son origine se dit
// alors « Gagné en jouant ».
export function lireCondition(v: unknown): ConditionTitre | null {
  try {
    const o = objet(v)
    return { stat: chaine(o.stat), min: nombre(o.min) }
  } catch {
    return null
  }
}
```

Dans `lireProfil.ts` : supprimer la fonction locale `condition` (et son commentaire), importer
`lireCondition` depuis `../lib/conditionTitre` (à côté de `type ConditionTitre`), et écrire
`condition: lireCondition(o.condition)` dans `titre()`.

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter web-v2 exec vitest run src/features/compte`
Expected: PASS (les tests de profil existants restent verts).

- [ ] **Step 5: Commit et push**

```bash
git add apps/web-v2/src/features/compte
git commit -m "feat(v2): la condition d'un titre se lit en un seul endroit, et dit l'enrichissement"
git push
```

---

### Task 3: Lire mes titres, ranger les chemins

**Files:**
- Create: `apps/web-v2/src/features/titres/api/lireMesTitres.ts`
- Create: `apps/web-v2/src/features/titres/api/lireMesTitres.test.ts`
- Create: `apps/web-v2/src/features/titres/api/mesTitres.ts`
- Create: `apps/web-v2/src/features/titres/lib/chemins.ts`
- Create: `apps/web-v2/src/features/titres/lib/chemins.test.ts`

**Interfaces:**
- Consumes: `lireCondition`, `type ConditionTitre` (tâche 2) ; RPC `get_mes_titres` (tâche 1).
- Produces:
  - `type TitreDuChemin = { id: number; nom: string; min: number; obtenu: boolean; porte: boolean }`
  - `type Chemin = { stat: string; compteur: number; titres: TitreDuChemin[] }`
  - `type TitreAncien = { id: number; nom: string; condition: ConditionTitre | null; porte: boolean }`
  - `type MesTitres = { obtenus: number; total: number; chemins: Chemin[]; autreEpoque: TitreAncien[] }`
  - `lireMesTitres(v: unknown): MesTitres` ; `fetchMesTitres(): Promise<MesTitres>`
  - `nomDuChemin(stat: string): string` ; `compteurEnClair(stat: string, n: number): string` ;
    `prochain(chemin: Chemin): TitreDuChemin | null`

- [ ] **Step 1: Écrire les tests qui échouent**

`lireMesTitres.test.ts` :

```ts
/**
 * QUOI     — la lecture de get_mes_titres (migration 430).
 */
import { expect, test } from 'vitest'
import { lireMesTitres } from './lireMesTitres'

const brut = {
  obtenus: 3,
  total: 20,
  chemins: [
    {
      stat: 'places_visited',
      compteur: 60,
      titres: [
        { id: 25, nom: 'Pèlerin', min: 10, obtenu: true, porte: false },
        { id: 32, nom: 'Errant', min: 150, obtenu: false, porte: false },
      ],
    },
  ],
  autreEpoque: [
    { id: 1, nom: 'Novice', condition: { stat: 'discoveries', min: 0 }, porte: true },
    { id: 9, nom: 'Banneret', condition: 'cassée', porte: false },
  ],
}

test('les chemins et l’autre époque se lisent', () => {
  const t = lireMesTitres(brut)
  expect(t.obtenus).toBe(3)
  expect(t.chemins[0]?.titres[1]).toEqual({ id: 32, nom: 'Errant', min: 150, obtenu: false, porte: false })
  expect(t.autreEpoque[0]).toEqual({
    id: 1, nom: 'Novice', condition: { stat: 'discoveries', min: 0 }, porte: true,
  })
})

test('une condition illisible n’empêche pas de lire le titre', () => {
  expect(lireMesTitres(brut).autreEpoque[1]?.condition).toBeNull()
})

test('un JSON mal formé lève une erreur', () => {
  expect(() => lireMesTitres({ obtenus: 'trois' })).toThrow()
})
```

`chemins.test.ts` :

```ts
/**
 * QUOI     — le nom des chemins, leur compteur en clair, le prochain titre à gagner.
 */
import { expect, test } from 'vitest'
import type { Chemin } from '../api/lireMesTitres'
import { compteurEnClair, nomDuChemin, prochain } from './chemins'

const titre = (min: number, obtenu: boolean) => ({ id: min, nom: `T${String(min)}`, min, obtenu, porte: false })
const chemin = (titres: Chemin['titres'], compteur = 0): Chemin => ({ stat: 'places_visited', compteur, titres })

test('le prochain est le premier titre pas encore obtenu', () => {
  expect(prochain(chemin([titre(10, true), titre(50, false), titre(150, false)]))?.min).toBe(50)
})

test('tout neuf : le prochain est le premier palier', () => {
  expect(prochain(chemin([titre(10, false), titre(50, false)]))?.min).toBe(10)
})

test('tout gagné : pas de prochain', () => {
  expect(prochain(chemin([titre(10, true), titre(50, true)]))).toBeNull()
})

test('la base décide : un compteur au-delà du seuil ne suffit pas à dire « obtenu »', () => {
  expect(prochain(chemin([titre(10, false)], 12))?.min).toBe(10)
})

test('chaque chemin a son nom et son compteur en clair', () => {
  expect(nomDuChemin('level')).toBe('Le chemin')
  expect(nomDuChemin('places_visited')).toBe('Les visites')
  expect(nomDuChemin('places_added')).toBe('Les lieux ajoutés')
  expect(nomDuChemin('places_enriched')).toBe('Les lieux enrichis')
  expect(compteurEnClair('level', 12)).toBe('niveau 12')
  expect(compteurEnClair('places_visited', 60)).toBe('60 lieux visités')
  expect(compteurEnClair('places_added', 1)).toBe('1 lieu ajouté')
  expect(compteurEnClair('places_enriched', 4)).toBe('4 lieux enrichis')
})
```

- [ ] **Step 2: Vérifier qu'ils échouent**

Run: `pnpm --filter web-v2 exec vitest run src/features/titres`
Expected: FAIL (modules introuvables).

- [ ] **Step 3: Implémenter**

`api/lireMesTitres.ts` :

```ts
/**
 * QUOI     — mes titres, lus depuis `get_mes_titres` (migration 430) : le compte, les chemins
 *            vivants (chaque titre, son seuil, obtenu ou non, porté ou non), et les titres gagnés
 *            sur un chemin refermé (« D'une autre époque »).
 * POURQUOI — la base décide ce qui est obtenu (la même règle que get_user_titles) : le front ne
 *            recalcule jamais un seuil.
 */
import { lireCondition, type ConditionTitre } from '@/features/compte/lib/conditionTitre'
import { booleen, chaine, liste, nombre, objet } from '@/shared/lib/lire'

export type TitreDuChemin = { id: number; nom: string; min: number; obtenu: boolean; porte: boolean }
export type Chemin = { stat: string; compteur: number; titres: TitreDuChemin[] }
export type TitreAncien = { id: number; nom: string; condition: ConditionTitre | null; porte: boolean }
export type MesTitres = { obtenus: number; total: number; chemins: Chemin[]; autreEpoque: TitreAncien[] }

function titreDuChemin(v: unknown): TitreDuChemin {
  const o = objet(v)
  return { id: nombre(o.id), nom: chaine(o.nom), min: nombre(o.min), obtenu: booleen(o.obtenu), porte: booleen(o.porte) }
}

function chemin(v: unknown): Chemin {
  const o = objet(v)
  return { stat: chaine(o.stat), compteur: nombre(o.compteur), titres: liste(titreDuChemin)(o.titres) }
}

function titreAncien(v: unknown): TitreAncien {
  const o = objet(v)
  return { id: nombre(o.id), nom: chaine(o.nom), condition: lireCondition(o.condition), porte: booleen(o.porte) }
}

export function lireMesTitres(v: unknown): MesTitres {
  const o = objet(v)
  return {
    obtenus: nombre(o.obtenus),
    total: nombre(o.total),
    chemins: liste(chemin)(o.chemins),
    autreEpoque: liste(titreAncien)(o.autreEpoque),
  }
}
```

`api/mesTitres.ts` :

```ts
/**
 * QUOI     — mes titres (migration 430).
 */
import { supabase } from '@/shared/supabase/client'
import { lireMesTitres } from './lireMesTitres'

export async function fetchMesTitres() {
  const { data, error } = await supabase.rpc('get_mes_titres')
  if (error) throw error
  return lireMesTitres(data)
}
```

Les types connaissent `get_mes_titres` depuis la tâche 1 (step 4b) ; une erreur TS sur le nom
veut dire qu'ils n'ont pas été régénérés : relancer `pnpm --filter web-v2 gen:types`, jamais de cast.

`lib/chemins.ts` :

```ts
/**
 * QUOI     — ce qu'on dit d'un chemin de titres : son nom (« Les visites »), son compteur en clair
 *            (« 60 lieux visités »), et le prochain titre à gagner.
 * POURQUOI — la base range les chemins ; ici, seulement les mots (maquette 112:107).
 */
import type { Chemin, TitreDuChemin } from '../api/lireMesTitres'

const NOMS: Record<string, string> = {
  level: 'Le chemin',
  places_visited: 'Les visites',
  places_added: 'Les lieux ajoutés',
  places_enriched: 'Les lieux enrichis',
}

const UNITES: Record<string, [string, string]> = {
  places_visited: ['lieu visité', 'lieux visités'],
  places_added: ['lieu ajouté', 'lieux ajoutés'],
  places_enriched: ['lieu enrichi', 'lieux enrichis'],
}

export function nomDuChemin(stat: string): string {
  return NOMS[stat] ?? stat
}

export function compteurEnClair(stat: string, n: number): string {
  if (stat === 'level') return `niveau ${String(n)}`
  const unite = UNITES[stat]
  if (!unite) return String(n)
  return `${String(n)} ${n > 1 ? unite[1] : unite[0]}`
}

// Le premier titre pas encore obtenu, ou null si tout le chemin est gagné.
export function prochain(chemin: Chemin): TitreDuChemin | null {
  return chemin.titres.find((t) => !t.obtenu) ?? null
}
```

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter web-v2 exec vitest run src/features/titres`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit et push**

```bash
git add apps/web-v2/src/features/titres
git commit -m "feat(v2): lire mes titres et ranger les chemins"
git push
```

---

### Task 4: Le panneau et la feuille d'un titre

**Files:**
- Create: `apps/web-v2/src/features/titres/hooks/useMesTitres.ts`
- Create: `apps/web-v2/src/features/titres/components/PageTitres.tsx`
- Create: `apps/web-v2/src/features/titres/components/PageTitres.module.css`
- Create: `apps/web-v2/src/features/titres/components/FeuilleTitre.tsx`
- Create: `apps/web-v2/src/features/titres/components/FeuilleTitre.module.css`
- Create: `apps/web-v2/src/features/titres/components/PageTitres.test.tsx`

**Interfaces:**
- Consumes: `fetchMesTitres`, types de la tâche 3 ; `phraseCondition` ; `Feuille` (`@/shared/ui/Feuille`), `Button`, `EmptyState`.
- Produces: `PageTitres()` (sans props) ; `type TitreTouche = { nom: string; cas: 'obtenu' | 'a-gagner' | 'ancien'; condition: ConditionTitre | null; compteur: number | null }`.

- [ ] **Step 1: Écrire le test qui échoue**

`PageTitres.test.tsx` :

```tsx
/**
 * QUOI     — le panneau « Tous les titres » : un bloc par chemin, le prochain avec sa barre, les
 *            titres portés, « D'une autre époque » ; un titre touché s'explique dans une feuille.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import type { MesTitres } from '../api/lireMesTitres'
import { PageTitres } from './PageTitres'

const api = vi.hoisted(() => ({ fetchMesTitres: vi.fn() }))
vi.mock('../api/mesTitres', () => api)

const titres: MesTitres = {
  obtenus: 3,
  total: 9,
  chemins: [
    {
      stat: 'places_visited',
      compteur: 60,
      titres: [
        { id: 1, nom: 'Pèlerin', min: 10, obtenu: true, porte: false },
        { id: 2, nom: 'Cheminant', min: 50, obtenu: true, porte: true },
        { id: 3, nom: 'Errant', min: 150, obtenu: false, porte: false },
        { id: 4, nom: 'Marcheur des Mondes', min: 500, obtenu: false, porte: false },
      ],
    },
    {
      stat: 'places_enriched',
      compteur: 0,
      titres: [{ id: 5, nom: 'Glaneur', min: 1, obtenu: false, porte: false }],
    },
  ],
  autreEpoque: [{ id: 9, nom: 'Banneret', condition: { stat: 'plantages', min: 30 }, porte: false }],
}

beforeEach(() => {
  api.fetchMesTitres.mockResolvedValue(titres)
})

function afficher() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PageTitres />
    </QueryClientProvider>,
  )
}

test('le compte, un bloc par chemin, le prochain avec sa barre', async () => {
  afficher()
  expect(await screen.findByText('3')).toBeInTheDocument()
  expect(screen.getByText('titres obtenus sur 9')).toBeInTheDocument()
  const visites = screen.getByRole('region', { name: 'Les visites' })
  expect(within(visites).getByText('60 lieux visités')).toBeInTheDocument()
  expect(within(visites).getByRole('progressbar', { name: 'Errant' })).toHaveAttribute('aria-valuenow', '60')
  expect(within(visites).getAllByRole('progressbar')).toHaveLength(1)
  expect(within(visites).getByRole('button', { name: /Cheminant/ })).toHaveTextContent('sur ton profil')
  expect(screen.getByRole('region', { name: 'Les lieux enrichis' })).toBeInTheDocument()
})

test('d’une autre époque : seulement ce qui est gagné', async () => {
  afficher()
  const ancien = await screen.findByRole('region', { name: 'D’une autre époque' })
  expect(within(ancien).getByRole('button', { name: /Banneret/ })).toBeInTheDocument()
})

test('sans titre d’une autre époque, le bloc ne s’affiche pas', async () => {
  api.fetchMesTitres.mockResolvedValue({ ...titres, autreEpoque: [] })
  afficher()
  await screen.findByRole('region', { name: 'Les visites' })
  expect(screen.queryByRole('region', { name: 'D’une autre époque' })).toBeNull()
})

test('un titre obtenu s’explique', async () => {
  afficher()
  await userEvent.click(await screen.findByRole('button', { name: /Cheminant/ }))
  const feuille = screen.getByRole('dialog', { name: 'Cheminant' })
  expect(within(feuille).getByText('Débloqué en visitant 50 lieux sur place.')).toBeInTheDocument()
  expect(within(feuille).getByText('Tu en as 60. Il est à toi pour toujours.')).toBeInTheDocument()
})

test('un titre à gagner montre où on en est', async () => {
  afficher()
  await userEvent.click(await screen.findByRole('button', { name: /Errant/ }))
  const feuille = screen.getByRole('dialog', { name: 'Errant' })
  expect(within(feuille).getByText('Se gagne en visitant 150 lieux sur place.')).toBeInTheDocument()
  expect(within(feuille).getByText('60 / 150 — encore 90')).toBeInTheDocument()
})

test('un titre d’une autre époque dit que le chemin s’est refermé', async () => {
  afficher()
  await userEvent.click(await screen.findByRole('button', { name: /Banneret/ }))
  const feuille = screen.getByRole('dialog', { name: 'Banneret' })
  expect(within(feuille).getByText('Débloqué en veillant sur 30 lieux.')).toBeInTheDocument()
  expect(within(feuille).getByText(/Ce chemin s’est refermé avec la V2/)).toBeInTheDocument()
})

test('une erreur se dit, et se réessaie', async () => {
  api.fetchMesTitres.mockRejectedValue(new Error('réseau'))
  afficher()
  expect(await screen.findByText('Tes titres n’ont pas pu être chargés')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Vérifier qu'il échoue**

Run: `pnpm --filter web-v2 exec vitest run src/features/titres/components`
Expected: FAIL (module `./PageTitres` introuvable).

- [ ] **Step 3: Implémenter le hook**

`hooks/useMesTitres.ts` :

```ts
/**
 * QUOI     — mes titres, pour le panneau « Tous les titres ».
 */
import { useQuery } from '@tanstack/react-query'
import { fetchMesTitres } from '../api/mesTitres'

export function useMesTitres() {
  const query = useQuery({ queryKey: ['mes-titres'], queryFn: fetchMesTitres })
  return { titres: query.data, erreur: query.isError, reessayer: query.refetch }
}
```

- [ ] **Step 4: Implémenter la feuille**

`components/FeuilleTitre.tsx` :

```tsx
/**
 * QUOI     — la feuille d'un titre touché (maquettes « Titres — 3a/3b/3c ») : obtenu (comment, et
 *            où on en est), à gagner (comment, et la barre), d'une autre époque (comment, et que le
 *            chemin s'est refermé).
 * POURQUOI — toucher un titre l'explique (Uriel, 27/09). Pas de « Porter ce titre » : le choix
 *            reste dans « Modifier mon profil » (Uriel, 06/10).
 */
import { phraseCondition, type ConditionTitre } from '@/features/compte/lib/conditionTitre'
import { Feuille } from '@/shared/ui/Feuille'
import { Text } from '@/shared/ui/Text'
import styles from './FeuilleTitre.module.css'

export type TitreTouche = {
  nom: string
  cas: 'obtenu' | 'a-gagner' | 'ancien'
  condition: ConditionTitre | null
  compteur: number | null
}

export function FeuilleTitre({ titre, onFermer }: { titre: TitreTouche; onFermer: () => void }) {
  const phrase = phraseCondition(titre.condition)
  return (
    <Feuille titre={titre.nom} onFermer={onFermer}>
      <div className={styles.feuille}>
        <span className={styles.gelule} data-obtenu={titre.cas !== 'a-gagner' || undefined}>
          <span aria-hidden="true">✦</span>
          {titre.nom}
        </span>
        {titre.cas === 'obtenu' && (
          <>
            <Text variant="corps">{phrase}</Text>
            <Text variant="sous-titre">{`Tu en as ${String(titre.compteur ?? 0)}. Il est à toi pour toujours.`}</Text>
            <Text variant="legende">Tu choisis les trois titres de ton profil dans « Modifier mon profil ».</Text>
          </>
        )}
        {titre.cas === 'a-gagner' && titre.condition && (
          <>
            <Text variant="corps">{phrase.replace('Débloqué', 'Se gagne')}</Text>
            <Barre valeur={titre.compteur ?? 0} max={titre.condition.min} nom={titre.nom} />
            <Text variant="sous-titre">
              {`${String(titre.compteur ?? 0)} / ${String(titre.condition.min)} — encore ${String(titre.condition.min - (titre.compteur ?? 0))}`}
            </Text>
          </>
        )}
        {titre.cas === 'ancien' && (
          <>
            <Text variant="corps">{phrase}</Text>
            <Text variant="sous-titre">
              Ce chemin s’est refermé avec la V2 : le titre reste à toi et se porte toujours.
            </Text>
          </>
        )}
      </div>
    </Feuille>
  )
}

export function Barre({ valeur, max, nom }: { valeur: number; max: number; nom: string }) {
  return (
    <div
      className={styles.barre}
      role="progressbar"
      aria-label={nom}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={valeur}
    >
      <span style={{ width: `${String(Math.min(100, (valeur / max) * 100))}%` }} />
    </div>
  )
}
```

Note : la phrase « Se gagne en visitant 150 lieux sur place. » vient de `phraseCondition`
(« Débloqué en visitant… ») avec « Débloqué » remplacé. Si `phraseCondition` change de tournure,
le test de la feuille le dira.

Attention : dans la feuille « à gagner », la barre a le même nom que celle du panneau ; le test du
panneau compte les barres **dans** la région « Les visites », la feuille est rendue ailleurs
(`Feuille` passe par un portail quand la racine existe, et le test du panneau n'ouvre pas de
feuille avant ce comptage).

`components/FeuilleTitre.module.css` :

```css
/*
 * QUOI     — la feuille d'un titre : la gélule en grand, la phrase, la barre (maquettes 3a-3c).
 */
.feuille {
  display: grid;
  gap: var(--space-3);
}

.gelule {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-4) var(--space-1) var(--space-3);
  border: 1px dashed var(--color-texte-doux);
  border-radius: var(--radius-rond);
  color: var(--color-texte-doux);
  font-family: var(--font-titre);
  font-size: var(--titre-section-size);
}

.gelule[data-obtenu] {
  border: none;
  background: var(--color-pilule);
  color: var(--color-encre);
}

.gelule > span {
  color: var(--color-ocre);
  font-size: var(--legende-size);
}

.barre {
  height: 6px;
  overflow: hidden;
  border-radius: var(--radius-rond);
  background: var(--color-sable);
}

.barre > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-ocre);
}
```

- [ ] **Step 5: Implémenter le panneau**

`components/PageTitres.tsx` :

```tsx
/**
 * QUOI     — le panneau « Tous les titres » (maquette 112:107) : le compte, un bloc par chemin
 *            vivant (les titres par seuil, le prochain avec sa barre, les portés cerclés), puis
 *            « D'une autre époque » (les titres gagnés sur un chemin refermé).
 * POURQUOI — aucun endroit ne montrait les titres qu'on peut gagner (Uriel, 06/10). La base range ;
 *            ici, on montre.
 */
import { useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import type { Chemin, TitreDuChemin } from '../api/lireMesTitres'
import { useMesTitres } from '../hooks/useMesTitres'
import { compteurEnClair, nomDuChemin, prochain } from '../lib/chemins'
import { Barre, FeuilleTitre, type TitreTouche } from './FeuilleTitre'
import styles from './PageTitres.module.css'

export function PageTitres() {
  const { titres, erreur, reessayer } = useMesTitres()
  const [touche, setTouche] = useState<TitreTouche | null>(null)

  if (erreur) {
    return (
      <div className={styles.etat}>
        <EmptyState>Tes titres n’ont pas pu être chargés</EmptyState>
        <Button kind="doux" onClick={() => void reessayer()}>
          Réessayer
        </Button>
      </div>
    )
  }
  if (!titres) return <div className={styles.chargement} aria-busy="true" />

  return (
    <div className={styles.page}>
      <div className={styles.resume}>
        <p className={styles.compte}>
          <span className={styles.nombre}>{titres.obtenus}</span>
          <span>{`titres obtenus sur ${String(titres.total)}`}</span>
        </p>
        <p className={styles.aide}>
          Touche un titre pour savoir comment il se gagne. Tu en portes trois sur ton profil.
        </p>
      </div>

      {titres.chemins.map((chemin) => (
        <BlocChemin key={chemin.stat} chemin={chemin} onToucher={setTouche} />
      ))}

      {titres.autreEpoque.length > 0 && (
        <section className={styles.ancien} aria-label="D’une autre époque">
          <h2 className={styles.nomAncien}>D’une autre époque</h2>
          <p className={styles.explication}>
            Gagnés dans l’ancienne version du jeu. Ils restent à toi et se portent toujours.
          </p>
          <div className={styles.gelules}>
            {titres.autreEpoque.map((t) => (
              <Gelule
                key={t.id}
                nom={t.nom}
                obtenu
                porte={t.porte}
                onToucher={() => {
                  setTouche({ nom: t.nom, cas: 'ancien', condition: t.condition, compteur: null })
                }}
              />
            ))}
          </div>
        </section>
      )}

      {touche && (
        <FeuilleTitre
          titre={touche}
          onFermer={() => {
            setTouche(null)
          }}
        />
      )}
    </div>
  )
}

function BlocChemin({ chemin, onToucher }: { chemin: Chemin; onToucher: (t: TitreTouche) => void }) {
  const suivant = prochain(chemin)
  const nom = nomDuChemin(chemin.stat)
  const toucher = (t: TitreDuChemin) => {
    onToucher({
      nom: t.nom,
      cas: t.obtenu ? 'obtenu' : 'a-gagner',
      condition: { stat: chemin.stat, min: t.min },
      compteur: chemin.compteur,
    })
  }
  return (
    <section className={styles.chemin} aria-label={nom}>
      <header className={styles.entete}>
        <h2 className={styles.nomChemin}>{nom}</h2>
        <span className={styles.compteur}>{compteurEnClair(chemin.stat, chemin.compteur)}</span>
      </header>
      <ul className={styles.titres}>
        {chemin.titres.map((t) => (
          <li key={t.id} className={styles.ligne}>
            <Gelule
              nom={t.nom}
              obtenu={t.obtenu}
              porte={t.porte}
              onToucher={() => {
                toucher(t)
              }}
            />
            {t === suivant ? (
              <div className={styles.progres}>
                <span className={styles.seuil}>
                  {`${String(chemin.compteur)} / ${compteurEnClair(chemin.stat, t.min)}`}
                </span>
                <Barre valeur={chemin.compteur} max={t.min} nom={t.nom} />
              </div>
            ) : (
              <span className={styles.seuil}>{compteurEnClair(chemin.stat, t.min)}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Gelule({
  nom,
  obtenu,
  porte,
  onToucher,
}: {
  nom: string
  obtenu: boolean
  porte: boolean
  onToucher: () => void
}) {
  return (
    <button
      type="button"
      className={styles.gelule}
      data-obtenu={obtenu || undefined}
      data-porte={porte || undefined}
      onClick={onToucher}
    >
      <span className={styles.marque} aria-hidden="true">
        ✦
      </span>
      {nom}
      {porte && <span className={styles.porte}> · sur ton profil</span>}
    </button>
  )
}
```

`components/PageTitres.module.css` :

```css
/*
 * QUOI     — le panneau « Tous les titres » (maquette 112:107) : cartes parchemin par chemin,
 *            gélules pleines (obtenu) ou en pointillés (à gagner), portées cerclées de rouge ;
 *            « D'une autre époque » en pointillés.
 */
.page {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6) var(--space-8);
}

.resume {
  display: grid;
  gap: var(--space-2);
}

.compte {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  margin: 0;
  color: var(--color-texte);
  font-family: var(--font-corps);
  font-size: var(--corps-size);
}

.nombre {
  font-family: var(--font-titre);
  font-size: var(--titre-section-size);
}

.aide,
.explication {
  margin: 0;
  color: var(--color-texte-doux);
  font-family: var(--font-corps);
  font-size: var(--legende-size);
}

.explication {
  font-style: italic;
}

.chemin,
.ancien {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-bord);
  border-radius: var(--radius-carte);
  background: color-mix(in srgb, var(--color-surface) 55%, transparent);
}

.ancien {
  border-style: dashed;
  background: none;
}

.entete {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
}

.nomChemin,
.nomAncien {
  margin: 0;
  color: var(--color-texte);
  font-family: var(--font-titre);
  font-size: var(--titre-carte-size);
  font-weight: normal;
}

.nomAncien {
  color: var(--color-texte-doux);
}

.compteur,
.seuil {
  color: var(--color-texte-doux);
  font-family: var(--font-corps);
  font-size: var(--legende-size);
}

.titres {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.ligne {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.progres {
  display: grid;
  flex: 1;
  gap: var(--space-1);
}

.gelules {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.gelule {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border: 1px dashed var(--color-texte-doux);
  border-radius: var(--radius-rond);
  background: none;
  color: var(--color-texte-doux);
  font-family: var(--font-corps);
  font-size: var(--legende-size);
  cursor: pointer;
  transition: transform var(--duree-douce) var(--courbe-douce);
}

.gelule:active {
  transform: scale(0.97);
}

.gelule[data-obtenu] {
  border: 1px solid transparent;
  background: var(--color-pilule);
  color: var(--color-encre);
}

.gelule[data-porte] {
  border-color: var(--color-accent);
}

.marque {
  color: var(--color-ocre);
}

.porte {
  color: var(--color-texte-doux);
}

.etat {
  display: grid;
  justify-items: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-6);
}

.chargement {
  min-height: 240px;
}

@media (prefers-reduced-motion: reduce) {
  .gelule {
    transition: none;
  }
}
```

Vérifier que `--duree-douce` et `--courbe-douce` existent (`grep -n "duree-douce" apps/web-v2/src/shared/styles/tokens.css`) — ils sont utilisés par `CarteScreen.module.css`. `--color-pilule` existe (liste des tokens) ; si sa teinte n'est pas la gélule crème de la maquette (`#f6e1c3`), comparer à l'écran et le dire plutôt qu'ajouter un hex.

- [ ] **Step 6: Vérifier**

Run: `pnpm --filter web-v2 exec vitest run src/features/titres`
Expected: PASS (15 tests). Puis `pnpm --filter web-v2 exec tsc --noEmit -p .` et `pnpm --filter web-v2 exec eslint src/features/titres` sans sortie.

- [ ] **Step 7: Commit et push**

```bash
git add apps/web-v2/src/features/titres
git commit -m "feat(v2): le panneau « Tous les titres » et la feuille d'un titre"
git push
```

---

### Task 5: La coupe dans la coquille, la route, le parcours dans le navigateur

**Files:**
- Create: `apps/web-v2/src/assets/ui/coupe.svg`
- Modify: `apps/web-v2/src/app/routes/carte.tsx` (ajouter `RouteTitres` après `RouteNouveautes`)
- Modify: `apps/web-v2/src/app/router.tsx:20,49` (import et route `titres`)
- Modify: `apps/web-v2/src/app/shell/Shell.tsx:183-197` (bouton coupe avant la cloche)
- Modify: `apps/web-v2/src/app/shell/Shell.test.tsx` (mock et deux tests)

**Interfaces:**
- Consumes: `PageTitres` (tâche 4) ; `DetailPane`, `ouvrir()` de `Shell.tsx` (`useOuvrir`).
- Produces: route `/<onglet>/titres`.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `Shell.test.tsx`, à côté des autres `vi.mock` :

```tsx
vi.mock('@/features/titres/api/mesTitres', () => ({
  fetchMesTitres: () =>
    Promise.resolve({ obtenus: 0, total: 0, chemins: [], autreEpoque: [] }),
}))
```

et à la fin :

```tsx
test('la coupe ouvre « Tous les titres » ; fermer ramène à l’onglet', async () => {
  const router = renderAt(['/accueil', '/accueil/chemins'])
  await userEvent.click(await screen.findByRole('button', { name: 'Tous les titres' }))
  expect(router.state.location.pathname).toBe('/accueil/titres')
  await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  await vi.waitFor(() => {
    expect(router.state.location.pathname).toBe('/accueil')
  })
})

test('la coupe est là sur la carte aussi, à côté de la cloche', async () => {
  renderAt('/carte')
  expect(await screen.findByRole('button', { name: 'Tous les titres' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Vérifier qu'ils échouent**

Run: `pnpm --filter web-v2 exec vitest run src/app/shell/Shell.test.tsx`
Expected: FAIL (pas de bouton « Tous les titres »).

- [ ] **Step 3: Implémenter**

`assets/ui/coupe.svg` (le pochoir de la maquette « Titres — 1 ») :

```svg
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M6 3H18V8.5C18 11.8 15.6 14.2 13 14.6V17H15.5C16.1 17 16.6 17.5 16.6 18.1V19H7.4V18.1C7.4 17.5 7.9 17 8.5 17H11V14.6C8.4 14.2 6 11.8 6 8.5V3Z" fill="#3F3024"/>
<path d="M6 19.8H18V21.6H6Z" fill="#3F3024"/>
<path d="M5.2 4.6H3.2C2.9 4.6 2.6 4.9 2.6 5.2V7C2.6 9 4 10.6 5.9 10.9L6.3 9.4C5 9.1 4.2 8.1 4.2 7V6.2H5.2Z" fill="#3F3024"/>
<path d="M18.8 4.6H20.8C21.1 4.6 21.4 4.9 21.4 5.2V7C21.4 9 20 10.6 18.1 10.9L17.7 9.4C19 9.1 19.8 8.1 19.8 7V6.2H18.8Z" fill="#3F3024"/>
<path opacity="0.85" d="M8.2 5H9.4V8.6C9.4 9.8 9.9 10.8 10.7 11.5C9.2 11.1 8.2 9.9 8.2 8.6Z" fill="#FCF3E4"/>
<path opacity="0.7" d="M7 20.4H17V20.9H7Z" fill="#FCF3E4"/>
</svg>
```

Ajouter `coupe.svg` à la liste de `assets/ui/README.md` si ce fichier recense les icônes.

`app/routes/carte.tsx` — import `import { PageTitres } from '@/features/titres/components/PageTitres'`, mettre à jour le `QUOI` de l'en-tête (« … les notifications, les nouveautés de l'app et tous les titres »), et ajouter :

```tsx
// /<onglet>/titres — tous les titres, ouverts depuis la coupe (maquette 112:107)
export function RouteTitres() {
  return (
    <DetailPane title="Tous les titres">
      <PageTitres />
    </DetailPane>
  )
}
```

`app/router.tsx` — ajouter `RouteTitres` à l'import de `./routes/carte`, et la route après `nouveautes` :

```tsx
              { path: 'titres', Component: RouteTitres },
```

`app/shell/Shell.tsx` — `import coupe from '@/assets/ui/coupe.svg'` (à côté de `cloche`), et dans `<div className={styles.actions}>`, **avant** le bouton Notifications :

```tsx
          <button
            type="button"
            className={styles.action}
            aria-label="Tous les titres"
            onClick={() => {
              ouvrir('titres')
            }}
          >
            <img src={coupe} alt="" />
          </button>
```

Mettre à jour le `QUOI` de l'en-tête de `Shell.tsx` (« … logotype, la coupe et la cloche, … »).
Sur PC, la barre est verticale : la coupe tombe au-dessus de la cloche ; sur téléphone, l'en-tête
est horizontal : elle tombe à gauche de la cloche. Vérifier dans le navigateur que l'ordre CSS de
`.actions` ne l'inverse pas.

- [ ] **Step 4: Vérifier les tests et le build**

Run: `pnpm --filter web-v2 exec vitest run` puis `pnpm --filter web-v2 exec tsc --noEmit -p .`, `pnpm --filter web-v2 exec eslint src`, `pnpm --filter web-v2 exec prettier --check src`, et `pnpm --filter web-v2 build`
Expected: tous les tests PASS, aucune erreur, build terminé (`dist/sw.js` généré).

- [ ] **Step 5: Parcours dans le navigateur**

Run (en arrière-plan) : `pnpm dev:v2` depuis la racine, puis ouvrir `http://localhost:5174/v2/carte` (connecté).

À vérifier, à 1440 px puis à 390 px :
1. la coupe est au-dessus de la cloche (PC), à gauche de la cloche (téléphone), même taille et même encre ;
2. elle ouvre « Tous les titres » : le compte, quatre chemins dans l'ordre (Le chemin, Les visites, Les lieux ajoutés, Les lieux enrichis), un seul titre avec barre par chemin non terminé, les titres portés cerclés de rouge avec « · sur ton profil », « D'une autre époque » avec Novice ;
3. toucher un titre obtenu, un titre à gagner, un titre d'une autre époque : la bonne feuille, Échap ou le voile la ferme ;
4. fermer le panneau ramène à l'onglet ;
5. comparer à la maquette Figma 112:107 côte à côte à 390 px ; reprendre chaque écart visible.

- [ ] **Step 6: Commit, push, vault**

```bash
git add apps/web-v2/src/assets/ui/coupe.svg apps/web-v2/src/app
git commit -m "feat(v2): la coupe ouvre « Tous les titres »"
git push
```

Puis, dans le vault (`1. LE MÉTIER/1. Runes de Chêne/Explore/_État.md`), passer la ligne « La page « Tous les titres » » de « conception validée » à « en ligne (mig 430) » une fois déployée.
