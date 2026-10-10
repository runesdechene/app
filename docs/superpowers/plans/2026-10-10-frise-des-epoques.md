# La frise des époques — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** remplacer les boutons « Époques » de la feuille des filtres par une frise repliable posée sur la carte, dont les bornes suivent le calendrier du joueur.

**Architecture:** la frise remplit le même `Filtres.epoques` (ensemble d'identifiants d'époques) que les boutons d'aujourd'hui : `filtrer` ne change pas. Un module pur `features/carte/lib/frise.ts` passe de l'ensemble à la plage (deux rangs) et calcule l'en-tête ; le composant `FriseDesEpoques` dessine la bande avec deux `<input type="range">` natifs. La base renomme « Monde post-1945 » et renvoie les bornes des époques.

**Tech Stack:** React 19, TypeScript strict, CSS Modules, TanStack Query 5, Vitest + Testing Library, Supabase (SQL), paquet `@runes/calendrier`.

**Spec:** `docs/superpowers/specs/2026-10-10-frise-des-epoques-design.md`

## Global Constraints

- TS strict : pas de `any`, `@ts-ignore`, `as unknown as`, ni `!` non nul.
- pnpm uniquement ; `npx` seulement pour `supabase`.
- Chaque fichier neuf commence par un en-tête `QUOI — / POURQUOI — / ATTENTION —` (ATTENTION si utile), comme les fichiers voisins.
- Pas de `console.log`. Code mort croisé : supprimé dans le même commit.
- CSS : les couleurs, espacements, rayons, polices passent par les jetons de `src/shared/styles/tokens.css` (`var(--color-…)`, `var(--space-…)`…) ; `pnpm --filter web-v2 lint` doit passer (stylelint compris).
- Conventional Commits, avec la ligne `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Migrations : en tête `-- WHY:` ; tout `CREATE OR REPLACE` part de la définition live, copiée entière ; **appliquées par la session principale** (`npx supabase db push --linked`), jamais par un sous-agent.
- Les libellés exacts de la spec : « Toutes les époques », « Glisse les poignées pour remonter le temps », « Tout », « Après-guerre mondiale », « de X à Y — <compte> ».
- Le seuil PC est `(width >= 1024px)` (`useSurOrdinateur`, coquille).

## Review Focus

1. **Une poignée qui rattrape l'autre** (clavier ou glisser) : elle s'arrête sur l'époque de l'autre, la plage fait alors une seule époque — jamais une plage inversée. Test dans la tâche 4.
2. **Les bornes ouvertes** (Préhistoire sans début, Ère digitale sans fin) : « les origines », « aujourd'hui », aucune année sous la poignée. Test dans la tâche 3.
3. **Constantinople et 1453** : la borne s'écrit `0`, jamais une phrase. Test dans la tâche 1.
4. **Fermer la frise sur une plage** : la carte reste filtrée et le sablier reste à l'encre ; « Réinitialiser » des filtres remet la frise au repos. Test dans la tâche 5.
5. **Les époques pas encore lues** (premier appui sur le sablier) : la bande ne s'affiche qu'avec au moins deux époques datées, sans erreur. Test dans la tâche 4.

---

### Task 1: les années courtes dans `@runes/calendrier`

**Files:**
- Modify: `packages/calendrier/src/index.ts` (après `siecleEnClair`)
- Test: `packages/calendrier/src/index.test.ts`

**Interfaces:**
- Produces: `anneeCourte(annee: number, calendrier: Calendrier): string` ; `compteDuCalendrier(calendrier: Calendrier): string`.

- [ ] **Step 1: les tests qui échouent** — à la fin de `index.test.ts` (importer `anneeCourte` et `compteDuCalendrier` avec les autres) :

```ts
test('anneeCourte : le nombre seul, « av. » avant le début du compte', () => {
  expect(anneeCourte(476, 'chretien')).toBe('476')
  expect(anneeCourte(-3300, 'chretien')).toBe('3300 av.')
  expect(anneeCourte(-3300, 'moderne')).toBe('3300 av.')
  expect(anneeCourte(476, 'rome')).toBe('1229')
  expect(anneeCourte(-1200, 'rome')).toBe('447 av.')
  expect(anneeCourte(-1, 'rome')).toBe('753')
  expect(anneeCourte(930, 'constantinople')).toBe('523 av.')
  expect(anneeCourte(1453, 'constantinople')).toBe('0')
  expect(anneeCourte(1600, 'constantinople')).toBe('147')
})

test('compteDuCalendrier : la fin de phrase de la frise', () => {
  expect(compteDuCalendrier('chretien')).toBe('avant et après J.-C.')
  expect(compteDuCalendrier('moderne')).toBe('avant et pendant l’ère commune')
  expect(compteDuCalendrier('rome')).toBe('en années depuis la fondation de Rome')
  expect(compteDuCalendrier('constantinople')).toBe('en années depuis la chute de Constantinople')
})
```

- [ ] **Step 2: les lancer** — `pnpm --filter @runes/calendrier test` → échec, `anneeCourte` n'existe pas.

- [ ] **Step 3: le code** — après `siecleEnClair` :

```ts
// Les bornes de la frise des époques : le nombre seul, le calendrier est nommé une fois à côté
// (`compteDuCalendrier`). L'année de la chute, en Constantinople, est l'an 0 de son compte.
export function anneeCourte(a: number, calendrier: Calendrier): string {
  const compte = compter(a, calendrier)
  if (!compte) return '0'
  return compte.sens === 'av' ? `${String(compte.n)} av.` : String(compte.n)
}

export function compteDuCalendrier(calendrier: Calendrier): string {
  switch (calendrier) {
    case 'chretien':
      return 'avant et après J.-C.'
    case 'moderne':
      return 'avant et pendant l’ère commune'
    case 'rome':
      return 'en années depuis la fondation de Rome'
    case 'constantinople':
      return 'en années depuis la chute de Constantinople'
  }
}
```

- [ ] **Step 4: les relancer** — `pnpm --filter @runes/calendrier test` → tout passe.
- [ ] **Step 5: commit** — `feat(calendrier): les années courtes de la frise`.

---

### Task 2: la base — migration 477 et la lecture des bornes

**Files:**
- Create: `supabase/migrations/477_frise_des_epoques.sql`
- Modify: `apps/web-v2/src/features/carte/api/lireCarte.ts:30-31` (types) et `:79-82` (`lireFiltres`)
- Modify: `apps/web-v2/src/features/carte/hooks/useFiltresDeCarte.ts` (en-tête : « et les bornes des époques »)
- Test: `apps/web-v2/src/features/carte/api/lireCarte.test.ts` (le test de `lireFiltres`, ligne ~84)

**Interfaces:**
- Produces: `export type EpoqueFiltre = { id: string; nom: string; debut: number | null; fin: number | null }` ; `FiltresDeCarte = { natures: NatureFiltre[]; epoques: EpoqueFiltre[] }`. Les années sont chrétiennes, négatif = av. J.-C., comme `eras.year_start`.

- [ ] **Step 1: la migration** — `supabase/migrations/477_frise_des_epoques.sql`, la fonction copiée de sa définition live (lue le 10/10) avec `debut` et `fin` en plus :

```sql
-- WHY: la frise des époques (spec docs/superpowers/specs/2026-10-10-frise-des-epoques-design.md).
-- Le nom d'une période ne se convertit pas d'un calendrier à l'autre : « Monde post-1945 » perd son
-- année. filtres_de_carte renvoie les bornes de chaque époque, que la frise écrit dans le
-- calendrier du joueur. Définition de départ : la live du 10/10 (dernière version, mig 396).

UPDATE eras SET name = 'Après-guerre mondiale' WHERE id = 'post-1945';

CREATE OR REPLACE FUNCTION public.filtres_de_carte()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'natures', COALESCE((
      SELECT json_agg(json_build_object('id', t.id, 'nom', t.title, 'icone', t.icon, 'couleur', t.color)
        ORDER BY t."order", t.title)
      FROM tags t), '[]'::json),
    'epoques', COALESCE((
      SELECT json_agg(json_build_object('id', e.id, 'nom', e.name, 'debut', e.year_start, 'fin', e.year_end)
        ORDER BY e.id IN ('unknown', 'not-applicable'), e.sort_order)
      FROM eras e), '[]'::json));
$function$;

REVOKE ALL ON FUNCTION public.filtres_de_carte() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.filtres_de_carte() TO authenticated;
```

Ne pas l'appliquer : la session principale s'en charge.

- [ ] **Step 2: le test qui échoue** — dans `lireCarte.test.ts`, le test de `lireFiltres` : ajouter `debut: 476, fin: 1000` à une époque d'entrée et `debut: null` (sans `fin`) à une autre, et attendre `{ id, nom, debut: 476, fin: 1000 }` et `{ id, nom, debut: null, fin: null }`. Lancer `pnpm --filter web-v2 test lireCarte` → échec.

- [ ] **Step 3: le code** — dans `lireCarte.ts` :

```ts
// Ce que la feuille des filtres et la frise proposent (filtres_de_carte, migrations 396 et 477).
// Les bornes d'une époque sont des années chrétiennes (négatif = av. J.-C.), `null` si ouvertes.
export type NatureFiltre = { id: string; nom: string; icone: string | null; couleur: string | null }
export type EpoqueFiltre = { id: string; nom: string; debut: number | null; fin: number | null }
export type FiltresDeCarte = { natures: NatureFiltre[]; epoques: EpoqueFiltre[] }
```

et dans `lireFiltres` :

```ts
    epoques: liste((v): EpoqueFiltre => {
      const e = objet(v)
      return {
        id: chaine(e.id),
        nom: chaine(e.nom),
        debut: ouNull(nombre)(e.debut ?? null),
        fin: ouNull(nombre)(e.fin ?? null),
      }
    })(f.epoques),
```

(`nombre` est déjà importé de `@/shared/lib/lire`.)

- [ ] **Step 4:** `pnpm --filter web-v2 test lireCarte` et `pnpm --filter web-v2 exec tsc --noEmit` → passent.
- [ ] **Step 5: commit** — `feat(carte): les bornes des époques et l'Après-guerre mondiale (477)`.

---

### Task 3: la frise, en fonctions pures

**Files:**
- Create: `apps/web-v2/src/features/carte/lib/frise.ts`
- Test: `apps/web-v2/src/features/carte/lib/frise.test.ts`

**Interfaces:**
- Consumes: `EpoqueFiltre` (tâche 2), `anneeCourte`, `compteDuCalendrier` (tâche 1).
- Produces: `type Plage = { de: number; a: number }` ; `epoquesDatees(e: EpoqueFiltre[]): EpoqueFiltre[]` ; `plageDe(frise, choix: ReadonlySet<string>): Plage` ; `ensembleDe(frise, p: Plage): ReadonlySet<string>` ; `auRepos(frise, p): boolean` ; `bornes(frise, p, calendrier): { debut: string | null; fin: string | null }` ; `enTete(frise, p, calendrier): { titre: string; detail: string }`.

- [ ] **Step 1: les tests qui échouent** — `frise.test.ts` :

```ts
/**
 * QUOI     — la frise des époques : de l'ensemble choisi à la plage et retour, les bornes et la
 *            phrase d'en-tête dans le calendrier du joueur.
 */
import { expect, test } from 'vitest'
import type { EpoqueFiltre } from '../api/lireCarte'
import { auRepos, bornes, enTete, ensembleDe, epoquesDatees, plageDe } from './frise'

const e = (id: string, nom: string, debut: number | null, fin: number | null): EpoqueFiltre => ({
  id,
  nom,
  debut,
  fin,
})
const EPOQUES = [
  e('prehistory', 'Préhistoire', null, -3300),
  e('classical-antiquity', 'Antiquité classique', -500, 476),
  e('early-middle-ages', 'Haut Moyen Âge', 476, 1000),
  e('renaissance', 'Renaissance', 1453, 1600),
  e('digital-era', 'Ère digitale', 2020, null),
  e('not-applicable', 'Non concerné', null, null),
  e('unknown', 'Indéfinie', null, null),
]
const FRISE = epoquesDatees(EPOQUES)

test('la frise ne garde que les époques datées, dans leur ordre', () => {
  expect(FRISE.map((x) => x.id)).toEqual([
    'prehistory',
    'classical-antiquity',
    'early-middle-ages',
    'renaissance',
    'digital-era',
  ])
})

test('au repos : un ensemble vide, les poignées aux deux bouts', () => {
  expect(plageDe(FRISE, new Set())).toEqual({ de: 0, a: 4 })
  expect(ensembleDe(FRISE, { de: 0, a: 4 }).size).toBe(0)
  expect(auRepos(FRISE, { de: 0, a: 4 })).toBe(true)
})

test('une plage : les époques de l’une à l’autre, et retour', () => {
  const choix = ensembleDe(FRISE, { de: 2, a: 3 })
  expect([...choix]).toEqual(['early-middle-ages', 'renaissance'])
  expect(plageDe(FRISE, choix)).toEqual({ de: 2, a: 3 })
})

test('une seule époque est une plage', () => {
  expect([...ensembleDe(FRISE, { de: 1, a: 1 })]).toEqual(['classical-antiquity'])
  expect(enTete(FRISE, { de: 1, a: 1 }, 'chretien').titre).toBe('Antiquité classique')
})

test('les bornes suivent le calendrier ; une borne ouverte n’a pas d’année', () => {
  expect(bornes(FRISE, { de: 2, a: 3 }, 'chretien')).toEqual({ debut: '476', fin: '1600' })
  expect(bornes(FRISE, { de: 2, a: 3 }, 'rome')).toEqual({ debut: '1229', fin: '2353' })
  expect(bornes(FRISE, { de: 0, a: 4 }, 'rome')).toEqual({ debut: null, fin: null })
})

test('l’en-tête : au repos, une plage, des bornes ouvertes', () => {
  expect(enTete(FRISE, { de: 0, a: 4 }, 'rome')).toEqual({
    titre: 'Toutes les époques',
    detail: 'Glisse les poignées pour remonter le temps',
  })
  expect(enTete(FRISE, { de: 2, a: 3 }, 'rome')).toEqual({
    titre: 'Haut Moyen Âge → Renaissance',
    detail: 'de 1229 à 2353 — en années depuis la fondation de Rome',
  })
  expect(enTete(FRISE, { de: 0, a: 2 }, 'chretien').detail).toBe(
    'des origines à 1000 — avant et après J.-C.',
  )
  expect(enTete(FRISE, { de: 3, a: 4 }, 'chretien').detail).toBe(
    'de 1453 à aujourd’hui — avant et après J.-C.',
  )
})
```


- [ ] **Step 2:** `pnpm --filter web-v2 test frise` → échec, le module n'existe pas.

- [ ] **Step 3: le code** — `frise.ts` :

```ts
/**
 * QUOI     — la frise des époques en fonctions pures : la plage (deux rangs sur la frise) et
 *            l'ensemble d'époques qu'elle retient, les bornes et la phrase d'en-tête.
 * POURQUOI — spec 2026-10-10-frise-des-epoques : la frise remplit le même `Filtres.epoques` que
 *            les anciens boutons, `filtrer` ne change pas. Au repos, l'ensemble est vide : rien
 *            n'est filtré.
 * ATTENTION — la frise ne montre que les époques datées ; « Indéfinie » et « Non concerné »
 *            n'y sont jamais, une plage resserrée cache donc leurs lieux.
 */
import { anneeCourte, compteDuCalendrier, type Calendrier } from '@runes/calendrier'
import type { EpoqueFiltre } from '../api/lireCarte'

export type Plage = { de: number; a: number }

export function epoquesDatees(epoques: EpoqueFiltre[]): EpoqueFiltre[] {
  return epoques.filter((e) => e.debut !== null || e.fin !== null)
}

export function auRepos(frise: EpoqueFiltre[], p: Plage): boolean {
  return p.de === 0 && p.a === frise.length - 1
}

export function plageDe(frise: EpoqueFiltre[], choix: ReadonlySet<string>): Plage {
  const rangs = frise.flatMap((e, i) => (choix.has(e.id) ? [i] : []))
  if (rangs.length === 0) return { de: 0, a: frise.length - 1 }
  return { de: Math.min(...rangs), a: Math.max(...rangs) }
}

export function ensembleDe(frise: EpoqueFiltre[], p: Plage): ReadonlySet<string> {
  if (auRepos(frise, p)) return new Set()
  return new Set(frise.slice(p.de, p.a + 1).map((e) => e.id))
}

export function bornes(
  frise: EpoqueFiltre[],
  p: Plage,
  calendrier: Calendrier,
): { debut: string | null; fin: string | null } {
  const debut = frise[p.de]?.debut ?? null
  const fin = frise[p.a]?.fin ?? null
  return {
    debut: debut === null ? null : anneeCourte(debut, calendrier),
    fin: fin === null ? null : anneeCourte(fin, calendrier),
  }
}

export function enTete(
  frise: EpoqueFiltre[],
  p: Plage,
  calendrier: Calendrier,
): { titre: string; detail: string } {
  if (auRepos(frise, p)) {
    return { titre: 'Toutes les époques', detail: 'Glisse les poignées pour remonter le temps' }
  }
  const nomDe = frise[p.de]?.nom ?? ''
  const nomA = frise[p.a]?.nom ?? ''
  const { debut, fin } = bornes(frise, p, calendrier)
  return {
    titre: p.de === p.a ? nomDe : `${nomDe} → ${nomA}`,
    detail: `${debut === null ? 'des origines' : `de ${debut}`} à ${fin ?? 'aujourd’hui'} — ${compteDuCalendrier(calendrier)}`,
  }
}
```

- [ ] **Step 4:** `pnpm --filter web-v2 test frise` → passe.
- [ ] **Step 5: commit** — `feat(carte): la frise des époques, en fonctions pures`.

---

### Task 4: le composant `FriseDesEpoques`

**Files:**
- Create: `apps/web-v2/src/features/carte/components/FriseDesEpoques.tsx`
- Create: `apps/web-v2/src/features/carte/components/FriseDesEpoques.module.css`
- Test: `apps/web-v2/src/features/carte/components/FriseDesEpoques.test.tsx`
- Modify: `apps/web-v2/src/features/carte/components/README.md` (une ligne pour le nouveau composant, comme ses voisins)

**Interfaces:**
- Consumes: `frise.ts` (tâche 3), `EpoqueFiltre` (tâche 2), `useCalendrier()` de `@/shared/hooks/useCalendrier`.
- Produces: `export function FriseDesEpoques(props: { epoques: EpoqueFiltre[]; choix: ReadonlySet<string>; onChoix: (choix: ReadonlySet<string>) => void }): JSX.Element | null` — une `<section aria-label="La frise des époques">` ; deux sliders nommés « Début de la plage » et « Fin de la plage » ; un bouton « Tout » hors repos.

Le dessin (maquette Figma 539:851 pour PC, 542:878 pour téléphone) : un fond `--color-feuille` légèrement transparent, un bord `--color-sable`, un rayon 16 px, une ombre douce ; en tête le titre en `--font-titre` (Bebas Neue) 20 px `--color-encre`, le détail en 11 px `--color-texte-doux` ; la piste : une case par époque, de même largeur, 2 px d'écart, 28 px de haut sur téléphone et 40 px sur PC, rayons 3 px (10 px aux deux bouts), à l'encre dans la plage (texte `--color-sur-accent`) et en `--color-sable` dehors (texte `--color-texte-doux`) ; sur PC le nom de l'époque est écrit dans sa case (10 px, semi-gras, centré, sur deux lignes au plus), sur téléphone il est caché et « Préhistoire » / « Ère digitale » s'écrivent sous les deux bouts en `--color-texte-pale`, sauf quand une année de borne occupe ce bout ; les poignées : des disques de 22 px `--color-feuille`, bord 2 px `--color-encre`, petite ombre ; sous chaque poignée, l'année de sa borne en 11 px gras `--color-encre`.

Les deux sliders : deux `<input type="range" step={1}>` posés sur la piste, transparents sauf leur poignée (`appearance: none`, `pointer-events: none` sur la piste et `auto` sur `::-webkit-slider-thumb` / `::-moz-range-thumb`). Pour que la poignée tombe au bord d'une case : le slider « début » va de 0 à n − 1 et couvre la largeur `(n − 1) / n` de la piste depuis la gauche ; le slider « fin » va de 0 à n − 1 (valeur = rang de la dernière époque) et couvre la même largeur depuis `1 / n`. Chacun déborde de 11 px de chaque côté (la demi-largeur de la poignée) pour que le centre de la poignée tombe pile sur le bord. `n` passe en variable CSS (`style={{ '--n': n }}`, typé `CSSProperties` sans cast large : déclarer `type AvecN = CSSProperties & { '--n': number }`).

- [ ] **Step 1: les tests qui échouent** — `FriseDesEpoques.test.tsx` :

```tsx
/**
 * QUOI     — la frise : l'en-tête suit la plage, une poignée ne dépasse pas l'autre, « Tout »
 *            remet au repos, rien ne s'affiche sans époques datées.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { EpoqueFiltre } from '../api/lireCarte'
import { FriseDesEpoques } from './FriseDesEpoques'

vi.mock('@/shared/hooks/useCalendrier', () => ({ useCalendrier: () => 'rome' }))

const e = (id: string, nom: string, debut: number | null, fin: number | null): EpoqueFiltre => ({
  id,
  nom,
  debut,
  fin,
})
const EPOQUES = [
  e('prehistory', 'Préhistoire', null, -3300),
  e('early-middle-ages', 'Haut Moyen Âge', 476, 1000),
  e('renaissance', 'Renaissance', 1453, 1600),
  e('digital-era', 'Ère digitale', 2020, null),
]

function afficher(choix: ReadonlySet<string> = new Set(), epoques = EPOQUES) {
  const onChoix = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <FriseDesEpoques epoques={epoques} choix={choix} onChoix={onChoix} />
    </QueryClientProvider>,
  )
  return onChoix
}

test('au repos : toutes les époques, pas de « Tout »', () => {
  afficher()
  expect(screen.getByText('Toutes les époques')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Tout' })).not.toBeInTheDocument()
})

test('une plage : son nom, ses bornes dans le calendrier du joueur', () => {
  afficher(new Set(['early-middle-ages', 'renaissance']))
  expect(screen.getByText('Haut Moyen Âge → Renaissance')).toBeInTheDocument()
  expect(
    screen.getByText('de 1229 à 2353 — en années depuis la fondation de Rome'),
  ).toBeInTheDocument()
})

test('déplacer la fin resserre la plage', () => {
  const onChoix = afficher()
  fireEvent.change(screen.getByRole('slider', { name: 'Fin de la plage' }), {
    target: { value: '1' },
  })
  expect([...(onChoix.mock.calls[0]?.[0] ?? [])]).toEqual(['prehistory', 'early-middle-ages'])
})

test('une poignée s’arrête sur l’autre', () => {
  const onChoix = afficher(new Set(['renaissance']))
  fireEvent.change(screen.getByRole('slider', { name: 'Début de la plage' }), {
    target: { value: '3' },
  })
  expect([...(onChoix.mock.calls[0]?.[0] ?? [])]).toEqual(['renaissance'])
})

test('« Tout » remet la frise au repos', async () => {
  const onChoix = afficher(new Set(['renaissance']))
  await userEvent.click(screen.getByRole('button', { name: 'Tout' }))
  expect(onChoix.mock.calls[0]?.[0]?.size).toBe(0)
})

test('sans au moins deux époques datées, rien', () => {
  afficher(new Set(), [])
  expect(screen.queryByRole('region', { name: 'La frise des époques' })).not.toBeInTheDocument()
})
```

- [ ] **Step 2:** `pnpm --filter web-v2 test FriseDesEpoques` → échec.

- [ ] **Step 3: le composant** — `FriseDesEpoques.tsx` :

```tsx
/**
 * QUOI     — la frise des époques, en bande sur la carte (maquette Figma 539:851 PC, 542:878
 *            téléphone) : la plage en clair, une case par époque datée, deux poignées et leurs
 *            bornes dans le calendrier du joueur.
 * POURQUOI — spec 2026-10-10-frise-des-epoques : elle remplace les boutons « Époques » de la
 *            feuille des filtres. Deux `<input type="range">` natifs : le clavier et les lecteurs
 *            d'écran sans bibliothèque.
 * ATTENTION — une poignée s'arrête sur l'autre ; la plage n'est jamais inversée. Le CSS place
 *            chaque slider pour que sa poignée tombe au bord d'une case (voir le module CSS).
 */
import type { CSSProperties } from 'react'
import { useCalendrier } from '@/shared/hooks/useCalendrier'
import type { EpoqueFiltre } from '../api/lireCarte'
import { auRepos, bornes, enTete, ensembleDe, epoquesDatees, plageDe, type Plage } from '../lib/frise'
import styles from './FriseDesEpoques.module.css'

type AvecN = CSSProperties & { '--n': number; '--de': number; '--a': number }

type Props = {
  epoques: EpoqueFiltre[]
  choix: ReadonlySet<string>
  onChoix: (choix: ReadonlySet<string>) => void
}

export function FriseDesEpoques({ epoques, choix, onChoix }: Props) {
  const calendrier = useCalendrier()
  const frise = epoquesDatees(epoques)
  if (frise.length < 2) return null
  const plage = plageDe(frise, choix)
  const repos = auRepos(frise, plage)
  const { titre, detail } = enTete(frise, plage, calendrier)
  const { debut, fin } = bornes(frise, plage, calendrier)
  const dernier = frise.length - 1
  const choisir = (p: Plage) => {
    onChoix(ensembleDe(frise, p))
  }
  const style: AvecN = { '--n': frise.length, '--de': plage.de, '--a': plage.a }

  return (
    <section className={styles.bande} aria-label="La frise des époques">
      <div className={styles.tete}>
        <div>
          <p className={styles.titre}>{titre}</p>
          <p className={styles.detail}>{detail}</p>
        </div>
        {!repos && (
          <button
            type="button"
            className={styles.tout}
            onClick={() => {
              onChoix(new Set())
            }}
          >
            Tout
          </button>
        )}
      </div>
      <div className={styles.piste} style={style}>
        <ol className={styles.cases}>
          {frise.map((e, i) => (
            <li
              key={e.id}
              className={styles.case}
              data-dedans={(!repos && i >= plage.de && i <= plage.a) || undefined}
            >
              <span className={styles.nom}>{e.nom}</span>
            </li>
          ))}
        </ol>
        <input
          type="range"
          className={`${styles.poignee} ${styles.debut}`}
          min={0}
          max={dernier}
          step={1}
          value={plage.de}
          aria-label="Début de la plage"
          aria-valuetext={frise[plage.de]?.nom}
          onChange={(ev) => {
            choisir({ de: Math.min(Number(ev.target.value), plage.a), a: plage.a })
          }}
        />
        <input
          type="range"
          className={`${styles.poignee} ${styles.fin}`}
          min={0}
          max={dernier}
          step={1}
          value={plage.a}
          aria-label="Fin de la plage"
          aria-valuetext={frise[plage.a]?.nom}
          onChange={(ev) => {
            choisir({ de: plage.de, a: Math.max(Number(ev.target.value), plage.de) })
          }}
        />
        <p className={styles.bornes} aria-hidden="true">
          {debut === null ? (
            <span className={styles.bout}>{frise[0]?.nom}</span>
          ) : (
            <span className={styles.annee} data-cote="debut">
              {debut}
            </span>
          )}
          {fin === null ? (
            <span className={`${styles.bout} ${styles.boutFin}`}>{frise[dernier]?.nom}</span>
          ) : (
            <span className={styles.annee} data-cote="fin">
              {fin}
            </span>
          )}
        </p>
      </div>
    </section>
  )
}
```

Le module CSS dessine ce qui est décrit plus haut. Points obligés :
- `.piste { position: relative; }` ; `.cases { display: grid; grid-template-columns: repeat(var(--n), 1fr); gap: 2px; }`.
- `.nom` caché sous 1024 px, visible au-dessus ; `.bout` visible sous 1024 px seulement ; `.boutFin { position: absolute; right: 0; }`.
- `.poignee { position: absolute; top: 0; height: <hauteur des cases>; margin: 0; appearance: none; background: none; pointer-events: none; }` avec la poignée stylée par `::-webkit-slider-thumb` et `::-moz-range-thumb` (`pointer-events: auto`, 22 px), et un anneau visible au `:focus-visible`.
- `.debut { left: -11px; width: calc((var(--n) - 1) / var(--n) * 100% + 22px); }` ; `.fin { left: calc(100% / var(--n) - 11px); width: calc((var(--n) - 1) / var(--n) * 100% + 22px); }`.
- `.annee[data-cote='debut'] { left: calc(var(--de) / var(--n) * 100%); translate: -50% 0; }` ; `.annee[data-cote='fin'] { left: calc((var(--a) + 1) / var(--n) * 100%); translate: -50% 0; }` (dans `.bornes { position: relative; }`, bornées au cadre par `max(0px, …)` si elles débordent).

- [ ] **Step 4:** `pnpm --filter web-v2 test FriseDesEpoques` et `pnpm --filter web-v2 lint` → passent.
- [ ] **Step 5: commit** — `feat(carte): la frise des époques`.

---

### Task 5: la frise sur la carte, les époques hors de la feuille

**Files:**
- Modify: `apps/web-v2/src/features/carte/components/CarteScreen.tsx` (en-tête ; état `friseOuverte` près de `filtreOuvert` ligne ~134 ; le bouton sablier dans `.haut` avant le bouton Filtre, ligne ~326 ; la bande ; `data-frise` sur la racine `.ecran`)
- Modify: `apps/web-v2/src/features/carte/components/CarteScreen.module.css` (`.sablier`, `.frise`, la rose / « Ma position » / « + » effacés sous `[data-frise]`)
- Modify: `apps/web-v2/src/features/carte/components/FiltreFeuille.tsx` (la rubrique « Époques » supprimée, lignes ~114-131 ; l'en-tête ; `epoques` ne se lit plus) et `FiltreFeuille.module.css` (`.epoque` supprimé s'il ne sert plus)
- Modify: `apps/web-v2/src/features/carte/lib/filtres.ts` (en-tête : les époques viennent de la frise)
- Test: `apps/web-v2/src/features/carte/components/CarteScreen.test.tsx`, `apps/web-v2/src/features/carte/lib/filtres.test.ts`

**Interfaces:**
- Consumes: `FriseDesEpoques` (tâche 4), `useFiltresDeCarte(actif)` (existant).

Comportement (spec, « Ce que voit le joueur ») :
- Le sablier : `<button type="button" className={styles.sablier} aria-label="Frise des époques" aria-expanded={friseOuverte} data-actif={(friseOuverte || filtres.epoques.size > 0) || undefined}>`, un SVG en ligne de 20 × 20, `stroke="currentColor"`, trait 1,6, bouts ronds, dessiné comme la maquette : deux traits horizontaux (haut et bas) et deux côtés qui se resserrent au milieu — `<path d="M4 2h12M4 18h12M5.5 2v3l4.5 5-4.5 5v3M14.5 2v3L10 10l4.5 5v3" />`. Même carré que `.filtre` (48 px, bord `--color-bord`, rayon) ; `[data-actif]` : fond `--color-encre`, icône `--color-sur-accent`. Seulement pour les membres (`!visiteur`), comme le bouton Filtre.
- Un appui ouvre ou referme ; la bande : `{!visiteur && friseOuverte && <div className={styles.frise}><FriseDesEpoques epoques={epoques} choix={filtres.epoques} onChoix={(choix) => { setFiltres({ ...filtres, epoques: choix }) }} /></div>}` avec `const { epoques } = useFiltresDeCarte(friseOuverte)` (même clé de cache que la feuille).
- `.frise` : `position: absolute; bottom: 20px; left: calc(24px + var(--decalage-carte)); right: 24px; z-index: 1;` et, à partir de 1024 px, centrée sur la partie carte, 960 px au plus.
- Sous `.ecran[data-frise]` : `.rose`, `.position` et `.ajouter` sont cachés (`display: none`), la bande prend leur place. *(Le « + » aussi : la bande, haute d'une centaine de pixels, le recouvrirait ; il revient dès qu'on referme.)*
- `FiltreFeuille` : supprimer la rubrique « Époques » et tout ce qui ne servait qu'à elle (`epoques` du hook, la classe CSS). « Réinitialiser » vide toujours `Filtres`, donc remet aussi la frise au repos.

- [ ] **Step 1: les tests qui échouent** —
  - `filtres.test.ts` : un lieu « Non concerné » est caché quand `epoques` est `new Set(['late-middle-ages'])`, un lieu sans époque aussi.
  - `CarteScreen.test.tsx` : le mock `fetchFiltres` (ligne 22) renvoie deux époques datées, `{ id: 'early-middle-ages', nom: 'Haut Moyen Âge', debut: 476, fin: 1000 }` et `{ id: 'renaissance', nom: 'Renaissance', debut: 1453, fin: 1600 }`. Nouveau test « le sablier ouvre la frise ; refermée sur une plage, il reste à l'encre » : cliquer « Frise des époques » → `findByRole('region', { name: 'La frise des époques' })` ; `fireEvent.change` sur « Fin de la plage » à `'0'` → le texte « Haut Moyen Âge » ; recliquer le sablier → la région disparaît et le bouton a `data-actif`. Puis ouvrir « Filtre », « Réinitialiser » → le sablier n'a plus `data-actif`. Dans le test vitrine existant (ligne ~392) : le sablier n'est pas là non plus. Dans le test « Filtre » existant : la feuille n'a plus de bouton « Préhistoire ».
  - Lancer `pnpm --filter web-v2 test CarteScreen filtres` → échec.
- [ ] **Step 2: le code** — comme décrit ci-dessus. En-têtes `QUOI` de `CarteScreen.tsx`, `CarteScreen.module.css`, `FiltreFeuille.tsx`, `filtres.ts` mis à jour (le sablier et la frise ; la feuille : ma progression et les natures).
- [ ] **Step 3:** `pnpm --filter web-v2 test`, `pnpm --filter web-v2 lint`, `pnpm --filter web-v2 build` → passent.
- [ ] **Step 4: commit** — `feat(carte): la frise sur la carte, les époques hors de la feuille des filtres`.

---

### Task 6: mise en ligne (session principale)

- [ ] Appliquer la 477 : `npx supabase db push --linked`. Vérifier en prod : `select name from eras where id = 'post-1945'` → « Après-guerre mondiale » ; `select filtres_de_carte()->'epoques'->0` contient `debut` et `fin`.
- [ ] `pnpm dev` (web-v2), dans le navigateur, sur PC et en largeur 390 px : ouvrir la frise, resserrer la plage au glisser et au clavier, voir les lieux disparaître en direct, refermer (sablier à l'encre), « Réinitialiser » dans les filtres ; passer en calendrier de Rome et voir les bornes changer, puis revenir en chrétien.
- [ ] Pythéas 1.16.0 (`apps/web-v2/package.json`, et la note de version si le dépôt en tient une), `pnpm --filter web-v2 build`, déploiement Netlify manuel selon `.claude/rules/deploiement.md`.
- [ ] `_État.md` : la ligne de la frise passe en « en prod » ; push.
