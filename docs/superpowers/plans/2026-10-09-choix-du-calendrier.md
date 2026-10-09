# Le choix du calendrier — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le joueur choisit son calendrier (chrétien, moderne, fondation de Rome, chute de Constantinople) à l'onboarding ou dans les Préférences, et les dates des lieux et des énigmes s'affichent dans ce calendrier.

**Architecture:** Un paquet pnpm pur `@runes/calendrier` porte toute la logique de conversion (balises `{…}` dans les textes, années, siècles) ; l'appli (`apps/web-v2`) et le Hub (`apps/hub`) l'importent. Le choix vit dans `users.calendrier` (migration 474), lu par un hook partagé `useCalendrier()` sous la clé `['preferences', 'calendrier']`. Les énigmes existantes reçoivent leurs balises par une migration 475, relue par Uriel avant d'être appliquée, et **après** le déploiement du code qui sait les lire.

**Tech Stack:** TypeScript strict, React 19, TanStack Query 5, Vitest 5, Supabase (Postgres, RPC `SECURITY DEFINER`), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-10-09-choix-du-calendrier-design.md` — à lire avant toute tâche.

## Global Constraints

- **pnpm** uniquement ; `npx` seulement pour `supabase`. Migrations : `npx supabase db push --linked`, appliquées par la session principale, jamais par un sous-agent.
- **TS strict** : pas de `any`, `@ts-ignore`, `as unknown as`, ni assertion `!`.
- Une zone de `apps/web-v2/src/features/` n'importe **jamais** une autre zone : ce qui se partage va dans `src/shared/`.
- Chaque fichier commence par l'en-tête `QUOI / POURQUOI / ATTENTION` en français, comme ses voisins. Pas de `console.log`.
- Valeurs : `'chretien' | 'moderne' | 'rome' | 'constantinople'`, défaut `'chretien'` (base, sans compte, avant lecture).
- Libellés exacts : « Chrétien — av. / ap. J.-C. », « Moderne — av. è. c. / è. c. », « Fondation de Rome », « Chute de Constantinople ».
- En `chretien`, le contenu d'une balise s'affiche **mot pour mot**.
- Années chrétiennes : négatif = avant J.-C., pas d'an zéro (−52 = 52 av. J.-C.), comme `places.year_exact`.
- **Conventional Commits**, terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Ordre de mise en ligne** : 474 appliquée → code déployé (Explore + Hub) → seulement ensuite 475 (sinon les joueurs voient des accolades).

## Review Focus

1. **QCM daté** : le joueur en `rome` touche « 702 ap. la fondation de Rome » ; le serveur doit recevoir `{52 av. J.-C.}` (le choix stocké), et le bon choix doit s'éclairer au verdict → test dans la Tâche 5.
2. **Accolade seule ou balise incomprise** dans un texte du Hub : le joueur ne doit voir ni plantage ni accolade de balise ; le Hub doit l'alerter → tests dans la Tâche 1 (`balisesIncomprises`, `texteEnClair`).
3. **Calendrier illisible** (visiteur sans compte, base qui répond `null`, valeur inconnue) : tout s'affiche en chrétien, rien ne casse → test dans la Tâche 2.
4. **Choix refusé par la base** pendant l'onboarding : on reste sur l'écran avec un message, on ne passe pas à la bienvenue → test dans la Tâche 4.
5. **Énigme libre dont la réponse est balisée** : le Hub refuse de l'enregistrer → vérifié à la main dans la Tâche 7 (le Hub n'a pas de tests).

---

### Task 1: Le paquet `@runes/calendrier`

**Files:**
- Create: `packages/calendrier/package.json`
- Create: `packages/calendrier/tsconfig.json`
- Create: `packages/calendrier/src/index.ts`
- Test: `packages/calendrier/src/index.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces :
  - `type Calendrier = 'chretien' | 'moderne' | 'rome' | 'constantinople'`
  - `CALENDRIERS: readonly { id: Calendrier; libelle: string; explication: string }[]` (dans l'ordre chretien, moderne, rome, constantinople)
  - `estCalendrier(v: unknown): v is Calendrier`
  - `texteEnClair(texte: string, calendrier: Calendrier): string`
  - `balisesIncomprises(texte: string): string[]`
  - `anneeEnClair(annee: number, calendrier: Calendrier): string`
  - `siecleEnClair(annee: number, calendrier: Calendrier): string`

- [ ] **Step 1: Créer le paquet**

`packages/calendrier/package.json` :

```json
{
  "name": "@runes/calendrier",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "6.0.3",
    "vitest": "5.0.2"
  }
}
```

`packages/calendrier/tsconfig.json` (les mêmes exigences que `apps/web-v2`, qui compilera ce code) :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

Run: `pnpm install` (à la racine)
Expected: le paquet apparaît dans le workspace, sans erreur.

- [ ] **Step 2: Écrire les tests**

`packages/calendrier/src/index.test.ts` :

```ts
/**
 * QUOI     — les conversions de la spec calendrier : son tableau d'exemples, les bords (pas d'an
 *            zéro, 753 av. J.-C., 1453), les siècles, les balises incomprises.
 */
import { expect, test } from 'vitest'
import {
  anneeEnClair,
  balisesIncomprises,
  CALENDRIERS,
  estCalendrier,
  siecleEnClair,
  texteEnClair,
} from './index'

const dansTous = (texte: string) => CALENDRIERS.map((c) => texteEnClair(texte, c.id))

test('le tableau de la spec, dans l’ordre chrétien, moderne, Rome, Constantinople', () => {
  expect(dansTous('{52 av. J.-C.}')).toEqual([
    '52 av. J.-C.',
    '52 av. è. c.',
    '702 ap. la fondation de Rome',
    '1504 av. la chute de Constantinople',
  ])
  expect(dansTous('{930}')).toEqual([
    '930',
    '930',
    '1683 ap. la fondation de Rome',
    '523 av. la chute de Constantinople',
  ])
  expect(dansTous('{IIIe siècle av. J.-C.}')).toEqual([
    'IIIe siècle av. J.-C.',
    'IIIᵉ siècle av. è. c.',
    'VIᵉ siècle ap. la fondation de Rome',
    'XVIIIᵉ siècle av. la chute de Constantinople',
  ])
  expect(dansTous('{1515}')).toEqual([
    '1515',
    '1515',
    '2268 ap. la fondation de Rome',
    '62 ap. la chute de Constantinople',
  ])
})

test('pas d’an zéro : les bords de Rome et de Constantinople', () => {
  expect(anneeEnClair(-753, 'rome')).toBe('1 ap. la fondation de Rome')
  expect(anneeEnClair(-754, 'rome')).toBe('1 av. la fondation de Rome')
  expect(anneeEnClair(-1, 'rome')).toBe('753 ap. la fondation de Rome')
  expect(anneeEnClair(1, 'rome')).toBe('754 ap. la fondation de Rome')
  expect(anneeEnClair(1453, 'constantinople')).toBe('l’année de la chute de Constantinople')
  expect(anneeEnClair(1454, 'constantinople')).toBe('1 ap. la chute de Constantinople')
  expect(anneeEnClair(1452, 'constantinople')).toBe('1 av. la chute de Constantinople')
})

test('une année de notre ère reste nue, sauf si la balise disait « ap. J.-C. »', () => {
  expect(anneeEnClair(930, 'chretien')).toBe('930')
  expect(anneeEnClair(-52, 'chretien')).toBe('52 av. J.-C.')
  expect(texteEnClair('{930 ap. J.-C.}', 'moderne')).toBe('930 è. c.')
  expect(texteEnClair('{930 ap. J.-C.}', 'chretien')).toBe('930 ap. J.-C.')
})

test('les siècles, des deux côtés de l’an 1', () => {
  expect(texteEnClair('{Iᵉʳ siècle av. J.-C.}', 'moderne')).toBe('Iᵉʳ siècle av. è. c.')
  expect(texteEnClair('{Ier siècle}', 'rome')).toBe('IXᵉ siècle ap. la fondation de Rome')
  expect(siecleEnClair(1150, 'chretien')).toBe('XIIᵉ siècle')
  expect(siecleEnClair(-52, 'chretien')).toBe('Iᵉʳ siècle av. J.-C.')
  expect(siecleEnClair(-52, 'rome')).toBe('VIIIᵉ siècle ap. la fondation de Rome')
  expect(siecleEnClair(1453, 'constantinople')).toBe('Iᵉʳ siècle ap. la chute de Constantinople')
})

test('un texte : ses balises converties, le reste intact', () => {
  expect(texteEnClair('Rien à convertir, 24 runes.', 'rome')).toBe('Rien à convertir, 24 runes.')
  expect(texteEnClair('entre {107 av. J.-C.} et {86 av. J.-C.}', 'rome')).toBe(
    'entre 647 ap. la fondation de Rome et 668 ap. la fondation de Rome',
  )
})

test('une balise incomprise s’affiche telle quelle, et le Hub la voit', () => {
  expect(texteEnClair('au {IIIe millénaire av. J.-C.}', 'rome')).toBe('au IIIe millénaire av. J.-C.')
  expect(balisesIncomprises('au {IIIe millénaire av. J.-C.} puis {52 av. J.-C.}')).toEqual([
    'IIIe millénaire av. J.-C.',
  ])
  expect(balisesIncomprises('en {52 av. J.-C.')).toEqual(['une accolade seule'])
  expect(balisesIncomprises('{0}')).toEqual(['0'])
  expect(balisesIncomprises('{52 av. J.-C.} et {IIIe siècle}')).toEqual([])
})

test('estCalendrier ne reconnaît que les quatre', () => {
  expect(estCalendrier('rome')).toBe(true)
  expect(estCalendrier('gaulois')).toBe(false)
  expect(estCalendrier(null)).toBe(false)
})
```

- [ ] **Step 3: Vérifier qu'ils échouent**

Run: `pnpm --filter @runes/calendrier test`
Expected: FAIL — `./index` introuvable.

- [ ] **Step 4: Écrire le module**

`packages/calendrier/src/index.ts` :

```ts
/**
 * QUOI     — les quatre calendriers d'Explore, et la conversion des dates écrites en chrétien.
 * POURQUOI — spec 2026-10-09-choix-du-calendrier : une date se balise entre accolades dans un
 *            texte (`{52 av. J.-C.}`, `{IIIe siècle av. J.-C.}`) ; l'appli et le Hub la réécrivent
 *            dans le calendrier choisi. Un seul code pour les deux : l'aperçu du Hub calcule comme
 *            l'appli.
 * ATTENTION — une année est chrétienne : négatif = avant J.-C., sans an zéro (−52 = 52 av. J.-C.),
 *            comme `places.year_exact`. En chrétien, une balise s'affiche mot pour mot.
 */
export type Calendrier = 'chretien' | 'moderne' | 'rome' | 'constantinople'

export const CALENDRIERS: readonly { id: Calendrier; libelle: string; explication: string }[] = [
  {
    id: 'chretien',
    libelle: 'Chrétien — av. / ap. J.-C.',
    explication:
      'Compté depuis la naissance de Jésus selon Denys le Petit (VIᵉ siècle), qui s’est trompé de quelques années : les historiens la placent entre 7 et 4 av. J.-C.',
  },
  {
    id: 'moderne',
    libelle: 'Moderne — av. è. c. / è. c.',
    explication: 'Les mêmes années, sans référence religieuse : avant l’ère commune, ère commune.',
  },
  {
    id: 'rome',
    libelle: 'Fondation de Rome',
    explication: 'Compté depuis la fondation légendaire de Rome, en 753 av. J.-C.',
  },
  {
    id: 'constantinople',
    libelle: 'Chute de Constantinople',
    explication: 'Compté depuis la prise de Constantinople par les Ottomans, en 1453.',
  },
]

export function estCalendrier(v: unknown): v is Calendrier {
  return CALENDRIERS.some((c) => c.id === v)
}

type Sens = 'av' | 'ap'

// Une année comptée dans un calendrier : « 702 » « ap. ». `null` : l'année même de la chute de
// Constantinople, qui n'est ni avant ni après.
function compter(annee: number, calendrier: Calendrier): { n: number; sens: Sens } | null {
  if (calendrier === 'chretien' || calendrier === 'moderne') {
    return annee < 0 ? { n: -annee, sens: 'av' } : { n: annee, sens: 'ap' }
  }
  // L'année astronomique a un an zéro : 1 av. J.-C. = 0, 52 av. J.-C. = −51.
  const astronomique = annee < 0 ? annee + 1 : annee
  if (calendrier === 'rome') {
    const depuisRome = astronomique + 753
    return depuisRome >= 1 ? { n: depuisRome, sens: 'ap' } : { n: 1 - depuisRome, sens: 'av' }
  }
  const depuisLaChute = astronomique - 1453
  if (depuisLaChute === 0) return null
  return depuisLaChute > 0
    ? { n: depuisLaChute, sens: 'ap' }
    : { n: -depuisLaChute, sens: 'av' }
}

// `explicite` : la balise disait « ap. J.-C. ». Sans lui, une année de notre ère reste nue en
// chrétien et en moderne (« 930 »), comme dans les textes.
function suffixe(sens: Sens, calendrier: Calendrier, explicite: boolean): string {
  switch (calendrier) {
    case 'chretien':
      return sens === 'av' ? ' av. J.-C.' : explicite ? ' ap. J.-C.' : ''
    case 'moderne':
      return sens === 'av' ? ' av. è. c.' : explicite ? ' è. c.' : ''
    case 'rome':
      return ` ${sens}. la fondation de Rome`
    case 'constantinople':
      return ` ${sens}. la chute de Constantinople`
  }
}

function romain(n: number): string {
  const table: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let reste = n
  return table.reduce((acc, [valeur, lettres]) => {
    const fois = Math.floor(reste / valeur)
    reste -= fois * valeur
    return acc + lettres.repeat(fois)
  }, '')
}

const VALEURS: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100 }

function deRomain(chiffres: string): number {
  const valeurs = [...chiffres].map((c) => VALEURS[c] ?? 0)
  return valeurs.reduce((total, v, i) => total + (v < (valeurs[i + 1] ?? 0) ? -v : v), 0)
}

function annee(a: number, calendrier: Calendrier, explicite: boolean): string {
  const compte = compter(a, calendrier)
  if (!compte) return 'l’année de la chute de Constantinople'
  return `${String(compte.n)}${suffixe(compte.sens, calendrier, explicite)}`
}

// Le siècle se prend sur l'année déjà convertie : −52 est au VIIIᵉ siècle de Rome.
function siecle(a: number, calendrier: Calendrier, explicite: boolean): string {
  const compte = compter(a, calendrier) ?? { n: 1, sens: 'ap' }
  const rang = Math.ceil(compte.n / 100)
  return `${romain(rang)}${rang === 1 ? 'ᵉʳ' : 'ᵉ'} siècle${suffixe(compte.sens, calendrier, explicite)}`
}

export function anneeEnClair(a: number, calendrier: Calendrier): string {
  return annee(a, calendrier, false)
}

export function siecleEnClair(a: number, calendrier: Calendrier): string {
  return siecle(a, calendrier, false)
}

const BALISE = /\{([^{}]*)\}/g
const ANNEE = /^([1-9]\d{0,3})(?: (av|ap)\. J\.-C\.)?$/
const SIECLE = /^([IVXLC]+)(?:e|er|ᵉ|ᵉʳ) siècle(?: (av|ap)\. J\.-C\.)?$/

// Le contenu d'une balise, converti ; `null` s'il sort de la grammaire de la spec.
function dateEnClair(contenu: string, calendrier: Calendrier): string | null {
  const enAnnee = ANNEE.exec(contenu)
  const enSiecle = SIECLE.exec(contenu)
  if (!enAnnee && !enSiecle) return null
  if (calendrier === 'chretien') return contenu
  if (enAnnee) {
    const n = Number(enAnnee[1])
    return annee(enAnnee[2] === 'av' ? -n : n, calendrier, enAnnee[2] === 'ap')
  }
  if (!enSiecle) return null
  // Un siècle passe par son milieu : le IIIe av. J.-C. (−300 à −201) par −250.
  const milieu = 100 * deRomain(enSiecle[1] ?? '') - 50
  return siecle(enSiecle[2] === 'av' ? -milieu : milieu, calendrier, enSiecle[2] === 'ap')
}

export function texteEnClair(texte: string, calendrier: Calendrier): string {
  return texte.replace(BALISE, (_balise, contenu: string) => {
    const propre = contenu.trim()
    return dateEnClair(propre, calendrier) ?? propre
  })
}

export function balisesIncomprises(texte: string): string[] {
  const incomprises = [...texte.matchAll(BALISE)]
    .map((m) => (m[1] ?? '').trim())
    .filter((contenu) => dateEnClair(contenu, 'moderne') === null)
  const horsBalises = texte.replace(BALISE, '')
  return /[{}]/.test(horsBalises) ? [...incomprises, 'une accolade seule'] : incomprises
}
```

- [ ] **Step 5: Vérifier qu'ils passent**

Run: `pnpm --filter @runes/calendrier test && pnpm --filter @runes/calendrier typecheck`
Expected: PASS, 7 tests ; aucune erreur de types.

- [ ] **Step 6: Commit**

```bash
git add packages/calendrier pnpm-lock.yaml
git commit -m "feat(calendrier): le paquet partagé qui convertit les dates balisées"
```

---

### Task 2: Le réglage en base et sa lecture côté appli

**Files:**
- Create: `supabase/migrations/474_choix_du_calendrier.sql`
- Modify: `apps/web-v2/package.json` (dépendance `@runes/calendrier`)
- Modify: `apps/web-v2/src/shared/supabase/database.types.ts` (régénéré)
- Create: `apps/web-v2/src/shared/lib/calendrierDuCompte.ts`
- Create: `apps/web-v2/src/shared/hooks/useCalendrier.ts`
- Test: `apps/web-v2/src/shared/hooks/useCalendrier.test.tsx`

**Interfaces:**
- Consumes: `Calendrier`, `estCalendrier` (Tâche 1).
- Produces :
  - RPC `set_calendrier(p_calendrier text) RETURNS json` → `{success, calendrier}` ou `{error}` ; `get_my_preferences()` renvoie en plus `calendrier`.
  - `lireCalendrier(): Promise<Calendrier>` et `reglerCalendrier(c: Calendrier): Promise<void>` dans `@/shared/lib/calendrierDuCompte`.
  - `useCalendrier(): Calendrier` et `useChoisirCalendrier(): { choisir: (c: Calendrier, options?: { onSuccess?: () => void }) => void; enCours: boolean; echec: boolean }` dans `@/shared/hooks/useCalendrier`.

- [ ] **Step 1: Vérifier la définition live avant d'écrire la migration**

Run: `npx supabase db query --linked "select pg_get_functiondef('public.get_my_preferences'::regproc)"`
Expected: identique au corps ci-dessous à la ligne `'calendrier'` près (relevé le 09/10). S'il a bougé, repartir du live.

- [ ] **Step 2: Écrire la migration**

`supabase/migrations/474_choix_du_calendrier.sql` :

```sql
-- WHY: Uriel, 09/10 — le choix du calendrier revient (spec 2026-10-09-choix-du-calendrier-design.md).
--   1. users.calendrier : chretien (défaut), moderne, rome, constantinople. Il suit le joueur d'un
--      appareil à l'autre (la V1 le gardait dans le navigateur).
--   2. set_calendrier : set_my_preference ne prend que des booléens ; même forme que set_title_gender.
--   3. get_my_preferences renvoie calendrier. Réécrite à partir de sa définition live (relevée le 09/10).

ALTER TABLE public.users
  ADD COLUMN calendrier text NOT NULL DEFAULT 'chretien'
  CONSTRAINT users_calendrier_check CHECK (calendrier IN ('chretien', 'moderne', 'rome', 'constantinople'));

CREATE OR REPLACE FUNCTION public.set_calendrier(p_calendrier text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN json_build_object('error', 'unauthorized'); END IF;
  IF p_calendrier NOT IN ('chretien', 'moderne', 'rome', 'constantinople') THEN
    RETURN json_build_object('error', 'bad_calendrier');
  END IF;
  UPDATE public.users SET calendrier = p_calendrier WHERE id = auth.uid()::text;
  RETURN json_build_object('success', true, 'calendrier', p_calendrier);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_calendrier(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_calendrier(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_preferences()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'email', u.email_address,
    'brouillerPistes', u.brouiller_pistes,
    'pushImportant', u.push_important_enabled,
    'pushRecap', u.push_recap_enabled,
    'showDepartement', u.show_departement,
    'showEnvies', u.show_envies,
    'lieuxEnCouleur', u.lieux_en_couleur,
    'titleGender', u.title_gender,
    'calendrier', u.calendrier
  )
  FROM public.users u
  WHERE u.id = (auth.uid())::text;
$function$;
```

- [ ] **Step 3: Appliquer et vérifier en prod** (session principale uniquement)

Run: `npx supabase db push --linked`
Puis : `npx supabase db query --linked "select calendrier, count(*) from users group by 1"`
Expected: une seule ligne `chretien` avec le nombre total de comptes.
Puis : `npx supabase db query --linked "select pg_get_functiondef('public.get_my_preferences'::regproc) like '%calendrier%' as ok"` → `true`.

- [ ] **Step 4: Brancher le paquet et régénérer les types**

Dans `apps/web-v2/package.json`, `dependencies` : `"@runes/calendrier": "workspace:*"`.

Run: `pnpm install` puis, dans `apps/web-v2` : `pnpm gen:types`
Expected: `database.types.ts` contient `set_calendrier` et la colonne `calendrier`.

- [ ] **Step 5: Écrire le test du hook**

`apps/web-v2/src/shared/hooks/useCalendrier.test.tsx` :

```tsx
/**
 * QUOI     — le calendrier lu (chrétien tant qu'on ne sait pas), et le choix qui s'affiche tout
 *            de suite.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import { useCalendrier, useChoisirCalendrier } from './useCalendrier'

const api = vi.hoisted(() => ({ lireCalendrier: vi.fn(), reglerCalendrier: vi.fn() }))
vi.mock('../lib/calendrierDuCompte', () => api)

function enveloppe() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

test('illisible (sans compte, réponse vide) : chrétien', async () => {
  api.lireCalendrier.mockRejectedValue(new Error('objet attendu'))
  const { result } = renderHook(() => useCalendrier(), { wrapper: enveloppe() })
  expect(result.current).toBe('chretien')
  await waitFor(() => {
    expect(api.lireCalendrier).toHaveBeenCalled()
  })
  expect(result.current).toBe('chretien')
})

test('choisir Rome : toutes les dates le lisent aussitôt', async () => {
  api.lireCalendrier.mockResolvedValue('chretien')
  api.reglerCalendrier.mockResolvedValue(undefined)
  const { result } = renderHook(() => ({ lu: useCalendrier(), ...useChoisirCalendrier() }), {
    wrapper: enveloppe(),
  })
  await waitFor(() => {
    expect(api.lireCalendrier).toHaveBeenCalled()
  })
  api.lireCalendrier.mockResolvedValue('rome')
  act(() => {
    result.current.choisir('rome')
  })
  await waitFor(() => {
    expect(result.current.lu).toBe('rome')
  })
  expect(api.reglerCalendrier.mock.calls[0]?.[0]).toBe('rome')
})
```

Run: `pnpm --filter web-v2 exec vitest run src/shared/hooks/useCalendrier.test.tsx`
Expected: FAIL — `./useCalendrier` introuvable.

- [ ] **Step 6: Écrire l'accès à la base et le hook**

`apps/web-v2/src/shared/lib/calendrierDuCompte.ts` :

```ts
/**
 * QUOI     — le calendrier de l'Explorateur connecté : le lire, le choisir.
 * POURQUOI — `users.calendrier` (mig 474). `set_calendrier` est à part : `set_my_preference` ne
 *            prend que des booléens. Partagé : l'onboarding, les Préférences et chaque écran qui
 *            affiche une date s'en servent.
 * ATTENTION — sans compte, `get_my_preferences` ne renvoie rien : `objet` lève, et l'appelant
 *            retombe sur le chrétien.
 */
import { estCalendrier, type Calendrier } from '@runes/calendrier'
import { supabase } from '@/shared/supabase/client'
import { objet } from './lire'

export async function lireCalendrier(): Promise<Calendrier> {
  const { data, error } = await supabase.rpc('get_my_preferences')
  if (error) throw error
  const calendrier = objet(data).calendrier
  return estCalendrier(calendrier) ? calendrier : 'chretien'
}

export async function reglerCalendrier(calendrier: Calendrier): Promise<void> {
  const { data, error } = await supabase.rpc('set_calendrier', { p_calendrier: calendrier })
  if (error) throw error
  if ('error' in objet(data)) throw new Error('calendrier refusé')
}
```

`apps/web-v2/src/shared/hooks/useCalendrier.ts` :

```ts
/**
 * QUOI     — le calendrier où s'affichent les dates, et le moyen d'en changer.
 * POURQUOI — la clé `['preferences', 'calendrier']` suit le contrat des Préférences (voir
 *            useLieuxEnCouleur) : changer de calendrier réécrit aussitôt toutes les dates à
 *            l'écran. Tant qu'il n'est pas lu, ou sans compte : chrétien, le défaut de la base.
 * ATTENTION — le choix s'affiche avant la réponse de la base ; refusé, la relecture remet le
 *            vrai, et `echec` permet de le dire.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Calendrier } from '@runes/calendrier'
import { lireCalendrier, reglerCalendrier } from '../lib/calendrierDuCompte'

const CLE = ['preferences', 'calendrier']

export function useCalendrier(): Calendrier {
  return useQuery({ queryKey: CLE, queryFn: lireCalendrier }).data ?? 'chretien'
}

export function useChoisirCalendrier() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: reglerCalendrier,
    onMutate: async (calendrier: Calendrier) => {
      await queryClient.cancelQueries({ queryKey: CLE })
      queryClient.setQueryData(CLE, calendrier)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CLE }),
  })
  return { choisir: mutation.mutate, enCours: mutation.isPending, echec: mutation.isError }
}
```

- [ ] **Step 7: Vérifier**

Run: `pnpm --filter web-v2 exec vitest run src/shared/hooks/useCalendrier.test.tsx && pnpm --filter web-v2 typecheck`
Expected: PASS ; aucune erreur de types.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/474_choix_du_calendrier.sql apps/web-v2/package.json pnpm-lock.yaml apps/web-v2/src/shared
git commit -m "feat(v2): le calendrier du compte — colonne, set_calendrier, useCalendrier"
```

---

### Task 3: Choisir son calendrier dans les Préférences

**Files:**
- Create: `apps/web-v2/src/shared/ui/ChoixDuCalendrier.tsx`
- Create: `apps/web-v2/src/shared/ui/ChoixDuCalendrier.module.css`
- Modify: `apps/web-v2/src/features/compte/components/PreferencesPage.tsx` (nouvelle carte après « Ta présence sur la carte »)
- Test: `apps/web-v2/src/features/compte/components/PreferencesPage.test.tsx`

**Interfaces:**
- Consumes: `CALENDRIERS`, `Calendrier` (Tâche 1) ; `useCalendrier`, `useChoisirCalendrier` (Tâche 2).
- Produces : `ChoixDuCalendrier({ valeur, onChange }: { valeur: Calendrier; onChange: (c: Calendrier) => void })` — un `radiogroup` nommé « Ton calendrier », un bouton radio par calendrier, nommé par son libellé.

- [ ] **Step 1: Écrire le test**

Dans `PreferencesPage.test.tsx`, ajouter après les autres `vi.mock` :

```tsx
const calendrier = vi.hoisted(() => ({
  lireCalendrier: vi.fn((): Promise<'chretien' | 'rome'> => Promise.resolve('chretien')),
  reglerCalendrier: vi.fn((_c: string) => Promise.resolve()),
}))
vi.mock('@/shared/lib/calendrierDuCompte', () => calendrier)
```

et le test (la relecture qui suit l'enregistrement doit rendre Rome, d'où le second `mockResolvedValue`) :

```tsx
test('le calendrier : quatre choix expliqués, Rome s’enregistre', async () => {
  ouvrir()
  const carte = await screen.findByRole('region', { name: 'Ton calendrier' })
  expect(carte).toHaveTextContent('Denys le Petit')
  expect(screen.getByRole('radio', { name: /Chrétien/ })).toBeChecked()
  calendrier.lireCalendrier.mockResolvedValue('rome')
  await userEvent.click(screen.getByRole('radio', { name: /Fondation de Rome/ }))
  expect(screen.getByRole('radio', { name: /Fondation de Rome/ })).toBeChecked()
  await waitFor(() => {
    expect(calendrier.reglerCalendrier.mock.calls[0]?.[0]).toBe('rome')
  })
})
```

Si le test existant « les trois cartes » compte les régions, passer son attente à quatre.

Run: `pnpm --filter web-v2 exec vitest run src/features/compte/components/PreferencesPage.test.tsx`
Expected: FAIL — pas de région « Ton calendrier ».

- [ ] **Step 2: Écrire le composant**

`apps/web-v2/src/shared/ui/ChoixDuCalendrier.tsx` :

```tsx
/**
 * QUOI     — les quatre calendriers, chacun avec sa ligne d'explication : un seul se choisit.
 * POURQUOI — le même choix à l'onboarding et dans les Préférences (spec calendrier). De vrais
 *            boutons radio, comme `Segments` : clavier et lecteurs d'écran sans code maison.
 */
import { CALENDRIERS, type Calendrier } from '@runes/calendrier'
import { useId } from 'react'
import styles from './ChoixDuCalendrier.module.css'

export function ChoixDuCalendrier({
  valeur,
  onChange,
}: {
  valeur: Calendrier
  onChange: (calendrier: Calendrier) => void
}) {
  const nom = useId()
  return (
    <div className={styles.choix} role="radiogroup" aria-label="Ton calendrier">
      {CALENDRIERS.map((c) => (
        <label key={c.id} className={styles.option}>
          <input
            type="radio"
            name={nom}
            className={styles.radio}
            checked={c.id === valeur}
            onChange={() => {
              onChange(c.id)
            }}
          />
          <span className={styles.texte}>
            <span className={styles.libelle}>{c.libelle}</span>
            <span className={styles.explication}>{c.explication}</span>
          </span>
        </label>
      ))}
    </div>
  )
}
```

`apps/web-v2/src/shared/ui/ChoixDuCalendrier.module.css` :

```css
/*
 * QUOI     — une option par ligne, séparées d'un filet ; choisie : le bord rouge des pastilles
 *            choisies (PastilleChoix), titre et légende comme les lignes des Préférences.
 */
.choix {
  display: grid;
}

.option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  min-height: var(--cible-tactile);
  padding: var(--space-3) var(--space-4);
  border: 1.5px solid transparent;
  border-radius: var(--radius-carte);
  cursor: pointer;
}

.option + .option {
  border-top-color: color-mix(in srgb, var(--color-bord) 60%, transparent);
}

.option:has(.radio:checked) {
  border-color: var(--color-accent);
  background: var(--color-choisie);
}

.radio {
  flex: none;
  margin-top: 3px;
  accent-color: var(--color-accent);
}

.texte {
  display: grid;
  gap: var(--space-1);
  text-align: left;
}

.libelle {
  color: var(--color-encre);
  font-family: var(--font-corps);
  font-size: var(--corps-size);
  font-weight: var(--weight-semi);
}

.explication {
  color: var(--color-texte-doux);
  font-family: var(--font-corps);
  font-size: var(--legende-size);
  line-height: var(--dense-leading);
}
```

- [ ] **Step 3: La carte dans les Préférences**

Dans `PreferencesPage.tsx` :
- imports : `import { useCalendrier, useChoisirCalendrier } from '@/shared/hooks/useCalendrier'` et `import { ChoixDuCalendrier } from '@/shared/ui/ChoixDuCalendrier'` ;
- en tête de `PreferencesPage()`, avec les autres hooks (avant tout `return`) :

```tsx
  const calendrier = useCalendrier()
  const choixDuCalendrier = useChoisirCalendrier()
```

- dans la condition d'alerte existante, `{echec && (` devient `{(echec || choixDuCalendrier.echec) && (` ;
- entre `</Carte>` de « Ta présence sur la carte » et `<Carte titre="Ton compte">` :

```tsx
      <Carte titre="Ton calendrier">
        <ChoixDuCalendrier
          valeur={calendrier}
          onChange={(c) => {
            choixDuCalendrier.choisir(c)
          }}
        />
      </Carte>
```

- ajouter au commentaire d'en-tête : « Le calendrier (spec 2026-10-09) : où s'affichent les dates des lieux et des énigmes. »

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter web-v2 exec vitest run src/features/compte && pnpm --filter web-v2 lint`
Expected: PASS ; lint propre (stylelint compris).

- [ ] **Step 5: Commit**

```bash
git add apps/web-v2/src/shared/ui/ChoixDuCalendrier.* apps/web-v2/src/features/compte
git commit -m "feat(v2): choisir son calendrier dans les Préférences"
```

---

### Task 4: L'étape « calendrier » de l'onboarding

**Files:**
- Create: `apps/web-v2/src/features/onboarding/components/Calendrier.tsx`
- Modify: `apps/web-v2/src/features/onboarding/hooks/useParcours.ts:15` (type `Etape`)
- Modify: `apps/web-v2/src/features/onboarding/components/Onboarding.tsx` (table `ECRANS`, commentaire « sept écrans »)
- Modify: `apps/web-v2/src/features/onboarding/components/Nom.tsx:21` (`aller('fin')` → `aller('calendrier')`)
- Modify: `apps/web-v2/src/features/onboarding/README.md` (la liste des étapes)
- Test: `apps/web-v2/src/features/onboarding/components/Onboarding.test.tsx`

**Interfaces:**
- Consumes: `ChoixDuCalendrier` (Tâche 3), `useChoisirCalendrier` (Tâche 2), `Page`, `Suivant` (`./Page`), `useParcours`.
- Produces : l'adresse `/bienvenue/calendrier`.

- [ ] **Step 1: Écrire le test**

Dans `Onboarding.test.tsx`, ajouter après `vi.mock('../api/entree', () => api)` :

```tsx
const calendrier = vi.hoisted(() => ({
  lireCalendrier: vi.fn((): Promise<'chretien'> => Promise.resolve('chretien')),
  reglerCalendrier: vi.fn((_c: string) => Promise.resolve()),
}))
vi.mock('@/shared/lib/calendrierDuCompte', () => calendrier)
```

Dans le test « du Préambule à la bienvenue », entre le clic sur « Suivant » de l'écran du nom (et `expect(api.nommer)…`) et `expect(await screen.findByText('Claire M.'))…`, insérer :

```tsx
  expect(await screen.findByRole('heading', { name: 'Quel calendrier ?' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: /Chrétien/ })).toBeChecked()
  await userEvent.click(screen.getByRole('radio', { name: /Moderne/ }))
  await userEvent.click(screen.getByRole('button', { name: /Suivant/ }))
  expect(calendrier.reglerCalendrier.mock.calls[0]?.[0]).toBe('moderne')
```

Puis un nouveau test :

```tsx
test('un calendrier refusé par la base le dit, et on reste sur l’écran', async () => {
  calendrier.reglerCalendrier.mockRejectedValueOnce(new Error('refusé'))
  monter('/bienvenue/calendrier')
  await userEvent.click(await screen.findByRole('button', { name: /Suivant/ }))
  expect(await screen.findByRole('alert')).toHaveTextContent('n’a pas pu être enregistré')
  expect(screen.getByRole('heading', { name: 'Quel calendrier ?' })).toBeInTheDocument()
})
```

Run: `pnpm --filter web-v2 exec vitest run src/features/onboarding`
Expected: FAIL — pas d'écran « Quel calendrier ? ».

- [ ] **Step 2: Écrire l'écran**

`apps/web-v2/src/features/onboarding/components/Calendrier.tsx` :

```tsx
/**
 * QUOI     — « Quel calendrier ? » : où s'afficheront les dates des lieux et des énigmes.
 * POURQUOI — Uriel, 09/10 : le choix se propose à l'entrée, juste après le nom (spec calendrier).
 *            Chrétien est déjà coché : « Suivant » sans rien toucher garde le défaut.
 * ATTENTION — un compte déjà entré ne passe pas par ici : il change de calendrier dans les
 *            Préférences.
 */
import type { Calendrier as Choix } from '@runes/calendrier'
import { useState } from 'react'
import { useChoisirCalendrier } from '@/shared/hooks/useCalendrier'
import { ChoixDuCalendrier } from '@/shared/ui/ChoixDuCalendrier'
import { useParcours } from '../hooks/useParcours'
import styles from './Onboarding.module.css'
import { Page, Suivant } from './Page'

export function Calendrier() {
  const { aller } = useParcours()
  const [choix, setChoix] = useState<Choix>('chretien')
  const { choisir, enCours, echec } = useChoisirCalendrier()

  return (
    <Page
      bas={
        <Suivant
          disabled={enCours}
          onClick={() => {
            choisir(choix, {
              onSuccess: () => {
                aller('fin')
              },
            })
          }}
        />
      }
    >
      <h1 className={styles.titre}>Quel calendrier ?</h1>
      <p className={styles.chapeau}>
        Les dates des lieux et des énigmes s’afficheront ainsi. Tu pourras en changer dans tes
        préférences.
      </p>
      <ChoixDuCalendrier valeur={choix} onChange={setChoix} />
      {echec && (
        <p role="alert" className={styles.alerte}>
          Ton calendrier n’a pas pu être enregistré. Réessaie dans un instant.
        </p>
      )}
    </Page>
  )
}
```

- [ ] **Step 3: L'insérer dans le parcours**

- `useParcours.ts:15` : `export type Etape = 'preambule' | 'charte' | 'email' | 'code' | 'nom' | 'calendrier' | 'fin'`
- `Onboarding.tsx` : `import { Calendrier } from './Calendrier'`, ajouter `calendrier: Calendrier,` entre `nom: Nom,` et `fin: Bienvenue,` ; le commentaire d'en-tête dit « les sept écrans d'entrée ».
- `Nom.tsx:21` : `aller('fin')` → `aller('calendrier')`.
- `README.md` : la liste des adresses devient `` `charte` et `nom` s'ils manquent au compte, `calendrier` juste après `nom`, et `fin` `` ; la liste des composants ajoute `Calendrier`.

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter web-v2 exec vitest run src/features/onboarding && pnpm --filter web-v2 typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web-v2/src/features/onboarding
git commit -m "feat(v2): le choix du calendrier à l'entrée, après le nom"
```

---

### Task 5: Les dates des énigmes dans le calendrier choisi

**Files:**
- Modify: `apps/web-v2/src/features/carte/components/FeuilleEnigme.tsx` (récit, question, choix)
- Modify: `apps/web-v2/src/features/carte/components/VerdictEnigme.tsx` (réponse, explication)
- Modify: `apps/web-v2/src/features/enigmes/components/PageCulture.tsx` (question, réponse, explication)
- Test: `apps/web-v2/src/features/carte/components/FeuilleEnigme.test.tsx`
- Test: `apps/web-v2/src/features/enigmes/components/PageCulture.test.tsx`

**Interfaces:**
- Consumes: `texteEnClair` (Tâche 1), `useCalendrier` (Tâche 2).
- Produces : rien de nouveau ; `onRepondre` et `percerEnigme` reçoivent toujours le texte **stocké** du choix.

- [ ] **Step 1: Écrire les tests**

Dans `FeuilleEnigme.test.tsx`, ajouter après le `vi.mock('../api/enigmes', …)` :

```tsx
const calendrier = vi.hoisted(() => ({
  lireCalendrier: vi.fn((): Promise<'chretien' | 'rome'> => Promise.resolve('chretien')),
  reglerCalendrier: vi.fn(),
}))
vi.mock('@/shared/lib/calendrierDuCompte', () => calendrier)
```

et le test :

```tsx
test('en calendrier de Rome : les dates converties, le choix stocké part au serveur', async () => {
  calendrier.lireCalendrier.mockResolvedValue('rome')
  ouvrirEnigme.mockResolvedValue({
    ...enigme,
    recit: 'En {52 av. J.-C.}, Vercingétorix se rend.',
    question: 'Quand Alésia tombe-t-elle ?',
    choix: ['{52 av. J.-C.}', '{58 av. J.-C.}'],
  })
  percerEnigme.mockResolvedValue({
    juste: true, reponse: '{52 av. J.-C.}', explication: 'César le raconte en {51 av. J.-C.}.', xp: 1, gagnes: 1,
    points: 5, total: 130, nouveauxTitres: [], prochain: null,
    resteEnAttente: 0, niveau: { niveau: 12, avant: 0.5, apres: 0.52 },
  })
  monter()
  await retourner()
  expect(await screen.findByText('En 702 ap. la fondation de Rome, Vercingétorix se rend.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '702 ap. la fondation de Rome' }))
  expect(percerEnigme).toHaveBeenCalledWith(4, '{52 av. J.-C.}')
  expect(await screen.findByText('La réponse : 702 ap. la fondation de Rome')).toBeInTheDocument()
  expect(screen.getByText('César le raconte en 703 ap. la fondation de Rome.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '702 ap. la fondation de Rome' })).toHaveAttribute('data-juste', 'true')
})
```

Le nom accessible d'un choix inclut sa lettre cachée (`aria-hidden`) : il vaut bien le seul libellé, comme « Sainte-Sophie » dans le test existant. Si `prochain: null` n'est pas accepté par le type `Verdict`, reprendre l'objet `prochain` du premier test.

Dans `PageCulture.test.tsx`, ajouter le même `vi.mock('@/shared/lib/calendrierDuCompte', …)` (résolvant `'moderne'`) et :

```tsx
test('les énigmes résolues dans le calendrier choisi', async () => {
  api.fetchMaCulture.mockResolvedValue({
    ...byzance,
    enigmes: [{ ...byzance.enigmes[0], question: 'Que se passe-t-il en {52 av. J.-C.} ?', reponse: '{IIIe siècle av. J.-C.}' }],
  })
  afficher()
  expect(await screen.findByText('Que se passe-t-il en 52 av. è. c. ?')).toBeInTheDocument()
  expect(screen.getByText('IIIᵉ siècle av. è. c.')).toBeInTheDocument()
})
```

Run: `pnpm --filter web-v2 exec vitest run src/features/carte/components/FeuilleEnigme.test.tsx src/features/enigmes/components/PageCulture.test.tsx`
Expected: FAIL — les accolades s'affichent.

- [ ] **Step 2: Convertir à l'affichage**

`FeuilleEnigme.tsx` :
- imports : `import { texteEnClair } from '@runes/calendrier'` et `import { useCalendrier } from '@/shared/hooks/useCalendrier'` ;
- dans `FeuilleEnigme`, avec les autres hooks : `const calendrier = useCalendrier()` ;
- `{enigme.recit}` → `{texteEnClair(enigme.recit, calendrier)}` ; les deux `{enigme.question}` → `{texteEnClair(enigme.question, calendrier)}` ;
- le composant `Reponses` (ligne 161, appelé ligne 109) reçoit une prop de plus `calendrier: Calendrier` (type importé de `@runes/calendrier`), passée par `FeuilleEnigme` ; dans `enigme.choix.map((c, i) => …)`, seul le libellé affiché change : `{c}` (après la lettre) → `{texteEnClair(c, calendrier)}`. `key={c}`, `onRepondre(c)`, `c === verdict.reponse` et `c === choisie` gardent `c`.
- ajouter au commentaire d'en-tête : « Les dates balisées s'affichent dans le calendrier du joueur ; un choix part au serveur tel qu'il est stocké (spec calendrier). »

`VerdictEnigme.tsx` : `FeteDuVerdict` et `BilanDuVerdict` appellent `const calendrier = useCalendrier()` ; `` `La réponse : ${verdict.reponse}` `` → `` `La réponse : ${texteEnClair(verdict.reponse, calendrier)}` `` ; `{verdict.explication}` → `{texteEnClair(verdict.explication, calendrier)}`.

`PageCulture.tsx` : `const calendrier = useCalendrier()` dans le composant qui rend la liste ; `{e.question}`, `{e.reponse}`, `{e.explication}` → `texteEnClair(…, calendrier)`.

- [ ] **Step 3: Vérifier**

Run: `pnpm --filter web-v2 exec vitest run src/features/carte src/features/enigmes && pnpm --filter web-v2 typecheck`
Expected: PASS, anciens tests compris.

- [ ] **Step 4: Commit**

```bash
git add apps/web-v2/src/features/carte apps/web-v2/src/features/enigmes
git commit -m "feat(v2): les dates des énigmes dans le calendrier du joueur"
```

---

### Task 6: Les dates des lieux

**Files:**
- Modify: `apps/web-v2/src/features/lieu/lib/faits.ts` (`romain` et `siecle` partent dans le paquet)
- Modify: `apps/web-v2/src/features/lieu/components/FicheLieu.tsx:92`
- Modify: `apps/web-v2/src/features/ajout/components/EtapeApercu.tsx:65-70`
- Modify: `apps/web-v2/src/features/ajout/components/ChampsDuLieu.tsx` (libellé de la case)
- Test: `apps/web-v2/src/features/lieu/lib/faits.test.ts`

**Interfaces:**
- Consumes: `siecleEnClair`, `anneeEnClair`, `Calendrier` (Tâche 1), `useCalendrier` (Tâche 2).
- Produces : `ligneDeFaits(f: FicheLieu['faits'], calendrier: Calendrier): string | null`.

- [ ] **Step 1: Écrire le test**

Remplacer `faits.test.ts` par :

```ts
import { expect, test } from 'vitest'
import { ligneDeFaits } from './faits'

const vide = { epoque: null, annee: null }

test('la ligne ne dit que ce qui est connu : l’époque et le siècle', () => {
  expect(ligneDeFaits({ epoque: 'Moyen Âge', annee: 1150 }, 'chretien')).toBe('Moyen Âge · XIIᵉ siècle')
  expect(ligneDeFaits({ ...vide, annee: -52 }, 'chretien')).toBe('Iᵉʳ siècle av. J.-C.')
})

test('le siècle dans le calendrier choisi', () => {
  expect(ligneDeFaits({ epoque: 'Antiquité', annee: -52 }, 'moderne')).toBe('Antiquité · Iᵉʳ siècle av. è. c.')
  expect(ligneDeFaits({ epoque: 'Antiquité', annee: -52 }, 'rome')).toBe(
    'Antiquité · VIIIᵉ siècle ap. la fondation de Rome',
  )
  expect(ligneDeFaits({ ...vide, annee: 1515 }, 'constantinople')).toBe('Iᵉʳ siècle ap. la chute de Constantinople')
})

test('rien de connu : pas de ligne', () => {
  expect(ligneDeFaits(vide, 'rome')).toBeNull()
})
```

Run: `pnpm --filter web-v2 exec vitest run src/features/lieu/lib/faits.test.ts`
Expected: FAIL.

- [ ] **Step 2: `faits.ts` délègue au paquet**

```ts
/**
 * QUOI     — la ligne de faits sous le type : l'époque et le siècle.
 * POURQUOI — elle répond aux questions de qui envisage d'y aller ; elle ne dit que ce qui est
 *            connu, et disparaît sinon (spec fiche §2). Le siècle suit le calendrier du joueur
 *            (spec calendrier) ; le calcul vit dans `@runes/calendrier`.
 */
import { siecleEnClair, type Calendrier } from '@runes/calendrier'
import type { FicheLieu } from '../api/lireLieu'

export function ligneDeFaits(f: FicheLieu['faits'], calendrier: Calendrier): string | null {
  const morceaux = [f.epoque, f.annee === null ? null : siecleEnClair(f.annee, calendrier)].filter(
    (m): m is string => m !== null,
  )
  return morceaux.length > 0 ? morceaux.join(' · ') : null
}
```

- [ ] **Step 3: Les écrans**

- `FicheLieu.tsx` : `const calendrier = useCalendrier()` avec les autres hooks, **avant** les `return` anticipés ; ligne 92 : `ligneDeFaits(fiche.faits, calendrier)`.
- `EtapeApercu.tsx` : `const calendrier = useCalendrier()` avec les autres hooks ; le bloc des lignes 65-70 devient :

```ts
  const annee = brouillon.annee === null ? null : anneeEnClair(brouillon.annee, calendrier)
```

  (imports `anneeEnClair` de `@runes/calendrier`, `useCalendrier` de `@/shared/hooks/useCalendrier`).
- `ChampsDuLieu.tsx` : le libellé de la case `av. J.-C.` → `av. è. c.` ; le commentaire « Les bornes de la base : 10 000 av. J.-C., 2100 après. » reste juste. La variable `avantJC` peut rester : elle dit la même chose.

- [ ] **Step 4: Vérifier**

Run: `pnpm --filter web-v2 exec vitest run src/features/lieu src/features/ajout && pnpm --filter web-v2 typecheck`
Expected: PASS. Si un test de `ajout` cherche le libellé « av. J.-C. », le passer à « av. è. c. ».

- [ ] **Step 5: Commit**

```bash
git add apps/web-v2/src/features/lieu apps/web-v2/src/features/ajout
git commit -m "feat(v2): le siècle des lieux dans le calendrier du joueur, l'année saisie en ère commune"
```

---

### Task 7: Le Hub — aperçu, garde-fou, listes

**Files:**
- Modify: `apps/hub/package.json` (dépendance)
- Create: `apps/hub/src/components/enigmes/ApercuCalendriers.tsx`
- Modify: `apps/hub/src/components/enigmes/FormulaireEnigme.tsx` (l'aperçu sous l'explication)
- Modify: `apps/hub/src/components/Enigmas.tsx` (`handleSaveForm` refuse ; la question de la liste en clair)
- Modify: `apps/hub/src/components/enigmes/EnigmesSignalees.tsx` (question, réponse attendue, réponse du joueur en clair)

**Interfaces:**
- Consumes: `CALENDRIERS`, `texteEnClair`, `balisesIncomprises` (Tâche 1) ; `EnigmaForm` (`./types`).
- Produces : `ApercuCalendriers({ form }: { form: EnigmaForm })`.

- [ ] **Step 1: Brancher le paquet**

`apps/hub/package.json`, `dependencies` : `"@runes/calendrier": "workspace:*"`. Run: `pnpm install`.

- [ ] **Step 2: L'aperçu**

`apps/hub/src/components/enigmes/ApercuCalendriers.tsx` :

```tsx
import { balisesIncomprises, CALENDRIERS, texteEnClair } from '@runes/calendrier'
import type { EnigmaForm } from './types'

// L'énigme telle que la liront les joueurs dans chaque calendrier (spec 2026-10-09-choix-du-calendrier).
// Une date s'écrit entre accolades, en chrétien : {52 av. J.-C.}, {IIIe siècle av. J.-C.}. Une balise
// incomprise s'afficherait telle quelle chez le joueur : on la signale.
export function ApercuCalendriers({ form }: { form: EnigmaForm }) {
  const choix = form.format === 'qcm' ? form.choices ?? [] : []
  const textes = [form.lore_text, form.question, ...choix, form.answer, form.explanation]
  if (!textes.some(t => /[{}]/.test(t))) return null
  const incomprises = textes.flatMap(balisesIncomprises)

  return (
    <div className="faction-field" style={{ marginBottom: 12 }}>
      <label className="faction-field-label">Aperçu des dates</label>
      {incomprises.length > 0 && (
        <div style={{ color: '#ef4444', marginBottom: 8 }}>
          Balises incomprises : {incomprises.join(' · ')}
        </div>
      )}
      {CALENDRIERS.map(c => (
        <details key={c.id}>
          <summary>{c.libelle}</summary>
          <p>{texteEnClair(form.lore_text, c.id)}</p>
          <p><strong>{texteEnClair(form.question, c.id)}</strong></p>
          {choix.length > 0 && (
            <ul>
              {choix.map((ch, i) => <li key={i}>{texteEnClair(ch, c.id)}</li>)}
            </ul>
          )}
          <p>Réponse : {texteEnClair(form.answer, c.id)}</p>
          <p>{texteEnClair(form.explanation, c.id)}</p>
        </details>
      ))}
    </div>
  )
}
```

Dans `FormulaireEnigme.tsx` : `import { ApercuCalendriers } from './ApercuCalendriers'`, et `<ApercuCalendriers form={form} />` juste après le bloc « Explication », avant la case « Active ».

- [ ] **Step 3: Le garde-fou à l'enregistrement**

Dans `Enigmas.tsx`, `handleSaveForm`, juste après `setSaveError(null)` :

```ts
    // Une réponse libre ne se balise pas : personne ne taperait « 702 ap. la fondation de Rome »
    // (spec calendrier).
    if (editForm.format === 'free' && /[{}]/.test(editForm.answer)) {
      setSaveError('Une réponse libre ne peut pas être une date balisée : passe en QCM, ou écris-la sans accolades.')
      setSaving(false)
      return
    }
```

- [ ] **Step 4: Les listes en clair (chrétien, sans accolades)**

- `Enigmas.tsx`, cellule de la question (vers la ligne 433) : `{e.question || …}` → `{texteEnClair(e.question, 'chretien') || …}` ; import `texteEnClair` de `@runes/calendrier`.
- `EnigmesSignalees.tsx` : `{s.enigme.question}`, `{s.enigme.reponse}` et `{s.reponseDonnee}` → `texteEnClair(…, 'chretien')` (un QCM renvoie le choix stocké, accolades comprises).

- [ ] **Step 5: Vérifier à la main**

Run (dans `apps/hub`) : `pnpm build` → OK. Puis `pnpm dev` (port 3001), ouvrir une énigme :
- taper `En {52 av. J.-C.}` dans le récit → l'aperçu apparaît, quatre calendriers, « 702 ap. la fondation de Rome » sous Rome ;
- taper `{52 av. J.-C.` → « une accolade seule » en rouge ;
- format Libre, réponse `{52 av. J.-C.}` → « Enregistrer » refuse avec le message ;
- **ne rien enregistrer** en prod pendant l'essai (annuler).

- [ ] **Step 6: Commit**

```bash
git add apps/hub pnpm-lock.yaml
git commit -m "feat(hub): l'aperçu des dates dans les quatre calendriers, et le garde-fou des réponses libres"
```

---

### Task 8: Livrer le code (Explore et Hub)

**Files:**
- Modify: `apps/web-v2/package.json` (`version` → `1.14.0`)

- [ ] **Step 1: Tout vérifier**

Run (dans `apps/web-v2`) : `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Run : `pnpm --filter @runes/calendrier test`
Expected: tout passe.

- [ ] **Step 2: Le parcours dans le navigateur**

`pnpm dev` (port 5174), connecté :
- Préférences → « Ton calendrier » → Fondation de Rome ;
- une fiche de lieu datée → le siècle « … ap. la fondation de Rome » ;
- l'aperçu d'ajout d'un lieu avec une année → l'année convertie ; la case dit « av. è. c. » ;
- revenir en chrétien → les dates redeviennent « av. J.-C. ».
(Les énigmes n'ont pas encore de balises : elles ne changent pas, c'est attendu.)

- [ ] **Step 3: Version et commit**

`apps/web-v2/package.json` : `"version": "1.14.0"`.

```bash
git add apps/web-v2/package.json
git commit -m "chore(v2): Pythéas 1.14.0 — le choix du calendrier"
```

- [ ] **Step 4: Déployer** — lire `.claude/rules/deploiement.md` d'abord ; Netlify manuel. Explore (`runesdechene`) puis Hub (`hub-runesdechene`), vérifier le build servi comme le dit la règle. Push.

---

### Task 9: Baliser les énigmes existantes (relu par Uriel)

**Files:**
- Create: `supabase/migrations/475_dates_balisees.sql`
- Temporaire (scratchpad, jamais commité) : la liste avant/après.

**Interfaces:**
- Consumes: la grammaire de la Tâche 1 ; Tâche 8 déployée.

- [ ] **Step 1: Mesurer avant**

Run :

```bash
npx supabase db query --linked "select count(*) filter (where format='qcm' and not (choices ? answer)) qcm_sans_reponse, count(*) filter (where lore_text||question||explanation||answer||coalesce(choices::text,'') ~ '[{}]') avec_accolades from enigmas"
```

Expected (09/10) : `qcm_sans_reponse = 1` (déjà là avant ce chantier, à signaler à Uriel, pas à corriger en douce), `avec_accolades = 0`.

- [ ] **Step 2: Extraire les candidats**

```bash
npx supabase db query --linked "select id, active, format, lore_text, question, explanation, answer, choices from enigmas where lore_text||' '||question||' '||explanation||' '||answer||' '||coalesce(choices::text,'') ~* '(J\.?-?C|siècle|\m[0-9]{2,4}\M)' order by id" > <scratchpad>/candidats.json
```

Toutes les énigmes, actives ou non (une inactive peut être réactivée).

- [ ] **Step 3: Baliser à la main**

Pour chaque énigme, ne baliser **que les dates** couvertes par la grammaire (année avec ou sans `av./ap. J.-C.`, siècle) :
- « 1 100 litres », « 62 mois », « 24 runes », « 20 ans », « 5 ans » : pas de balise.
- « entre 107 et 86 av. J.-C. » → « entre {107 av. J.-C.} et {86 av. J.-C.} ».
- « VIIIe siècle » (sans av./ap.) → « {VIIIe siècle} ».
- « vers 500 av. J.-C. » → « vers {500 av. J.-C.} ».
- Millénaires, « IIIe s. » abrégé, dates mois-jour (« le 14 juillet 1789 » → seul `{1789}` se balise) : on laisse ce qui sort de la grammaire.
- QCM : la réponse et le choix identique reçoivent **la même** balise ; les autres choix datés aussi.

Écrire `<scratchpad>/balisage.md` : par énigme, `n° id`, puis chaque champ modifié en avant/après. Vérifier chaque nouveau texte avec `balisesIncomprises` (petit script Node sur le paquet) : zéro incomprise.

- [ ] **Step 4: ⛔ Relecture d'Uriel**

Publier la liste avant/après en page (Artifact) et **attendre son accord explicite**. Ses corrections s'appliquent à la liste, puis on lui remontre ce qui a changé.

- [ ] **Step 5: Écrire la migration**

`supabase/migrations/475_dates_balisees.sql` : en tête

```sql
-- WHY: Uriel, 09/10 — les dates des énigmes s'affichent dans le calendrier du joueur (spec
--      2026-10-09-choix-du-calendrier) : on les balise entre accolades. Liste relue par Uriel le <date>.
--      Chaque UPDATE ne touche l'énigme que si ses textes sont encore ceux relus : une modification
--      faite dans le Hub entre-temps n'est pas écrasée (l'énigme est alors simplement sautée).
```

puis, par énigme modifiée, un `UPDATE public.enigmas SET <champs balisés> WHERE id = <id> AND lore_text = <ancien> AND question = <ancien> AND explanation = <ancien> AND answer = <ancien> AND choices IS NOT DISTINCT FROM <ancien>::jsonb;` — les chaînes en dollar-quoting (`$t$…$t$`) pour ne rien échapper. Générer ce SQL par script depuis la liste validée, pas à la main.

- [ ] **Step 6: Appliquer et vérifier en prod** (session principale)

Run: `npx supabase db push --linked`
Puis :

```bash
npx supabase db query --linked "select count(*) filter (where lore_text||question||explanation||answer||coalesce(choices::text,'') ~ '[{}]') balisees, count(*) filter (where format='qcm' and not (choices ? answer)) qcm_sans_reponse from enigmas"
```

Expected: `balisees` = le nombre d'énigmes de la liste (sinon, lister les sautées et le dire à Uriel) ; `qcm_sans_reponse = 1`, inchangé.
Puis repasser `balisesIncomprises` (script Node) sur toutes les énigmes relues de la base → zéro.

- [ ] **Step 7: Dans le navigateur, en prod**

En Rome : ouvrir une énigme datée sur la carte (QCM), répondre juste, voir le verdict converti ; la page de sa culture. Revenir en chrétien : textes identiques à avant.

- [ ] **Step 8: Commit, push, clore**

```bash
git add supabase/migrations/475_dates_balisees.sql
git commit -m "feat(enigmes): les dates des énigmes balisées pour le choix du calendrier"
git push
```

`_État.md` d'Explore : la ligne du calendrier dans *Tranché* passe à « fait » avec les migrations 474-475 et Pythéas 1.14.0. Un piège rencontré → `.claude/rules/`.
