# Énigmes démo — vraie validation + rotation infinie — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En mode démo (borne), valider réellement les réponses aux énigmes (juste/faux) avec l'explication affichée, et faire tourner un flux d'énigmes aléatoire à l'infini — sans jamais écrire en base.

**Architecture:** Deux fonctions SQL `SECURITY DEFINER` **lecture seule**, gardées au seul compte démo (`get_demo_enigmas` = pool aléatoire ; `check_enigma_answer` = validation via le matcher existant + révélation `answer`/`explanation`). Le proxy Supabase démo route `answer_enigma` vers un chemin async qui appelle `check_enigma_answer` puis reconstruit la réponse attendue par le front. Le front charge `get_demo_enigmas` au lieu de `get_daily_enigma` en démo.

**Tech Stack:** PostgreSQL (Supabase), TypeScript, React, Vite, Zustand, Vitest.

## Global Constraints

- **Zéro écriture en base en démo** : les 2 fonctions SQL sont des `SELECT` purs ; le proxy ne touche jamais `answer_enigma` réel.
- **Inertie hors démo** : RPC gardées compte démo (`demo@runesdechene.com`) ; front ne les appelle que sous `isDemoMode()`. `answer_enigma`/`get_daily_enigma` d'origine **inchangés**.
- **Migrations** : fichier numéroté dans `supabase/migrations/`, canal unique `npx supabase db push --linked`. Prochain numéro = **327**.
- **TS strict** : pas de `any` gratuit (le proxy en a déjà par nécessité de typage dynamique — rester cohérent avec l'existant).
- **Matcher fidèle** : réutiliser `public._enigma_answer_matches(p_user text, p_correct text)` (ordre : réponse utilisateur d'abord).
- **Compte démo** : `demo@runesdechene.com` (id `7ccc2025-2f3b-4252-9d3b-0de3e4a8835f`).

---

## File Structure

- **Create** `supabase/migrations/327_demo_enigmas_read_only.sql` — les 2 fonctions read-only + grants.
- **Modify** `apps/explore-web/src/lib/demo/demoSupabase.ts` — nouvelle catégorie `validated`, `validatedEnigmaResponse`, retrait des cas `answer_*` de `fakeResponse`.
- **Modify** `apps/explore-web/src/lib/demo/demoSupabase.test.ts` — MAJ classification + tests validation.
- **Modify** `apps/explore-web/src/components/enigma/DailyEnigma.tsx` — `loadEnigmas()` appelle `get_demo_enigmas` en démo.

---

## Task 1: Migration SQL — fonctions read-only gardées compte démo

**Files:**
- Create: `supabase/migrations/327_demo_enigmas_read_only.sql`

**Interfaces:**
- Produces (SQL) :
  - `public.get_demo_enigmas(p_count integer DEFAULT 3) RETURNS json` → `{ enigmas: [{ id, difficulty, loreText, question, format, choices, theme, rewardInfluence, rewardErudition }] }` ou `{ error: 'unauthorized' }`.
  - `public.check_enigma_answer(p_enigma_id integer, p_answer text) RETURNS json` → `{ correct, answer, explanation, difficulty }` ou `{ error }`.

- [ ] **Step 1: Écrire la migration**

```sql
-- supabase/migrations/327_demo_enigmas_read_only.sql
-- Deux fonctions LECTURE SEULE réservées au compte démo (borne demo.runesdechene.com).
-- Aucune écriture. Servent la vraie validation + la rotation infinie des énigmes en mode démo.
-- Garde par email : seul demo@runesdechene.com peut les appeler (anti-triche joueurs réels).

CREATE OR REPLACE FUNCTION public.get_demo_enigmas(p_count integer DEFAULT 3)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result JSON;
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) IS DISTINCT FROM 'demo@runesdechene.com' THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT json_build_object('enigmas', COALESCE(json_agg(e), '[]'::json))
  INTO v_result
  FROM (
    SELECT
      en.id,
      en.difficulty,
      en.lore_text AS "loreText",
      en.question,
      en.format,
      en.choices,
      en.theme,
      COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_influence_' || en.difficulty), 3) AS "rewardInfluence",
      COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_erudition_' || en.difficulty), 1) AS "rewardErudition"
    FROM enigmas en
    WHERE en.type = 'daily' AND en.active = TRUE
    ORDER BY random()
    LIMIT GREATEST(1, LEAST(p_count, 10))
  ) e;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_enigma_answer(p_enigma_id integer, p_answer text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_enigma RECORD;
BEGIN
  IF (SELECT email FROM auth.users WHERE id = auth.uid()) IS DISTINCT FROM 'demo@runesdechene.com' THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO v_enigma FROM enigmas WHERE id = p_enigma_id;
  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'enigma_not_found');
  END IF;

  RETURN json_build_object(
    'correct',     public._enigma_answer_matches(p_answer, v_enigma.answer),
    'answer',      v_enigma.answer,
    'explanation', v_enigma.explanation,
    'difficulty',  v_enigma.difficulty
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_demo_enigmas(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_enigma_answer(integer, text) TO authenticated;
```

- [ ] **Step 2: Appliquer la migration**

Run: `npx supabase db push --linked`
Expected: `327_demo_enigmas_read_only.sql` appliquée, pas d'erreur.

- [ ] **Step 3: Vérifier la présence des fonctions (MCP `execute_sql` ou psql)**

Run (SQL) :
```sql
select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and proname in ('get_demo_enigmas','check_enigma_answer') order by proname;
```
Expected: 2 lignes (`check_enigma_answer`, `get_demo_enigmas`).

- [ ] **Step 4: Vérifier la garde (un appel hors session démo)**

Run (SQL, en tant que service/postgres où `auth.uid()` est NULL) :
```sql
select public.get_demo_enigmas(3);
```
Expected: `{"error":"unauthorized"}` (auth.uid() NULL ≠ email démo). Confirme que la garde bloque hors compte démo.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/327_demo_enigmas_read_only.sql
git commit -m "feat(demo): RPC read-only get_demo_enigmas + check_enigma_answer (gardées compte démo)"
```

---

## Task 2: Proxy démo — router `answer_enigma` vers la vraie validation

**Files:**
- Modify: `apps/explore-web/src/lib/demo/demoSupabase.ts`
- Modify: `apps/explore-web/src/lib/demo/demoSupabase.test.ts`

**Interfaces:**
- Consumes: `useDemoStore` (glory), RPC SQL `check_enigma_answer` (Task 1).
- Produces:
  - `VALIDATED_WRITES: ReadonlySet<string>` = `{ 'answer_enigma', 'answer_fragment_enigma' }`.
  - `classifyRpc(name): 'read' | 'faked' | 'validated' | 'blocked'`.
  - `validatedEnigmaResponse(realRpc, args): Promise<{ data: unknown; error: unknown }>` — appelle `check_enigma_answer` et reconstruit la réponse attendue par `EnigmaResult`.

- [ ] **Step 1: Écrire les tests qui échouent (MAJ + ajouts dans `demoSupabase.test.ts`)**

Remplacer l'assertion `classifyRpc('answer_enigma')` (actuellement `'faked'`) par `'validated'`, retirer l'ancien test `fakeResponse('answer_enigma')`, et ajouter le bloc suivant :

```ts
// Remplacer la ligne existante dans "classe les écritures faked" :
//   expect(classifyRpc('answer_enigma')).toBe('faked')  ← SUPPRIMER
// et ajouter :
describe('classifyRpc — validated', () => {
  it('classe answer_enigma / answer_fragment_enigma comme validated', () => {
    expect(classifyRpc('answer_enigma')).toBe('validated')
    expect(classifyRpc('answer_fragment_enigma')).toBe('validated')
  })
})

describe('validatedEnigmaResponse', () => {
  beforeEach(() => { useDemoStore.getState().reset() })

  it('bonne réponse : renvoie correct/answer/explanation réels + incrémente la Gloire', async () => {
    const realRpc = vi.fn().mockResolvedValue({
      data: { correct: true, answer: 'Durin', explanation: 'Roi nain.', difficulty: 'medium' },
      error: null,
    })
    const gloryBefore = useDemoStore.getState().glory
    const { data, error } = await validatedEnigmaResponse(realRpc, { p_enigma_id: 5, p_answer: 'durin' }) as { data: any; error: any }
    expect(error).toBeNull()
    expect(realRpc).toHaveBeenCalledWith('check_enigma_answer', { p_enigma_id: 5, p_answer: 'durin' })
    expect(data.correct).toBe(true)
    expect(data.explanation).toBe('Roi nain.')
    expect(data.crownsGain).toBe(2) // medium
    expect(data.newCrownsBalance).toBe(Infinity)
    expect(useDemoStore.getState().glory).toBe(gloryBefore + 1)
  })

  it('mauvaise réponse : correct=false mais explication présente', async () => {
    const realRpc = vi.fn().mockResolvedValue({
      data: { correct: false, answer: 'Durin', explanation: 'Roi nain.', difficulty: 'easy' },
      error: null,
    })
    const { data } = await validatedEnigmaResponse(realRpc, { p_enigma_id: 5, p_answer: 'nope' }) as { data: any }
    expect(data.correct).toBe(false)
    expect(data.explanation).toBe('Roi nain.')
    expect(data.crownsGain).toBe(1) // easy
  })
})

describe('wrapSupabaseForDemo — answer_enigma validé', () => {
  beforeEach(() => { useDemoStore.getState().reset() })

  it('route vers check_enigma_answer, jamais vers answer_enigma réel', async () => {
    const realRpc = vi.fn().mockResolvedValue({
      data: { correct: true, answer: 'X', explanation: 'Y', difficulty: 'hard' },
      error: null,
    })
    const wrapped = wrapSupabaseForDemo({ rpc: realRpc, from: vi.fn(), storage: { from: vi.fn() } })
    const { data } = await wrapped.rpc('answer_enigma', { p_enigma_id: 9, p_answer: 'x' }) as { data: any }
    expect(realRpc).toHaveBeenCalledWith('check_enigma_answer', { p_enigma_id: 9, p_answer: 'x' })
    expect(realRpc).not.toHaveBeenCalledWith('answer_enigma', expect.anything())
    expect(data.correct).toBe(true)
    expect(data.crownsGain).toBe(3) // hard
  })
})
```

Ajouter `validatedEnigmaResponse` à l'import en tête du fichier de test :
```ts
import { classifyRpc, fakeResponse, wrapSupabaseForDemo, FAKED_WRITES, OVERRIDDEN_READS, validatedEnigmaResponse } from './demoSupabase'
```

- [ ] **Step 2: Lancer les tests → échec attendu**

Run: `pnpm --filter explore-web exec vitest run src/lib/demo/demoSupabase.test.ts`
Expected: FAIL (`validatedEnigmaResponse` non exporté ; `classifyRpc('answer_enigma')` renvoie encore `'faked'`).

- [ ] **Step 3: Modifier `demoSupabase.ts`**

(a) Retirer `answer_enigma` et `answer_fragment_enigma` de `FAKED_WRITES` :
```ts
export const FAKED_WRITES: ReadonlySet<string> = new Set([
  'discover_place',
  'invest_crowns',
  'harvest_crown',
])
```

(b) Ajouter, sous `FAKED_WRITES` :
```ts
export const VALIDATED_WRITES: ReadonlySet<string> = new Set([
  'answer_enigma',
  'answer_fragment_enigma',
])

const CROWNS_BY_DIFFICULTY: Record<string, number> = {
  very_easy: 1, easy: 1, medium: 2, hard: 3,
}
```

(c) Mettre à jour `classifyRpc` (ajouter `validated` en tête) :
```ts
export function classifyRpc(name: string): 'read' | 'faked' | 'validated' | 'blocked' {
  if (VALIDATED_WRITES.has(name)) return 'validated'
  if (FAKED_WRITES.has(name) || OVERRIDDEN_READS.has(name)) return 'faked'
  if (READ_PREFIXES.some((p) => name.startsWith(p))) return 'read'
  return 'blocked'
}
```

(d) Retirer les cas `answer_enigma`/`answer_fragment_enigma` du `switch` de `fakeResponse` (les 2 lignes `case` + le bloc `return` associé), le reste inchangé.

(e) Ajouter la fonction async (après `fakeResponse`) :
```ts
/**
 * answer_enigma en démo : vraie validation via check_enigma_answer (lecture seule),
 * puis reconstruction du payload attendu par EnigmaResult. Aucune écriture.
 */
export async function validatedEnigmaResponse(
  realRpc: (name: string, args: Record<string, unknown>) => any,
  args: Record<string, unknown>,
): Promise<{ data: unknown; error: unknown }> {
  const { data, error } = await realRpc('check_enigma_answer', {
    p_enigma_id: args.p_enigma_id,
    p_answer: args.p_answer,
  })
  if (error || !data || (data as { error?: string }).error) {
    return { data: null, error: error ?? (data as { error?: string })?.error ?? 'check_failed' }
  }
  const d = data as { correct: boolean; answer: string; explanation: string; difficulty: string }
  const demo = useDemoStore.getState()
  demo.addGlory(1)
  return {
    data: {
      correct: d.correct,
      answer: d.answer,
      explanation: d.explanation,
      influenceGain: 1,
      eruditionGain: 1,
      crownsGain: CROWNS_BY_DIFFICULTY[d.difficulty] ?? 1,
      newCrownsBalance: Infinity,
      newErudition: 0,
      newGlory: useDemoStore.getState().glory,
    },
    error: null,
  }
}
```

(f) Dans `wrapSupabaseForDemo`, brancher la nouvelle catégorie dans le handler `.rpc` (juste avant `if (kind === 'faked')`) :
```ts
          if (kind === 'validated') return validatedEnigmaResponse(realRpc, args)
          if (kind === 'faked') return Promise.resolve(fakeResponse(name, args))
          return Promise.resolve(blockedResponse(name))
```

- [ ] **Step 4: Lancer les tests → succès attendu**

Run: `pnpm --filter explore-web exec vitest run src/lib/demo/demoSupabase.test.ts`
Expected: PASS (toute la suite, y compris les tests existants `from()`/`storage`/cache).

- [ ] **Step 5: Commit**

```bash
git add apps/explore-web/src/lib/demo/demoSupabase.ts apps/explore-web/src/lib/demo/demoSupabase.test.ts
git commit -m "feat(demo): answer_enigma → vraie validation via check_enigma_answer (proxy)"
```

---

## Task 3: Front — charger un flux d'énigmes rotatif en démo

**Files:**
- Modify: `apps/explore-web/src/components/enigma/DailyEnigma.tsx`

**Interfaces:**
- Consumes: `isDemoMode()` (déjà importé), RPC `get_demo_enigmas` (Task 1).

- [ ] **Step 1: Aiguiller `loadEnigmas()` en démo**

Dans `loadEnigmas()`, remplacer l'appel unique :
```ts
    supabase.rpc('get_daily_enigma', { p_user_id: userId }).then(({ data, error }) => {
```
par un aiguillage démo (le reste du `.then(...)` est **inchangé**) :
```ts
    const request = isDemoMode()
      ? supabase.rpc('get_demo_enigmas', { p_count: 3 })
      : supabase.rpc('get_daily_enigma', { p_user_id: userId })

    request.then(({ data, error }) => {
```

Le corps du `.then` existant gère déjà : `d.all_answered && !isDemoMode()` (jamais « tout résolu » en démo), `d.enigmas` (même forme), tri par difficulté. `handleNext()` recharge déjà la série en démo (`loadEnigmas()`) → rotation continue.

- [ ] **Step 2: Vérifier le build (types)**

Run: `pnpm --filter explore-web build`
Expected: build OK, pas d'erreur TS.

- [ ] **Step 3: Vérifier en local (mode démo, contre la prod)**

Run: `VITE_DEMO_MODE=true VITE_DEMO_EMAIL=demo@runesdechene.com VITE_DEMO_PASSWORD=borne pnpm --filter explore-web dev`
Vérifier :
  - [ ] Ouvrir « Énigmes du jour » → une série s'affiche.
  - [ ] Répondre **juste** → « Bonne réponse » + explication visible.
  - [ ] Répondre **faux** → « Raté » + explication visible (plus de faux positif).
  - [ ] « Énigme suivante » puis rejouer → **nouvelles** énigmes (série renouvelée).
  - [ ] DevTools réseau : appels `get_demo_enigmas` / `check_enigma_answer`, **aucun** `answer_enigma`.

- [ ] **Step 4: Commit**

```bash
git add apps/explore-web/src/components/enigma/DailyEnigma.tsx
git commit -m "feat(demo): flux d'énigmes rotatif (get_demo_enigmas) en mode démo"
```

---

## Task 4: Vérification bout-en-bout + déploiement

**Files:** aucun (vérif + push).

- [ ] **Step 1: Suite de tests complète**

Run: `pnpm --filter explore-web test`
Expected: PASS.

- [ ] **Step 2: Build prod normal (inertie démo)**

Run: `pnpm --filter explore-web build` (sans `VITE_DEMO_MODE`)
Expected: build OK ; `answer_enigma`/`get_daily_enigma` d'origine servis (aucun code démo actif).

- [ ] **Step 3: Pousser → auto-deploy Netlify de la démo**

```bash
git push origin demo-borne
```
Expected: Netlify rebuild le site `runesdechene-demo` depuis `demo-borne`. La migration 327 est déjà en prod (Task 1) → la borne valide et fait tourner les énigmes.

- [ ] **Step 4: Vérif sur la borne live**

Ouvrir `demo.runesdechene.com` → Énigmes : validation réelle + explication + rotation. Confirmer avec Uriel.

---

## Notes

- **Sécurité** : `check_enigma_answer` révèle `answer`/`explanation`, mais la garde par email confine ça au compte démo. Aucun joueur réel ne peut l'appeler (retour `unauthorized`).
- **Fragment enigmas** : `answer_fragment_enigma` passe aussi par `check_enigma_answer` (validation par `enigma_id`, indépendante du type) — cohérent, même si `get_demo_enigmas` ne sert que le pool `daily`.
- **Dette éventuelle** : si un jour on veut une vraie montée de niveau visuelle liée aux réponses, brancher les seuils sur `demoStore.glory` (déjà incrémenté ici).
