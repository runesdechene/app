# « Les énigmes » et le menu du profil — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** une page « Les énigmes » (énigmes résolues sur le total, par culture, puis ce qu'on a appris) et un menu du profil redessiné, ouvert au toucher du portrait, qui y mène.

**Architecture:** une migration (deux RPC de lecture, une phrase de zone par culture) ; une nouvelle zone `features/enigmes/` (api, hooks, deux pages) ouverte en panneau `/:onglet/enigmes` et `/:onglet/enigmes/:culture` comme « Tous les titres » ; « Les chercher sur la carte » passe par `/carte?zone=lat,lng` ; le menu du profil vit dans la coquille (`app/shell/MenuDuProfil.tsx`) et remplace la navigation directe de l'onglet Compte ; la coupe, l'engrenage et la sortie quittent la barre pour le menu.

**Tech Stack:** PostgreSQL / Supabase, React 19 + TypeScript strict + TanStack Query + React Router, Vitest, Hub React.

**Spec:** les décisions de la conversation du 07/10, consignées dans le `_État.md` d'Explore (ligne « Énigmes de retour dans Explore ») et dans la spec `docs/superpowers/specs/2026-10-07-v2-enigmes-design.md` (le jeu). Maquettes Figma, page 1 : « Profil — le menu redessiné » (476:434), « Les énigmes — 2. la page » (478:452), « Les énigmes — 3. une culture » (478:526).

## Global Constraints

- Les règles du plan `2026-10-07-v2-enigmes.md` (Global Constraints) valent ici à l'identique : `CLAUDE.md`, `.claude/rules/v2.md`, `supabase.md`, `hub.md`, français partout, TS strict, zones qui ne s'importent pas entre elles (`app/` peut importer les zones), jetons CSS, `prefers-reduced-motion`, migration au premier numéro libre (l'autre session a la 446 : prendre **447** et le lui annoncer), `CREATE OR REPLACE` depuis la définition live, tests SQL `BEGIN … ROLLBACK` avec `ASSERT` lancés par `.superpowers/sdd/2026-10-07-v2-enigmes/lancer.sh`.
- Mots : « Les énigmes » (jamais « Codex »), « résolues » (jamais « découvertes » : découvrir = révéler un lieu à distance).
- Le menu : portrait, nom, « Niveau N · premier titre porté » ; lignes Mon profil · Les énigmes (« N résolues ») · Tous les titres (« N obtenus ») · Préférences ; trait ; Se déconnecter (rouge). Icône des énigmes : un « ? » cerclé. La cloche reste en haut à droite.
- Déploiement : avec la bascule (autre session), jamais sans s'être parlé.

## Review Focus

1. **Un compte sans aucune énigme résolue** : la page dit « 0 énigme résolue sur 451 », chaque culture « 0 / 72 résolues », la vue d'une culture n'a que l'encart → test du lecteur et du rendu à zéro (Tâches 3 et 4).
2. **Une culture désactivée ou sans cercle** : absente de la page ; et « Les chercher sur la carte » ne s'affiche pas sans centre → test SQL (culture inactive absente) et test du rendu (`centre: null`) (Tâches 1 et 4).
3. **`/carte?zone=` mal formé** (`?zone=abc`) : la carte s'ouvre normalement, sans vol ni erreur → test de `lireZone` (Tâche 5).
4. **Le menu ouvert puis « Mon profil »** : la feuille se ferme et l'onglet Compte s'ouvre, l'historique ne garde pas la feuille → test du menu (Tâche 6).
5. **Toucher le portrait alors qu'on est déjà sur Compte** : le menu s'ouvre quand même (pas de remontée en haut de page à la place) → test de la barre (Tâche 6).

---

### Task 1: Migration 447 — lire ses énigmes, la phrase de zone

**Files:**
- Create: `supabase/migrations/447_mes_enigmes.sql`, `supabase/tests/v2-enigmes/447_mes_enigmes.sql`

**Interfaces:**
- Produces :
  - colonne `enigma_themes.zone text` (« entre la Thrace et l'Asie Mineure »).
  - `mes_enigmes() → json` : `{ "resolues": int, "total": int, "cultures": [{ "id", "nom", "icone": text|null, "couleur": text|null, "resolues": int, "total": int }] }` — cultures actives ayant des cercles, triées par part résolue décroissante.
  - `mes_enigmes_culture(p_theme text) → json` : `{ "culture": { "id", "nom", "icone", "couleur", "zone": text|null }, "resolues": int, "total": int, "centre": { "lat", "lng" } | null, "enigmes": [{ "reponse", "question", "explication", "le": timestamptz }] }` — énigmes du stock résolues par le compte, la plus récente en tête ; lève `P0002` si la culture n'existe pas ou est inactive.
  - `enregistrer_culture(…, p_zone text DEFAULT NULL)` (9 paramètres ; l'appel à 8 du Hub en ligne reste valable) ; `cultures_du_hub()` renvoie aussi `zone`.

- [ ] **Step 1: Écrire le test**

```sql
-- 447 : ses énigmes résolues, par culture ; la phrase de zone. Annulé.
BEGIN;
\ir ../../migrations/447_mes_enigmes.sql
DO $test$
DECLARE
  v_moi text := 'cb16ff47-1ead-4adf-8eff-04d117551541';
  v_neuf text := (SELECT id FROM users u WHERE NOT EXISTS (SELECT 1 FROM enigma_responses r WHERE r.user_id = u.id) LIMIT 1);
  m json; c json; v_erreur text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_moi, 'role', 'authenticated')::text, true);
  m := public.mes_enigmes();
  ASSERT (m->>'total')::int = (SELECT sum((x->>'total')::int) FROM json_array_elements(m->'cultures') x), 'total = somme des cultures';
  ASSERT (m->>'resolues')::int > 0, 'le compte de test a des énigmes résolues';
  c := public.mes_enigmes_culture('celtique');
  ASSERT json_array_length(c->'enigmes') = (c->>'resolues')::int, 'une énigme listée par énigme résolue';
  ASSERT c->'centre'->>'lat' IS NOT NULL, 'une culture avec cercles a un centre';
  ASSERT (c->'enigmes'->0->>'le')::timestamptz >= (c->'enigmes'->1->>'le')::timestamptz, 'la plus récente en tête';
  -- Une culture inactive n'apparaît pas et ne s'ouvre pas.
  UPDATE enigma_themes SET active = false WHERE id = 'romaine';
  ASSERT NOT EXISTS (SELECT 1 FROM json_array_elements(public.mes_enigmes()->'cultures') x WHERE x->>'id' = 'romaine'), 'culture inactive absente';
  BEGIN PERFORM public.mes_enigmes_culture('romaine'); v_erreur := 'ouverte';
  EXCEPTION WHEN OTHERS THEN v_erreur := SQLSTATE; END;
  ASSERT v_erreur = 'P0002', 'culture inactive : P0002, pas ' || v_erreur;
  -- Un compte neuf : zéro partout.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_neuf, 'role', 'authenticated')::text, true);
  ASSERT (public.mes_enigmes()->>'resolues')::int = 0, 'compte neuf : 0 résolue';
  -- La phrase de zone s'enregistre (le compte de test est admin) et l'ancien appel à 8 paramètres marche encore.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_moi, 'role', 'authenticated')::text, true);
  PERFORM public.enregistrer_culture('byzantine', 'Byzantine', '#a93d76', '', 'de Byzance',
    (SELECT cercles FROM enigma_themes WHERE id = 'byzantine'), true, 0, 'entre la Thrace et l’Asie Mineure');
  ASSERT (SELECT zone FROM enigma_themes WHERE id = 'byzantine') = 'entre la Thrace et l’Asie Mineure', 'zone enregistrée';
  PERFORM public.enregistrer_culture('byzantine', 'Byzantine', '#a93d76', '', 'de Byzance',
    (SELECT cercles FROM enigma_themes WHERE id = 'byzantine'), true, 0);
  RAISE EXCEPTION 'BILAN tout passe';
END $test$;
ROLLBACK;
```

- [ ] **Step 2: RED** — `echo "-- vide" > supabase/migrations/447_mes_enigmes.sql` puis lancer : échec sur `mes_enigmes` inexistante.

- [ ] **Step 3: Écrire la migration**

```sql
-- WHY: la page « Les énigmes » (Uriel, 07/10) : combien d'énigmes on a résolues sur le total, par
--      culture, puis ce qu'on a appris ; et la phrase qui dit où une culture s'éveille, réglée dans le Hub.
-- BASE: enregistrer_culture et cultures_du_hub — définitions live (444 et 441) copiées entières ;
--       enregistrer_culture gagne p_zone (DEFAULT NULL : l'appel à 8 paramètres du Hub en ligne tient).
-- SCHEMA CHECKED (<date>) : enigma_themes(id, label, icon, color, cercles, active, sort_order),
--   enigma_responses(enigma_id, user_id, correct, responded_at), enigmas(question, answer, explanation).

ALTER TABLE public.enigma_themes ADD COLUMN IF NOT EXISTS zone text;

-- Les énigmes du stock d'une culture qu'un compte a résolues, avec la date de sa bonne réponse.
CREATE OR REPLACE FUNCTION public._enigmes_resolues(p_user text, p_theme text)
RETURNS TABLE (enigma_id integer, le timestamptz) LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT e.id, max(r.responded_at)
    FROM public._enigmes_du_jeu(p_theme) e JOIN enigma_responses r ON r.enigma_id = e.id
   WHERE r.user_id = p_user AND r.correct
   GROUP BY e.id
$$;
REVOKE EXECUTE ON FUNCTION public._enigmes_resolues(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.mes_enigmes()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_moi text := auth.uid()::text;
  v_cultures json;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'non connecté' USING ERRCODE = '42501'; END IF;
  WITH c AS (
    SELECT t.id, t.label, t.icon, t.color,
           (SELECT count(*) FROM public._enigmes_resolues(v_moi, t.id))::int AS resolues,
           (SELECT count(*) FROM public._enigmes_du_jeu(t.id))::int AS total
      FROM enigma_themes t WHERE t.active AND jsonb_array_length(t.cercles) > 0)
  SELECT COALESCE(json_agg(json_build_object('id', id, 'nom', label, 'icone', icon, 'couleur', color,
                                             'resolues', resolues, 'total', total)
                  ORDER BY resolues::numeric / greatest(total, 1) DESC, label), '[]'::json)
    INTO v_cultures FROM c WHERE total > 0;
  RETURN json_build_object(
    'resolues', (SELECT COALESCE(sum((x->>'resolues')::int), 0) FROM json_array_elements(v_cultures) x),
    'total', (SELECT COALESCE(sum((x->>'total')::int), 0) FROM json_array_elements(v_cultures) x),
    'cultures', v_cultures);
END $$;

CREATE OR REPLACE FUNCTION public.mes_enigmes_culture(p_theme text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_moi text := auth.uid()::text;
  t enigma_themes;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'non connecté' USING ERRCODE = '42501'; END IF;
  SELECT * INTO t FROM enigma_themes WHERE id = p_theme AND active;
  IF t.id IS NULL THEN RAISE EXCEPTION 'culture introuvable' USING ERRCODE = 'P0002'; END IF;
  RETURN json_build_object(
    'culture', json_build_object('id', t.id, 'nom', t.label, 'icone', t.icon, 'couleur', t.color, 'zone', t.zone),
    'resolues', (SELECT count(*) FROM public._enigmes_resolues(v_moi, t.id)),
    'total', (SELECT count(*) FROM public._enigmes_du_jeu(t.id)),
    -- Le premier cercle : « Les chercher sur la carte » y emmène.
    'centre', CASE WHEN jsonb_array_length(t.cercles) > 0
                   THEN json_build_object('lat', (t.cercles->0->>'lat')::float8, 'lng', (t.cercles->0->>'lng')::float8) END,
    'enigmes', (SELECT COALESCE(json_agg(json_build_object('reponse', e.answer, 'question', e.question,
                                                            'explication', e.explanation, 'le', r.le)
                                         ORDER BY r.le DESC), '[]'::json)
                  FROM public._enigmes_resolues(v_moi, t.id) r JOIN enigmas e ON e.id = r.enigma_id));
END $$;

REVOKE ALL ON FUNCTION public.mes_enigmes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mes_enigmes() TO authenticated;
REVOKE ALL ON FUNCTION public.mes_enigmes_culture(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mes_enigmes_culture(text) TO authenticated;

-- enregistrer_culture : la définition live (444), plus p_zone.
DROP FUNCTION IF EXISTS public.enregistrer_culture(text, text, text, text, text, jsonb, boolean, int);
-- (coller ici la définition live de 444 avec le paramètre `p_zone text DEFAULT NULL` ajouté en dernier,
--  `zone` ajouté à l'INSERT (valeur NULLIF(btrim(p_zone), '')) et au DO UPDATE SET (zone = EXCLUDED.zone))
REVOKE ALL ON FUNCTION public.enregistrer_culture(text, text, text, text, text, jsonb, boolean, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enregistrer_culture(text, text, text, text, text, jsonb, boolean, int, text) TO authenticated;

-- cultures_du_hub : la définition live (441), plus 'zone', t.zone dans le json_build_object.
```

(Les deux définitions live se recopient entières depuis `pg_get_functiondef`, modifiées aux seuls endroits dits.)

- [ ] **Step 4: GREEN** — lancer le test : `BILAN tout passe`.
- [ ] **Step 5: Commit** — `feat(enigmes): lire ses énigmes résolues, la phrase de zone d'une culture (mig 447)` (ne pas pousser avant application ; l'appliquer par `db push` après accord d'Uriel, puis pousser).

---

### Task 2: Hub — la phrase de zone

**Files:** Modify `apps/hub/src/components/cultures/Cultures.tsx`

- [ ] **Step 1:** l'interface `Culture` gagne `zone: string | null` ; sous le champ « Complément de titre », un champ « Où elle s'éveille (une phrase) » (`placeholder="entre la Thrace et l’Asie Mineure"`) qui fait `changer({ zone: e.target.value })` ; l'appel `enregistrer_culture` passe `p_zone: c.zone ?? ''`.
- [ ] **Step 2:** `pnpm --filter hub build` OK ; dans le navigateur, écrire la phrase de Byzance, sauvegarder, recharger : elle est là.
- [ ] **Step 3: Commit** — `feat(hub): la phrase de zone de chaque culture`.

---

### Task 3: Zone `features/enigmes` — lire et charger

**Files:**
- Create: `apps/web-v2/src/features/enigmes/README.md`, `api/lireMesEnigmes.ts` (+ `.test.ts`), `api/mesEnigmes.ts`, `hooks/useMesEnigmes.ts`

**Interfaces:**
```ts
export type CultureResolue = { id: string; nom: string; icone: string | null; couleur: string | null; resolues: number; total: number }
export type MesEnigmes = { resolues: number; total: number; cultures: CultureResolue[] }
export type EnigmeApprise = { reponse: string; question: string; explication: string; le: string }
export type MaCulture = { culture: { id: string; nom: string; icone: string | null; couleur: string | null; zone: string | null }; resolues: number; total: number; centre: { lat: number; lng: number } | null; enigmes: EnigmeApprise[] }
export function lireMesEnigmes(v: unknown): MesEnigmes
export function lireMaCulture(v: unknown): MaCulture
export function useMesEnigmes(): { mesEnigmes: MesEnigmes | undefined; erreur: boolean; reessayer: () => void }   // clé ['mes-enigmes']
export function useMaCulture(id: string): { maCulture: MaCulture | undefined; erreur: boolean; reessayer: () => void } // clé ['mes-enigmes', id]
```

- [ ] **Step 1: Tests des lecteurs** (zéro résolue ; `centre: null` ; `zone: null` ; une énigme apprise lue telle quelle) — même style que `features/carte/api/lireEnigmes.test.ts`.
- [ ] **Step 2: RED**, puis **Step 3** écrire les lecteurs (`objet`, `chaine`, `nombre`, `liste`, `ouNull` de `@/shared/lib/lire`), l'api (`supabase.rpc('mes_enigmes')`, `supabase.rpc('mes_enigmes_culture', { p_theme: id })`, `if (error) throw error`) et les hooks (`useQuery`), puis **GREEN**.
- [ ] **Step 4:** `percer_enigme` doit rafraîchir la page : dans `features/carte/hooks/useEnigme.ts`, `onSettled` invalide aussi `['mes-enigmes']`.
- [ ] **Step 5:** `pnpm --filter web-v2 gen:types` (après application de la 447), test, typecheck, lint. **Commit** — `feat(enigmes): lire mes énigmes résolues`.

---

### Task 4: Les deux pages

**Files:**
- Create: `apps/web-v2/src/features/enigmes/components/PageEnigmes.tsx` (+ `.module.css`, `.test.tsx`), `components/PageCulture.tsx` (+ `.module.css`, `.test.tsx`), `components/PastilleCulture.tsx` (+ `.module.css`)
- Modify: `apps/web-v2/src/app/routes/carte.tsx` (deux routes de panneau, à côté de `RouteTitres`), `apps/web-v2/src/app/router.tsx` (enfants de `:tab` : `{ path: 'enigmes', Component: RouteEnigmes }`, `{ path: 'enigmes/:culture', Component: RouteEnigmesCulture }`)

**Ce que montrent les pages (maquettes 478:452 et 478:526) :**
- `PageEnigmes` : « Ce que tu as appris en perçant les « ? » de la carte. » ; « **137** énigmes résolues sur 451 » (chiffre en Bebas, singulier « énigme résolue » quand ≤ 1) ; « Touche une culture pour relire ses réponses et ses « Le savais-tu ? ». » ; une ligne-bouton par culture : `PastilleCulture` (icône du Hub, sinon disque à sa couleur, sinon l'encre), nom en Bebas, « 14 / 72 résolues » à la couleur de la culture, chevron, fine jauge `resolues / total`. Toucher → `navigate('enigmes/<id>')` relatif au panneau.
- `PageCulture` (titre du panneau = nom de la culture) : pastille 44 px, « **14 / 72** résolues », jauge ; **l'encart** (fond `--color-surface`, filet `--color-ocre`, rayon `--radius`) : sceau « ? » de cire (même dessin que `SceauQuiSeRetourne`, face avant, 40 px), titre Bebas « Encore 58 énigmes à percer » (« Encore une énigme à percer » si 1 ; si 0 : « Tout est percé » et « De nouvelles énigmes viendront. »), phrase « Chaque matin, une énigme de {nom} s'éveille {zone ?? 'quelque part dans sa zone'}. Zoome sur la carte : les sceaux « ? » t'attendent. », lien « Les chercher sur la carte → » (`/carte?zone=<lat>,<lng>`, absent si `centre` est null) ; puis une carte par énigme apprise : réponse en gras, date relative (« aujourd'hui », « hier », sinon « 3 mai » / « mai 2026 » — `Intl.DateTimeFormat('fr-FR')`), question en légende, « Le savais-tu ? » en IM Fell (`--font-inscription`, italique).
- Les phrases (`resoluesEnClair`, `encartEnClair`, `quandEnClair`) vivent dans `features/enigmes/lib/enClair.ts` avec leur test.

- [ ] **Step 1: Tests** — `enClair.test.ts` (singulier/pluriel, encart à 0/1/58, zone absente, dates) ; `PageEnigmes.test.tsx` (le compte en tête, une ligne par culture, toucher ouvre la culture) ; `PageCulture.test.tsx` (encart, lien vers la carte avec la bonne zone, pas de lien sans centre, une carte par énigme apprise).
- [ ] **Step 2: RED**, **Step 3** écrire, **Step 4 GREEN** + typecheck + lint.
- [ ] **Step 5: Navigateur** — `/v2/carte/enigmes` puis une culture ; comparer à 390 px avec les maquettes (règle « un écran n'est fini que comparé à sa maquette »).
- [ ] **Step 6: Commit** — `feat(enigmes): la page « Les énigmes » et la vue d'une culture`.

---

### Task 5: « Les chercher sur la carte »

**Files:** Modify `apps/web-v2/src/app/shell/Shell.tsx` (`CarteDeLaCoquille`), `apps/web-v2/src/features/carte/components/CarteScreen.tsx`, Create `apps/web-v2/src/features/carte/lib/zone.ts` (+ test)

**Interfaces:** `lireZone(param: string | null): { lat: number; lng: number } | null` ; `CarteScreen` gagne `zone?: { lat: number; lng: number }` et `onZoneAtteinte?: () => void`.

- [ ] **Step 1: Test** de `lireZone` : `'41,28.9'` → `{ lat: 41, lng: 28.9 }` ; `null`, `'abc'`, `'41'`, `'95,10'` → `null`.
- [ ] **Step 2: RED → écrire → GREEN.**
- [ ] **Step 3:** `CarteDeLaCoquille` lit `recherche.get('zone')` par `lireZone`, la passe à `CarteScreen` ; `onZoneAtteinte` retire `zone` de l'adresse (même motif que `pin`). Dans `CarteScreen`, un effet sur `[carte, zone]` : `carte.flyTo({ center: [zone.lng, zone.lat], zoom: ZOOM_DES_SCEAUX + 0.5, duration: dureeDouce(document.documentElement) })` puis `onZoneAtteinte()`.
- [ ] **Step 4:** test de `CarteScreen` (FausseCarte) : avec `zone`, `flyTo` est appelé une fois avec ce centre. Navigateur : depuis Byzance, « Les chercher sur la carte » vole sur l'Égée et les sceaux y sont.
- [ ] **Step 5: Commit** — `feat(carte): voler jusqu'à la zone d'une culture depuis « Les énigmes »`.

---

### Task 6: Le menu du profil

**Files:**
- Create: `apps/web-v2/src/app/shell/MenuDuProfil.tsx` (+ `.module.css`, `.test.tsx`), `apps/web-v2/src/assets/ui/menu-*.svg` (cinq icônes au trait : profil, énigmes « ? » cerclé, titres, préférences, sortie — reprises de la maquette 476:434 par `get_design_context` / téléchargement)
- Modify: `apps/web-v2/src/app/shell/TabBar.tsx`, `apps/web-v2/src/app/shell/Shell.tsx` (retirer la coupe, l'engrenage et la sortie de `.actions` ; la cloche reste), `apps/web-v2/src/features/compte/components/CompteScreen.tsx` (retirer « Préférences » et « Se déconnecter », désormais dans le menu — code mort croisé), leurs tests (`Shell.test.tsx` : les tests de la coupe, de l'engrenage et de la sortie passent par le menu)

**Interfaces:** `MenuDuProfil({ onFermer }: { onFermer: () => void })` — une `Feuille` titrée « Mon menu » : tête (Avatar `taille="moyen"` ou la taille la plus proche existante, nom en Bebas, « Niveau N · {premier titre} ») ; lignes-boutons ; « Se déconnecter » appelle `seDeconnecter()` (garde l'alerte d'échec de `CompteScreen`).

Navigation des lignes (chacune ferme d'abord la feuille) :
- Mon profil → `navigate('/compte')` ;
- Les énigmes → `ouvrir('enigmes')` (même `useOuvrir` que la coupe : panneau sur l'onglet courant) ;
- Tous les titres → `ouvrir('titres')` ;
- Préférences → `ouvrir('preferences')`.

`TabBar.press('compte')` n'appelle plus `resolveTabPress` : il ouvre le menu (`useState` local `menuOuvert`), y compris quand Compte est déjà l'onglet actif.

Les détails (« 137 résolues », « 19 obtenus ») viennent de `useMesEnigmes()` et `useMesTitres()` ; absents tant qu'ils chargent.

- [ ] **Step 1: Tests** — `MenuDuProfil.test.tsx` : la tête (nom, niveau, titre), les quatre lignes et leurs détails, « Mon profil » ferme et va sur `/compte`, « Les énigmes » va sur `/<onglet>/enigmes` ; `Shell.test.tsx` : toucher le portrait ouvre le menu (même depuis `/compte`), la cloche reste dans la barre, la coupe n'y est plus.
- [ ] **Step 2: RED → écrire → GREEN**, typecheck, lint.
- [ ] **Step 3: Navigateur**, téléphone (390 px) et PC : le menu s'ouvre au portrait, chaque ligne mène où il faut, la cloche est en haut à droite ; comparer à la maquette 476:434.
- [ ] **Step 4: Commit** — `feat(coquille): le menu du profil — profil, énigmes, titres, préférences, sortie`.

---

### Task 7: Vérifier, pousser, préparer le déploiement

- [ ] `pnpm --filter web-v2 test && lint && typecheck`, `pnpm build:v2`, `pnpm --filter hub build` ; `pnpm exec vite preview` sur la carte (règle « une dépendance qui change… » : pas de dépendance ici, mais la coquille change).
- [ ] `git pull --rebase`, `git push`. Prévenir l'autre session : ces commits partent avec la bascule (Hub inclus).
- [ ] Vault : `_État.md` (fait) ; un piège rencontré → `.claude/rules/`.
