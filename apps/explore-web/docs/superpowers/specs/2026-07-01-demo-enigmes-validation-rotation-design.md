# Énigmes en mode démo — vraie validation + rotation infinie — Design

**Date :** 2026-07-01
**Statut :** Spec validée (Uriel), en attente de plan d'implémentation
**Contexte :** borne démo `demo.runesdechene.com` (mode `VITE_DEMO_MODE=true`)

## Problème

En mode démo, `answer_enigma` est intercepté par le proxy Supabase (`demoSupabase.ts`)
et renvoie **toujours** `{ correct: true }`, **sans** les champs `answer` ni
`explanation`. Conséquences constatées sur la borne :

1. Quoi qu'on réponde, c'est « bonne réponse » → l'énigme perd tout son sens.
2. Le texte d'explication / lore (le sel du produit, « Fragments d'Histoire ») ne
   s'affiche jamais.
3. Les énigmes ne tournent pas : la démo reboucle sur les 3 énigmes **du jour**
   (`get_daily_enigma` est deterministe par jour), pas de renouvellement.

## Objectif

En démo : **vraie validation** (juste = juste, faux = faux) **avec l'explication
affichée dans les deux cas**, et un **flux d'énigmes qui tourne en continu**
(aléatoire, rejouable à l'infini). Le tout en conservant les invariants démo :
**zéro écriture en base** et **inertie totale hors démo**.

## Contrainte structurante

La bonne réponse (`enigmas.answer`) et l'explication (`enigmas.explanation`) ne sont
**jamais** envoyées au client par `get_daily_enigma` (anti-triche) — elles n'arrivent
qu'en retour de `answer_enigma`, qui **écrit** (insert `enigma_responses`, update
`users`, `user_crowns`, `activity_log`). Donc afficher la vraie explication **exige
une voie de lecture serveur dédiée**. On l'ajoute, réservée au compte démo.

## Architecture

Deux nouvelles fonctions SQL `SECURITY DEFINER`, **lecture seule**, **gardées compte
démo uniquement**, + branchement dans le proxy démo + un aiguillage front.

### Garde anti-triche (commune aux 2 RPC)

Chaque fonction vérifie que l'appelant est le compte démo, sinon `unauthorized` :

```sql
IF (SELECT email FROM auth.users WHERE id = auth.uid()) IS DISTINCT FROM 'demo@runesdechene.com' THEN
  RETURN json_build_object('error', 'unauthorized');
END IF;
```

Garde par **email** (stable) plutôt que par id codé en dur (survit à une recréation
du compte). Les vrais joueurs ne peuvent donc pas révéler les réponses ni piocher des
énigmes hors de leur flux.

### 1. Rotation infinie — `get_demo_enigmas(p_count int default 3)`

- Renvoie `p_count` énigmes **aléatoires** du pool actif
  (`type = 'daily' AND active = TRUE`, **toutes difficultés** — inclut `hard`).
- **Même forme JSON** que le tableau `enigmas[]` de `get_daily_enigma` :
  `{ id, difficulty, loreText, question, format, choices, theme, rewardInfluence, rewardErudition }`
  (mappe `lore_text` → `loreText` ; rewards lus dans `app_settings` comme l'original).
- `ORDER BY random() LIMIT p_count` → jeu neuf à chaque appel. **Aucun** filtre
  « déjà répondu » → rejouable à l'infini.
- Retour : `{ 'enigmas': json_agg(...) }` (pas de champ `all_answered`, jamais
  « tout résolu » en démo).

### 2. Vraie validation + explication — `check_enigma_answer(p_enigma_id int, p_answer text)`

- `SELECT * FROM enigmas WHERE id = p_enigma_id` ; si absent → `{ error: 'enigma_not_found' }`.
- `v_correct := public._enigma_answer_matches(p_answer, v_enigma.answer)` — **réutilise
  le matcher existant** (accents/casse/normalisation identiques à la prod).
- Retour : `{ correct, answer, explanation, difficulty }`. **Aucune** écriture.

### 3. Proxy démo (`src/lib/demo/demoSupabase.ts`)

- `answer_enigma` (et `answer_fragment_enigma`) cesse d'être un fake statique et
  devient un **faked-with-read** : `await supabase.rpc('check_enigma_answer', {...})`
  (lecture réelle), puis fusion avec l'habillage démo :
  - `demoStore.addGlory(1)` (progression visuelle de session, inchangé),
  - complète le payload attendu par `EnigmaResult` :
    `{ correct, answer, explanation, influenceGain: 1, eruditionGain: 1,
       crownsGain: <selon difficulté 1/1/2/3>, newCrownsBalance: Infinity,
       newErudition: 0, newGlory: demoStore.glory }`.
- `get_demo_enigmas` : commence par `get_` → déjà classé `read` (pass-through). Aucun
  changement de `classifyRpc` requis pour lui. `check_enigma_answer` idem (`check_`
  n'est pas un préfixe read connu → on l'appelle en interne, pas via classify).
- Détail technique : `answer_enigma` doit sortir du chemin `Promise.resolve(fakeResponse)`
  synchrone pour un chemin **async** qui fait le vrai appel réseau puis reconstruit la
  réponse. `fakeResponse` reste synchrone pour les autres cas ; on ajoute une branche
  async dédiée dans le wrapper `.rpc`.

### 4. Front (`src/components/enigma/DailyEnigma.tsx`)

- `loadEnigmas()` : en démo (`isDemoMode()`), appeler `get_demo_enigmas` (au lieu de
  `get_daily_enigma`). Le reste du parsing est identique (même forme). En démo on ne
  gère jamais `all_answered` (déjà le cas).
- `handleNext()` recharge déjà la série en démo → rotation continue automatique.
- `EnigmaResult` affiche déjà `correct / answer / explanation` → fonctionne dès que le
  payload est peuplé (via le proxy). Aucun changement de rendu nécessaire.

## Invariants préservés

- **Zéro écriture** : les 2 fonctions sont des `SELECT` purs. Rien n'est inséré/modifié.
- **Inertie hors démo** : les RPC sont gardées compte démo, et le front ne les appelle
  que sous `isDemoMode()`. La prod normale est intouchée (`answer_enigma`/`get_daily_enigma`
  d'origine inchangés).

## Migration

Un fichier numéroté dans `supabase/migrations/` créant les 2 fonctions
(`CREATE OR REPLACE`, basé sur la def LIVE de `_answer_enigma_internal` /
`get_daily_enigma` pour les formes de retour). Poussé via
**`npx supabase db push --linked`** (canal unique). Additif, sans risque prod.
`GRANT EXECUTE` aux rôles `authenticated` (la garde email fait le reste).

## Tests

- **Proxy** :
  - `answer_enigma` (démo) route vers `check_enigma_answer`, renvoie
    `{ correct, answer, explanation }` réels ; une mauvaise réponse → `correct: false`
    + explication présente.
  - `demoStore.glory` continue d'incrémenter à chaque réponse.
- **SQL** (manuel via MCP, compte démo) :
  - `get_demo_enigmas(3)` → 3 énigmes, formes correctes, ordre varie entre 2 appels.
  - `check_enigma_answer` avec la bonne réponse → `correct: true` + `explanation` ;
    avec une fausse → `correct: false` + `explanation`.
  - Appel par un user non-démo → `{ error: 'unauthorized' }`.

## Hors-scope (YAGNI)

- Pas de gains réels (Gloire/Couronnes/Érudition) en démo — restent visuels/∞.
- Pas de persistance des énigmes « vues » entre sessions (rotation pure aléatoire).
- Pas de refonte de `get_daily_enigma` / `answer_enigma` d'origine (prod inchangée).
- Pas de validation client-side (le matcher reste serveur, fidèle).
