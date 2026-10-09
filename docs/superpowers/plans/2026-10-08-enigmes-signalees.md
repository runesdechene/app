# Les énigmes signalées — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** plusieurs réponses acceptées par énigme, un lien « Signaler une erreur ou une injustice » sous le
verdict, et un écran « Énigmes signalées » dans le Hub qui accepte une réponse en un clic.

**Architecture :** une migration (470) ajoute `enigmas.accepted_answers`, une fonction pure `_enigma_juste`
utilisée par `percer_enigme`, la table `signalements_enigme` et trois RPC, calquées sur les signalements de
lieu (migration 387). Dans la V2, la feuille « Signaler ce lieu » devient un composant partagé
(`shared/ui/FeuilleDeSignalement`) que le lieu et l'énigme configurent. Dans le Hub, un champ « Autres
réponses acceptées » dans le formulaire, et un nouvel écran calqué sur `moderation/Signalements.tsx`.

**Tech stack :** Postgres/Supabase (plpgsql), React 19 + TanStack Query + Vitest (V2), React 18 (Hub).

**Spec :** `docs/superpowers/specs/2026-10-08-enigmes-signalees-design.md`

## Global Constraints

- Branche `feat/enigmes-souples`, partie de `origin/feat/fragments-carte` (la prod).
- Migration **470**. Avant de l'appliquer, vérifier qu'aucune branche distante n'a pris 470
  (`git fetch` puis `git ls-tree --name-only origin/feat/fragments-carte supabase/migrations/ | tail -2`) ;
  si oui, renuméroter.
- Canal unique : `npx supabase db push --dry-run --linked` puis `npx supabase db push --linked`
  (`pnpm dlx supabase` si npx casse). En tête : `-- WHY:`. Preview :
  `node scripts/migration-preview.mjs supabase/migrations/463_enigmes_signalees.sql`.
- `percer_enigme` repart de sa définition **live** (copiée le 08/10, reproduite en Task 1) : une seule ligne
  change.
- Pas rétroactif : rien ne touche `enigma_responses`, l'XP ni les titres.
- TS strict, pas de `any`, pas de `console.log`. V2 : un composant ne parle pas à Supabase (il passe par
  `api/`), une zone n'importe pas une autre zone (`@/features/*` interdit depuis une autre zone).
- Libellés exacts (typographie : apostrophe ’) :
  - lien : « Signaler une erreur ou une injustice » ;
  - feuille : titre « Signaler une erreur », consigne « Qu’est-ce qui ne va pas ? L’équipe regarde chaque
    signalement. », raisons « Ma réponse aurait dû être acceptée » (`reponse_refusee`), « La réponse ou
    l’explication est fausse » (`erreur`), « Autre chose » (`autre`) ;
  - merci : « Merci » / « L’équipe va regarder cette énigme de près. » ;
  - erreur : « Le signalement n’est pas parti. Réessaie dans un instant. ».
- Conventional Commits, une étape qui marche = un commit, avec la ligne
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **Dix joueurs signalent « Eudes » sur la même énigme** : accepter une fois doit clore les dix, pas en
  laisser neuf dans le Hub → auto-test SQL en Task 1 (`traiter` clôt les signalements que la variante rend
  justes).
- **Accepter une réponse déjà couverte** (« eudes » alors que « Eudes » est déjà variante) : pas de doublon
  dans `accepted_answers` → auto-test en Task 1.
- **Signaler une énigme jamais répondue**, ou une énigme QCM : la première est refusée par la base ; la
  seconde est permise (raison `erreur`) mais le Hub n'offre pas « Accepter » → test SQL en Task 1, condition
  `format === 'free'` en Task 5.
- **Un même joueur signale deux fois la même énigme** : un seul signalement ouvert, le second remplace le
  premier → `ON CONFLICT` en Task 1.
- **Fermer la feuille de signalement** ramène à la feuille de l'énigme, verdict intact → test en Task 3.

---

### Task 1 : migration 470 — variantes, signalements, RPC

**Files :**
- Create : `supabase/migrations/463_enigmes_signalees.sql`
- Modify : `apps/web-v2/src/shared/supabase/database.types.ts` (régénéré)

**Interfaces :**
- Produces :
  - colonne `enigmas.accepted_answers text[] NOT NULL DEFAULT '{}'` ;
  - `_enigma_juste(p_reponse text, p_answer text, p_variantes text[]) → boolean` (interne) ;
  - `signaler_enigme(p_enigme integer, p_raison text, p_precision text DEFAULT NULL) → json {ok}` (joueurs) ;
  - `signalements_enigme_du_hub() → json` : tableau de
    `{ id, raison, precision, reponseDonnee, quand, enigme: { numero, question, reponse, variantes, format }, qui: { id, nom } }` (admins) ;
  - `traiter_signalement_enigme(p_id bigint, p_accepter boolean DEFAULT false) → json {ok}` (admins).

- [ ] **Step 1 : vérifier que la définition live de `percer_enigme` n'a pas bougé depuis le 08/10**

```bash
npx supabase db query --linked "select pg_get_functiondef('public.percer_enigme(bigint,text)'::regprocedure)" -o csv
```

Expected : identique au corps reproduit au Step 2 hors la ligne `v_juste :=`. Sinon, repartir du live.

- [ ] **Step 2 : écrire la migration (auto-tests compris)**

`supabase/migrations/463_enigmes_signalees.sql` :

```sql
-- WHY: les joueurs trouvent les énigmes trop strictes (« Eudes » refusé pour « Eudes de Paris »). La
--      tolérance aux fautes (mig 003) ne devine pas une réponse incomplète, et l'élargir ferait passer
--      « Paris ». Donc : des réponses acceptées en plus, choisies par l'équipe, et un signalement du joueur
--      qui arrive dans le Hub (spec 2026-10-08-enigmes-signalees-design.md). Pas rétroactif.
--   1. enigmas.accepted_answers : les variantes.
--   2. _enigma_juste : juste si la réponse correspond à la réponse ou à une variante.
--   3. percer_enigme : définition live du 08/10, seule la ligne v_juste change.
--   4. signalements_enigme + signaler_enigme : calqués sur signalements_lieu (mig 387) ; la réponse du
--      joueur est relevée en base, jamais envoyée par l'appli.
--   5. signalements_enigme_du_hub / traiter_signalement_enigme : la file du Hub (admins).
--   6. Auto-tests : la migration échoue si le moindre cas se comporte mal.

-- 1.
ALTER TABLE public.enigmas ADD COLUMN accepted_answers text[] NOT NULL DEFAULT '{}';

-- 2.
CREATE OR REPLACE FUNCTION public._enigma_juste(p_reponse text, p_answer text, p_variantes text[])
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM unnest(array_prepend(p_answer, COALESCE(p_variantes, '{}'))) AS a
    WHERE public._enigma_answer_matches(p_reponse, a));
$function$;
REVOKE ALL ON FUNCTION public._enigma_juste(text, text, text[]) FROM PUBLIC, anon, authenticated;

-- 3.
CREATE OR REPLACE FUNCTION public.percer_enigme(p_eveil bigint, p_reponse text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi      text := auth.uid()::text;
  w          enigmes_eveillees := public._eveil_en_attente(p_eveil);
  e          enigmas;
  v_juste    boolean;
  v_genre    text;
  v_xp_avant int;
  v_xp_apres int;
  v_nouveaux text[] := '{}';
  v_prochain json;
  v_niveau   int;
  v_seuil    int;
  v_suivant  int;
BEGIN
  SELECT * INTO e FROM enigmas WHERE id = w.enigma_id;
  v_juste := CASE WHEN e.format = 'free' THEN public._enigma_juste(p_reponse, e.answer, e.accepted_answers)
                  ELSE public._enigma_normalize(p_reponse) = public._enigma_normalize(e.answer) END;
  SELECT COALESCE(xp_total, 0), COALESCE(title_gender, 'm') INTO v_xp_avant, v_genre FROM users WHERE id = v_moi;

  -- Pas de Couronnes (en sommeil dans Explore) : on n'appelle pas _answer_enigma_internal.
  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained, eveil_id)
  VALUES (e.id, v_moi, left(p_reponse, 500), v_juste, 0, 0, w.id);

  IF v_juste THEN v_nouveaux := public._attribuer_titres_connaissance(v_moi, e.theme); END IF;
  SELECT COALESCE(xp_total, 0) INTO v_xp_apres FROM users WHERE id = v_moi;
  v_niveau := public._level_from_xp(v_xp_apres);
  v_seuil := public._xp_for_level(v_niveau);
  v_suivant := public._xp_for_level(v_niveau + 1);

  SELECT json_build_object('nom', public._nom_titre(t, v_genre),
                           'seuil', public._seuil_connaissance(e.theme, (t.condition->>'palier')::int))
    INTO v_prochain
    FROM titles t
   WHERE t.condition->>'stat' = 'connaissance' AND t.condition->>'theme' = e.theme
     AND NOT EXISTS (SELECT 1 FROM titres_connaissance c WHERE c.user_id = v_moi AND c.title_id = t.id)
   ORDER BY (t.condition->>'palier')::int LIMIT 1;

  RETURN json_build_object(
    'juste', v_juste,
    'reponse', e.answer,
    'explication', e.explanation,
    'xp', v_xp_apres - v_xp_avant,
    'niveau', v_niveau,
    -- Monter de niveau fait repartir la jauge de zéro (comme decouvrir_lieu, mig 401).
    'avant', CASE WHEN public._level_from_xp(v_xp_avant) < v_niveau THEN 0
                  ELSE round((v_xp_avant - v_seuil)::numeric / greatest(1, v_suivant - v_seuil), 3) END,
    'apres', round((v_xp_apres - v_seuil)::numeric / greatest(1, v_suivant - v_seuil), 3),
    'gagnes', CASE WHEN v_juste THEN public._poids_enigme(e.difficulty) ELSE 0 END,
    'points', public._points_connaissance(v_moi, e.theme),
    'total', public._total_connaissance(e.theme),
    'nouveauxTitres', to_json(v_nouveaux),
    'prochain', v_prochain,
    'resteEnAttente', json_array_length(public.enigmes_en_attente()));
END $function$;

-- 4.
CREATE TABLE public.signalements_enigme (
  id bigserial PRIMARY KEY,
  enigma_id integer NOT NULL REFERENCES public.enigmas(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  raison text NOT NULL CHECK (raison IN ('reponse_refusee', 'erreur', 'autre')),
  precision text CHECK (char_length(precision) <= 500),
  reponse_donnee text NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now(),
  traite_le timestamptz,
  traite_par varchar REFERENCES public.users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX signalements_enigme_ouvert ON public.signalements_enigme (enigma_id, user_id) WHERE traite_le IS NULL;
ALTER TABLE public.signalements_enigme ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.signalements_enigme FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.signaler_enigme(p_enigme integer, p_raison text, p_precision text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_precision text := NULLIF(btrim(COALESCE(p_precision, '')), '');
  v_reponse text;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF p_raison NOT IN ('reponse_refusee', 'erreur', 'autre') THEN
    RAISE EXCEPTION 'Raison inconnue' USING ERRCODE = '22023';
  END IF;
  IF char_length(coalesce(v_precision, '')) > 500 THEN
    RAISE EXCEPTION 'Un mot de 500 signes au plus' USING ERRCODE = '22023';
  END IF;
  -- Sa dernière réponse : on ne signale que ce qu'on a répondu.
  SELECT answer_given INTO v_reponse FROM enigma_responses
   WHERE enigma_id = p_enigme AND user_id = v_moi ORDER BY responded_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réponds d’abord à cette énigme' USING ERRCODE = 'P0002';
  END IF;
  IF (SELECT count(*) FROM signalements_enigme WHERE user_id = v_moi AND cree_le > now() - interval '1 day') >= 20 THEN
    RAISE EXCEPTION 'Vingt signalements aujourd’hui : reviens demain' USING ERRCODE = 'P0001', HINT = 'limite';
  END IF;

  INSERT INTO signalements_enigme (enigma_id, user_id, raison, precision, reponse_donnee)
  VALUES (p_enigme, v_moi, p_raison, v_precision, v_reponse)
  ON CONFLICT (enigma_id, user_id) WHERE traite_le IS NULL
    DO UPDATE SET raison = excluded.raison, precision = excluded.precision,
                  reponse_donnee = excluded.reponse_donnee, cree_le = now();
  RETURN json_build_object('ok', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.signaler_enigme(integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signaler_enigme(integer, text, text) TO authenticated;

-- 5.
CREATE OR REPLACE FUNCTION public.signalements_enigme_du_hub()
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin') THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501';
  END IF;
  RETURN (SELECT COALESCE(json_agg(json_build_object(
      'id', s.id, 'raison', s.raison, 'precision', s.precision,
      'reponseDonnee', s.reponse_donnee, 'quand', s.cree_le,
      'enigme', json_build_object('numero', e.id, 'question', e.question, 'reponse', e.answer,
                                  'variantes', to_json(e.accepted_answers), 'format', e.format),
      'qui', json_build_object('id', u.id, 'nom', user_public_name(u.id, u.display_name, u.first_name)))
    ORDER BY s.cree_le DESC), '[]'::json)
    FROM signalements_enigme s JOIN enigmas e ON e.id = s.enigma_id JOIN users u ON u.id = s.user_id
    WHERE s.traite_le IS NULL);
END;
$function$;
REVOKE ALL ON FUNCTION public.signalements_enigme_du_hub() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.signalements_enigme_du_hub() TO authenticated;

CREATE OR REPLACE FUNCTION public.traiter_signalement_enigme(p_id bigint, p_accepter boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s signalements_enigme;
  e enigmas;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::text AND role = 'admin') THEN
    RAISE EXCEPTION 'Réservé aux admins' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO s FROM signalements_enigme WHERE id = p_id AND traite_le IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Introuvable' USING ERRCODE = 'P0002';
  END IF;
  SELECT * INTO e FROM enigmas WHERE id = s.enigma_id;

  -- Accepter : la réponse du joueur devient une variante, sauf si elle passe déjà.
  IF p_accepter AND e.format = 'free'
     AND NOT public._enigma_juste(s.reponse_donnee, e.answer, e.accepted_answers) THEN
    UPDATE enigmas SET accepted_answers = accepted_answers || btrim(s.reponse_donnee)
     WHERE id = e.id RETURNING * INTO e;
  END IF;

  -- Clôt celui-ci, et ceux de la même énigme que la nouvelle variante rend justes.
  UPDATE signalements_enigme SET traite_le = now(), traite_par = auth.uid()::text
   WHERE traite_le IS NULL AND enigma_id = e.id
     AND (id = p_id OR (p_accepter AND e.format = 'free'
                        AND public._enigma_juste(reponse_donnee, e.answer, e.accepted_answers)));
  RETURN json_build_object('ok', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.traiter_signalement_enigme(bigint, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.traiter_signalement_enigme(bigint, boolean) TO authenticated;

-- 6.
DO $$
BEGIN
  IF NOT public._enigma_juste('eudes', 'Eudes de Paris', ARRAY['Eudes']) THEN
    RAISE EXCEPTION 'auto-test : « eudes » devrait passer avec la variante « Eudes »';
  END IF;
  IF NOT public._enigma_juste('Eudes de pari', 'Eudes de Paris', '{}') THEN
    RAISE EXCEPTION 'auto-test : la tolérance aux fautes sur la réponse principale a disparu';
  END IF;
  IF public._enigma_juste('Paris', 'Eudes de Paris', ARRAY['Eudes']) THEN
    RAISE EXCEPTION 'auto-test : « Paris » ne doit pas passer';
  END IF;
  IF public._enigma_juste('Eudes', 'Eudes de Paris', '{}') THEN
    RAISE EXCEPTION 'auto-test : sans variante, « Eudes » ne doit pas passer';
  END IF;
  IF public._enigma_juste('Eudes', 'Eudes de Paris', NULL) THEN
    RAISE EXCEPTION 'auto-test : variantes NULL';
  END IF;
END $$;
```

- [ ] **Step 3 : preview et dry-run**

```bash
git fetch -q && git ls-tree --name-only origin/feat/fragments-carte supabase/migrations/ | tail -2
node scripts/migration-preview.mjs supabase/migrations/463_enigmes_signalees.sql
npx supabase db push --dry-run --linked
```

Expected : aucun 470 ailleurs ; le preview ne montre, pour `percer_enigme`, que la ligne `v_juste` ; le
dry-run liste seulement `463_enigmes_signalees.sql`.

- [ ] **Step 4 : appliquer**

```bash
npx supabase db push --linked
```

Expected : appliquée sans erreur (les auto-tests du bloc 6 sont passés, sinon la migration aurait échoué).

- [ ] **Step 5 : vérifier en prod le parcours SQL d'un signalement, dans une transaction annulée**

Écrire `$TEMP/verif463.sql` (scratchpad) puis le lancer avec
`npx supabase db query --linked -f "$TEMP/verif463.sql"`. Il prend une vraie énigme libre et deux vrais
comptes, simule les deux joueurs et un admin, et **annule tout** à la fin.

```sql
BEGIN;
CREATE TEMP TABLE t AS
SELECT (SELECT id FROM enigmas WHERE format = 'free' AND active ORDER BY id LIMIT 1) AS enigme,
       (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1) AS admin,
       ARRAY(SELECT id FROM users WHERE role IS DISTINCT FROM 'admin' ORDER BY id LIMIT 2) AS joueurs;
UPDATE enigmas SET answer = 'Eudes de Paris', accepted_answers = '{}' WHERE id = (SELECT enigme FROM t);
INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct)
SELECT t.enigme, j, 'Eudes', false FROM t, unnest(t.joueurs) j;
DO $$
DECLARE r record; j text;
BEGIN
  SELECT * INTO r FROM t;
  FOREACH j IN ARRAY r.joueurs LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', j)::text, true);
    PERFORM signaler_enigme(r.enigme, 'reponse_refusee', 'Eudes suffit');
    PERFORM signaler_enigme(r.enigme, 'reponse_refusee', 'deuxième fois');  -- remplace, n'ajoute pas
  END LOOP;
  IF (SELECT count(*) FROM signalements_enigme WHERE enigma_id = r.enigme AND traite_le IS NULL) <> 2 THEN
    RAISE EXCEPTION 'attendu : deux signalements ouverts';
  END IF;
  BEGIN
    PERFORM signaler_enigme(r.enigme + 100000, 'erreur', NULL);
    RAISE EXCEPTION 'une énigme jamais répondue a été signalée';
  EXCEPTION WHEN sqlstate 'P0002' THEN NULL;
  END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', r.admin)::text, true);
  PERFORM traiter_signalement_enigme(
    (SELECT id FROM signalements_enigme WHERE enigma_id = r.enigme AND traite_le IS NULL LIMIT 1), true);
  IF (SELECT accepted_answers FROM enigmas WHERE id = r.enigme) <> ARRAY['Eudes'] THEN
    RAISE EXCEPTION 'attendu : une seule variante « Eudes »';
  END IF;
  IF EXISTS (SELECT 1 FROM signalements_enigme WHERE enigma_id = r.enigme AND traite_le IS NULL) THEN
    RAISE EXCEPTION 'accepter aurait dû clore les deux signalements';
  END IF;
  RAISE NOTICE 'parcours 470 : OK';
END $$;
ROLLBACK;
```

Expected : `NOTICE: parcours 470 : OK`, puis `ROLLBACK` (rien ne reste en base). Si `auth.uid()` ne lit pas
`request.jwt.claims` dans ce contexte, le dire et vérifier à la place par le parcours navigateur (Task 6).

- [ ] **Step 6 : régénérer les types de la V2**

```bash
pnpm --filter web-v2 gen:types
git diff --stat apps/web-v2/src/shared/supabase/database.types.ts
```

Expected : `signaler_enigme`, `signalements_enigme_du_hub`, `traiter_signalement_enigme` et
`accepted_answers` apparaissent ; pas d'autre bouleversement (sinon une autre branche a migré : le dire).

- [ ] **Step 7 : commit**

```bash
git add supabase/migrations/463_enigmes_signalees.sql apps/web-v2/src/shared/supabase/database.types.ts
git commit -m "feat(enigmes): réponses acceptées et signalements d'énigme (mig 470)"
```

---

### Task 2 : V2 — la feuille de signalement devient partagée

**Files :**
- Create : `apps/web-v2/src/shared/ui/FeuilleDeSignalement.tsx`
- Create : `apps/web-v2/src/shared/ui/FeuilleDeSignalement.module.css`
- Modify : `apps/web-v2/src/features/lieu/components/FeuilleSignaler.tsx` (devient une configuration)
- Modify : `apps/web-v2/src/features/lieu/components/Feuilles.module.css` (retirer `.raisons`, `.raison`,
  `.precision` devenus morts)
- Test : `apps/web-v2/src/features/lieu/components/Feuilles.test.tsx` (le test « Signaler » existant doit
  rester vert, sans changement)

**Interfaces :**
- Produces :
  ```ts
  export type Raison<R extends string> = { id: R; libelle: string }
  export function FeuilleDeSignalement<R extends string>(props: {
    titre: string
    consigne: string
    raisons: Raison<R>[]
    merci: string
    onEnvoyer: (raison: R, precision: string) => Promise<void>
    onFermer: () => void
  }): JSX.Element
  ```

- [ ] **Step 1 : vérifier que le test existant passe avant de toucher**

Run : `pnpm --filter web-v2 test -- Feuilles.test.tsx`
Expected : PASS (dont « « Signaler » : une raison, un mot, puis un merci »).

- [ ] **Step 2 : créer le composant partagé**

`apps/web-v2/src/shared/ui/FeuilleDeSignalement.tsx` :

```tsx
/**
 * QUOI     — une feuille « Signaler » : des raisons (une seule choisie), un mot facultatif, « Envoyer le
 *            signalement » ; puis un merci.
 * POURQUOI — la même feuille sert au lieu (maquette « Lieu — signaler », 30/09) et à l'énigme (08/10,
 *            sans maquette : « au style de Signaler ce lieu ») ; chacun donne ses raisons et son envoi.
 */
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from './Button'
import { Feuille } from './Feuille'
import styles from './FeuilleDeSignalement.module.css'

export type Raison<R extends string> = { id: R; libelle: string }

export function FeuilleDeSignalement<R extends string>({
  titre,
  consigne,
  raisons,
  merci,
  onEnvoyer,
  onFermer,
}: {
  titre: string
  consigne: string
  raisons: Raison<R>[]
  merci: string
  onEnvoyer: (raison: R, precision: string) => Promise<void>
  onFermer: () => void
}) {
  const [raison, setRaison] = useState<R | null>(null)
  const [precision, setPrecision] = useState('')
  const envoi = useMutation({
    mutationFn: (r: R) => onEnvoyer(r, precision),
  })

  if (envoi.isSuccess) {
    return (
      <Feuille titre={titre} onFermer={onFermer}>
        <h2 className={styles.titre}>Merci</h2>
        <p className={styles.avertissement}>{merci}</p>
        <Button kind="doux" onClick={onFermer}>
          Fermer
        </Button>
      </Feuille>
    )
  }

  return (
    <Feuille titre={titre} onFermer={onFermer}>
      <h2 className={styles.titre}>{titre}</h2>
      <fieldset className={styles.raisons}>
        <legend className={styles.description}>{consigne}</legend>
        {raisons.map((r) => (
          <label key={r.id} className={styles.raison}>
            <input
              type="radio"
              name="raison"
              checked={raison === r.id}
              onChange={() => {
                setRaison(r.id)
              }}
            />
            {r.libelle}
          </label>
        ))}
      </fieldset>
      <textarea
        className={styles.precision}
        aria-label="Un mot de plus"
        placeholder="Un mot de plus (facultatif)…"
        maxLength={500}
        rows={2}
        value={precision}
        onChange={(e) => {
          setPrecision(e.target.value)
        }}
      />
      {envoi.isError && (
        <p className={styles.refus} role="alert">
          Le signalement n’est pas parti. Réessaie dans un instant.
        </p>
      )}
      <Button
        disabled={raison === null || envoi.isPending}
        onClick={() => {
          if (raison) envoi.mutate(raison)
        }}
      >
        {envoi.isPending ? 'Envoi…' : 'Envoyer le signalement'}
      </Button>
    </Feuille>
  )
}
```

`apps/web-v2/src/shared/ui/FeuilleDeSignalement.module.css` — les règles reprises telles quelles de
`features/lieu/components/Feuilles.module.css` :

```css
/*
 * QUOI     — la feuille « Signaler » : titre Bebas, raisons bordées (une seule choisie), un mot.
 */
.titre {
  margin: 0 0 var(--space-3);
  color: var(--color-encre);
  font-family: var(--font-titre);
  font-size: var(--titre-carte-size);
  font-weight: var(--weight-normal);
}

.description {
  color: var(--color-texte-doux);
  font-family: var(--font-corps);
  font-size: var(--legende-size);
  line-height: var(--dense-leading);
}

.avertissement,
.refus {
  margin: 0 0 var(--space-4);
  font-family: var(--font-corps);
  font-size: var(--corps-size);
  line-height: var(--corps-leading);
}

.avertissement {
  color: var(--color-texte);
}

.refus {
  color: var(--color-accent);
}

.raisons {
  display: grid;
  gap: var(--space-2);
  margin: 0 0 var(--space-3);
  padding: 0;
  border: none;
}

.raisons legend {
  margin-bottom: var(--space-2);
}

.raison {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 14px;
  border: 1px solid var(--color-sable);
  border-radius: var(--radius-carte);
  color: var(--color-encre);
  font-family: var(--font-corps);
  font-size: var(--sous-titre-size);
  cursor: pointer;
  transition:
    background-color var(--duree-douce) var(--courbe-douce),
    border-color var(--duree-douce) var(--courbe-douce);
}

.raison:has(input:checked) {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent-clair) 18%, transparent);
}

.raison input {
  accent-color: var(--color-accent);
}

.precision {
  width: 100%;
  margin-bottom: var(--space-3);
  padding: var(--space-3) 14px;
  border: 1px solid var(--color-sable);
  border-radius: var(--radius-carte);
  background: var(--color-feuille);
  color: var(--color-encre);
  font-family: var(--font-corps);
  font-size: var(--sous-titre-size);
  resize: vertical;
}

@media (prefers-reduced-motion: reduce) {
  .raison {
    transition: none;
  }
}
```

- [ ] **Step 3 : le lieu configure la feuille partagée**

Remplacer tout `apps/web-v2/src/features/lieu/components/FeuilleSignaler.tsx` par :

```tsx
/**
 * QUOI     — la feuille « Signaler ce lieu » (maquette « Lieu — signaler », 30/09) : cinq raisons,
 *            un mot facultatif, « Envoyer le signalement » ; puis un merci.
 * POURQUOI — ce que Modifier ne répare pas (un lieu qui n'existe pas, un doublon, un endroit
 *            dangereux) part à l'équipe, qui le voit dans le Hub (mig 387).
 */
import { FeuilleDeSignalement, type Raison as RaisonAffichee } from '@/shared/ui/FeuilleDeSignalement'
import { signalerLieu, type Raison } from '../api/lieu'

const RAISONS: RaisonAffichee<Raison>[] = [
  { id: 'n_existe_pas', libelle: 'Il n’existe pas, ou plus' },
  { id: 'prive_ou_dangereux', libelle: 'Il est privé, ou dangereux d’accès' },
  { id: 'doublon', libelle: 'C’est un doublon d’un autre lieu' },
  { id: 'contenu', libelle: 'Le récit ou les photos posent problème' },
  { id: 'autre', libelle: 'Autre chose' },
]

export function FeuilleSignaler({ id, onFermer }: { id: string; onFermer: () => void }) {
  return (
    <FeuilleDeSignalement
      titre="Signaler ce lieu"
      consigne="Qu’est-ce qui ne va pas ? L’équipe regarde chaque signalement."
      raisons={RAISONS}
      merci="L’équipe va regarder ce lieu de près."
      onEnvoyer={(raison, precision) => signalerLieu(id, raison, precision)}
      onFermer={onFermer}
    />
  )
}
```

- [ ] **Step 4 : retirer le CSS devenu mort**

Dans `features/lieu/components/Feuilles.module.css` : supprimer le bloc
`/* Signaler : cinq raisons, une seule choisie, puis un mot. */` et les règles `.raisons`, `.raisons legend`,
`.raison`, `.raison:has(input:checked)`, `.raison input`, `.precision` ; dans le bloc
`@media (prefers-reduced-motion: reduce)`, ne garder que `.choix`. Vérifier qu'aucun autre fichier ne les
utilise :

Run : `grep -rnE "styles\.(raisons|raison|precision)\b" apps/web-v2/src/features/lieu`
Expected : aucune ligne.

- [ ] **Step 5 : tests, types et lint**

Run : `pnpm --filter web-v2 test -- Feuilles.test.tsx && pnpm --filter web-v2 typecheck && pnpm --filter web-v2 lint`
Expected : PASS, aucune erreur.

- [ ] **Step 6 : commit**

```bash
git add apps/web-v2/src/shared/ui/FeuilleDeSignalement.tsx apps/web-v2/src/shared/ui/FeuilleDeSignalement.module.css apps/web-v2/src/features/lieu/components/FeuilleSignaler.tsx apps/web-v2/src/features/lieu/components/Feuilles.module.css
git commit -m "refactor(v2): la feuille « Signaler » partagée, pour le lieu et bientôt l'énigme"
```

---

### Task 3 : V2 — « Signaler une erreur ou une injustice » sous le verdict

**Files :**
- Modify : `apps/web-v2/src/features/carte/api/enigmes.ts`
- Create : `apps/web-v2/src/features/carte/components/FeuilleSignalerEnigme.tsx`
- Modify : `apps/web-v2/src/features/carte/components/FeuilleEnigme.tsx`
- Modify : `apps/web-v2/src/features/carte/components/FeuilleEnigme.module.css`
- Test : `apps/web-v2/src/features/carte/components/FeuilleEnigme.test.tsx`

**Interfaces :**
- Consumes : `FeuilleDeSignalement`, `Raison` (Task 2) ; RPC `signaler_enigme(p_enigme, p_raison, p_precision)` (Task 1).
- Produces : `signalerEnigme(numero: number, raison: RaisonEnigme, precision: string): Promise<void>`,
  `type RaisonEnigme = 'reponse_refusee' | 'erreur' | 'autre'`.

- [ ] **Step 1 : écrire les tests qui échouent**

Dans `FeuilleEnigme.test.tsx`, ajouter `signalerEnigme` au mock et deux tests :

```tsx
const signalerEnigme = vi.fn<(numero: number, raison: string, precision: string) => Promise<void>>()
vi.mock('../api/enigmes', () => ({
  ouvrirEnigme: (id: number) => ouvrirEnigme(id),
  percerEnigme: (id: number, r: string) => percerEnigme(id, r),
  signalerEnigme: (numero: number, raison: string, precision: string) =>
    signalerEnigme(numero, raison, precision),
}))
```

```tsx
const FAUX = {
  juste: false, reponse: 'Sainte-Sophie', explication: 'La plus grande coupole…', xp: 0, gagnes: 0,
  points: 5, total: 130, nouveauxTitres: [], prochain: null,
  resteEnAttente: 2, niveau: { niveau: 12, avant: 0.5, apres: 0.5 },
}

test('pas de signalement avant la réponse', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  monter()
  await retourner()
  await screen.findByRole('button', { name: 'Sainte-Sophie' })
  expect(screen.queryByRole('button', { name: 'Signaler une erreur ou une injustice' })).toBeNull()
})

test('après le verdict, signaler : une raison, un mot, un merci, puis retour à l’énigme', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  percerEnigme.mockResolvedValue(FAUX)
  signalerEnigme.mockResolvedValue(undefined)
  monter()
  await retourner()
  fireEvent.click(await screen.findByRole('button', { name: 'Sainte-Irène' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Signaler une erreur ou une injustice' }))
  fireEvent.click(screen.getByRole('radio', { name: 'Ma réponse aurait dû être acceptée' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Un mot de plus' }), {
    target: { value: 'les deux sont justes' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Envoyer le signalement' }))
  expect(await screen.findByText('Merci')).toBeInTheDocument()
  expect(signalerEnigme).toHaveBeenCalledWith(242, 'reponse_refusee', 'les deux sont justes')
  fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  expect(await screen.findByText('Pas cette fois')).toBeInTheDocument()
})
```

Note : si `Feuille` rend son propre bouton de fermeture nommé « Fermer », cibler celui du merci avec
`screen.getAllByRole('button', { name: 'Fermer' }).at(-1)`.

- [ ] **Step 2 : vérifier qu'ils échouent**

Run : `pnpm --filter web-v2 test -- FeuilleEnigme.test.tsx`
Expected : le premier passe déjà (rien n'existe), le second FAIL — bouton « Signaler une erreur ou une
injustice » introuvable.

- [ ] **Step 3 : l'appel à la base**

Ajouter à la fin de `features/carte/api/enigmes.ts` (et mettre « quatre RPC (migrations 441, 470) » dans
l'en-tête) :

```ts
export type RaisonEnigme = 'reponse_refusee' | 'erreur' | 'autre'

// Signaler une énigme (mig 470) : la base relève elle-même ma dernière réponse.
export async function signalerEnigme(numero: number, raison: RaisonEnigme, precision: string) {
  const { error } = await supabase.rpc('signaler_enigme', {
    p_enigme: numero,
    p_raison: raison,
    p_precision: precision,
  })
  if (error) throw error
}
```

- [ ] **Step 4 : la feuille de l'énigme**

`features/carte/components/FeuilleSignalerEnigme.tsx` :

```tsx
/**
 * QUOI     — « Signaler une erreur » sur une énigme : trois raisons, un mot, puis un merci.
 * POURQUOI — les joueurs trouvaient les énigmes trop strictes (« Eudes » pour « Eudes de Paris ») : ce
 *            qu'ils contestent arrive dans le Hub, qui peut accepter leur réponse (spec du 08/10, mig 470).
 */
import { FeuilleDeSignalement, type Raison } from '@/shared/ui/FeuilleDeSignalement'
import { signalerEnigme, type RaisonEnigme } from '../api/enigmes'

const RAISONS: Raison<RaisonEnigme>[] = [
  { id: 'reponse_refusee', libelle: 'Ma réponse aurait dû être acceptée' },
  { id: 'erreur', libelle: 'La réponse ou l’explication est fausse' },
  { id: 'autre', libelle: 'Autre chose' },
]

export function FeuilleSignalerEnigme({ numero, onFermer }: { numero: number; onFermer: () => void }) {
  return (
    <FeuilleDeSignalement
      titre="Signaler une erreur"
      consigne="Qu’est-ce qui ne va pas ? L’équipe regarde chaque signalement."
      raisons={RAISONS}
      merci="L’équipe va regarder cette énigme de près."
      onEnvoyer={(raison, precision) => signalerEnigme(numero, raison, precision)}
      onFermer={onFermer}
    />
  )
}
```

- [ ] **Step 5 : le lien, en bas de la feuille, après le verdict**

Dans `FeuilleEnigme.tsx` :
- importer `import { FeuilleSignalerEnigme } from './FeuilleSignalerEnigme'` ;
- ajouter l'état `const [signaler, setSignaler] = useState(false)` à côté de `choisie` ;
- juste avant `const envoyer = …`, ajouter :

```tsx
  if (signaler) {
    return (
      <FeuilleSignalerEnigme
        numero={enigme.numero}
        onFermer={() => {
          setSignaler(false)
        }}
      />
    )
  }
```

- après le bloc `{verdict ? (<Relance … />) : (…)}`, avant `</div>` de `.contenu`, ajouter :

```tsx
        {verdict && (
          <button
            type="button"
            className={styles.signaler}
            onClick={() => {
              setSignaler(true)
            }}
          >
            Signaler une erreur ou une injustice
          </button>
        )}
```

- compléter l'en-tête QUOI : « …après la réponse, le verdict, et tout en bas un lien discret pour signaler
  une erreur (mig 470). »

Le verdict ne se perd pas : il vit dans la mutation de `useEnigme`, qui reste montée.

Dans `FeuilleEnigme.module.css`, à la fin :

```css
/* Signaler : discret, tout en bas, après le verdict. */
.signaler {
  justify-self: center;
  padding: var(--space-2);
  border: none;
  background: none;
  color: var(--color-texte-doux);
  font-family: var(--font-corps);
  font-size: var(--legende-size);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
```

(Si `.contenu` n'est pas une grille, remplacer `justify-self: center` par `align-self: center`.)

- [ ] **Step 6 : tests, types, lint**

Run : `pnpm --filter web-v2 test -- FeuilleEnigme.test.tsx && pnpm --filter web-v2 typecheck && pnpm --filter web-v2 lint`
Expected : PASS, aucune erreur.

- [ ] **Step 7 : commit**

```bash
git add apps/web-v2/src/features/carte
git commit -m "feat(enigmes): « Signaler une erreur ou une injustice » sous le verdict"
```

---

### Task 4 : Hub — « Autres réponses acceptées » et ouverture directe d'une énigme

**Files :**
- Modify : `apps/hub/src/components/Enigmas.tsx`

**Interfaces :**
- Consumes : colonne `enigmas.accepted_answers` (Task 1).
- Produces : l'URL `/carte/enigmes?edit=<numero>` ouvre le formulaire de cette énigme (utilisée en Task 5).

- [ ] **Step 1 : le type et le chargement**

- `interface Enigma` : ajouter `accepted_answers: string[]` après `answer`.
- `EMPTY_ENIGMA` : ajouter `accepted_answers: [],` après `answer: '',`.
- dans `fetchData`, le mapping : ajouter
  `accepted_answers: Array.isArray(e.accepted_answers) ? (e.accepted_answers as string[]) : [],` après `answer`.
- dans `startEdit` : ajouter `accepted_answers: [...enigma.accepted_answers],` après `answer`.
- dans `handleSaveForm`, le `payload` : ajouter après `answer` :

```ts
        accepted_answers: editForm.format === 'free'
          ? editForm.accepted_answers.map(a => a.trim()).filter(Boolean)
          : [],
```

- [ ] **Step 2 : le champ, sous « Reponse correcte », pour une énigme libre**

```tsx
          {editForm.format === 'free' && (
            <div className="faction-field" style={{ marginBottom: 12 }}>
              <label className="faction-field-label">Autres réponses acceptées (une par ligne)</label>
              <textarea
                value={editForm.accepted_answers.join('\n')}
                onChange={e => setEditForm(prev => ({ ...prev, accepted_answers: e.target.value.split('\n') }))}
                className="faction-description-input"
                rows={3}
                placeholder={'Eudes\nEudes Ier'}
              />
            </div>
          )}
```

- [ ] **Step 3 : ouvrir une énigme depuis l'URL**

- import : `import { useSearchParams } from 'react-router-dom'` ;
- dans `Enigmas()`, après les `useState` : `const [searchParams, setSearchParams] = useSearchParams()` ;
- après la déclaration de `startEdit`, ajouter :

```ts
  // « Modifier l'énigme » depuis les énigmes signalées : /carte/enigmes?edit=242.
  useEffect(() => {
    const id = Number(searchParams.get('edit'))
    const enigma = enigmas.find(e => e.id === id)
    if (!enigma) return
    startEdit(enigma)
    setSearchParams({}, { replace: true })
  }, [enigmas])
```

- [ ] **Step 4 : taille et build**

Run : `wc -l apps/hub/src/components/Enigmas.tsx && pnpm --filter hub build`
Expected : ≤ 700 lignes (sinon sortir le formulaire dans `components/enigmes/FormulaireEnigme.tsx` dans ce
même commit) ; build OK.

- [ ] **Step 5 : commit**

```bash
git add apps/hub/src/components/Enigmas.tsx
git commit -m "feat(hub): autres réponses acceptées d'une énigme, et l'ouvrir depuis l'URL"
```

---

### Task 5 : Hub — l'écran « Énigmes signalées »

**Files :**
- Create : `apps/hub/src/components/enigmes/EnigmesSignalees.tsx`
- Modify : `apps/hub/src/App.tsx` (route admin)
- Modify : `apps/hub/src/components/Sidebar.tsx` (entrée et compteur)

**Interfaces :**
- Consumes : `signalements_enigme_du_hub()`, `traiter_signalement_enigme(p_id, p_accepter)` (Task 1) ;
  `/carte/enigmes?edit=<numero>` (Task 4).

- [ ] **Step 1 : l'écran**

`apps/hub/src/components/enigmes/EnigmesSignalees.tsx` :

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// Les énigmes que les joueurs contestent, envoyées depuis le verdict de la V2 (migration 470).
interface SignalementEnigme {
  id: number
  raison: string
  precision: string | null
  reponseDonnee: string
  quand: string
  enigme: { numero: number; question: string; reponse: string; variantes: string[]; format: 'qcm' | 'free' }
  qui: { id: string; nom: string }
}

const RAISONS: Record<string, string> = {
  reponse_refusee: 'Réponse refusée à tort',
  erreur: 'Réponse ou explication fausse',
  autre: 'Autre',
}

export function EnigmesSignalees() {
  const [rows, setRows] = useState<SignalementEnigme[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase.rpc('signalements_enigme_du_hub')
      if (Array.isArray(data)) setRows(data as SignalementEnigme[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchList() }, [fetchList])

  const traiter = async (s: SignalementEnigme, accepter: boolean) => {
    setBusy(s.id)
    setErreur(null)
    try {
      const { error } = await supabase.rpc('traiter_signalement_enigme', { p_id: s.id, p_accepter: accepter })
      if (error) setErreur(error.message)
      await fetchList()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mod-wrap">
      <div className="mod-head">
        <h1 className="mod-title">Énigmes signalées</h1>
      </div>

      {erreur && <div className="empty" style={{ color: '#8a3b1f' }}>{erreur}</div>}
      {loading && rows.length === 0 && <div className="loading">Chargement…</div>}
      {!loading && rows.length === 0 && <div className="empty">Aucune énigme signalée.</div>}

      {rows.map(s => (
        <div key={s.id} className="mod-row">
          <div className="mod-row-main" style={{ gridTemplateColumns: '1fr auto', cursor: 'default' }}>
            <div>
              <div style={{ fontWeight: 600 }}>Énigme n° {s.enigme.numero} — {s.enigme.question}</div>
              <div style={{ fontSize: 14, margin: '4px 0' }}>
                Attendue : <strong>{s.enigme.reponse}</strong>
                {s.enigme.variantes.length > 0 && <> (ou {s.enigme.variantes.join(', ')})</>}
              </div>
              <div style={{ fontSize: 14, margin: '4px 0' }}>
                Réponse du joueur : <strong>{s.reponseDonnee}</strong>
              </div>
              <div className="mod-badges">
                <span className="mod-badge" style={{ background: '#f3d9c9', color: '#8a3b1f' }}>
                  {RAISONS[s.raison] ?? s.raison}
                </span>
              </div>
              {s.precision && <div style={{ fontSize: 14, margin: '4px 0' }}>« {s.precision} »</div>}
              <div className="mod-meta">
                <span>par {s.qui.nom}</span>
                <span>{new Date(s.quand).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              {s.enigme.format === 'free' && (
                <button className="mod-btn" onClick={() => traiter(s, true)} disabled={busy === s.id}>
                  Accepter cette réponse
                </button>
              )}
              <Link className="mod-btn" to={`/carte/enigmes?edit=${s.enigme.numero}`}>
                Modifier l'énigme
              </Link>
              <button className="mod-btn" onClick={() => traiter(s, false)} disabled={busy === s.id}>
                Clore
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2 : la route (admins)**

Dans `App.tsx` : `import { EnigmesSignalees } from './components/enigmes/EnigmesSignalees'`, et dans les
routes admin, après `<Route path="/carte/enigmes" element={<Enigmas />} />` :

```tsx
          <Route path="/carte/enigmes-signalees" element={<EnigmesSignalees />} />
```

- [ ] **Step 3 : la barre latérale, avec le compteur**

Dans `Sidebar.tsx` :
- état : `const [enigmesSignalees, setEnigmesSignalees] = useState(0)` ;
- dans le `useEffect`, seulement pour un admin (la RPC refuse les autres) :

```ts
    if (isAdmin) {
      supabase.rpc('signalements_enigme_du_hub').then(({ data }) => {
        if (active && Array.isArray(data)) setEnigmesSignalees(data.length)
      })
    }
```

  et passer le tableau de dépendances à `[isAdmin]` ;
- après le `NavLink` « Enigmes » :

```tsx
            <NavLink to="/carte/enigmes-signalees" className={({ isActive }) => isActive ? 'active' : ''}>
              Énigmes signalées
              {enigmesSignalees > 0 && (
                <span style={{ marginLeft: 8, background: '#e0a73d', color: '#2b2b2b', fontSize: 11, fontWeight: 700, minWidth: 18, display: 'inline-block', textAlign: 'center', padding: '1px 7px', borderRadius: 999, verticalAlign: 'middle' }}>
                  {enigmesSignalees}
                </span>
              )}
            </NavLink>
```

- [ ] **Step 4 : build**

Run : `pnpm --filter hub build`
Expected : OK.

- [ ] **Step 5 : commit**

```bash
git add apps/hub/src/components/enigmes/EnigmesSignalees.tsx apps/hub/src/App.tsx apps/hub/src/components/Sidebar.tsx
git commit -m "feat(hub): l'écran « Énigmes signalées », accepter une réponse en un clic"
```

---

### Task 6 : vérifier le parcours de bout en bout

**Files :** aucun (un correctif éventuel va dans la tâche qu'il concerne, en nouveau commit).

- [ ] **Step 1 : tout le monde au vert**

Run : `pnpm --filter web-v2 test && pnpm --filter web-v2 lint && pnpm --filter web-v2 build && pnpm --filter hub build`
Expected : tout PASS.

- [ ] **Step 2 : V2 dans le navigateur** (`pnpm --filter web-v2 dev`, compte de test)

Ouvrir une énigme éveillée, répondre, vérifier : pas de lien avant la réponse ; après, « Signaler une erreur
ou une injustice » tout en bas, discret ; la feuille, ses trois raisons, l'envoi, le merci, « Fermer »
ramène au verdict intact. Une énigme se répond une fois par éveil : utiliser une énigme réellement éveillée
pour le compte de test, sans rien inventer en base.

- [ ] **Step 3 : Hub dans le navigateur** (`pnpm --filter hub dev`, port 3001)

« Énigmes signalées » montre le signalement de l'étape 2, compteur compris. « Modifier l'énigme » ouvre le
bon formulaire, avec le champ « Autres réponses acceptées » ; enregistrer ne rouvre pas le formulaire.
Sur une énigme libre, « Accepter cette réponse » : la ligne disparaît, la variante apparaît dans le
formulaire. Remettre ensuite l'énigme de test dans son état d'origine (retirer la variante) si elle n'était
pas légitime.

- [ ] **Step 4 : pousser**

```bash
git push
```

Le déploiement (V2 et Hub, Netlify manuel) se fait après accord d'Uriel, en lisant d'abord
`.claude/rules/deploiement.md`.
