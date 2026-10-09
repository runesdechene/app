# Le passeport (V2) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** remplacer la section « Visités » du profil V2 par un passeport à trois niveaux (natures → territoires → mois).

**Architecture:** une fonction SQL `get_passeport` renvoie toutes les natures et tous les tampons (un par lieu visité, date coupée au mois pour les autres) ; le client regroupe en pur TypeScript (`lib/passeport.ts`) et affiche trois écrans dans la zone `compte`. `get_profil_explorateur` gagne `nbVisites` ; sa liste `visites` est retirée **après** le déploiement (migration séparée), car le bundle en prod la lit encore.

**Tech Stack:** React 19, TypeScript strict, TanStack Query 5, react-router 7, CSS modules + stylelint (tokens), Vitest + Testing Library, Supabase Postgres (plpgsql).

**Spec:** `docs/superpowers/specs/2026-10-07-v2-passeport-design.md`

## Global Constraints

- TS strict : pas de `any`, `@ts-ignore`, `as unknown as`. Aucun `console.log`.
- En-tête de fichier `QUOI` / `POURQUOI` (/ `ATTENTION` si utile), en français, comme les fichiers voisins.
- Une zone n'importe jamais une autre zone ni `app/` ; le passeport vit dans `features/compte/`. Les composants n'appellent jamais Supabase (seulement `api/`).
- ≤ 400 lignes par fichier ; CSS : tokens de `shared/styles/tokens.css` seulement (stylelint), `font-weight: var(--weight-…)`.
- Textes d'interface en français, apostrophe typographique `’`.
- Migrations : en tête `-- WHY:` et `-- SCHEMA CHECKED`, pas de BEGIN/COMMIT ; tout `CREATE OR REPLACE` part de la définition **live** (`pg_get_functiondef`) ; appliquées **par le contrôleur seulement** avec `npx supabase db push --linked` ; vérification en prod dans une transaction annulée.
- JSON de la base : clés en camelCase (`nbVisites`, `imageUrl`, `auJour`). La spec écrit `nb_visites` : c'est `nbVisites` dans le JSON, comme les autres clés du profil.
- Un tampon = un lieu visité ; date = **première** visite, jour de Paris (`AT TIME ZONE 'Europe/Paris'`) ; pour un autre que soi : le 1er du mois.
- Paliers d'encre : 1 → `pale`, 2–9 → `moyen`, 10+ → `fort`.

## Review Focus

1. Un lieu visité plusieurs fois → un seul tampon, daté de la première visite (test SQL Task 1, test `lib` Task 3).
2. Profil d'un autre → aucune date au jour ne sort de la base ; aucune pastille du jour à l'écran (vérif SQL Task 1, test composant Task 7).
3. Lieu sans département ni pays → page « Ailleurs », atteignable par son URL (test `lib` Task 3, test Task 7).
4. Nom de territoire avec espace/apostrophe/accent (« Côtes-d’Armor », « Royaume-Uni ») → l'URL encodée rouvre la bonne page (test Task 7).
5. Profil déjà en cache sans `nbVisites` (ancien format persistant) ou passeport `null` (Explorateur désactivé) → pas d'écran cassé (test `lirePasseport` Task 2, test Task 5).

---

### Task 1 : migration 431 — `get_passeport` et `nbVisites` (contrôleur)

**Files:**
- Create: `supabase/migrations/431_passeport.sql`
- Modify: `apps/web-v2/src/shared/supabase/database.types.ts` (régénéré)

**Interfaces:**
- Produces: RPC `get_passeport(p_user_id text) → json | null` :
  `{ auJour: boolean, natures: {id,nom,icone,couleur}[], tampons: {id,nom,imageUrl,nature,departement,pays,quand}[] }` ; `get_profil_explorateur` gagne `nbVisites: integer` (garde `visites`).

- [ ] **Step 1 : vérifier le schéma et la définition live**

```bash
npx supabase db query --linked "select column_name, data_type from information_schema.columns where table_name in ('place_explorers','tags','place_tags') and column_name in ('visited_at','user_id','place_id','id','title','icon','color','order','tag_id','is_primary') order by table_name"
npx supabase db query --linked "select count(*), string_agg(title, ', ' order by \"order\") from tags"
npx supabase db query --linked "select pg_get_functiondef('public.get_profil_explorateur(text)'::regprocedure)"
```

Attendu : `visited_at` timestamptz ; `tags."order"` existe ; 22 natures (sinon : s'arrêter, demander à Uriel lesquelles exclure). La définition live doit être identique à `426_profil_visites_avec_ajouts.sql` (sinon partir de la live).

- [ ] **Step 2 : écrire la migration**

`431_passeport.sql` :

```sql
-- WHY: Le passeport remplace « Visités » sur le profil V2 (spec 2026-10-07-v2-passeport-design).
--      get_passeport : toutes les natures + un tampon par lieu visité (première visite).
--      Vie privée (Uriel, 07/10) : le jour exact pour soi seulement, le 1er du mois pour les autres
--      — la coupe se fait ici, le jour ne sort jamais de la base pour un autre.
--      get_profil_explorateur : + nbVisites (le chiffre du profil). `visites` reste jusqu'au
--      déploiement du nouveau front (la 1.1.0 en prod la lit) ; une migration suivante la retire.
-- SCHEMA CHECKED: place_explorers(user_id, place_id, visited_at timestamptz), places(departement,
--      pays, images, masked, private), tags(id, title, icon, color, "order"),
--      place_tags(place_id, tag_id, is_primary) — information_schema, 07/10/2026.

CREATE OR REPLACE FUNCTION public.get_passeport(p_user_id text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND is_active IS NOT FALSE) THEN
    RETURN NULL;
  END IF;
  v_moi := COALESCE((auth.uid())::text = p_user_id, false);

  RETURN (
    WITH premieres AS (
      SELECT e.place_id, min(e.visited_at) AS premiere
        FROM public.place_explorers e JOIN public.places p ON p.id = e.place_id
       WHERE e.user_id = p_user_id
         AND (v_moi OR (p.masked IS NOT TRUE AND p.private IS NOT TRUE))
       GROUP BY e.place_id
    )
    SELECT json_build_object(
      'auJour', v_moi,
      'natures', COALESCE((
        SELECT json_agg(json_build_object('id', t.id, 'nom', t.title, 'icone', t.icon, 'couleur', t.color)
                        ORDER BY t."order", t.title)
          FROM public.tags t), '[]'::json),
      'tampons', COALESCE((
        SELECT json_agg(json_build_object(
                 'id', p.id,
                 'nom', p.title,
                 'imageUrl', p.images -> 0 ->> 'url',
                 'nature', (SELECT pt.tag_id FROM public.place_tags pt
                             WHERE pt.place_id = p.id AND pt.is_primary LIMIT 1),
                 'departement', p.departement,
                 'pays', p.pays,
                 'quand', to_char(
                   CASE WHEN v_moi THEN (pr.premiere AT TIME ZONE 'Europe/Paris')
                        ELSE date_trunc('month', pr.premiere AT TIME ZONE 'Europe/Paris') END,
                   'YYYY-MM-DD'))
               ORDER BY pr.premiere DESC)
          FROM premieres pr JOIN public.places p ON p.id = pr.place_id), '[]'::json)
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_passeport(text) TO anon, authenticated;
```

Puis, à la suite, `CREATE OR REPLACE FUNCTION public.get_profil_explorateur` **copiée entière depuis la live** (Step 1), avec un seul delta : ajouter après la ligne `'visites', …` :

```sql
      'nbVisites', (SELECT count(*) FROM visites),
```

Ajouter dans l'en-tête `-- WHY:` : « get_profil_explorateur : delta unique sur la live (= 426) : + nbVisites. »

- [ ] **Step 3 : appliquer (contrôleur)**

```bash
npx supabase db push --linked
```

- [ ] **Step 4 : vérifier en prod, sans rien écrire**

Dans une transaction annulée (`begin; … rollback;`), avec Uriel (`id` commençant par `cb16ff47`, lire l'id complet dans `users`) puis avec un autre utilisateur actif :

```sql
begin;
select set_config('request.jwt.claims', json_build_object('sub', '<id Uriel>', 'role', 'authenticated')::text, true);
set local role authenticated;
select json_array_length(get_passeport('<id Uriel>')->'tampons') as n,
       get_passeport('<id Uriel>')->'auJour' as au_jour,
       get_passeport('<id Uriel>')->'tampons'->0 as premier,
       (get_profil_explorateur('<id Uriel>')->>'nbVisites')::int as nb,
       json_array_length(get_profil_explorateur('<id Uriel>')->'visites') as nb_liste;
rollback;
```

Attendu (Uriel) : `n = nb = nb_liste` ; `au_jour = true` ; `quand` au jour. Puis même requête avec `sub` = l'autre utilisateur, en lisant le passeport **d'Uriel** : `au_jour = false`, chaque `quand` se termine par `-01`, aucun lieu privé/masqué d'Uriel. Vérifier aussi qu'un lieu visité deux fois n'apparaît qu'une fois (`select place_id from place_explorers where user_id = '<id Uriel>' group by 1 having count(*) > 1 limit 1`, puis le chercher dans `tampons`).

- [ ] **Step 5 : régénérer les types et committer**

```bash
cd apps/web-v2 && pnpm gen:types && cd ../..
git add supabase/migrations/431_passeport.sql apps/web-v2/src/shared/supabase/database.types.ts
git commit -m "feat(passeport): get_passeport et nbVisites (migration 431)"
```

Attendu dans les types : `get_passeport: { Args: { p_user_id: string }; Returns: Json }`.

---

### Task 2 : lecture du passeport — `api`, `lirePasseport`, `usePasseport`

**Files:**
- Create: `apps/web-v2/src/features/compte/api/lirePasseport.ts`
- Create: `apps/web-v2/src/features/compte/api/passeport.ts`
- Create: `apps/web-v2/src/features/compte/hooks/usePasseport.ts`
- Test: `apps/web-v2/src/features/compte/api/lirePasseport.test.ts`

**Interfaces:**
- Consumes: RPC `get_passeport` (Task 1).
- Produces:
  ```ts
  export type Nature = { id: string; nom: string; icone: string; couleur: string }
  export type Tampon = { id: string; nom: string; imageUrl: string | null; nature: string | null;
                         departement: string | null; pays: string | null; quand: string }
  export type Passeport = { auJour: boolean; natures: Nature[]; tampons: Tampon[] }
  export function lirePasseport(json: unknown): Passeport | null
  export async function fetchPasseport(id: string): Promise<Passeport | null>
  export function passeportKey(id: string): string[]   // ['passeport', id]
  export function usePasseport(id: string): { passeport: Passeport | null | undefined; erreur: boolean; reessayer: () => void }
  ```

- [ ] **Step 1 : écrire le test**

```ts
/**
 * QUOI     — la lecture du passeport renvoyé par get_passeport.
 * POURQUOI — un tampon illisible est écarté (le reste s'affiche) ; un passeport illisible ou
 *            `null` (Explorateur désactivé) devient `null`.
 */
import { expect, test } from 'vitest'
import { lirePasseport } from './lirePasseport'

const NATURE = { id: 'chateau', nom: 'Châteaux', icone: 'https://x/c.svg', couleur: '#a9260f' }
const TAMPON = {
  id: 'p1',
  nom: 'Château de Gourdon',
  imageUrl: 'https://x/g.webp',
  nature: 'chateau',
  departement: 'Alpes-Maritimes',
  pays: 'France',
  quand: '2026-10-02',
}

test('un passeport complet', () => {
  expect(lirePasseport({ auJour: true, natures: [NATURE], tampons: [TAMPON] })).toEqual({
    auJour: true,
    natures: [NATURE],
    tampons: [TAMPON],
  })
})

test('les champs facultatifs à null', () => {
  const t = { ...TAMPON, imageUrl: null, nature: null, departement: null, pays: null }
  expect(lirePasseport({ auJour: false, natures: [], tampons: [t] })?.tampons).toEqual([t])
})

test('un tampon illisible est écarté, pas le passeport', () => {
  const p = lirePasseport({ auJour: true, natures: [NATURE], tampons: [{ id: 3 }, TAMPON] })
  expect(p?.tampons).toEqual([TAMPON])
})

test('une date mal formée écarte le tampon', () => {
  const p = lirePasseport({ auJour: true, natures: [], tampons: [{ ...TAMPON, quand: 'hier' }] })
  expect(p?.tampons).toEqual([])
})

test('null ou illisible → null', () => {
  expect(lirePasseport(null)).toBeNull()
  expect(lirePasseport({ natures: [], tampons: [] })).toBeNull()
  expect(lirePasseport('x')).toBeNull()
})
```

- [ ] **Step 2 : lancer, voir échouer**

Run: `cd apps/web-v2 && pnpm test src/features/compte/api/lirePasseport.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : implémenter**

`lirePasseport.ts` :

```ts
/**
 * QUOI     — la forme du passeport d'un Explorateur, et sa lecture depuis le JSON de la base.
 * POURQUOI — `get_passeport` (migration 431) renvoie toutes les natures et un tampon par lieu
 *            visité. Un tampon illisible est écarté plutôt que de faire tomber le passeport.
 * ATTENTION — `quand` est « AAAA-MM-JJ » ; pour le profil d'un autre, c'est le 1er du mois
 *            (`auJour` faux) : le jour exact ne quitte jamais la base.
 */
import { booleen, chaine, liste, objet, ouNull } from '@/shared/lib/lire'

export type Nature = { id: string; nom: string; icone: string; couleur: string }
export type Tampon = {
  id: string
  nom: string
  imageUrl: string | null
  nature: string | null
  departement: string | null
  pays: string | null
  quand: string
}
export type Passeport = { auJour: boolean; natures: Nature[]; tampons: Tampon[] }

const DATE = /^\d{4}-\d{2}-\d{2}$/

function nature(v: unknown): Nature {
  const o = objet(v)
  return { id: chaine(o.id), nom: chaine(o.nom), icone: chaine(o.icone), couleur: chaine(o.couleur) }
}

function tampon(v: unknown): Tampon | null {
  try {
    const o = objet(v)
    const quand = chaine(o.quand)
    if (!DATE.test(quand)) return null
    return {
      id: chaine(o.id),
      nom: chaine(o.nom),
      imageUrl: ouNull(chaine)(o.imageUrl),
      nature: ouNull(chaine)(o.nature),
      departement: ouNull(chaine)(o.departement),
      pays: ouNull(chaine)(o.pays),
      quand,
    }
  } catch {
    return null
  }
}

export function lirePasseport(json: unknown): Passeport | null {
  if (json === null) return null
  try {
    const o = objet(json)
    return {
      auJour: booleen(o.auJour),
      natures: liste(nature)(o.natures),
      tampons: liste(tampon)(o.tampons).filter((t): t is Tampon => t !== null),
    }
  } catch {
    return null
  }
}
```

`passeport.ts` :

```ts
/**
 * QUOI     — charge le passeport d'un Explorateur.
 * POURQUOI — une seule lecture (`get_passeport`, migration 431) : les trois pages du passeport
 *            se calculent ensuite dans le navigateur, sans autre appel.
 */
import { supabase } from '@/shared/supabase/client'
import { lirePasseport, type Passeport } from './lirePasseport'

export async function fetchPasseport(id: string): Promise<Passeport | null> {
  const { data, error } = await supabase.rpc('get_passeport', { p_user_id: id })
  if (error) throw error
  return lirePasseport(data)
}
```

`usePasseport.ts` :

```ts
/**
 * QUOI     — le passeport d'un Explorateur, depuis le cache ou la base.
 * POURQUOI — `undefined` pendant le chargement, `null` si l'Explorateur est introuvable : les
 *            écrans distinguent les deux, comme pour le profil.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchPasseport } from '../api/passeport'
import type { Passeport } from '../api/lirePasseport'

export function passeportKey(id: string) {
  return ['passeport', id]
}

export function usePasseport(id: string): {
  passeport: Passeport | null | undefined
  erreur: boolean
  reessayer: () => void
} {
  const query = useQuery({ queryKey: passeportKey(id), queryFn: () => fetchPasseport(id) })
  return {
    passeport: query.data,
    erreur: query.isError,
    reessayer: () => {
      void query.refetch()
    },
  }
}
```

- [ ] **Step 4 : lancer, voir passer**

Run: `cd apps/web-v2 && pnpm test src/features/compte/api/lirePasseport.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add apps/web-v2/src/features/compte/api/lirePasseport.ts apps/web-v2/src/features/compte/api/lirePasseport.test.ts apps/web-v2/src/features/compte/api/passeport.ts apps/web-v2/src/features/compte/hooks/usePasseport.ts
git commit -m "feat(passeport): lecture du passeport"
```

---

### Task 3 : les regroupements — `lib/passeport.ts`

**Files:**
- Create: `apps/web-v2/src/features/compte/lib/passeport.ts`
- Test: `apps/web-v2/src/features/compte/lib/passeport.test.ts`

**Interfaces:**
- Consumes: `Nature`, `Tampon`, `Passeport` (Task 2).
- Produces:
  ```ts
  export type Encre = 'pale' | 'moyen' | 'fort'
  export type ParNature = { nature: Nature; compte: number; encre: Encre | null } // encre null = jamais visitée
  export type Territoire = { nom: string; tampons: Tampon[] }   // tampons du plus récent au plus ancien
  export type Mois = { cle: string; tampons: Tampon[] }         // cle « AAAA-MM »
  export const AILLEURS = 'Ailleurs'
  export function encre(compte: number): Encre
  export function parNature(natures: Nature[], tampons: Tampon[]): ParNature[] // toutes les natures, ordre reçu
  export function territoireDe(t: Tampon): string                             // departement ?? pays ?? AILLEURS
  export function parTerritoire(tampons: Tampon[]): Territoire[]              // le plus récemment tamponné d'abord
  export function parMois(tampons: Tampon[]): Mois[]                          // le plus récent d'abord
  export function comptes(tampons: Tampon[]): { departements: number; pays: number }
  export function enDate(quand: string): Date                                 // date locale, sans décalage de fuseau
  ```

- [ ] **Step 1 : écrire le test**

```ts
/**
 * QUOI     — les regroupements du passeport : par nature, par territoire, par mois.
 */
import { expect, test } from 'vitest'
import type { Nature, Tampon } from '../api/lirePasseport'
import { AILLEURS, comptes, encre, enDate, parMois, parNature, parTerritoire, territoireDe } from './passeport'

const N = (id: string): Nature => ({ id, nom: id, icone: `https://x/${id}.svg`, couleur: '#000000' })
const T = (id: string, quand: string, o: Partial<Tampon> = {}): Tampon => ({
  id,
  nom: id,
  imageUrl: null,
  nature: 'chateau',
  departement: 'Alpes-Maritimes',
  pays: 'France',
  quand,
  ...o,
})

test('encre : 1 pâle, 2 à 9 moyen, 10 et plus fort', () => {
  expect([1, 2, 9, 10, 42].map(encre)).toEqual(['pale', 'moyen', 'moyen', 'fort', 'fort'])
})

test('par nature : toutes les natures, comptées, jamais visitées sans encre', () => {
  const r = parNature([N('chateau'), N('source')], [T('a', '2026-10-01'), T('b', '2026-09-01')])
  expect(r.map((x) => [x.nature.id, x.compte, x.encre])).toEqual([
    ['chateau', 2, 'moyen'],
    ['source', 0, null],
  ])
})

test('par nature : un tampon sans nature ne compte nulle part', () => {
  expect(parNature([N('chateau')], [T('a', '2026-10-01', { nature: null })])[0]?.compte).toBe(0)
})

test('territoire : département, sinon pays, sinon Ailleurs', () => {
  expect(territoireDe(T('a', '2026-10-01'))).toBe('Alpes-Maritimes')
  expect(territoireDe(T('a', '2026-10-01', { departement: null, pays: 'Italie' }))).toBe('Italie')
  expect(territoireDe(T('a', '2026-10-01', { departement: null, pays: null }))).toBe(AILLEURS)
})

test('par territoire : le plus récemment tamponné d’abord, tampons récents d’abord', () => {
  const r = parTerritoire([
    T('a', '2026-10-06'),
    T('b', '2026-10-01', { departement: null, pays: 'Italie' }),
    T('c', '2026-09-01'),
  ])
  expect(r.map((t) => [t.nom, t.tampons.map((x) => x.id)])).toEqual([
    ['Alpes-Maritimes', ['a', 'c']],
    ['Italie', ['b']],
  ])
})

test('par mois : le plus récent d’abord', () => {
  const r = parMois([T('a', '2026-10-06'), T('b', '2026-09-28'), T('c', '2026-10-01')])
  expect(r.map((m) => [m.cle, m.tampons.map((x) => x.id)])).toEqual([
    ['2026-10', ['a', 'c']],
    ['2026-09', ['b']],
  ])
})

test('comptes : départements distincts, pays distincts (France comprise)', () => {
  expect(
    comptes([
      T('a', '2026-10-01'),
      T('b', '2026-10-01', { departement: 'Var' }),
      T('c', '2026-10-01', { departement: null, pays: 'Italie' }),
      T('d', '2026-10-01', { departement: null, pays: null }),
    ]),
  ).toEqual({ departements: 2, pays: 2 })
})

test('enDate : le jour donné, sans décalage de fuseau', () => {
  const d = enDate('2026-10-01')
  expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 1])
})
```

- [ ] **Step 2 : lancer, voir échouer**

Run: `cd apps/web-v2 && pnpm test src/features/compte/lib/passeport.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : implémenter**

```ts
/**
 * QUOI     — les regroupements du passeport : par nature (page 1), par territoire (page 2),
 *            par mois (page 3), et les comptes « N départements · N pays ».
 * POURQUOI — la base renvoie une liste plate (migration 431) ; tout le reste se calcule ici, en
 *            pur, pour que les trois pages s'ouvrent sans nouvel appel.
 * ATTENTION — les tampons arrivent du plus récent au plus ancien ; chaque regroupement garde
 *            cet ordre. Une date « AAAA-MM-JJ » se lit en date locale (`enDate`) : `new Date`
 *            sur la chaîne la lirait en UTC et reculerait d'un jour à l'ouest.
 */
import type { Nature, Tampon } from '../api/lirePasseport'

export type Encre = 'pale' | 'moyen' | 'fort'
export type ParNature = { nature: Nature; compte: number; encre: Encre | null }
export type Territoire = { nom: string; tampons: Tampon[] }
export type Mois = { cle: string; tampons: Tampon[] }

export const AILLEURS = 'Ailleurs'

export function encre(compte: number): Encre {
  if (compte >= 10) return 'fort'
  if (compte >= 2) return 'moyen'
  return 'pale'
}

export function parNature(natures: Nature[], tampons: Tampon[]): ParNature[] {
  return natures.map((nature) => {
    const compte = tampons.filter((t) => t.nature === nature.id).length
    return { nature, compte, encre: compte === 0 ? null : encre(compte) }
  })
}

export function territoireDe(t: Tampon): string {
  return t.departement ?? t.pays ?? AILLEURS
}

function grouper(tampons: Tampon[], cle: (t: Tampon) => string): Map<string, Tampon[]> {
  const groupes = new Map<string, Tampon[]>()
  for (const t of tampons) groupes.set(cle(t), [...(groupes.get(cle(t)) ?? []), t])
  return groupes
}

export function parTerritoire(tampons: Tampon[]): Territoire[] {
  return [...grouper(tampons, territoireDe)].map(([nom, liste]) => ({ nom, tampons: liste }))
}

export function parMois(tampons: Tampon[]): Mois[] {
  return [...grouper(tampons, (t) => t.quand.slice(0, 7))].map(([cle, liste]) => ({
    cle,
    tampons: liste,
  }))
}

export function comptes(tampons: Tampon[]): { departements: number; pays: number } {
  const distincts = (valeurs: (string | null)[]) => new Set(valeurs.filter((v) => v !== null)).size
  return {
    departements: distincts(tampons.map((t) => t.departement)),
    pays: distincts(tampons.map((t) => t.pays)),
  }
}

export function enDate(quand: string): Date {
  const [annee = 0, mois = 1, jour = 1] = quand.split('-').map(Number)
  return new Date(annee, mois - 1, jour)
}
```

- [ ] **Step 4 : lancer, voir passer**

Run: `cd apps/web-v2 && pnpm test src/features/compte/lib/passeport.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add apps/web-v2/src/features/compte/lib/passeport.ts apps/web-v2/src/features/compte/lib/passeport.test.ts
git commit -m "feat(passeport): regroupements par nature, territoire et mois"
```

---

### Task 4 : les tampons — `TamponNature` et `TamponPhoto`

**Files:**
- Create: `apps/web-v2/src/features/compte/components/passeport/TamponNature.tsx` + `.module.css`
- Create: `apps/web-v2/src/features/compte/components/passeport/TamponPhoto.tsx` + `.module.css`
- Create: `apps/web-v2/src/features/compte/lib/dates.ts` (formats de date du passeport)
- Test: `apps/web-v2/src/features/compte/components/passeport/Tampons.test.tsx`, `apps/web-v2/src/features/compte/lib/dates.test.ts`

**Interfaces:**
- Consumes: `Nature`, `Tampon` (Task 2), `Encre`, `enDate` (Task 3).
- Produces:
  ```ts
  // TamponNature : le tampon rond d'une nature ; `encre` null = jamais visitée (pointillés).
  export function TamponNature(props: { nature: Nature; compte: number; encre: Encre | null; taille?: 'normal' | 'petit' }): JSX.Element
  // TamponPhoto : la photo encrée bichrome dans un disque, cerclée en pointillés, avec sa date.
  export function TamponPhoto(props: { tampon: Tampon; nature: Nature | null; date: string }): JSX.Element
  // dates.ts
  export function dateCourte(quand: string, auJour: boolean): string   // « 6 oct. » ou « oct. 2026 »
  export function moisLong(cle: string): string                       // « 2026-10 » → « octobre 2026 »
  export function depuis(quand: string, auJour: boolean): string      // « depuis le 12 juin 2025 » ou « depuis juin 2025 »
  ```

- [ ] **Step 1 : écrire les tests**

`dates.test.ts` :

```ts
/**
 * QUOI     — les dates du passeport : au jour pour soi, au mois pour les autres.
 */
import { expect, test } from 'vitest'
import { dateCourte, depuis, moisLong } from './dates'

test('date courte', () => {
  expect(dateCourte('2026-10-06', true)).toBe('6 oct.')
  expect(dateCourte('2026-10-01', false)).toBe('oct. 2026')
})

test('mois long', () => {
  expect(moisLong('2026-09')).toBe('septembre 2026')
})

test('depuis', () => {
  expect(depuis('2025-06-12', true)).toBe('depuis le 12 juin 2025')
  expect(depuis('2025-06-01', false)).toBe('depuis juin 2025')
})
```

`Tampons.test.tsx` :

```tsx
/**
 * QUOI     — les deux tampons : nature (compte, encre, pointillés) et photo encrée (date, repli sans photo).
 */
import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { TamponNature } from './TamponNature'
import { TamponPhoto } from './TamponPhoto'

const NATURE = { id: 'chateau', nom: 'Châteaux', icone: 'https://x/c.svg', couleur: '#a9260f' }
const TAMPON = {
  id: 'p1',
  nom: 'Château de Gourdon',
  imageUrl: 'https://x/storage/v1/object/public/p/g.webp',
  nature: 'chateau',
  departement: 'Alpes-Maritimes',
  pays: 'France',
  quand: '2026-10-02',
}

test('un tampon de nature visitée : son compte et son encre', () => {
  render(<TamponNature nature={NATURE} compte={18} encre="fort" />)
  const t = screen.getByRole('img', { name: 'Châteaux : 18 lieux' })
  expect(t).toHaveAttribute('data-encre', 'fort')
  expect(screen.getByText('×18')).toBeInTheDocument()
})

test('une nature jamais visitée : en pointillés, sans compte', () => {
  render(<TamponNature nature={NATURE} compte={0} encre={null} />)
  expect(screen.getByRole('img', { name: 'Châteaux : pas encore' })).toHaveAttribute('data-absent')
  expect(screen.queryByText(/×/)).not.toBeInTheDocument()
})

test('un tampon photo : la photo, la date, le nom pour le lecteur d’écran', () => {
  render(<TamponPhoto tampon={TAMPON} nature={NATURE} date="2 oct." />)
  expect(screen.getByRole('img', { name: 'Château de Gourdon, 2 oct.' })).toBeInTheDocument()
  expect(screen.getByText('2 oct.')).toBeInTheDocument()
})

test('sans photo : le disque de la nature', () => {
  const { container } = render(
    <TamponPhoto tampon={{ ...TAMPON, imageUrl: null }} nature={NATURE} date="2 oct." />,
  )
  expect(container.querySelector('img')).toBeNull()
})
```

- [ ] **Step 2 : lancer, voir échouer**

Run: `cd apps/web-v2 && pnpm test src/features/compte/lib/dates.test.ts src/features/compte/components/passeport/Tampons.test.tsx`
Expected: FAIL (modules introuvables).

- [ ] **Step 3 : implémenter**

`lib/dates.ts` :

```ts
/**
 * QUOI     — les dates du passeport, en français.
 * POURQUOI — pour soi, le jour (« 6 oct. ») ; pour un autre, la base n'envoie que le mois
 *            (migration 431) et l'écran n'affiche que lui (« oct. 2026 »).
 */
import { enDate } from './passeport'

const COURTE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const MOIS_COURT = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric' })
const MOIS_LONG = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
const LONGUE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

export function dateCourte(quand: string, auJour: boolean): string {
  return (auJour ? COURTE : MOIS_COURT).format(enDate(quand))
}

export function moisLong(cle: string): string {
  return MOIS_LONG.format(enDate(`${cle}-01`))
}

export function depuis(quand: string, auJour: boolean): string {
  return auJour ? `depuis le ${LONGUE.format(enDate(quand))}` : `depuis ${moisLong(quand.slice(0, 7))}`
}
```

`TamponNature.tsx` :

```tsx
/**
 * QUOI     — le tampon d'une nature : deux cercles et l'icône à sa couleur, le compte « ×N »
 *            (maquette « Passeport — 1 », 432:272).
 * POURQUOI — l'encre fonce à mesure qu'une nature se répète ; une nature jamais visitée reste
 *            en pointillés, sans couleur : ce qui manque se voit aussi.
 */
import type { Nature } from '../../api/lirePasseport'
import type { Encre } from '../../lib/passeport'
import styles from './TamponNature.module.css'

export function TamponNature({
  nature,
  compte,
  encre,
  taille = 'normal',
}: {
  nature: Nature
  compte: number
  encre: Encre | null
  taille?: 'normal' | 'petit'
}) {
  const libelle =
    encre === null ? `${nature.nom} : pas encore` : `${nature.nom} : ${compte} ${compte > 1 ? 'lieux' : 'lieu'}`
  return (
    <span
      className={styles.tampon}
      role="img"
      aria-label={libelle}
      data-encre={encre ?? undefined}
      data-absent={encre === null ? '' : undefined}
      data-taille={taille}
      style={{ '--couleur': nature.couleur, '--icone': `url(${nature.icone})` }}
    >
      <span className={styles.icone} aria-hidden="true" />
      {encre !== null && (
        <span className={styles.compte} aria-hidden="true">
          ×{compte}
        </span>
      )}
    </span>
  )
}
```

`TamponNature.module.css` :

```css
/*
 * QUOI     — un tampon rond de 46 px (32 px en « petit ») : cercle épais, cercle fin, icône
 *            peinte à la couleur de la nature, compte en bas. Absent : pointillés pâles.
 */
.tampon {
  position: relative;
  display: inline-grid;
  flex: none;
  place-items: center;
  width: 46px;
  height: 46px;
  border: 2px solid var(--couleur);
  border-radius: var(--radius-rond);
  box-shadow: inset 0 0 0 3px var(--color-fond), inset 0 0 0 4px var(--couleur);
  rotate: -6deg;
}

.tampon:nth-child(even) {
  rotate: 5deg;
}

.tampon[data-taille='petit'] {
  width: 32px;
  height: 32px;
}

.tampon[data-encre='pale'] {
  opacity: 0.55;
}

.tampon[data-encre='moyen'] {
  opacity: 0.8;
}

.tampon[data-absent] {
  border: 1.5px dashed var(--color-texte-pale);
  box-shadow: none;
  opacity: 0.6;
}

.icone {
  width: 45%;
  height: 45%;
  background: var(--couleur);
  mask: var(--icone) center / contain no-repeat;
}

.tampon[data-absent] .icone {
  background: var(--color-texte-pale);
}

.compte {
  position: absolute;
  bottom: -2px;
  padding: 0 3px;
  background: var(--color-fond);
  color: var(--couleur);
  font-family: var(--font-condensee);
  font-size: var(--micro-size);
  font-weight: var(--weight-gras);
  line-height: 1;
}
```

`TamponPhoto.tsx` :

```tsx
/**
 * QUOI     — la photo encrée : la photo du lieu en bichrome, à la couleur de sa nature, dans
 *            un disque cerclé de pointillés, et sa date en pastille (maquette « Passeport — 2 »).
 * POURQUOI — « J'aime bien la photo encrée » (Uriel, 06/10) : une photo, mais qui reste un
 *            tampon. Sans photo, le disque prend la couleur de la nature et son icône.
 * ATTENTION — le bichrome se fait en CSS (niveaux de gris, puis la couleur en `lighten`, puis
 *            le papier en `darken`) : `isolation: isolate` garde ces mélanges dans le disque.
 */
import { aLaTaille } from '@/shared/lib/image'
import type { Nature, Tampon } from '../../api/lirePasseport'
import styles from './TamponPhoto.module.css'

export function TamponPhoto({
  tampon,
  nature,
  date,
}: {
  tampon: Tampon
  nature: Nature | null
  date: string
}) {
  return (
    <span
      className={styles.tampon}
      role="img"
      aria-label={`${tampon.nom}, ${date}`}
      style={{
        '--couleur': nature?.couleur ?? 'var(--color-ocre)',
        '--icone': nature ? `url(${nature.icone})` : 'none',
      }}
    >
      <span className={styles.disque} aria-hidden="true">
        {tampon.imageUrl ? (
          <>
            <img
              className={styles.photo}
              src={aLaTaille(tampon.imageUrl, 96)}
              alt=""
              loading="lazy"
              decoding="async"
            />
            <span className={styles.encre} />
            <span className={styles.papier} />
          </>
        ) : (
          <span className={styles.icone} />
        )}
      </span>
      <span className={styles.date} aria-hidden="true">
        {date}
      </span>
    </span>
  )
}
```

`TamponPhoto.module.css` :

```css
/*
 * QUOI     — disque de 96 px cerclé de pointillés à la couleur de la nature ; la photo en
 *            bichrome dedans ; la date en pastille crème à cheval sur le bas.
 */
.tampon {
  position: relative;
  display: inline-block;
  flex: none;
  width: 96px;
  height: 96px;
}

.disque {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 2px dashed var(--couleur);
  border-radius: var(--radius-rond);
  background: var(--color-barre);
  isolation: isolate;
}

.photo,
.encre,
.papier {
  position: absolute;
  inset: 4px;
  width: calc(100% - 8px);
  height: calc(100% - 8px);
  border-radius: var(--radius-rond);
}

.photo {
  object-fit: cover;
  filter: grayscale(1) contrast(1.3) brightness(1.1);
}

.encre {
  background: var(--couleur);
  mix-blend-mode: lighten;
}

.papier {
  background: var(--color-barre);
  mix-blend-mode: darken;
}

.icone {
  width: 40%;
  height: 40%;
  background: var(--couleur);
  mask: var(--icone) center / contain no-repeat;
}

.date {
  position: absolute;
  bottom: -6px;
  left: 50%;
  padding: 1px var(--space-2);
  border: 1px solid var(--couleur);
  border-radius: var(--radius-rond);
  background: var(--color-fond);
  color: var(--couleur);
  font-family: var(--font-condensee);
  font-size: var(--meta-size);
  font-weight: var(--weight-gras);
  white-space: nowrap;
  translate: -50% 0;
}
```

Si `style={{ '--couleur': … }}` refuse de compiler : regarder comment `LieuCarte.tsx` passe `'--icone'` (une augmentation de `CSSProperties` existe déjà dans le projet) et faire pareil.

- [ ] **Step 4 : lancer, voir passer**

Run: `cd apps/web-v2 && pnpm test src/features/compte && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add apps/web-v2/src/features/compte/components/passeport apps/web-v2/src/features/compte/lib/dates.ts apps/web-v2/src/features/compte/lib/dates.test.ts
git commit -m "feat(passeport): tampons de nature et photos encrées"
```

---

### Task 5 : page 1 — le passeport sur le profil ; `nbVisites`

**Files:**
- Create: `apps/web-v2/src/features/compte/components/passeport/PasseportProfil.tsx` + `.module.css`
- Modify: `apps/web-v2/src/features/compte/components/ProfilDecouvertes.tsx` (Visités → PasseportProfil)
- Modify: `apps/web-v2/src/features/compte/components/ProfilChiffres.tsx:16` (`profil.nbVisites`)
- Modify: `apps/web-v2/src/features/compte/api/lireProfil.ts` (retirer `visites`, ajouter `nbVisites`)
- Modify tests: `apps/web-v2/src/features/compte/api/lireProfil.test.ts`, `apps/web-v2/src/features/compte/components/ProfilExplorateur.test.tsx`
- Test: `apps/web-v2/src/features/compte/components/passeport/PasseportProfil.test.tsx`

**Interfaces:**
- Consumes: `usePasseport` (Task 2), `parNature`, `comptes` (Task 3), `TamponNature` (Task 4).
- Produces: `export function PasseportProfil({ id }: { id: string }): JSX.Element | null` ; lien « Ouvrir le passeport › » vers `/${tab}/explorateur/${id}/passeport`. `ExplorateurProfile.nbVisites: number` (et plus de `visites`).

- [ ] **Step 1 : écrire le test de la page 1**

```tsx
/**
 * QUOI     — le passeport sur le profil : un tampon par nature, les comptes, le lien d'ouverture.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Passeport } from '../../api/lirePasseport'
import { PasseportProfil } from './PasseportProfil'

const api = vi.hoisted(() => ({ fetchPasseport: vi.fn() }))
vi.mock('../../api/passeport', () => api)

const N = (id: string, nom: string) => ({ id, nom, icone: `https://x/${id}.svg`, couleur: '#a9260f' })
const T = (id: string, o: Record<string, unknown> = {}) => ({
  id,
  nom: id,
  imageUrl: null,
  nature: 'chateau',
  departement: 'Alpes-Maritimes',
  pays: 'France',
  quand: '2026-10-01',
  ...o,
})

const PASSEPORT: Passeport = {
  auJour: true,
  natures: [N('chateau', 'Châteaux'), N('source', 'Sources')],
  tampons: [T('a'), T('b', { departement: 'Var' }), T('c', { departement: null, pays: 'Italie' })],
}

beforeEach(() => {
  api.fetchPasseport.mockResolvedValue(PASSEPORT)
})

function afficher() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/compte/explorateur/u1']}>
        <Routes>
          <Route path="/:tab/explorateur/:id" element={<PasseportProfil id="u1" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('un tampon par nature, les manquantes en pointillés', async () => {
  afficher()
  expect(await screen.findByRole('img', { name: 'Châteaux : 3 lieux' })).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Sources : pas encore' })).toBeInTheDocument()
})

test('le titre, les comptes et le lien d’ouverture', async () => {
  afficher()
  expect(await screen.findByRole('heading', { name: /Passeport\s*3/ })).toBeInTheDocument()
  expect(screen.getByText('2 départements · 2 pays')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Ouvrir le passeport ›' })).toHaveAttribute(
    'href',
    '/compte/explorateur/u1/passeport',
  )
})

test('un compte nul ne s’affiche pas', async () => {
  api.fetchPasseport.mockResolvedValue({ ...PASSEPORT, tampons: [T('c', { departement: null, pays: 'Italie' })] })
  afficher()
  expect(await screen.findByText('1 pays')).toBeInTheDocument()
  expect(screen.queryByText(/département/)).not.toBeInTheDocument()
})

test('zéro tampon ou passeport introuvable : pas de section', async () => {
  api.fetchPasseport.mockResolvedValue({ ...PASSEPORT, tampons: [] })
  afficher()
  await vi.waitFor(() => expect(api.fetchPasseport).toHaveBeenCalled())
  expect(screen.queryByRole('heading', { name: /Passeport/ })).not.toBeInTheDocument()
})

test('erreur : une ligne et Réessayer', async () => {
  api.fetchPasseport.mockRejectedValue(new Error('réseau'))
  afficher()
  expect(await screen.findByText('Le passeport n’a pas pu s’ouvrir.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
})
```

- [ ] **Step 2 : lancer, voir échouer**

Run: `cd apps/web-v2 && pnpm test src/features/compte/components/passeport/PasseportProfil.test.tsx`
Expected: FAIL (module introuvable).

- [ ] **Step 3 : implémenter la page 1**

`PasseportProfil.tsx` :

```tsx
/**
 * QUOI     — le passeport sur le profil (maquette « Passeport — 1 », 432:272) : un tampon par
 *            nature avec son compte, « N départements · N pays », « Ouvrir le passeport ».
 * POURQUOI — remplace la rangée « Visités » : à 200 lieux, une rangée de cartes ne disait plus
 *            rien ; 22 tampons au plus disent tout, à 5 comme à 300 lieux.
 *            Zéro tampon : la section n'existe pas (comme l'ancienne).
 */
import { Link, useParams } from 'react-router'
import { usePasseport } from '../../hooks/usePasseport'
import { comptes, parNature } from '../../lib/passeport'
import { TamponNature } from './TamponNature'
import styles from './PasseportProfil.module.css'

function accorder(n: number, un: string, plusieurs: string): string {
  return `${n} ${n > 1 ? plusieurs : un}`
}

export function PasseportProfil({ id }: { id: string }) {
  const { tab = 'compte' } = useParams()
  const { passeport, erreur, reessayer } = usePasseport(id)

  if (erreur) {
    return (
      <section className={styles.section} aria-label="Passeport">
        <p className={styles.erreur}>Le passeport n’a pas pu s’ouvrir.</p>
        <button type="button" className={styles.reessayer} onClick={reessayer}>
          Réessayer
        </button>
      </section>
    )
  }
  if (passeport === undefined) return <div className={styles.squelette} aria-hidden="true" />
  if (passeport === null || passeport.tampons.length === 0) return null

  const { departements, pays } = comptes(passeport.tampons)
  const lieux = [
    departements > 0 ? accorder(departements, 'département', 'départements') : null,
    pays > 0 ? `${pays} pays` : null,
  ].filter((x) => x !== null)

  return (
    <section className={styles.section} aria-label="Passeport">
      <h2 className={styles.titre}>
        Passeport <span className={styles.nombre}>{passeport.tampons.length}</span>
      </h2>
      <div className={styles.page}>
        {parNature(passeport.natures, passeport.tampons).map((n) => (
          <TamponNature key={n.nature.id} nature={n.nature} compte={n.compte} encre={n.encre} />
        ))}
      </div>
      <p className={styles.pied}>
        <span>{lieux.join(' · ')}</span>
        <Link className={styles.ouvrir} to={`/${tab}/explorateur/${id}/passeport`}>
          Ouvrir le passeport ›
        </Link>
      </p>
    </section>
  )
}
```

`PasseportProfil.module.css` :

```css
/*
 * QUOI     — la section passeport du profil : titre comme les autres sections, une page de
 *            papier réglé où les tampons s'alignent, puis les comptes et le lien.
 */
.section {
  display: grid;
  gap: var(--space-3);
  padding: 0 var(--space-6);
}

.titre {
  margin: 0;
  color: var(--color-encre);
  font-family: var(--font-titre);
  font-size: var(--titre-detail-size);
  font-weight: var(--weight-normal);
  letter-spacing: var(--titre-tracking);
}

.nombre {
  margin-left: var(--space-1);
  color: var(--color-texte-pale);
}

.page {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-sable);
  border-radius: var(--radius-carte);
  background:
    repeating-linear-gradient(
      to bottom,
      transparent 0 27px,
      color-mix(in srgb, var(--color-ocre) 25%, transparent) 27px 28px
    ),
    var(--color-barre);
}

.pied {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  margin: 0;
  color: var(--color-texte-doux);
  font-family: var(--font-corps);
  font-size: var(--legende-size);
}

.ouvrir {
  color: var(--color-accent);
  font-weight: var(--weight-gras);
  text-decoration: none;
}

.squelette {
  height: 180px;
  margin: 0 var(--space-6);
  border-radius: var(--radius-carte);
  background: var(--color-barre);
}

.erreur {
  margin: 0;
  color: var(--color-texte-doux);
  font-family: var(--font-corps);
  font-size: var(--legende-size);
}

.reessayer {
  justify-self: start;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-accent);
  font-family: var(--font-corps);
  font-size: var(--legende-size);
  font-weight: var(--weight-gras);
  cursor: pointer;
}
```

- [ ] **Step 4 : brancher sur le profil, remplacer `visites` par `nbVisites`**

`ProfilDecouvertes.tsx` : remplacer la ligne
`<Section titre="Visités" lieux={profil.visites} position={position} avecAuteur />`
par `<PasseportProfil id={profil.id} />` (import `./passeport/PasseportProfil`), et mettre à jour l'en-tête :
`QUOI — le bas du profil : Lieux ajoutés, le Passeport (à la place de Visités, spec 2026-10-07), Envie d'y aller.`

`lireProfil.ts` : dans le type, remplacer `visites: Lieu[]` par
`nbVisites: number // lieux distincts visités (migration 431) ; la liste vit dans le passeport` ;
dans `lireProfil`, remplacer `visites: liste(lieu)(o.visites),` par
`nbVisites: o.nbVisites === undefined ? 0 : nombre(o.nbVisites),`
(un profil en cache d'avant la 431 reste lisible). Ajouter « 431 » à la ligne `ATTENTION` des migrations suivies.

`ProfilChiffres.tsx:16` : `[profil.nbVisites, accorder(profil.nbVisites, 'Lieu visité', 'Lieux visités')],`.

Tests existants : dans `lireProfil.test.ts`, `COMPLET` remplace `visites: []` par `nbVisites: 4`, le test des visites (lignes ~83-90) devient :

```ts
test('le nombre de lieux visités ; absent (profil en cache d’avant la 431) → 0', () => {
  expect(lireProfil(COMPLET)?.nbVisites).toBe(4)
  expect(lireProfil({ ...COMPLET, nbVisites: undefined })?.nbVisites).toBe(0)
})
```

Dans `ProfilExplorateur.test.tsx`, remplacer `visites: [carte('p2', …)]` par `nbVisites: 1`, mocker le passeport comme dans `PasseportProfil.test.tsx` (`vi.mock('../api/passeport', …)` avec `fetchPasseport` résolu à `null`), et adapter les assertions qui cherchaient la section « Visités » / « Abbaye du Thoronet » : elles cherchent désormais le chiffre « 1 » « Lieu visité ».

- [ ] **Step 5 : lancer, voir passer**

Run: `cd apps/web-v2 && pnpm test src/features/compte && pnpm typecheck && pnpm lint`
Expected: PASS, aucune autre référence à `profil.visites` (`grep -rn "\.visites" src/features/compte` vide).

- [ ] **Step 6 : commit**

```bash
git add apps/web-v2/src/features/compte
git commit -m "feat(passeport): le passeport remplace Visités sur le profil"
```

---

### Task 6 : `LieuCarte` — pastille et tampon par-dessus

**Files:**
- Modify: `apps/web-v2/src/shared/ui/LieuCarte.tsx`, `apps/web-v2/src/shared/ui/LieuCarte.module.css`
- Test: `apps/web-v2/src/shared/ui/LieuCarte.test.tsx` (créer s'il n'existe pas, sinon compléter)

**Interfaces:**
- Produces: deux props facultatives de `LieuCarte` :
  `pastille?: string` — remplace la distance en haut à droite… **à gauche** (le coin droit porte le tampon) ;
  `coin?: ReactNode` — posé à cheval sur le coin haut-droit, hors de la carte.
  Sans elles, la carte est inchangée (Accueil, profil).

- [ ] **Step 1 : écrire le test**

```tsx
/**
 * QUOI     — la carte d'un lieu : par défaut la distance ; dans le passeport, une pastille de
 *            date à gauche et un tampon par-dessus le coin.
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { LieuCarte, type LieuDeCarte } from './LieuCarte'

const LIEU: LieuDeCarte = {
  id: 'p1',
  nom: 'Château de Gourdon',
  imageUrl: null,
  latitude: 43.72,
  longitude: 6.97,
  categorie: null,
  auteur: null,
}

function afficher(props: Partial<Parameters<typeof LieuCarte>[0]> = {}) {
  render(
    <MemoryRouter initialEntries={['/compte']}>
      <ul>
        <LieuCarte lieu={LIEU} position={null} avecAuteur={false} {...props} />
      </ul>
    </MemoryRouter>,
  )
}

test('la pastille et le coin s’affichent', () => {
  afficher({ pastille: '2 oct.', coin: <span>tampon</span> })
  expect(screen.getByText('2 oct.')).toBeInTheDocument()
  expect(screen.getByText('tampon')).toBeInTheDocument()
})

test('sans elles, rien de plus', () => {
  afficher()
  expect(screen.queryByText('2 oct.')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Château de Gourdon/ })).toHaveAttribute('href', '/compte/lieu/p1')
})
```

- [ ] **Step 2 : lancer, voir échouer**

Run: `cd apps/web-v2 && pnpm test src/shared/ui/LieuCarte.test.tsx`
Expected: FAIL (le premier test : props inconnues → typecheck, ou texte absent).

- [ ] **Step 3 : implémenter**

Dans `LieuCarte.tsx` : importer `type ReactNode` de `react` ; ajouter aux props `pastille?: string` et `coin?: ReactNode` ; dans le rendu, juste après `{distance && …}` :

```tsx
        {pastille && <span className={styles.pastille}>{pastille}</span>}
```

et, **après** la fermeture du `<Link>` (toujours dans le `<li>`) :

```tsx
      {coin && <span className={styles.coin}>{coin}</span>}
```

Ajouter à l'en-tête `ATTENTION` : « `pastille` et `coin` ne servent qu'au passeport (date du jour, tampon de la nature) ; le coin déborde de la carte, le rognage est donc sur le lien, pas sur la carte. »

Dans `LieuCarte.module.css` : déplacer `overflow: hidden;` de `.carte` vers `.lien` et ajouter `border-radius: var(--radius-carte);` à `.lien` (le coin peut alors déborder) ; puis ajouter :

```css
/* Passeport : la date en pastille à gauche, le tampon à cheval sur le coin haut-droit. */
.pastille {
  position: absolute;
  top: var(--space-3);
  left: var(--space-3);
  padding: 2px var(--space-2);
  border-radius: var(--radius-rond);
  background: color-mix(in srgb, var(--color-fond) 90%, transparent);
  color: var(--color-texte);
  font-family: var(--font-condensee);
  font-size: var(--meta-size);
  font-weight: var(--weight-gras);
}

.coin {
  position: absolute;
  top: calc(var(--space-3) * -1);
  right: calc(var(--space-2) * -1);
  pointer-events: none;
}
```

- [ ] **Step 4 : lancer, voir passer**

Run: `cd apps/web-v2 && pnpm test src/shared/ui && pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5 : commit**

```bash
git add apps/web-v2/src/shared/ui/LieuCarte.tsx apps/web-v2/src/shared/ui/LieuCarte.module.css apps/web-v2/src/shared/ui/LieuCarte.test.tsx
git commit -m "feat(lieu-carte): pastille et tampon par-dessus, pour le passeport"
```

---

### Task 7 : pages 2 et 3, et leurs routes

**Files:**
- Create: `apps/web-v2/src/features/compte/components/passeport/PasseportOuvert.tsx` + `.module.css`
- Create: `apps/web-v2/src/features/compte/components/passeport/PasseportTerritoire.tsx` + `.module.css`
- Modify: `apps/web-v2/src/app/routes/compte.tsx` (deux routes), `apps/web-v2/src/app/router.tsx` (deux chemins après `explorateur/:id/modifier`)
- Test: `apps/web-v2/src/features/compte/components/passeport/PasseportPages.test.tsx`

**Interfaces:**
- Consumes: `usePasseport` (Task 2) ; `parTerritoire`, `territoireDe`, `parNature`, `parMois`, `AILLEURS` (Task 3) ; `TamponNature`, `TamponPhoto`, `dateCourte`, `moisLong`, `depuis` (Task 4) ; `LieuCarte` avec `pastille`/`coin` (Task 6) ; `useGlisser` (`@/shared/hooks/useGlisser`).
- Produces: `PasseportOuvert({ id })`, `PasseportTerritoire({ id, territoire })` ; routes `:tab/explorateur/:id/passeport` et `:tab/explorateur/:id/passeport/:territoire` (paramètre encodé avec `encodeURIComponent`).

- [ ] **Step 1 : écrire le test**

```tsx
/**
 * QUOI     — page 2 (une page par territoire) et page 3 (un territoire, mois par mois).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useParams } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import type { Passeport } from '../../api/lirePasseport'
import { PasseportOuvert } from './PasseportOuvert'
import { PasseportTerritoire } from './PasseportTerritoire'

const api = vi.hoisted(() => ({ fetchPasseport: vi.fn() }))
vi.mock('../../api/passeport', () => api)

const NATURE = { id: 'chateau', nom: 'Châteaux', icone: 'https://x/c.svg', couleur: '#a9260f' }
const T = (id: string, quand: string, o: Record<string, unknown> = {}) => ({
  id,
  nom: `Lieu ${id}`,
  imageUrl: null,
  nature: 'chateau',
  departement: 'Alpes-Maritimes',
  pays: 'France',
  quand,
  ...o,
})

const AM = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => T(id, `2026-10-0${6 - i}`))
const PASSEPORT: Passeport = {
  auJour: true,
  natures: [NATURE],
  tampons: [
    ...AM,
    T('g', '2026-09-12'),
    T('h', '2026-08-03'),
    T('i', '2026-07-01', { departement: 'Côtes-d’Armor' }),
    T('j', '2026-06-01', { departement: null, pays: null }),
  ],
}

beforeEach(() => {
  api.fetchPasseport.mockResolvedValue(PASSEPORT)
})

function afficher(url: string) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/:tab/explorateur/:id/passeport" element={<PasseportOuvert id="u1" />} />
          <Route
            path="/:tab/explorateur/:id/passeport/:territoire"
            element={<TerritoireDepuisUrl />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// Comme la route de app/ : le paramètre arrive décodé par react-router.
function TerritoireDepuisUrl() {
  const { territoire = '' } = useParams()
  return <PasseportTerritoire id="u1" territoire={territoire} />
}

test('page 2 : une page par territoire, 4 tampons au plus et « +N »', async () => {
  afficher('/compte/explorateur/u1/passeport')
  const am = await screen.findByRole('link', { name: /Alpes-Maritimes/ })
  expect(within(am).getAllByRole('img')).toHaveLength(4)
  expect(within(am).getByText('+4 ›')).toBeInTheDocument()
  expect(am).toHaveAttribute('href', '/compte/explorateur/u1/passeport/Alpes-Maritimes')
  expect(screen.getByRole('link', { name: /Ailleurs/ })).toBeInTheDocument()
})

test('page 2 : un nom avec apostrophe s’encode dans l’adresse', async () => {
  afficher('/compte/explorateur/u1/passeport')
  expect(await screen.findByRole('link', { name: /Côtes-d’Armor/ })).toHaveAttribute(
    'href',
    `/compte/explorateur/u1/passeport/${encodeURIComponent('Côtes-d’Armor')}`,
  )
})

test('page 3 : résumé, deux mois ouverts, les autres repliés et dépliables', async () => {
  afficher('/compte/explorateur/u1/passeport/Alpes-Maritimes')
  expect(await screen.findByText(/8 tampons · 1 nature sur 1 · depuis le 3 août 2026/)).toBeInTheDocument()
  const octobre = screen.getByRole('region', { name: /octobre 2026/i })
  expect(within(octobre).getAllByRole('link')).toHaveLength(6)
  expect(within(octobre).getByText('6 oct.')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: /septembre 2026/i })).toBeInTheDocument()
  const aout = screen.getByRole('button', { name: /août 2026 · 1 tampon/i })
  expect(screen.queryByRole('link', { name: /Lieu h/ })).not.toBeInTheDocument()
  await userEvent.click(aout)
  expect(screen.getByRole('link', { name: /Lieu h/ })).toBeInTheDocument()
})

test('page 3 : chez un autre, pas de pastille du jour', async () => {
  api.fetchPasseport.mockResolvedValue({
    ...PASSEPORT,
    auJour: false,
    tampons: PASSEPORT.tampons.map((t) => ({ ...t, quand: `${t.quand.slice(0, 7)}-01` })),
  })
  afficher('/compte/explorateur/u1/passeport/Alpes-Maritimes')
  expect(await screen.findByText(/depuis août 2026/)).toBeInTheDocument()
  expect(screen.queryByText(/^\d+ oct\.$/)).not.toBeInTheDocument()
})

test('page 3 : Ailleurs et nom avec apostrophe se rouvrent depuis l’adresse', async () => {
  afficher('/compte/explorateur/u1/passeport/Ailleurs')
  expect(await screen.findByRole('link', { name: /Lieu j/ })).toBeInTheDocument()
})

test('page 3 : un territoire inconnu', async () => {
  afficher('/compte/explorateur/u1/passeport/Atlantide')
  expect(await screen.findByText('Ce territoire n’est pas dans le passeport.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '‹ Le passeport' })).toHaveAttribute(
    'href',
    '/compte/explorateur/u1/passeport',
  )
})
```

- [ ] **Step 2 : lancer, voir échouer**

Run: `cd apps/web-v2 && pnpm test src/features/compte/components/passeport/PasseportPages.test.tsx`
Expected: FAIL (modules introuvables).

- [ ] **Step 3 : implémenter la page 2**

`PasseportOuvert.tsx` :

```tsx
/**
 * QUOI     — le passeport ouvert (maquette « Passeport — 2 », 429:519) : une page par
 *            département ou pays, comme des visas ; ses 4 tampons les plus récents en photo
 *            encrée qui se chevauchent, avec leur date ; « +N › » ouvre le territoire.
 * POURQUOI — pas de nom de lieu ici (Uriel, 06/10) : la page dit « où » et « quand », le
 *            détail est un toucher plus loin.
 */
import { Link, useParams } from 'react-router'
import { usePasseport } from '../../hooks/usePasseport'
import { dateCourte } from '../../lib/dates'
import { parTerritoire } from '../../lib/passeport'
import { TamponPhoto } from './TamponPhoto'
import styles from './PasseportOuvert.module.css'

const MONTRES = 4

export function PasseportOuvert({ id }: { id: string }) {
  const { tab = 'compte' } = useParams()
  const { passeport, erreur, reessayer } = usePasseport(id)

  if (erreur) {
    return (
      <div className={styles.etat}>
        <p>Le passeport n’a pas pu s’ouvrir.</p>
        <button type="button" className={styles.reessayer} onClick={reessayer}>
          Réessayer
        </button>
      </div>
    )
  }
  if (passeport === undefined) return <div className={styles.squelette} aria-hidden="true" />
  if (passeport === null) return <p className={styles.etat}>Ce passeport n’existe pas.</p>

  const natures = new Map(passeport.natures.map((n) => [n.id, n]))
  return (
    <ul className={styles.pages}>
      {parTerritoire(passeport.tampons).map((t) => (
        <li key={t.nom}>
          <Link
            className={styles.page}
            to={`/${tab}/explorateur/${id}/passeport/${encodeURIComponent(t.nom)}`}
          >
            <span className={styles.entete}>
              <span className={styles.nom}>{t.nom}</span>
              <span className={styles.compte}>
                {t.tampons.length} {t.tampons.length > 1 ? 'tampons' : 'tampon'}
              </span>
              {t.tampons.length > MONTRES && (
                <span className={styles.plus}>+{t.tampons.length - MONTRES} ›</span>
              )}
            </span>
            <span className={styles.tampons}>
              {t.tampons.slice(0, MONTRES).map((x) => (
                <TamponPhoto
                  key={x.id}
                  tampon={x}
                  nature={x.nature === null ? null : (natures.get(x.nature) ?? null)}
                  date={dateCourte(x.quand, passeport.auJour)}
                />
              ))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
```

`PasseportOuvert.module.css` :

```css
/*
 * QUOI     — une pile de pages de papier réglé ; chaque page : nom en Bebas, compte, « +N › »,
 *            puis ses tampons photo qui se chevauchent, légèrement tournés.
 */
.pages {
  display: grid;
  gap: var(--space-4);
  margin: 0;
  padding: var(--space-4) var(--space-6) var(--space-8);
  list-style: none;
}

.page {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-sable);
  border-radius: var(--radius-carte);
  background:
    repeating-linear-gradient(
      to bottom,
      transparent 0 27px,
      color-mix(in srgb, var(--color-ocre) 25%, transparent) 27px 28px
    ),
    var(--color-barre);
  color: inherit;
  text-decoration: none;
}

.entete {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
}

.nom {
  flex: 1;
  color: var(--color-encre);
  font-family: var(--font-titre);
  font-size: var(--titre-carte-size);
  letter-spacing: var(--titre-tracking);
}

.compte {
  color: var(--color-texte-doux);
  font-family: var(--font-corps);
  font-size: var(--legende-size);
}

.plus {
  color: var(--color-accent);
  font-family: var(--font-corps);
  font-size: var(--legende-size);
  font-weight: var(--weight-gras);
}

.tampons {
  display: flex;
  padding-bottom: var(--space-2);
}

.tampons > * + * {
  margin-left: calc(var(--space-6) * -1);
}

.tampons > :nth-child(odd) {
  rotate: -5deg;
}

.tampons > :nth-child(even) {
  rotate: 4deg;
  translate: 0 var(--space-2);
}

.etat {
  display: grid;
  justify-items: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-6);
  color: var(--color-texte-doux);
  font-family: var(--font-corps);
}

.reessayer {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-accent);
  font-family: var(--font-corps);
  font-weight: var(--weight-gras);
  cursor: pointer;
}

.squelette {
  height: 240px;
  margin: var(--space-4) var(--space-6);
  border-radius: var(--radius-carte);
  background: var(--color-barre);
}
```

- [ ] **Step 4 : implémenter la page 3**

`PasseportTerritoire.tsx` :

```tsx
/**
 * QUOI     — un territoire en détail (maquette « Passeport — 3 », 442:272) : le résumé, ses
 *            natures, puis un défilement horizontal par mois de cartes « Lieux ajoutés », le
 *            tampon de la nature posé sur le coin, la date du jour en pastille (pour soi).
 * POURQUOI — « sans tampon pour les lieux en détail, juste un scroll horizontal » (Uriel,
 *            07/10) : la photo redevient l'héroïne, le tampon reste en coin. Les deux mois
 *            les plus récents sont ouverts, les autres repliés : la page reste courte.
 */
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useGlisser } from '@/shared/hooks/useGlisser'
import { LieuCarte } from '@/shared/ui/LieuCarte'
import type { Nature, Tampon } from '../../api/lirePasseport'
import { usePasseport } from '../../hooks/usePasseport'
import { dateCourte, depuis, moisLong } from '../../lib/dates'
import { parMois, parNature, territoireDe, type Mois } from '../../lib/passeport'
import { TamponNature } from './TamponNature'
import styles from './PasseportTerritoire.module.css'

const OUVERTS = 2

export function PasseportTerritoire({ id, territoire }: { id: string; territoire: string }) {
  const { tab = 'compte' } = useParams()
  const { passeport, erreur, reessayer } = usePasseport(id)
  const [deplies, setDeplies] = useState<string[]>([])

  if (erreur) {
    return (
      <div className={styles.etat}>
        <p>Le passeport n’a pas pu s’ouvrir.</p>
        <button type="button" className={styles.lien} onClick={reessayer}>
          Réessayer
        </button>
      </div>
    )
  }
  if (passeport === undefined) return <div className={styles.squelette} aria-hidden="true" />

  const tampons = (passeport?.tampons ?? []).filter((t) => territoireDe(t) === territoire)
  if (passeport === null || tampons.length === 0) {
    return (
      <div className={styles.etat}>
        <p>Ce territoire n’est pas dans le passeport.</p>
        <Link className={styles.lien} to={`/${tab}/explorateur/${id}/passeport`}>
          ‹ Le passeport
        </Link>
      </div>
    )
  }

  const natures = parNature(passeport.natures, tampons).filter((n) => n.encre !== null)
  const parId = new Map(passeport.natures.map((n) => [n.id, n]))
  const plusAncien = tampons[tampons.length - 1]?.quand ?? ''
  const mois = parMois(tampons)

  return (
    <div className={styles.page}>
      <p className={styles.resume}>
        {tampons.length} {tampons.length > 1 ? 'tampons' : 'tampon'} · {natures.length}{' '}
        {natures.length > 1 ? 'natures' : 'nature'} sur {passeport.natures.length} ·{' '}
        {depuis(plusAncien, passeport.auJour)}
      </p>
      <h2 className={styles.rubrique}>Ses natures</h2>
      <div className={styles.natures}>
        {natures.map((n) => (
          <TamponNature key={n.nature.id} nature={n.nature} compte={n.compte} encre={n.encre} />
        ))}
      </div>
      {mois.map((m, i) =>
        i < OUVERTS || deplies.includes(m.cle) ? (
          <MoisOuvert key={m.cle} mois={m} natures={parId} auJour={passeport.auJour} />
        ) : (
          <button
            key={m.cle}
            type="button"
            className={styles.replie}
            onClick={() => setDeplies([...deplies, m.cle])}
          >
            {moisLong(m.cle)} · {m.tampons.length} {m.tampons.length > 1 ? 'tampons' : 'tampon'} ›
          </button>
        ),
      )}
    </div>
  )
}

function MoisOuvert({
  mois,
  natures,
  auJour,
}: {
  mois: Mois
  natures: Map<string, Nature>
  auJour: boolean
}) {
  const glisser = useGlisser()
  const titre = `${moisLong(mois.cle)} · ${mois.tampons.length} ${mois.tampons.length > 1 ? 'tampons' : 'tampon'}`
  return (
    <section className={styles.mois} aria-label={titre}>
      <h3 className={styles.rubrique}>{titre}</h3>
      <div className={styles.cadre}>
        <ul ref={glisser} className={styles.rangee}>
          {mois.tampons.map((t) => (
            <Carte key={t.id} tampon={t} nature={t.nature === null ? null : (natures.get(t.nature) ?? null)} auJour={auJour} />
          ))}
        </ul>
      </div>
    </section>
  )
}

function Carte({ tampon, nature, auJour }: { tampon: Tampon; nature: Nature | null; auJour: boolean }) {
  return (
    <LieuCarte
      lieu={{
        id: tampon.id,
        nom: tampon.nom,
        imageUrl: tampon.imageUrl,
        latitude: null,
        longitude: null,
        categorie: nature ? { icone: nature.icone } : null,
        auteur: null,
      }}
      position={null}
      avecAuteur={false}
      pastille={auJour ? dateCourte(tampon.quand, true) : undefined}
      coin={nature ? <TamponNature nature={nature} compte={1} encre="fort" taille="petit" /> : undefined}
    />
  )
}
```

Attention au test « chez un autre » : le `TamponNature` du coin a un `aria-label` « Châteaux : 1 lieu » — ce n'est pas une date, le test reste juste. Formater avec Prettier (`pnpm format`) avant le commit : les lignes longues ci-dessus seront recoupées.

`PasseportTerritoire.module.css` :

```css
/*
 * QUOI     — le détail d'un territoire : résumé, natures, puis un mois par rangée qui défile
 *            (même carrousel que les sections du profil), les mois anciens en lignes repliées.
 */
.page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
  padding: var(--space-4) 0 var(--space-8);
}

.resume,
.rubrique,
.natures,
.replie {
  margin: 0 var(--space-6);
}

.resume {
  color: var(--color-texte-doux);
  font-family: var(--font-corps);
  font-size: var(--legende-size);
}

.rubrique {
  color: var(--color-ocre);
  font-family: var(--font-condensee);
  font-size: var(--libelle-size);
  font-weight: var(--weight-gras);
  letter-spacing: var(--libelle-tracking);
  text-transform: uppercase;
}

.natures {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.mois {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-2);
}

.cadre {
  display: flex;
}

/* Le haut de la rangée laisse la place au tampon qui déborde du coin des cartes. */
.rangee {
  display: flex;
  flex: 1;
  gap: var(--space-3);
  margin: 0;
  padding: var(--space-4) var(--space-6) var(--space-2);
  overflow-x: auto;
  cursor: grab;
  list-style: none;
  scrollbar-width: none;
}

.rangee::-webkit-scrollbar {
  display: none;
}

.replie {
  justify-self: start;
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-texte-doux);
  font-family: var(--font-condensee);
  font-size: var(--libelle-size);
  font-weight: var(--weight-gras);
  letter-spacing: var(--libelle-tracking);
  text-transform: uppercase;
  cursor: pointer;
}

.etat {
  display: grid;
  justify-items: center;
  gap: var(--space-3);
  padding: var(--space-8) var(--space-6);
  color: var(--color-texte-doux);
  font-family: var(--font-corps);
}

.lien {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-accent);
  font-family: var(--font-corps);
  font-weight: var(--weight-gras);
  text-decoration: none;
  cursor: pointer;
}

.squelette {
  height: 320px;
  margin: var(--space-4) var(--space-6);
  border-radius: var(--radius-carte);
  background: var(--color-barre);
}
```

Le libellé replié et le titre de section sont en minuscules dans le DOM (`moisLong`) et passent en capitales par le CSS : les tests cherchent `/octobre 2026/i`.

- [ ] **Step 5 : les routes**

`app/routes/compte.tsx`, ajouter (imports `PasseportOuvert`, `PasseportTerritoire` depuis `@/features/compte/components/passeport/…`) :

```tsx
// /<onglet>/explorateur/<id>/passeport — le passeport ouvert, une page par territoire
export function RoutePasseport() {
  const { id = '' } = useParams()
  return (
    <DetailPane title="Passeport">
      <PasseportOuvert id={id} />
    </DetailPane>
  )
}

// /<onglet>/explorateur/<id>/passeport/<territoire> — un territoire en détail. react-router
// rend le paramètre décodé (« Côtes-d’Armor »).
export function RoutePasseportTerritoire() {
  const { id = '', territoire = '' } = useParams()
  return (
    <DetailPane title={territoire}>
      <PasseportTerritoire id={id} territoire={territoire} />
    </DetailPane>
  )
}
```

`app/router.tsx`, après `{ path: 'explorateur/:id/modifier', Component: RouteModifier },` :

```tsx
              { path: 'explorateur/:id/passeport', Component: RoutePasseport },
              { path: 'explorateur/:id/passeport/:territoire', Component: RoutePasseportTerritoire },
```

(et les ajouter à l'import depuis `./routes/compte`).

- [ ] **Step 6 : lancer, voir passer**

Run: `cd apps/web-v2 && pnpm format && pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS (toute la suite).

- [ ] **Step 7 : commit**

```bash
git add apps/web-v2/src/features/compte apps/web-v2/src/app
git commit -m "feat(passeport): le passeport ouvert et le détail d'un territoire"
```

---

### Task 8 : vérification dans le navigateur, version, déploiement (contrôleur)

- [ ] **Step 1 :** `pnpm --filter web-v2 dev`, se connecter, ouvrir son profil : la section Passeport remplace Visités, le chiffre « Lieux visités » est juste ; « Ouvrir le passeport › » → page 2 → un territoire → page 3 ; défilement à la souris ; une carte ouvre la fiche ; un mois replié se déplie. Ouvrir le profil d'un autre Explorateur : pas de pastille du jour, dates au mois. Mobile 390 px : pas de défilement horizontal de la page.
- [ ] **Step 2 :** comparer aux maquettes Figma 432:272, 429:519, 442:272 ; corriger les écarts visibles.
- [ ] **Step 3 :** `pnpm --filter web-v2 build` ; version `1.1.0` → `1.2.0` dans `apps/web-v2/package.json` ; commit `chore(web-v2): Pythéas 1.2.0, le passeport`.
- [ ] **Step 4 :** lire `.claude/rules/deploiement.md`, demander le feu vert à Uriel, déployer à la main sur `rdc-web-v2`, test sur téléphone par Uriel.

### Task 9 : migration 432 — retirer `visites` du profil (contrôleur, après déploiement)

- [ ] **Step 1 :** une fois la 1.2.0 en prod et testée, `pg_get_functiondef` de `get_profil_explorateur` (= 431), créer `supabase/migrations/432_profil_sans_visites.sql` (`-- WHY: le passeport porte la liste des visites depuis la 1.2.0 ; delta unique sur la live (= 431) : la clé 'visites' disparaît du JSON (la CTE reste : elle sert à Envie d'y aller et à nbVisites).`), qui supprime seulement la ligne `'visites', …`.
- [ ] **Step 2 :** `npx supabase db push --linked` ; vérifier en transaction annulée : `get_profil_explorateur('<id Uriel>')->'visites'` est `null`, `nbVisites` inchangé ; le profil V2 s'ouvre.
- [ ] **Step 3 :** commit `feat(profil): la liste des visites quitte le profil (migration 432)`, push, merge dans `feat/v2-socle` avec l'accord d'Uriel ; décision dans `_État.md`.
