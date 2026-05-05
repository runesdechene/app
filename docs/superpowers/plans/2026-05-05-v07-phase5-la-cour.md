# V0.7 Phase 5 — La Cour — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline execution chosen — pas de sub-agents par décision Uriel 5/05). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer La Cour (influence à distance via Couronnes, expé-vs-expé, faveur 50, reset GPS gratuit, statut "veilleur par influence" réversible) + énigmes qui rapportent des Couronnes (1/1/2/3 miroir Gloire), en sprint unique avant festival du 12 mai 2026.

**Architecture:** 6 migrations SQL séquentielles (drop V0.5 → schéma phase 5 → RPCs métier → modifs RPCs existantes → titres). Frontend explore-web avec nouveau panel `PlaceCourtView` + 4 sous-composants + modale d'investissement. Hub admin minimal. Subscribe Realtime sur `activity_log` étendu.

**Tech Stack:** Postgres / Supabase (RPCs SECURITY DEFINER) · React 18 + Vite + TS strict · Zustand stores · Realtime subscribe.

**Spec source:** `docs/superpowers/specs/2026-05-05-v07-phase5-la-cour-design.md`

---

## File Structure

### Backend (`supabase/migrations/`)
- `077_drop_v05_influence.sql` — clean RPCs qui touchent `influence_stock`, drop tables/colonne/RPCs V0.5
- `078_v07_phase5_schema.sql` — tables `place_court_action`, `place_court_score`, colonnes `place_veille.by_influence` / `previous_expedition_id`
- `079_v07_phase5_rpcs_court.sql` — `invest_crowns()` + `get_place_court_state()` + helpers
- `080_v07_enigma_crowns.sql` — modifs `_answer_enigma_internal` + `_answer_fragment_enigma_internal` (Couronnes)
- `081_v07_plant_flag_court_reset.sql` — modif `plant_flag` (reset court_score + gestion by_influence)
- `082_v07_titles_mecenat.sql` — modif `get_user_titles` (titres mécénat)

### Frontend explore-web (`apps/explore-web/src/`)
- `types/court.ts` — types `PlaceCourtState`, `Patron`, `ChronicleEntry`, `Threat`, `CourtStatus`
- `components/places/details/PlaceCourtView.tsx` — section principale fiche lieu
- `components/places/details/CourtTensionBar.tsx` — jauge faveur
- `components/places/details/PatronsList.tsx` — top 5 mécènes
- `components/places/details/CourtChronicle.tsx` — journal 10 dernières actions
- `components/places/actions/InvestCrownsModal.tsx` — modale d'investissement
- `hooks/useCourtNotifications.ts` — subscribe filtré
- Modifs : `PlacePanel.tsx`, `EnigmaResult.tsx`, `DailyEnigma.tsx`, `FragmentEnigma.tsx`, `MapMarkers.tsx`, `crownsStore.ts`, `InfluenceToggle.tsx` (drop)

### Frontend hub (`apps/hub/src/`)
- `components/Divers.tsx` — ajout section "Bascules récentes"

---

## Pré-requis avant de démarrer

- [ ] Lire la spec : `docs/superpowers/specs/2026-05-05-v07-phase5-la-cour-design.md`
- [ ] Vérifier qu'on est sur `main`, working tree propre : `git status`
- [ ] Créer une branche dédiée : `git checkout -b v07-phase5-la-cour`
- [ ] Vérifier que la dernière migration est bien `076_hotfix_get_place_by_id.sql` : `ls supabase/migrations/ | tail -3`

---

## Task 1 — Migration 077 : Drop V0.5 (clean + tables + colonne)

**Files:**
- Create: `supabase/migrations/077_drop_v05_influence.sql`

**Pourquoi en une seule mig** : pour éviter une fenêtre où une RPC référence une colonne ou table droppée. Tout en transaction.

**Approche** : (1) réécrire les RPCs qui touchent `influence_stock` sans cette colonne (verbatim copy + retrait selon règle B1 discipline) (2) drop tables V0.5 (3) drop RPCs V0.5 (4) drop colonne `users.influence_stock`.

- [ ] **Step 1 — Audit final des RPCs à modifier**

Lancer ces grep pour vérifier qu'aucune autre RPC active n'a été oubliée :

```bash
grep -rn "influence_stock" supabase/migrations/ --include="*.sql" | grep -v ".archives" | grep -v "^supabase/migrations/001_baseline"
```

Liste attendue (à modifier dans cette mig) :
- `revisit_place` (dernière version : `006_revisit_place_gps_stock_only.sql`)
- `get_player_profile` (dernière version : `032_get_player_profile_veilled_places.sql`)
- `_answer_enigma_internal` (dernière version : `069_v07_fix_enigma_toast_log.sql`) — sera modifiée plus largement par mig 080 (Couronnes)
- `_answer_fragment_enigma_internal` (dernière version : `070_v07_fragment_enigma_toast_meta.sql`) — idem
- `create_place` (dernière version : `061_v07_gating_create_place_by_discoveries.sql`) — vérifier si réfère encore `influence_stock`

Si la liste diffère, mettre à jour le plan avant de continuer.

- [ ] **Step 2 — Lire la version courante de `revisit_place` (mig 006)**

```bash
cat supabase/migrations/006_revisit_place_gps_stock_only.sql
```

Copier-coller la définition de `revisit_place` dans une note tampon. Conformément à la règle B1, la nouvelle mig 077 redéfinira la fonction VERBATIM, en retirant uniquement la ligne `influence_stock = influence_stock + v_stock_gain` du UPDATE et `v_new_influence_stock` du RETURNING.

- [ ] **Step 3 — Lire la version courante de `get_player_profile` (mig 032)**

```bash
cat supabase/migrations/032_get_player_profile_veilled_places.sql
```

Préparer la nouvelle version : retirer `'influenceStock', COALESCE(u.influence_stock, 0)` du `json_build_object` de retour. Vérifier qu'aucune autre référence n'existe.

**Vérification frontend impactée** : `grep -rn "influenceStock" apps/explore-web/src/` — si trouvé, prévoir adaptation dans la task frontend correspondante (probablement aucun usage post-V0.6, mais vérifier).

- [ ] **Step 4 — Vérifier `create_place` (mig 061) ne touche pas `influence_stock`**

```bash
grep -n "influence_stock" supabase/migrations/061_v07_gating_create_place_by_discoveries.sql
```

Si présent, l'ajouter à la liste de RPCs à réécrire dans la mig 077. Sinon, skip (la baseline 001 n'est pas modifiable, c'est la baseline).

- [ ] **Step 5 — Écrire la migration 077**

Créer le fichier `supabase/migrations/077_drop_v05_influence.sql` avec le contenu suivant (assemblage des trois éléments) :

```sql
-- 077_drop_v05_influence.sql
-- WHY : Phase 5 (La Cour) remplace tout le système d'influence V0.5. Avant de
-- pouvoir DROP les tables `place_influence` / `user_place_influence` et la
-- colonne `users.influence_stock`, on doit réécrire les RPCs encore actives
-- qui les référencent. Ordre :
--   1. Réécrire `revisit_place` sans influence_stock (verbatim mig 006 - influence_stock).
--   2. Réécrire `get_player_profile` sans influenceStock (verbatim mig 032 - ce champ).
--   3. DROP les RPCs V0.5 (place_influence_action, _place_influence_action_internal).
--   4. DROP les tables V0.5 (user_place_influence, place_influence).
--   5. ALTER TABLE users DROP COLUMN influence_stock.
-- Les RPCs `_answer_enigma_internal` et `_answer_fragment_enigma_internal` qui
-- écrivent aussi influence_stock seront réécrites par la mig 080 (Couronnes
-- énigmes) — leur dernière version de mig 069/070 reste active en attendant.
-- Pour éviter un état intermédiaire incohérent, on applique 077 → 080 en série
-- via `pnpm dlx supabase db push` (transactionnelle par mig).

BEGIN;

-- ============================================================
-- 1. Reécrire revisit_place sans influence_stock
--    (Verbatim mig 006 - les 3 lignes qui touchent influence_stock)
-- ============================================================

-- [PLACER ICI le contenu complet de revisit_place de la mig 006,
--  en supprimant uniquement :
--   - la déclaration `v_new_influence_stock int;`
--   - le `influence_stock = influence_stock + v_stock_gain,` du UPDATE
--   - le `RETURNING influence_stock, ...INTO v_new_influence_stock, ...`
--   - le `'newInfluenceStock', v_new_influence_stock,` du json_build_object
--  Conserver tout le reste mot pour mot.]

-- ============================================================
-- 2. Reécrire get_player_profile sans influenceStock
--    (Verbatim mig 032 - le champ influenceStock du retour)
-- ============================================================

-- [PLACER ICI le contenu complet de get_player_profile de la mig 032,
--  en supprimant uniquement la ligne :
--   `'influenceStock', COALESCE(u.influence_stock, 0),`
--  Conserver tout le reste mot pour mot.]

-- ============================================================
-- 3. DROP RPCs V0.5
-- ============================================================

DROP FUNCTION IF EXISTS public.place_influence_action(text, text, integer, numeric, numeric, text);
DROP FUNCTION IF EXISTS public._place_influence_action_internal(text, text, integer, numeric, numeric, text);

-- ============================================================
-- 4. DROP tables V0.5
-- ============================================================

-- Order : user_place_influence référence place_influence (FK), drop dans le bon ordre.
-- Vérifier les FK avant : la mig 013 a créé ces tables.
DROP TABLE IF EXISTS public.user_place_influence;
DROP TABLE IF EXISTS public.place_influence;

-- ============================================================
-- 5. DROP colonne users.influence_stock
-- ============================================================

ALTER TABLE public.users DROP COLUMN IF EXISTS influence_stock;

COMMIT;
```

**ATTENTION**: les blocs `[PLACER ICI ...]` doivent être remplacés par le contenu réel des RPCs avant d'appliquer. Il vaut mieux faire ça dans cet ordre :
1. Cat mig 006 → copier-coller `revisit_place` → retirer les lignes mentionnées
2. Cat mig 032 → copier-coller `get_player_profile` → retirer la ligne mentionnée
3. Vérifier la mig finale en `cat`

- [ ] **Step 6 — Appliquer la migration**

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
pnpm dlx supabase db push
```

Expected : `Applying migration 077_drop_v05_influence.sql... done`. Si erreur "column influence_stock does not exist" → c'est qu'une RPC l'utilise encore, retour Step 1 audit.

- [ ] **Step 7 — Vérifier en prod**

Via Supabase Studio ou requête directe :

```sql
-- Tables droppées ?
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('place_influence', 'user_place_influence');
-- Expected: 0 rows

-- Colonne droppée ?
SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'influence_stock';
-- Expected: 0 rows

-- RPCs droppées ?
SELECT proname FROM pg_proc WHERE proname IN ('place_influence_action', '_place_influence_action_internal');
-- Expected: 0 rows

-- get_player_profile fonctionne ?
SELECT public.get_player_profile('<user_id_test>'::text);
-- Expected: JSON sans champ influenceStock, sans erreur
```

- [ ] **Step 8 — Commit**

```bash
git add supabase/migrations/077_drop_v05_influence.sql
git commit -m "feat(db): drop V0.5 influence system (mig 077)

- DROP place_influence, user_place_influence
- DROP place_influence_action, _place_influence_action_internal
- DROP users.influence_stock column
- Rewrite revisit_place, get_player_profile without influence_stock"
```

---

## Task 2 — Migration 078 : Schéma Phase 5

**Files:**
- Create: `supabase/migrations/078_v07_phase5_schema.sql`

- [ ] **Step 1 — Écrire la migration**

```sql
-- 078_v07_phase5_schema.sql
-- WHY : Phase 5 (La Cour). Tables d'investissement diplomatique et colonnes
-- d'état "veilleur par influence" sur place_veille. Pas encore de RPCs métier
-- (mig 079). Pas de seed : les scores partent de zéro pour tout le monde.

BEGIN;

-- ============================================================
-- TABLE place_court_action — journal append-only des investissements
-- ============================================================
-- Une ligne par action invest_crowns. Sert au leaderboard mécènes (cumulatif
-- à vie) et à la chronique du lieu (10 dernières actions).

CREATE TABLE IF NOT EXISTS public.place_court_action (
  id              bigserial PRIMARY KEY,
  place_id        text NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id         text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expedition_id   uuid NOT NULL REFERENCES public.expeditions(id) ON DELETE CASCADE,
  side            text NOT NULL CHECK (side IN ('defense', 'attack')),
  amount          integer NOT NULL CHECK (amount > 0),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Pour leaderboard mécènes par lieu (top patrons) ET par user (titres mécénat).
CREATE INDEX IF NOT EXISTS place_court_action_place_user_idx
  ON public.place_court_action (place_id, user_id);

-- Pour chronique (10 dernières actions du lieu).
CREATE INDEX IF NOT EXISTS place_court_action_place_created_idx
  ON public.place_court_action (place_id, created_at DESC);

-- Pour calcul total Couronnes investies par user (titres Bourse Légère etc).
CREATE INDEX IF NOT EXISTS place_court_action_user_idx
  ON public.place_court_action (user_id);

-- ============================================================
-- TABLE place_court_score — agrégation incrémentale par (lieu, expé)
-- ============================================================
-- Évite de recalculer SUM(amount) à chaque lecture. Mise à jour incrémentale
-- dans invest_crowns. Reset (DELETE) au plantage GPS d'une autre expé.

CREATE TABLE IF NOT EXISTS public.place_court_score (
  place_id        text NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  expedition_id   uuid NOT NULL REFERENCES public.expeditions(id) ON DELETE CASCADE,
  score           integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  last_action_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, expedition_id)
);

-- Pour query "menace haute sur un lieu donné" et "lieux où une expé attaque".
CREATE INDEX IF NOT EXISTS place_court_score_place_score_idx
  ON public.place_court_score (place_id, score DESC);

-- ============================================================
-- COLONNES place_veille — état "veilleur par influence"
-- ============================================================
-- by_influence : true si l'expé tient le lieu sans qu'aucun membre n'y soit
--                allé IRL depuis la bascule. Tant que ce flag est true, l'ancien
--                veilleur (= previous_expedition_id) peut reprendre le lieu
--                gratuitement par GPS.
-- previous_expedition_id : pointe vers l'expé qui détenait place_veille AVANT
--                         la bascule. Utilisé pour identifier qui peut "reset
--                         GPS gratuit". Reset à NULL dès qu'un membre de la
--                         nouvelle expé plante IRL (consolidation).

ALTER TABLE public.place_veille
  ADD COLUMN IF NOT EXISTS by_influence boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS previous_expedition_id uuid REFERENCES public.expeditions(id) ON DELETE SET NULL;

-- ============================================================
-- GRANTS
-- ============================================================

GRANT SELECT ON public.place_court_action TO authenticated, anon, service_role;
GRANT SELECT ON public.place_court_score  TO authenticated, anon, service_role;

COMMIT;
```

- [ ] **Step 2 — Appliquer**

```bash
pnpm dlx supabase db push
```

- [ ] **Step 3 — Vérifier**

```sql
-- Tables créées ?
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'place_court_%';
-- Expected: place_court_action, place_court_score

-- Colonnes ajoutées ?
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'place_veille'
  AND column_name IN ('by_influence', 'previous_expedition_id');
-- Expected: 2 rows

-- Indexes créés ?
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename LIKE 'place_court_%';
-- Expected: place_court_action_place_user_idx, place_court_action_place_created_idx,
--           place_court_action_user_idx, place_court_score_place_score_idx, et les PK
```

- [ ] **Step 4 — Commit**

```bash
git add supabase/migrations/078_v07_phase5_schema.sql
git commit -m "feat(db): phase 5 schema - place_court_action/score + by_influence (mig 078)"
```

---

## Task 3 — Migration 079 : RPCs invest_crowns + get_place_court_state

**Files:**
- Create: `supabase/migrations/079_v07_phase5_rpcs_court.sql`

Les deux RPCs principales de La Cour. Code complet ci-dessous.

- [ ] **Step 1 — Écrire la migration**

```sql
-- 079_v07_phase5_rpcs_court.sql
-- WHY : Phase 5 (La Cour). Deux RPCs métier :
--   - invest_crowns : action d'investissement (défense ou attaque), bascule
--     atomique, log activity_log avec cap 1×/jour pour place_court_attack.
--   - get_place_court_state : retour unifié pour la fiche lieu (veilleur,
--     score, top mécènes, chronique, statut, contexte caller).
-- Faveur 50 du veilleur : implicite, jamais stockée. Calculée à la volée.

BEGIN;

-- ============================================================
-- RPC invest_crowns
-- ============================================================
-- Args :
--   p_user_id : user investisseur
--   p_place_id : lieu cible
--   p_target_expedition_id : expé qui reçoit l'investissement (défense ou attaque)
--   p_amount : montant en Couronnes (>0)
--
-- Logique :
--   1. Auth check : p_user_id = auth.uid()
--   2. Lieu veillé ? Sinon error not_veilled
--   3. Balance >= amount ? Sinon error insufficient_crowns
--   4. side = 'defense' si target_expedition = veilleur actuel, sinon 'attack'
--   5. Pour 'attack' : user doit être membre de target_expedition. Sinon not_member.
--                       target_expedition doit être ≠ veilleur actuel. Sinon cannot_attack_self.
--   6. Pour 'defense' : tout user peut investir (mécénat libre).
--   7. Débit balance, insert action, upsert score.
--   8. Si attack : score atteint le score veilleur ? Bascule.
--   9. Notifications activity_log selon contexte.
--
-- Retour : JSON { success, side, newScore, balance, basculed, basculedExpeditionId? }

CREATE OR REPLACE FUNCTION public.invest_crowns(
  p_user_id              text,
  p_place_id             text,
  p_target_expedition_id uuid,
  p_amount               integer
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_now              timestamptz := now();
  v_today_date       date := current_date;
  v_veilleur_exp     uuid;
  v_was_by_influence boolean;
  v_prev_exp         uuid;
  v_is_member_target boolean;
  v_balance          integer;
  v_side             text;
  v_veilleur_score   integer;  -- 50 + sum defense
  v_new_target_score integer;
  v_basculed         boolean := false;
  v_place_title      text;
  v_user_name        text;
  v_actor_name       text;
  v_threshold_50pct  integer;
  v_target_exp_name  text;
  v_old_exp_id       uuid;
BEGIN
  -- Auth
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('error', 'invalid_amount');
  END IF;

  -- Lieu veillé ?
  SELECT pv.expedition_id, pv.by_influence, pv.previous_expedition_id
  INTO v_veilleur_exp, v_was_by_influence, v_prev_exp
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  IF v_veilleur_exp IS NULL THEN
    RETURN json_build_object('error', 'not_veilled');
  END IF;

  -- target_expedition existe ?
  IF NOT EXISTS (SELECT 1 FROM public.expeditions WHERE id = p_target_expedition_id) THEN
    RETURN json_build_object('error', 'expedition_not_found');
  END IF;

  -- Balance suffisante ?
  SELECT COALESCE(balance, 0) INTO v_balance FROM public.user_crowns WHERE user_id = p_user_id;
  v_balance := COALESCE(v_balance, 0);

  IF v_balance < p_amount THEN
    RETURN json_build_object('error', 'insufficient_crowns', 'balance', v_balance);
  END IF;

  -- Détermination side
  IF p_target_expedition_id = v_veilleur_exp THEN
    v_side := 'defense';
  ELSE
    v_side := 'attack';
    -- Pour attaque : user doit être membre de target_expedition
    SELECT EXISTS (
      SELECT 1 FROM public.expedition_members em
      WHERE em.expedition_id = p_target_expedition_id AND em.user_id = p_user_id
    ) INTO v_is_member_target;

    IF NOT v_is_member_target THEN
      RETURN json_build_object('error', 'not_member');
    END IF;
  END IF;

  -- ============================================================
  -- TRANSACTION : débit balance, insert action, upsert score
  -- ============================================================

  UPDATE public.user_crowns
  SET balance = balance - p_amount,
      updated_at = v_now
  WHERE user_id = p_user_id;

  INSERT INTO public.place_court_action (place_id, user_id, expedition_id, side, amount)
  VALUES (p_place_id, p_user_id, p_target_expedition_id, v_side, p_amount);

  INSERT INTO public.place_court_score (place_id, expedition_id, score, last_action_at)
  VALUES (p_place_id, p_target_expedition_id, p_amount, v_now)
  ON CONFLICT (place_id, expedition_id) DO UPDATE SET
    score          = place_court_score.score + EXCLUDED.score,
    last_action_at = EXCLUDED.last_action_at
  RETURNING score INTO v_new_target_score;

  -- ============================================================
  -- BASCULE check (uniquement si attack)
  -- ============================================================

  IF v_side = 'attack' THEN
    -- Score veilleur = 50 + sum defense de l'expé veilleuse
    SELECT COALESCE(score, 0) INTO v_veilleur_score
    FROM public.place_court_score
    WHERE place_id = p_place_id AND expedition_id = v_veilleur_exp;
    v_veilleur_score := 50 + COALESCE(v_veilleur_score, 0);

    IF v_new_target_score > v_veilleur_score THEN
      -- BASCULE
      v_old_exp_id := v_veilleur_exp;

      -- Reset tous les scores (le nouveau veilleur démarre avec faveur 50 implicite)
      DELETE FROM public.place_court_score WHERE place_id = p_place_id;

      -- Update place_veille
      UPDATE public.place_veille
      SET expedition_id = p_target_expedition_id,
          by_influence  = true,
          previous_expedition_id = COALESCE(v_prev_exp, v_old_exp_id),
          planted_at    = v_now
      WHERE place_id = p_place_id;

      v_basculed := true;
    END IF;
  END IF;

  -- ============================================================
  -- NOTIFICATIONS
  -- ============================================================

  SELECT title INTO v_place_title FROM public.places WHERE id = p_place_id;
  SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
  FROM public.users WHERE id = p_user_id;

  IF v_basculed THEN
    -- Notif aux membres de l'ancienne expé veilleuse
    INSERT INTO public.activity_log (type, actor_id, place_id, data)
    VALUES ('place_taken_remote', p_user_id, p_place_id, jsonb_build_object(
      'placeTitle',     v_place_title,
      'actorName',      v_actor_name,
      'oldExpeditionId', v_old_exp_id,
      'newExpeditionId', p_target_expedition_id
    ));

    -- Notif aux membres de la nouvelle expé veilleuse
    INSERT INTO public.activity_log (type, actor_id, place_id, data)
    VALUES ('place_taken_remote_self', p_user_id, p_place_id, jsonb_build_object(
      'placeTitle',     v_place_title,
      'expeditionId',   p_target_expedition_id
    ));
  ELSIF v_side = 'attack' THEN
    -- Cap 1×/jour : ne logger place_court_attack que si pas déjà loggé
    -- aujourd'hui pour cette tuple (place, expedition_attaquante).
    IF NOT EXISTS (
      SELECT 1 FROM public.activity_log
      WHERE type = 'place_court_attack'
        AND place_id = p_place_id
        AND (data->>'expeditionId')::uuid = p_target_expedition_id
        AND created_at::date = v_today_date
    ) THEN
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_court_attack', p_user_id, p_place_id, jsonb_build_object(
        'placeTitle',   v_place_title,
        'actorName',    v_actor_name,
        'expeditionId', p_target_expedition_id
      ));
    END IF;

    -- High threat : si menace franchit 50% du score veilleur
    v_threshold_50pct := v_veilleur_score / 2;
    IF v_new_target_score >= v_threshold_50pct
       AND (v_new_target_score - p_amount) < v_threshold_50pct
    THEN
      INSERT INTO public.activity_log (type, actor_id, place_id, data)
      VALUES ('place_court_high_threat', p_user_id, p_place_id, jsonb_build_object(
        'placeTitle',   v_place_title,
        'expeditionId', p_target_expedition_id,
        'score',        v_new_target_score
      ));
    END IF;
  END IF;

  -- ============================================================
  -- TITRE Mécène Principal — émission de notif si changement
  -- ============================================================
  -- On regarde si l'investissement de ce user le fait passer #1 du leaderboard
  -- mécènes du lieu, et si oui notifier (lui + ancien #1 si déchu).

  WITH totals AS (
    SELECT user_id, SUM(amount) AS total
    FROM public.place_court_action
    WHERE place_id = p_place_id
    GROUP BY user_id
  ),
  ranked AS (
    SELECT user_id, total, ROW_NUMBER() OVER (ORDER BY total DESC, user_id) AS rk
    FROM totals
  )
  -- Si le user est désormais #1 ET il y avait un #1 différent avant
  -- (= avant cet investissement), on log les notifs.
  -- Implémentation simple : on log à chaque investissement où user devient #1
  -- et où le précédent #1 était différent. Pas de tracking d'état précédent ;
  -- on utilise l'invariant "si avant cet ajout total user < N, après >= N".
  -- Pour V1, cap court : on accepte un comportement "best-effort" — possible
  -- de logger plusieurs fois le même titre. À améliorer si abus visible.
  -- → Notif uniquement si on devient #1 strict (user_id top du SELECT).
  INSERT INTO public.activity_log (type, actor_id, place_id, data)
  SELECT 'mecene_principal_gained', p_user_id, p_place_id,
         jsonb_build_object('placeTitle', v_place_title, 'total', r.total)
  FROM ranked r
  WHERE r.user_id = p_user_id AND r.rk = 1
    AND NOT EXISTS (
      -- Skip si déjà notifié dans la dernière heure (évite spam si oscille)
      SELECT 1 FROM public.activity_log al
      WHERE al.type = 'mecene_principal_gained'
        AND al.actor_id = p_user_id
        AND al.place_id = p_place_id
        AND al.created_at > v_now - interval '1 hour'
    );

  -- Note : `mecene_principal_lost` est plus complexe à émettre proprement
  -- depuis cette RPC (il faudrait connaître l'ancien #1). Décision V1 :
  -- on ne le calcule pas ici, on le dérive côté frontend via diff entre
  -- snapshots successifs de top patrons (à voir si utile, sinon drop).

  RETURN json_build_object(
    'success',                true,
    'side',                   v_side,
    'newScore',               v_new_target_score,
    'balance',                v_balance - p_amount,
    'basculed',               v_basculed,
    'basculedExpeditionId',   CASE WHEN v_basculed THEN p_target_expedition_id ELSE NULL END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.invest_crowns(text, text, uuid, integer)
  TO authenticated, service_role;

-- ============================================================
-- RPC get_place_court_state
-- ============================================================
-- Args :
--   p_place_id : lieu
--   p_user_id  : caller (pour contexte)
-- Retour : JSON
--   {
--     veilleur: { expeditionId, name, members[], byInfluence, planted_at },
--     scoreVeilleur: int (50 + defense),
--     threats: [{ expeditionId, name, score }] (max 5, score>0, ordre desc),
--     menaceHaute: int (= max threats.score, vue par veilleur, sinon null),
--     scoreToBeat: int (vue par challenger : v_veilleur_score, sinon null),
--     topPatrons: [{ userId, displayName, total }] (top 5 cumulatif),
--     chronicle: [{ ts, actorName, expeditionName, side, amount }] (10 dernières),
--     status: 'paisible' | 'convoite' | 'sous_pression' | 'en_siege',
--     callerContext: {
--       balance: int,
--       isMemberOfVeilleur: bool,
--       challengerExpeditions: [uuid] (expés où le caller est membre actif comme challenger),
--       userTotalOnPlace: int (cumulatif)
--     }
--   }

CREATE OR REPLACE FUNCTION public.get_place_court_state(
  p_place_id text,
  p_user_id  text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  v_veilleur_exp     uuid;
  v_by_influence     boolean;
  v_planted_at       timestamptz;
  v_score_defense    integer;
  v_score_veilleur   integer;
  v_menace_haute     integer;
  v_status           text;
  v_is_member_v      boolean;
  v_balance          integer;
  v_user_total       integer;
  v_veilleur_obj     jsonb;
  v_threats          jsonb;
  v_top_patrons      jsonb;
  v_chronicle        jsonb;
  v_challenger_exps  jsonb;
BEGIN
  -- Veilleur info
  SELECT pv.expedition_id, pv.by_influence, pv.planted_at
  INTO v_veilleur_exp, v_by_influence, v_planted_at
  FROM public.place_veille pv
  WHERE pv.place_id = p_place_id;

  IF v_veilleur_exp IS NULL THEN
    RETURN json_build_object('error', 'not_veilled');
  END IF;

  -- Score veilleur = 50 + defense
  SELECT COALESCE(score, 0) INTO v_score_defense
  FROM public.place_court_score
  WHERE place_id = p_place_id AND expedition_id = v_veilleur_exp;
  v_score_veilleur := 50 + COALESCE(v_score_defense, 0);

  -- Menace haute (max score parmi expés challengers)
  SELECT MAX(score) INTO v_menace_haute
  FROM public.place_court_score
  WHERE place_id = p_place_id AND expedition_id != v_veilleur_exp;
  v_menace_haute := COALESCE(v_menace_haute, 0);

  -- Statut
  IF v_menace_haute = 0 OR v_menace_haute < (v_score_veilleur * 10 / 100) THEN
    v_status := 'paisible';
  ELSIF v_menace_haute < (v_score_veilleur * 50 / 100) THEN
    v_status := 'convoite';
  ELSIF v_menace_haute < (v_score_veilleur * 80 / 100) THEN
    v_status := 'sous_pression';
  ELSE
    v_status := 'en_siege';
  END IF;

  -- Veilleur object (avec membres)
  SELECT jsonb_build_object(
    'expeditionId', e.id,
    'name',         COALESCE(e.faction_id, 'Expédition'),  -- TODO : col `name` à ajouter à expeditions, sinon faction
    'planted_at',   v_planted_at,
    'byInfluence',  v_by_influence,
    'members', (
      SELECT jsonb_agg(jsonb_build_object(
        'userId',      em.user_id,
        'displayName', COALESCE(u.display_name, u.first_name, u.id)
      ))
      FROM public.expedition_members em
      JOIN public.users u ON u.id = em.user_id
      WHERE em.expedition_id = e.id
    )
  ) INTO v_veilleur_obj
  FROM public.expeditions e
  WHERE e.id = v_veilleur_exp;

  -- Threats (top 5 challengers, score>0)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'expeditionId', pcs.expedition_id,
    'name',         COALESCE(e.faction_id, 'Expédition'),
    'score',        pcs.score
  ) ORDER BY pcs.score DESC), '[]'::jsonb)
  INTO v_threats
  FROM public.place_court_score pcs
  JOIN public.expeditions e ON e.id = pcs.expedition_id
  WHERE pcs.place_id = p_place_id
    AND pcs.expedition_id != v_veilleur_exp
    AND pcs.score > 0
  LIMIT 5;

  -- Top mécènes (cumulatif à vie sur ce lieu)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'userId',      t.user_id,
    'displayName', COALESCE(u.display_name, u.first_name, u.id),
    'total',       t.total
  ) ORDER BY t.total DESC), '[]'::jsonb)
  INTO v_top_patrons
  FROM (
    SELECT user_id, SUM(amount)::integer AS total
    FROM public.place_court_action
    WHERE place_id = p_place_id
    GROUP BY user_id
    ORDER BY total DESC
    LIMIT 5
  ) t
  JOIN public.users u ON u.id = t.user_id;

  -- Chronique (10 dernières actions)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'ts',             c.created_at,
    'actorName',      COALESCE(u.display_name, u.first_name, u.id),
    'expeditionName', COALESCE(e.faction_id, 'Expédition'),
    'side',           c.side,
    'amount',         c.amount
  ) ORDER BY c.created_at DESC), '[]'::jsonb)
  INTO v_chronicle
  FROM (
    SELECT pca.* FROM public.place_court_action pca
    WHERE pca.place_id = p_place_id
    ORDER BY pca.created_at DESC
    LIMIT 10
  ) c
  JOIN public.users u ON u.id = c.user_id
  JOIN public.expeditions e ON e.id = c.expedition_id;

  -- Caller context
  IF p_user_id IS NULL THEN
    RETURN json_build_object(
      'veilleur',       v_veilleur_obj,
      'scoreVeilleur',  v_score_veilleur,
      'threats',        v_threats,
      'menaceHaute',    v_menace_haute,
      'topPatrons',     v_top_patrons,
      'chronicle',      v_chronicle,
      'status',         v_status
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.expedition_members em
    WHERE em.expedition_id = v_veilleur_exp AND em.user_id = p_user_id
  ) INTO v_is_member_v;

  SELECT COALESCE(balance, 0) INTO v_balance
  FROM public.user_crowns WHERE user_id = p_user_id;
  v_balance := COALESCE(v_balance, 0);

  SELECT COALESCE(SUM(amount), 0)::integer INTO v_user_total
  FROM public.place_court_action
  WHERE place_id = p_place_id AND user_id = p_user_id;

  -- Expéditions challengers où le caller est membre (pour bouton "Investir pour [expé]")
  SELECT COALESCE(jsonb_agg(em.expedition_id), '[]'::jsonb)
  INTO v_challenger_exps
  FROM public.expedition_members em
  JOIN public.expeditions e ON e.id = em.expedition_id
  WHERE em.user_id = p_user_id
    AND em.expedition_id != v_veilleur_exp
    AND e.place_id = p_place_id;

  RETURN json_build_object(
    'veilleur',       v_veilleur_obj,
    'scoreVeilleur',  v_score_veilleur,
    'threats',        v_threats,
    'menaceHaute',    CASE WHEN v_is_member_v THEN v_menace_haute ELSE NULL END,
    'scoreToBeat',    CASE WHEN NOT v_is_member_v THEN v_score_veilleur ELSE NULL END,
    'topPatrons',     v_top_patrons,
    'chronicle',      v_chronicle,
    'status',         v_status,
    'callerContext',  jsonb_build_object(
      'balance',                v_balance,
      'isMemberOfVeilleur',     v_is_member_v,
      'challengerExpeditions',  v_challenger_exps,
      'userTotalOnPlace',       v_user_total
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_place_court_state(text, text)
  TO authenticated, anon, service_role;

COMMIT;
```

**Note** : la table `expeditions` n'a pas de colonne `name` aujourd'hui (cf. mig 015). On utilise `faction_id` comme nom temporaire. Si Uriel valide, ajouter une colonne `name` plus tard ; pour V1, lisible.

- [ ] **Step 2 — Appliquer**

```bash
pnpm dlx supabase db push
```

- [ ] **Step 3 — Test fonctionnel**

```sql
-- Créer un test : trouver un lieu veillé
SELECT place_id, expedition_id FROM public.place_veille LIMIT 1;
-- Note : récupérer un place_id et une expé veilleuse pour les tests suivants.

-- Tester get_place_court_state sur ce lieu (caller anonyme)
SELECT public.get_place_court_state('<place_id>', NULL);
-- Expected : JSON avec scoreVeilleur=50, threats=[], status='paisible'

-- Tester invest_crowns avec un utilisateur de test ayant des Couronnes
-- (à exécuter via le frontend dev, pas en SQL direct car SECURITY DEFINER vérifie auth.uid)
```

- [ ] **Step 4 — Commit**

```bash
git add supabase/migrations/079_v07_phase5_rpcs_court.sql
git commit -m "feat(db): RPCs invest_crowns + get_place_court_state (mig 079)"
```

---

## Task 4 — Migration 080 : Énigmes → Couronnes

**Files:**
- Create: `supabase/migrations/080_v07_enigma_crowns.sql`

Réécriture verbatim de `_answer_enigma_internal` (mig 069) et `_answer_fragment_enigma_internal` (mig 070), en :
- retirant la mise à jour `users.influence_stock` (déjà droppée par mig 077, donc obligatoire)
- retirant le retour `newInfluenceStock` du JSON
- ajoutant le crédit Couronnes selon difficulté (1/1/2/3)
- ajoutant `crownsGain` et `newCrownsBalance` au retour JSON

- [ ] **Step 1 — Cat les versions courantes**

```bash
cat supabase/migrations/069_v07_fix_enigma_toast_log.sql
cat supabase/migrations/070_v07_fragment_enigma_toast_meta.sql
```

Identifier précisément les blocs à retirer (`influence_stock = ...`, `newInfluenceStock`, `v_new_influence_stock`).

- [ ] **Step 2 — Écrire la migration**

```sql
-- 080_v07_enigma_crowns.sql
-- WHY : Phase 5 — les énigmes rapportent des Couronnes (1/1/2/3 selon difficulté
-- very_easy/easy/medium/hard, miroir Gloire/Coupe). Cap silencieux : si stock plein
-- (500), gain=0 sans erreur. Aussi : retrait de la mise à jour influence_stock
-- (colonne droppée par mig 077).
--
-- Reécriture verbatim mig 069 (_answer_enigma_internal) et mig 070
-- (_answer_fragment_enigma_internal), avec :
--   - DROP des lignes influence_stock
--   - ADD des lignes Couronnes
--   - JSON return : remplace newInfluenceStock par crownsGain/newCrownsBalance

BEGIN;

-- ============================================================
-- _answer_enigma_internal — verbatim mig 069 + Couronnes
-- ============================================================

CREATE OR REPLACE FUNCTION public._answer_enigma_internal(
  p_user_id text, p_enigma_id integer, p_answer text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_enigma RECORD;
  v_correct BOOLEAN;
  v_influence_gain INT := 0;  -- conservé pour compat enigma_responses, plus appliqué à users
  v_erudition_gain INT := 0;
  v_diff_key TEXT;
  v_actor_name TEXT;
  v_crowns_gain INT := 0;
  v_new_crowns_balance INT;
BEGIN
  SELECT * INTO v_enigma FROM enigmas WHERE id = p_enigma_id;
  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'enigma_not_found');
  END IF;

  v_correct := public._enigma_answer_matches(p_answer, v_enigma.answer);
  v_diff_key := v_enigma.difficulty;

  -- Calcul gains (logique mig 069 conservée)
  IF v_enigma.type = 'daily' THEN
    IF v_correct THEN
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_influence_' || v_diff_key), 3) INTO v_influence_gain;
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_erudition_' || v_diff_key), 1) INTO v_erudition_gain;
    ELSE
      SELECT COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_erudition_wrong'), 1) INTO v_erudition_gain;
    END IF;
  ELSIF v_enigma.type = 'place' THEN
    IF v_correct THEN
      v_influence_gain := COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_influence_base'), 2)
        + COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_influence_per_diff'), 1)
          * (CASE v_enigma.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 END);
      v_erudition_gain := COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_erudition_base'), 2)
        + COALESCE((SELECT value::INT FROM app_settings WHERE key = 'enigma_place_erudition_per_diff'), 1)
          * (CASE v_enigma.difficulty WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 END);
    ELSE
      v_erudition_gain := 1;
    END IF;
  END IF;

  -- Couronnes : 1/1/2/3 si correct, 0 sinon. Cap silencieux 500.
  IF v_correct THEN
    v_crowns_gain := CASE v_diff_key
      WHEN 'very_easy' THEN 1
      WHEN 'easy'      THEN 1
      WHEN 'medium'    THEN 2
      WHEN 'hard'      THEN 3
      ELSE 1
    END;
  END IF;

  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained)
  VALUES (p_enigma_id, p_user_id, p_answer, v_correct, v_influence_gain, v_erudition_gain);

  -- Update users : SEULEMENT erudition_points (influence_stock droppé mig 077)
  UPDATE users SET
    erudition_points = erudition_points + v_erudition_gain
  WHERE id = p_user_id;

  -- Update Couronnes : upsert avec cap silencieux 500
  IF v_crowns_gain > 0 THEN
    INSERT INTO public.user_crowns (user_id, balance, updated_at)
    VALUES (p_user_id, LEAST(500, v_crowns_gain), now())
    ON CONFLICT (user_id) DO UPDATE SET
      balance    = LEAST(500, public.user_crowns.balance + v_crowns_gain),
      updated_at = now()
    RETURNING balance INTO v_new_crowns_balance;
  ELSE
    SELECT COALESCE(balance, 0) INTO v_new_crowns_balance
    FROM public.user_crowns WHERE user_id = p_user_id;
    v_new_crowns_balance := COALESCE(v_new_crowns_balance, 0);
  END IF;

  -- Toast enigma_success (verbatim mig 069)
  IF v_correct THEN
    SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
    FROM users WHERE id = p_user_id;

    INSERT INTO activity_log (type, actor_id, data)
    VALUES ('enigma_success', p_user_id,
      jsonb_build_object(
        'actorName',     v_actor_name,
        'enigmaType',    v_enigma.type,
        'difficulty',    v_enigma.difficulty,
        'influenceGain', v_influence_gain,
        'eruditionGain', v_erudition_gain,
        'crownsGain',    v_crowns_gain
      ));
  END IF;

  RETURN json_build_object(
    'correct',           v_correct,
    'answer',            v_enigma.answer,
    'explanation',       v_enigma.explanation,
    'influenceGain',     v_influence_gain,
    'eruditionGain',     v_erudition_gain,
    'crownsGain',        v_crowns_gain,
    'newCrownsBalance',  v_new_crowns_balance,
    'newErudition',      (SELECT erudition_points FROM users WHERE id = p_user_id),
    'newGlory',          (SELECT exploration_points + erudition_points FROM users WHERE id = p_user_id)
  );
END;
$$;

ALTER FUNCTION public._answer_enigma_internal(text, integer, text) OWNER TO postgres;

-- ============================================================
-- _answer_fragment_enigma_internal — verbatim mig 070 + Couronnes
-- ============================================================

CREATE OR REPLACE FUNCTION public._answer_fragment_enigma_internal(
  p_user_id text, p_enigma_id integer, p_answer text, p_fragment_id integer
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_enigma RECORD;
  v_correct BOOLEAN;
  v_influence_gain INT := 0;
  v_erudition_gain INT := 0;
  v_diff_key TEXT;
  v_actor_name TEXT;
  v_crowns_gain INT := 0;
  v_new_crowns_balance INT;
BEGIN
  SELECT * INTO v_enigma FROM enigmas WHERE id = p_enigma_id;
  IF v_enigma.id IS NULL THEN
    RETURN json_build_object('error', 'enigma_not_found');
  END IF;

  IF NOT EXISTS(SELECT 1 FROM user_fragments WHERE user_id = p_user_id AND fragment_id = p_fragment_id) THEN
    RETURN json_build_object('error', 'fragment_not_owned');
  END IF;

  v_correct := public._enigma_answer_matches(p_answer, v_enigma.answer);
  v_diff_key := v_enigma.difficulty;

  IF v_correct THEN
    SELECT COALESCE(
      (SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_influence_' || v_diff_key),
      COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_influence'), 5)
    ) INTO v_influence_gain;
    SELECT COALESCE(
      (SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_erudition_' || v_diff_key),
      COALESCE((SELECT value::INT FROM app_settings WHERE key = 'fragment_enigma_erudition'), 2)
    ) INTO v_erudition_gain;
  ELSE
    v_erudition_gain := 1;
  END IF;

  -- Couronnes : 1/1/2/3 si correct, 0 sinon. Cap silencieux 500.
  IF v_correct THEN
    v_crowns_gain := CASE v_diff_key
      WHEN 'very_easy' THEN 1
      WHEN 'easy'      THEN 1
      WHEN 'medium'    THEN 2
      WHEN 'hard'      THEN 3
      ELSE 1
    END;
  END IF;

  INSERT INTO enigma_responses (enigma_id, user_id, answer_given, correct, influence_gained, erudition_gained)
  VALUES (p_enigma_id, p_user_id, p_answer, v_correct, v_influence_gain, v_erudition_gain);

  -- Update users : SEULEMENT erudition_points
  UPDATE users SET
    erudition_points = erudition_points + v_erudition_gain
  WHERE id = p_user_id;

  -- Update Couronnes
  IF v_crowns_gain > 0 THEN
    INSERT INTO public.user_crowns (user_id, balance, updated_at)
    VALUES (p_user_id, LEAST(500, v_crowns_gain), now())
    ON CONFLICT (user_id) DO UPDATE SET
      balance    = LEAST(500, public.user_crowns.balance + v_crowns_gain),
      updated_at = now()
    RETURNING balance INTO v_new_crowns_balance;
  ELSE
    SELECT COALESCE(balance, 0) INTO v_new_crowns_balance
    FROM public.user_crowns WHERE user_id = p_user_id;
    v_new_crowns_balance := COALESCE(v_new_crowns_balance, 0);
  END IF;

  -- Tracking interne fragment_enigma (verbatim mig 070)
  INSERT INTO activity_log (type, actor_id, data)
  VALUES ('fragment_enigma', p_user_id, jsonb_build_object(
    'fragmentId',    p_fragment_id,
    'enigmaId',      p_enigma_id,
    'correct',       v_correct,
    'influenceGain', v_influence_gain,
    'eruditionGain', v_erudition_gain,
    'crownsGain',    v_crowns_gain
  ));

  -- Toast enigma_success (verbatim mig 070)
  IF v_correct THEN
    SELECT COALESCE(display_name, first_name, 'Quelqu''un') INTO v_actor_name
    FROM users WHERE id = p_user_id;

    INSERT INTO activity_log (type, actor_id, data)
    VALUES ('enigma_success', p_user_id,
      jsonb_build_object(
        'actorName',     v_actor_name,
        'enigmaType',    'fragment',
        'difficulty',    v_enigma.difficulty,
        'influenceGain', v_influence_gain,
        'eruditionGain', v_erudition_gain,
        'crownsGain',    v_crowns_gain
      ));
  END IF;

  RETURN json_build_object(
    'correct',           v_correct,
    'answer',            v_enigma.answer,
    'explanation',       v_enigma.explanation,
    'influenceGain',     v_influence_gain,
    'eruditionGain',     v_erudition_gain,
    'crownsGain',        v_crowns_gain,
    'newCrownsBalance',  v_new_crowns_balance,
    'newErudition',      (SELECT erudition_points FROM users WHERE id = p_user_id)
  );
END;
$$;

ALTER FUNCTION public._answer_fragment_enigma_internal(text, integer, text, integer) OWNER TO postgres;

COMMIT;
```

- [ ] **Step 3 — Appliquer**

```bash
pnpm dlx supabase db push
```

- [ ] **Step 4 — Vérifier**

```sql
-- Tester énigme via frontend (DailyEnigma) ou simuler via SQL :
SELECT public._answer_enigma_internal('<user_id>', <enigma_id>, '<reponse_correcte>');
-- Expected : JSON avec crownsGain ∈ {1,2,3}, newCrownsBalance incrémentée, pas d'erreur

-- Vérifier que user_crowns a bien été crédité
SELECT balance FROM public.user_crowns WHERE user_id = '<user_id>';
```

- [ ] **Step 5 — Commit**

```bash
git add supabase/migrations/080_v07_enigma_crowns.sql
git commit -m "feat(db): énigmes rapportent des Couronnes 1/1/2/3 (mig 080)"
```

---

## Task 5 — Migration 081 : `plant_flag` (reset court_score + by_influence)

**Files:**
- Create: `supabase/migrations/081_v07_plant_flag_court_reset.sql`

Modifie `plant_flag` (dernière version : mig 067, ligne 958) pour :
1. À chaque plantage, **DELETE des scores challengers** sur ce lieu (la faveur 50 du veilleur reste implicite ; la défense de l'expé veilleuse cumulée précédemment est conservée si l'expé ne change pas — non : on reset tout pour simplifier, le veilleur reprendra à 50 fraîches).
2. Si plantage par un membre de **`previous_expedition_id`** (= ancien veilleur déchu pendant état by_influence), reprendre gratuit : `expedition_id ← previous_expedition_id`, `by_influence ← false`, `previous_expedition_id ← NULL`.
3. Si plantage par un membre de l'expé "par influence" actuelle : confirmer le statut, `by_influence ← false`, `previous_expedition_id ← NULL`.
4. Sinon : comportement standard (nouveau veilleur, reset by_influence).

- [ ] **Step 1 — Cat la version courante**

```bash
sed -n '950,1100p' supabase/migrations/067_v07_unified_glory_barem.sql
```

(Remplacer 1100 par la fin réelle de la fonction `plant_flag` — repérée par le `$$;` final.)

Copier-coller le corps complet de `plant_flag` dans une note tampon.

- [ ] **Step 2 — Écrire la migration**

Le fichier `081_v07_plant_flag_court_reset.sql` doit contenir une `CREATE OR REPLACE FUNCTION public.plant_flag(...)` qui reprend VERBATIM le corps de la mig 067 (même DECLARE, même check d'auth, même logique de proximité GPS), avec **insertion de la logique de reset court_score juste avant ou juste après le `INSERT INTO place_veille`** (selon le placement actuel de l'update). Voir mig 067 pour identifier le point d'insertion exact.

Pseudo-code à intégrer (à adapter à la structure réelle de la mig 067) :

```sql
-- ============================================================
-- AJOUT V0.7 phase 5 : reset court_score + handle by_influence
-- ============================================================

-- Récupérer l'état précédent (avant écriture) pour décider
SELECT pv.expedition_id, pv.by_influence, pv.previous_expedition_id
INTO v_prev_veilleur, v_prev_by_influence, v_prev_previous
FROM public.place_veille pv
WHERE pv.place_id = p_place_id;

-- Cas A : reprise gratuite par ancien veilleur déchu (priorité haute)
IF v_prev_by_influence = true AND v_prev_previous IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM public.expedition_members em
     WHERE em.expedition_id = v_prev_previous AND em.user_id = p_user_id
   )
THEN
  UPDATE public.place_veille
  SET expedition_id = v_prev_previous,
      by_influence = false,
      previous_expedition_id = NULL,
      planted_at = now()
  WHERE place_id = p_place_id;

  DELETE FROM public.place_court_score WHERE place_id = p_place_id;

  -- Notif expé déchue
  INSERT INTO public.activity_log (type, actor_id, place_id, data)
  VALUES ('place_taken_back_gps', p_user_id, p_place_id, jsonb_build_object(
    'placeTitle',     (SELECT title FROM places WHERE id = p_place_id),
    'expeditionId',   v_prev_veilleur  -- l'expé qui détenait par influence et qui perd
  ));

  -- Skip le reste (pas de création d'expé / membership)
  RETURN json_build_object(
    'success',        true,
    'mode',           'reclaim_gps',
    'expeditionId',   v_prev_previous
  );
END IF;

-- Cas B : confirmation IRL par membre de l'expé actuelle "par influence"
IF v_prev_by_influence = true AND v_prev_veilleur IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM public.expedition_members em
     WHERE em.expedition_id = v_prev_veilleur AND em.user_id = p_user_id
   )
THEN
  UPDATE public.place_veille
  SET by_influence = false,
      previous_expedition_id = NULL,
      planted_at = now()
  WHERE place_id = p_place_id;

  DELETE FROM public.place_court_score WHERE place_id = p_place_id;

  RETURN json_build_object(
    'success',        true,
    'mode',           'confirm_gps',
    'expeditionId',   v_prev_veilleur
  );
END IF;

-- Cas C : plantage standard (nouveau plantage ou plantage par l'expé veilleuse plein)
-- → comportement existant de plant_flag (mig 067), avec en plus :
DELETE FROM public.place_court_score WHERE place_id = p_place_id;
-- (Le INSERT/UPDATE de place_veille existant doit aussi clear by_influence + previous_expedition_id si l'expé veilleuse change.)
```

**Note d'intégration** : la mig 067 actuelle a sa propre logique de création d'expé / ajout de membre / update place_veille. Le pseudo-code ci-dessus doit être inséré **au début** de la fonction (cas A et B comme early return), et le **DELETE court_score** ajouté juste après l'écriture finale de place_veille du cas C.

Le flag `by_influence` et `previous_expedition_id` doivent être **explicitement set à false/NULL** dans le UPSERT de `place_veille` côté cas C, sinon ils gardent leur valeur précédente.

```sql
-- Dans le UPDATE/INSERT existant de place_veille du cas C, ajouter :
SET ...,
    by_influence = false,
    previous_expedition_id = NULL,
    ...
```

- [ ] **Step 3 — Appliquer**

```bash
pnpm dlx supabase db push
```

- [ ] **Step 4 — Test fonctionnel via Supabase Studio**

```sql
-- Setup : un lieu fictivement basculé par influence
UPDATE public.place_veille
SET by_influence = true,
    previous_expedition_id = (
      SELECT id FROM public.expeditions WHERE place_id = '<place_test_id>'
        AND id != (SELECT expedition_id FROM place_veille WHERE place_id = '<place_test_id>')
        LIMIT 1
    )
WHERE place_id = '<place_test_id>';

-- Tester : un membre de previous_expedition_id plante → cas A (reclaim)
-- Via le frontend en mode dev, ou en simulant l'auth.uid (compliqué).
-- Vérifier après plantage :
SELECT expedition_id, by_influence, previous_expedition_id FROM place_veille WHERE place_id = '<place_test_id>';
-- Expected : expedition_id = previous_expedition_id (l'ancienne), by_influence=false, previous=NULL
```

- [ ] **Step 5 — Commit**

```bash
git add supabase/migrations/081_v07_plant_flag_court_reset.sql
git commit -m "feat(db): plant_flag reset court_score + by_influence handling (mig 081)"
```

---

## Task 6 — Migration 082 : Titres de Mécénat dans `get_user_titles`

**Files:**
- Create: `supabase/migrations/082_v07_titles_mecenat.sql`

Ajout de 4 nouveaux titres :
- **Bourse Légère** : 50 Couronnes investies cumulées
- **Coffre d'Or** : 200 Couronnes
- **Trésorier** : 1000 Couronnes
- **Premier Mécène** : avoir été #1 mécène sur ≥3 lieux différents

(Le titre dynamique "Mécène Principal de [Lieu]" est calculé directement côté frontend via le retour de `get_place_court_state`, pas dans `get_user_titles` qui ne sait pas par défaut quel lieu spécifier.)

- [ ] **Step 1 — Cat la version courante de `get_user_titles`**

```bash
grep -rn "CREATE OR REPLACE FUNCTION public.get_user_titles" supabase/migrations/
```

Identifier la dernière version (probablement mig 044 selon mémoire). Cat le fichier.

- [ ] **Step 2 — Écrire la migration**

```sql
-- 082_v07_titles_mecenat.sql
-- WHY : Phase 5 — 4 nouveaux titres de mécénat reflètent l'engagement
-- diplomatique cumulatif (Couronnes investies à vie + lieux où user a été #1).
--
-- Verbatim mig <dernière version get_user_titles> + ajout des 4 titres.
-- La table place_court_action sert de source unique pour les calculs.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_titles(p_user_id text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
DECLARE
  -- [TOUTES LES DECLARE EXISTANTES de la mig courante]
  v_total_invested INT;
  v_places_top1    INT;
BEGIN
  -- [TOUTE LA LOGIQUE EXISTANTE : level, places_visited, enigma_score, plantages, carnets, unlocks...]

  -- ============================================================
  -- AJOUT V0.7 phase 5 : titres mécénat
  -- ============================================================

  SELECT COALESCE(SUM(amount), 0)::INT INTO v_total_invested
  FROM public.place_court_action
  WHERE user_id = p_user_id;

  WITH per_place AS (
    SELECT place_id, user_id, SUM(amount) AS total
    FROM public.place_court_action
    GROUP BY place_id, user_id
  ),
  ranked AS (
    SELECT place_id, user_id, total,
           ROW_NUMBER() OVER (PARTITION BY place_id ORDER BY total DESC, user_id) AS rk
    FROM per_place
  )
  SELECT COUNT(*)::INT INTO v_places_top1
  FROM ranked WHERE rk = 1 AND user_id = p_user_id;

  -- [JSON return existant : ajouter ces 4 titres au tableau]
  -- titles: [
  --   ...,
  --   { axis: 'mecenat', title: 'Bourse Légère',    threshold: 50,   acquired: v_total_invested >= 50,   unlocked: ... },
  --   { axis: 'mecenat', title: 'Coffre d''Or',     threshold: 200,  acquired: v_total_invested >= 200,  unlocked: ... },
  --   { axis: 'mecenat', title: 'Trésorier',        threshold: 1000, acquired: v_total_invested >= 1000, unlocked: ... },
  --   { axis: 'mecenat', title: 'Premier Mécène',   threshold: 3,    acquired: v_places_top1 >= 3,       unlocked: ... }
  -- ]

  RETURN json_build_object(...);  -- structure identique à la mig courante + 4 titres
END;
$$;

COMMIT;
```

**Implémentation réelle** : il faut récupérer la structure actuelle de `get_user_titles` (mig 044 en principe), copier-coller verbatim, et insérer ces 4 titres dans le bon endroit du tableau retourné. La forme exacte dépend de la structure JSON actuelle (axis, threshold, acquired, etc.) — à aligner.

- [ ] **Step 3 — Appliquer**

```bash
pnpm dlx supabase db push
```

- [ ] **Step 4 — Vérifier**

```sql
SELECT public.get_user_titles('<user_id>');
-- Expected : retour avec les 4 nouveaux titres dans le tableau
```

- [ ] **Step 5 — Commit**

```bash
git add supabase/migrations/082_v07_titles_mecenat.sql
git commit -m "feat(db): titres mécénat dans get_user_titles (mig 082)"
```

---

## Task 7 — Frontend : régénérer `database.types.ts` + créer `types/court.ts`

**Files:**
- Modify: `apps/explore-web/src/types/database.types.ts` (régéneration)
- Create: `apps/explore-web/src/types/court.ts`

- [ ] **Step 1 — Régénérer les types Supabase**

Selon le tooling existant :

```bash
cd "C:/Users/uriel/Desktop/DEVS/app (Runes de Chêne)"
pnpm dlx supabase gen types typescript --project-id <project-id> > apps/explore-web/src/types/database.types.ts
```

(Vérifier le project-id dans `.env` ou Supabase dashboard ; commande exacte selon la convention du repo — voir scripts/`package.json` du root.)

- [ ] **Step 2 — Créer `types/court.ts`**

```typescript
// apps/explore-web/src/types/court.ts
// Types client-side pour La Cour (V0.7 phase 5).

export type CourtStatus = 'paisible' | 'convoite' | 'sous_pression' | 'en_siege'

export type CourtSide = 'defense' | 'attack'

export interface ExpeditionMember {
  userId: string
  displayName: string
}

export interface CourtVeilleur {
  expeditionId: string
  name: string
  planted_at: string
  byInfluence: boolean
  members: ExpeditionMember[]
}

export interface CourtThreat {
  expeditionId: string
  name: string
  score: number
}

export interface Patron {
  userId: string
  displayName: string
  total: number
}

export interface ChronicleEntry {
  ts: string
  actorName: string
  expeditionName: string
  side: CourtSide
  amount: number
}

export interface CourtCallerContext {
  balance: number
  isMemberOfVeilleur: boolean
  challengerExpeditions: string[]
  userTotalOnPlace: number
}

export interface PlaceCourtState {
  veilleur: CourtVeilleur
  scoreVeilleur: number
  threats: CourtThreat[]
  menaceHaute: number | null  // visible seulement aux membres veilleur
  scoreToBeat: number | null  // visible seulement aux non-membres
  topPatrons: Patron[]
  chronicle: ChronicleEntry[]
  status: CourtStatus
  callerContext: CourtCallerContext
}

export interface InvestCrownsResult {
  success: boolean
  side: CourtSide
  newScore: number
  balance: number
  basculed: boolean
  basculedExpeditionId?: string
}
```

- [ ] **Step 3 — Vérifier que le build passe**

```bash
pnpm --filter explore-web build
```

Expected : aucune erreur TypeScript.

- [ ] **Step 4 — Commit**

```bash
git add apps/explore-web/src/types/court.ts apps/explore-web/src/types/database.types.ts
git commit -m "feat(types): regen database.types + new court.ts (phase 5)"
```

---

## Task 8 — Frontend : `crownsStore` refresh post-investment + post-énigme

**Files:**
- Modify: `apps/explore-web/src/stores/crownsStore.ts`

- [ ] **Step 1 — Lire le store actuel**

```bash
cat apps/explore-web/src/stores/crownsStore.ts
```

Identifier la fonction de fetch existante (probablement `loadCrownsState` ou `refreshCrownsState`).

- [ ] **Step 2 — Ajouter une action `setBalance(newBalance)` (utilitaire)**

Dans le store, ajouter une action qui permet de mettre à jour la balance directement depuis un retour RPC (énigme, investissement) sans refetch complet :

```typescript
// Ajouter dans la définition du store :
interface CrownsStoreState {
  // ... existing
  setBalance: (newBalance: number) => void
}

// Implémentation :
setBalance: (newBalance: number) => set({ balance: newBalance })
```

- [ ] **Step 3 — Vérifier que le build passe**

```bash
pnpm --filter explore-web build
```

- [ ] **Step 4 — Commit**

```bash
git add apps/explore-web/src/stores/crownsStore.ts
git commit -m "feat(crowns): add setBalance action for direct RPC return refresh"
```

---

## Task 9 — Frontend : `EnigmaResult` ajoute la ligne Couronnes

**Files:**
- Modify: `apps/explore-web/src/components/enigma/EnigmaResult.tsx`

- [ ] **Step 1 — Modifier le composant**

Le fichier actuel (lecture en début de session) affiche 3 gains. Ajouter une 4ème ligne `Couronnes`. Modifier les props pour accepter `crownsGain` :

```typescript
interface EnigmaResultProps {
  correct: boolean
  answer: string
  explanation: string
  /** @deprecated V0.5 — gardé pour compat */
  influenceGain: number
  /** @deprecated V0.5 — gardé pour compat */
  eruditionGain: number
  /** V0.6 — difficulté pour calcul gain unifié 1/1/2/3 */
  difficulty?: 'very_easy' | 'easy' | 'medium' | 'hard'
  /** V0.7 phase 5 — Couronnes gagnées (0 si stock plein) */
  crownsGain?: number
  onClose: () => void
  closeLabel?: string
}
```

Dans le JSX, ajouter sous les 3 lignes existantes :

```tsx
{correct && (
  <div className="enigma-result-gains">
    <div className="enigma-result-gain glory">
      {'🎖️'} +{gain} Gloire
    </div>
    <div className="enigma-result-gain coupe">
      {'🏆'} +{gain} Coupe
    </div>
    <div className="enigma-result-gain enigma">
      {'📖'} +1 énigme validée
    </div>
    {typeof crownsGain === 'number' && (
      <div className="enigma-result-gain crowns">
        {'👑'} +{crownsGain} Couronne{crownsGain > 1 ? 's' : ''}
        {crownsGain === 0 && <span style={{opacity: 0.6, fontSize: '0.85em', marginLeft: 8}}>(stock plein)</span>}
      </div>
    )}
  </div>
)}
```

Ajouter dans `EnigmaResult.css` (fichier à modifier ou ajouter une règle) une classe `.enigma-result-gain.crowns` cohérente avec les autres (couleur or chaud, par ex. `#caa066`).

- [ ] **Step 2 — Vérifier le build**

```bash
pnpm --filter explore-web build
```

- [ ] **Step 3 — Commit**

```bash
git add apps/explore-web/src/components/enigma/EnigmaResult.tsx apps/explore-web/src/components/enigma/EnigmaResult.css
git commit -m "feat(enigma): EnigmaResult affiche les Couronnes gagnées"
```

---

## Task 10 — Frontend : `DailyEnigma` + `FragmentEnigma` + `PlaceEnigma` (si existe) propagent `crownsGain`

**Files:**
- Modify: `apps/explore-web/src/components/enigma/DailyEnigma.tsx`
- Modify: `apps/explore-web/src/components/enigma/FragmentEnigma.tsx`
- Modify: `apps/explore-web/src/components/enigma/PlaceEnigma.tsx` (si présent — vérifier `ls`)

- [ ] **Step 1 — `DailyEnigma`**

Modifier l'interface `AnswerResult` pour inclure `crownsGain` et `newCrownsBalance` :

```typescript
interface AnswerResult {
  correct: boolean
  answer: string
  explanation: string
  influenceGain: number
  eruditionGain: number
  crownsGain: number
  newCrownsBalance: number
  newErudition: number
  newGlory: number
}
```

Dans `handleSubmit`, après réception de `data` :

```typescript
import { useCrownsStore } from '../../stores/crownsStore'

// ... dans le composant
const setCrownsBalance = useCrownsStore(s => s.setBalance)

// ... dans handleSubmit
if (!error && data && !data.error) {
  const r = data as AnswerResult
  setResult(r)
  setTotalGains(prev => ({
    influence: prev.influence + (r.influenceGain ?? 0),
    erudition: prev.erudition + (r.eruditionGain ?? 0),
  }))
  if (typeof r.newCrownsBalance === 'number') {
    setCrownsBalance(r.newCrownsBalance)
  }
  if (userId) void refreshLevelStateGlobal(userId)
}
```

Dans le JSX où `<EnigmaResult ... />` est rendu, passer `crownsGain={result.crownsGain}` :

```tsx
{result && (
  <EnigmaResult
    correct={result.correct}
    answer={result.answer}
    explanation={result.explanation}
    influenceGain={result.influenceGain}
    eruditionGain={result.eruditionGain}
    crownsGain={result.crownsGain}
    difficulty={enigma.difficulty}
    onClose={isLast ? onClose : handleNext}
    closeLabel={isLast ? 'Fermer' : 'Énigme suivante →'}
  />
)}
```

- [ ] **Step 2 — `FragmentEnigma`**

Même logique : étendre l'interface de retour, lire `crownsGain` + `newCrownsBalance`, propager à `EnigmaResult`, mettre à jour `crownsStore`.

- [ ] **Step 3 — `PlaceEnigma` (si existe)**

```bash
find apps/explore-web/src -iname "*placeenigma*" -o -iname "*place_enigma*"
```

Si trouvé, appliquer le même pattern.

- [ ] **Step 4 — Vérifier le build**

```bash
pnpm --filter explore-web build
```

- [ ] **Step 5 — Test manuel rapide**

Lancer le dev server et résoudre une énigme :

```bash
pnpm --filter explore-web dev
```

Browser → résoudre une énigme correcte → la modale doit afficher `👑 +N Couronnes` et le badge Couronnes en haut de carte doit s'incrémenter.

- [ ] **Step 6 — Commit**

```bash
git add apps/explore-web/src/components/enigma/
git commit -m "feat(enigma): DailyEnigma/FragmentEnigma/PlaceEnigma propagent crownsGain"
```

---

## Task 11 — Frontend : `CourtTensionBar.tsx`

**Files:**
- Create: `apps/explore-web/src/components/places/details/CourtTensionBar.tsx`
- Create: `apps/explore-web/src/components/places/details/CourtTensionBar.css`

Jauge horizontale qui pivote selon (score veilleur) − (menace haute). Sobre, parchemin/cuir doux, pas RPG.

- [ ] **Step 1 — Créer le composant**

```typescript
// apps/explore-web/src/components/places/details/CourtTensionBar.tsx
import './CourtTensionBar.css'
import type { CourtStatus } from '../../../types/court'

interface CourtTensionBarProps {
  scoreVeilleur: number
  menaceHaute: number  // 0 si pas de menace ou pas visible
  status: CourtStatus
}

const STATUS_LABELS: Record<CourtStatus, string> = {
  paisible:       '🟢 Lieu paisible',
  convoite:       '🟡 Lieu convoité',
  sous_pression:  '🟠 Lieu sous pression',
  en_siege:       '🔴 Lieu en siège',
}

export function CourtTensionBar({ scoreVeilleur, menaceHaute, status }: CourtTensionBarProps) {
  const total = scoreVeilleur + menaceHaute
  const veilleurPct = total > 0 ? Math.round((scoreVeilleur / total) * 100) : 100

  return (
    <div className="court-tension">
      <div className="court-tension-status">{STATUS_LABELS[status]}</div>
      <div className="court-tension-bar" role="img" aria-label={`Faveur veilleur ${scoreVeilleur}, menace ${menaceHaute}`}>
        <div className="court-tension-fill veilleur" style={{ width: `${veilleurPct}%` }} />
        <div className="court-tension-fill challenger" style={{ width: `${100 - veilleurPct}%` }} />
      </div>
      <div className="court-tension-scores">
        <span className="court-score-veilleur">Faveur {scoreVeilleur}</span>
        {menaceHaute > 0 && <span className="court-score-menace">Menace {menaceHaute}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2 — Créer le CSS**

```css
/* apps/explore-web/src/components/places/details/CourtTensionBar.css */
.court-tension {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 12px 0;
}
.court-tension-status {
  font-size: 14px;
  opacity: 0.85;
}
.court-tension-bar {
  display: flex;
  height: 10px;
  border-radius: 6px;
  overflow: hidden;
  background: rgba(0,0,0,0.08);
  border: 1px solid rgba(0,0,0,0.12);
}
.court-tension-fill {
  height: 100%;
  transition: width 0.5s ease;
}
.court-tension-fill.veilleur {
  background: linear-gradient(90deg, #6b8e6b, #8aaf8a);
}
.court-tension-fill.challenger {
  background: linear-gradient(90deg, #b86b4b, #d48060);
}
.court-tension-scores {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.court-score-veilleur { color: #4d6b4d; }
.court-score-menace   { color: #a05030; font-weight: 500; }
```

- [ ] **Step 3 — Build**

```bash
pnpm --filter explore-web build
```

- [ ] **Step 4 — Commit**

```bash
git add apps/explore-web/src/components/places/details/CourtTensionBar.{tsx,css}
git commit -m "feat(court): CourtTensionBar component"
```

---

## Task 12 — Frontend : `PatronsList.tsx`

**Files:**
- Create: `apps/explore-web/src/components/places/details/PatronsList.tsx`
- Create: `apps/explore-web/src/components/places/details/PatronsList.css`

Top 5 mécènes avec icone "Mécène Principal" pour le #1.

- [ ] **Step 1 — Créer le composant**

```typescript
// apps/explore-web/src/components/places/details/PatronsList.tsx
import './PatronsList.css'
import type { Patron } from '../../../types/court'

interface PatronsListProps {
  patrons: Patron[]
  currentUserId?: string
}

export function PatronsList({ patrons, currentUserId }: PatronsListProps) {
  if (patrons.length === 0) {
    return (
      <div className="patrons-empty">
        Aucun mécène ne s'est encore distingué sur ce lieu.
      </div>
    )
  }

  return (
    <div className="patrons-list">
      <div className="patrons-title">Trône des Mécènes</div>
      {patrons.map((p, i) => {
        const isFirst = i === 0
        const isYou = currentUserId === p.userId
        return (
          <div key={p.userId} className={`patron-row${isFirst ? ' first' : ''}${isYou ? ' is-you' : ''}`}>
            <span className="patron-rank">#{i + 1}</span>
            <span className="patron-name">
              {p.displayName}
              {isFirst && <span className="patron-title"> · Mécène Principal</span>}
              {isYou && <span className="patron-you"> (vous)</span>}
            </span>
            <span className="patron-total">{p.total} 👑</span>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2 — Créer le CSS**

```css
/* apps/explore-web/src/components/places/details/PatronsList.css */
.patrons-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 12px 0;
}
.patrons-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
  opacity: 0.8;
}
.patron-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 14px;
}
.patron-row.first {
  background: rgba(202, 160, 102, 0.12);
}
.patron-row.is-you {
  outline: 1px dashed rgba(0,0,0,0.2);
}
.patron-rank {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  width: 28px;
}
.patron-name {
  flex: 1;
}
.patron-title {
  color: #b88a4a;
  font-weight: 500;
}
.patron-you {
  opacity: 0.7;
  font-style: italic;
}
.patron-total {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.patrons-empty {
  font-style: italic;
  opacity: 0.6;
  font-size: 14px;
  margin: 12px 0;
}
```

- [ ] **Step 3 — Build + commit**

```bash
pnpm --filter explore-web build
git add apps/explore-web/src/components/places/details/PatronsList.{tsx,css}
git commit -m "feat(court): PatronsList component"
```

---

## Task 13 — Frontend : `CourtChronicle.tsx`

**Files:**
- Create: `apps/explore-web/src/components/places/details/CourtChronicle.tsx`
- Create: `apps/explore-web/src/components/places/details/CourtChronicle.css`

- [ ] **Step 1 — Composant**

```typescript
// apps/explore-web/src/components/places/details/CourtChronicle.tsx
import './CourtChronicle.css'
import type { ChronicleEntry } from '../../../types/court'
import { formatFrenchLongDate } from '../../../lib/dateFormat'

interface CourtChronicleProps {
  entries: ChronicleEntry[]
}

function formatRelative(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1)  return "à l'instant"
  if (min < 60) return `il y a ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24)   return `il y a ${h}h`
  const d = Math.floor(h / 24)
  if (d < 7)    return `il y a ${d}j`
  return formatFrenchLongDate(ts)
}

export function CourtChronicle({ entries }: CourtChronicleProps) {
  if (entries.length === 0) {
    return (
      <div className="chronicle-empty">
        Le lieu est encore silencieux. Aucune action diplomatique récente.
      </div>
    )
  }

  return (
    <div className="chronicle-list">
      <div className="chronicle-title">Chronique</div>
      {entries.map((e, i) => (
        <div key={i} className={`chronicle-row ${e.side}`}>
          <span className="chronicle-actor">{e.actorName}</span>
          {' '}
          <span className="chronicle-verb">
            {e.side === 'defense' ? 'a renforcé' : 'a investi'}
          </span>
          {' '}
          <span className="chronicle-amount">{e.amount} 👑</span>
          {' '}
          <span className="chronicle-target">
            pour {e.expeditionName}
          </span>
          {' — '}
          <span className="chronicle-time">{formatRelative(e.ts)}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2 — CSS**

```css
/* apps/explore-web/src/components/places/details/CourtChronicle.css */
.chronicle-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 12px 0;
}
.chronicle-title {
  font-size: 14px;
  font-weight: 600;
  opacity: 0.8;
  margin-bottom: 6px;
}
.chronicle-row {
  font-size: 13px;
  padding: 4px 6px;
  border-left: 2px solid transparent;
}
.chronicle-row.defense  { border-left-color: #6b8e6b; }
.chronicle-row.attack   { border-left-color: #b86b4b; }
.chronicle-actor   { font-weight: 500; }
.chronicle-amount  { font-variant-numeric: tabular-nums; font-weight: 500; }
.chronicle-time    { opacity: 0.6; font-size: 12px; }
.chronicle-empty   { font-style: italic; opacity: 0.6; font-size: 14px; }
```

- [ ] **Step 3 — Commit**

```bash
pnpm --filter explore-web build
git add apps/explore-web/src/components/places/details/CourtChronicle.{tsx,css}
git commit -m "feat(court): CourtChronicle component"
```

---

## Task 14 — Frontend : `InvestCrownsModal.tsx`

**Files:**
- Create: `apps/explore-web/src/components/places/actions/InvestCrownsModal.tsx`
- Create: `apps/explore-web/src/components/places/actions/InvestCrownsModal.css`

Modale avec slider 1→balance, preview du résultat, confirmation explicite, brûlage Couronnes signalé.

- [ ] **Step 1 — Composant**

```typescript
// apps/explore-web/src/components/places/actions/InvestCrownsModal.tsx
import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import { useCrownsStore } from '../../../stores/crownsStore'
import './InvestCrownsModal.css'
import type { InvestCrownsResult, CourtSide } from '../../../types/court'

interface InvestCrownsModalProps {
  placeId: string
  placeTitle: string
  expeditionId: string
  expeditionName: string
  side: CourtSide
  scoreToBeat?: number  // pour attaque, sinon ignoré
  currentScore: number  // score actuel de l'expé cible
  balance: number
  onClose: () => void
  onSuccess: (result: InvestCrownsResult) => void
}

export function InvestCrownsModal(props: InvestCrownsModalProps) {
  const { placeId, expeditionId, side, scoreToBeat, currentScore, balance, onClose, onSuccess } = props
  const userId = usePlayerStore(s => s.userId)
  const setCrownsBalance = useCrownsStore(s => s.setBalance)
  const [amount, setAmount] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const max = Math.min(balance, 500)
  const newScore = currentScore + amount
  const willBascule = side === 'attack' && typeof scoreToBeat === 'number' && newScore > scoreToBeat

  async function handleConfirm() {
    if (!userId) return
    setSubmitting(true)
    setError(null)
    const { data, error } = await supabase.rpc('invest_crowns', {
      p_user_id: userId,
      p_place_id: placeId,
      p_target_expedition_id: expeditionId,
      p_amount: amount,
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    const result = data as InvestCrownsResult & { error?: string }
    if (result.error) {
      setError(result.error)
      return
    }
    setCrownsBalance(result.balance)
    onSuccess(result)
    onClose()
  }

  return (
    <div className="invest-overlay" onClick={onClose}>
      <div className="invest-modal" onClick={e => e.stopPropagation()}>
        <button className="invest-close" onClick={onClose}>&#10005;</button>
        <h3 className="invest-title">
          {side === 'defense' ? 'Soutenir' : 'Défier'}
        </h3>
        <p className="invest-target">
          {props.expeditionName} sur <strong>{props.placeTitle}</strong>
        </p>

        <div className="invest-slider">
          <input
            type="range"
            min={1}
            max={max}
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            disabled={max === 0}
          />
          <div className="invest-amount">
            {amount} <span>👑</span> sur {balance}
          </div>
        </div>

        <div className="invest-preview">
          {side === 'attack' && typeof scoreToBeat === 'number' && (
            <>
              <div>Score de votre expédition : <strong>{currentScore}</strong> → <strong>{newScore}</strong></div>
              <div>Score à battre : <strong>{scoreToBeat}</strong></div>
              {willBascule && <div className="invest-bascule">⚡ Cet investissement fera basculer le lieu !</div>}
            </>
          )}
          {side === 'defense' && (
            <div>Faveur veilleur : <strong>{currentScore + 50}</strong> → <strong>{newScore + 50}</strong></div>
          )}
        </div>

        <p className="invest-warning">
          Vous allez investir <strong>{amount} Couronne{amount > 1 ? 's' : ''}</strong>. Brûlées définitivement.
        </p>

        {error && <div className="invest-error">{error}</div>}

        <div className="invest-buttons">
          <button className="invest-cancel" onClick={onClose} disabled={submitting}>Annuler</button>
          <button className="invest-confirm" onClick={handleConfirm} disabled={submitting || max === 0 || amount < 1}>
            {submitting ? 'Investissement…' : 'Confirmer'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2 — CSS**

```css
/* apps/explore-web/src/components/places/actions/InvestCrownsModal.css */
.invest-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 16px;
}
.invest-modal {
  background: #f8f1e3; padding: 24px; border-radius: 8px;
  max-width: 420px; width: 100%;
  position: relative;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}
.invest-close {
  position: absolute; top: 12px; right: 12px;
  background: none; border: none; font-size: 18px; cursor: pointer;
}
.invest-title { margin: 0 0 4px; font-size: 22px; }
.invest-target { margin: 0 0 16px; opacity: 0.85; }

.invest-slider { margin: 16px 0; }
.invest-slider input[type=range] { width: 100%; }
.invest-amount { font-size: 18px; text-align: center; margin-top: 8px; }
.invest-amount span { color: #caa066; }

.invest-preview {
  background: rgba(0,0,0,0.04);
  padding: 12px; border-radius: 6px; font-size: 14px;
  margin: 12px 0;
}
.invest-bascule {
  margin-top: 8px; padding: 6px; background: rgba(184,107,75,0.15);
  border-radius: 4px; font-weight: 500;
}

.invest-warning { font-size: 13px; opacity: 0.75; margin: 12px 0; }
.invest-error { color: #c94545; font-size: 13px; margin: 8px 0; }

.invest-buttons {
  display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px;
}
.invest-cancel, .invest-confirm {
  padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;
  font-size: 15px;
}
.invest-cancel { background: rgba(0,0,0,0.08); }
.invest-confirm {
  background: #6b3f1f; color: #fff;
}
.invest-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 3 — Build + commit**

```bash
pnpm --filter explore-web build
git add apps/explore-web/src/components/places/actions/InvestCrownsModal.{tsx,css}
git commit -m "feat(court): InvestCrownsModal component"
```

---

## Task 15 — Frontend : `PlaceCourtView.tsx` (intégration)

**Files:**
- Create: `apps/explore-web/src/components/places/details/PlaceCourtView.tsx`
- Create: `apps/explore-web/src/components/places/details/PlaceCourtView.css`

Composant principal qui assemble TensionBar + Veilleur + Boutons + Patrons + Chronicle. Charge les données via `get_place_court_state`. Ouvre `InvestCrownsModal` sur clic.

- [ ] **Step 1 — Composant principal**

```typescript
// apps/explore-web/src/components/places/details/PlaceCourtView.tsx
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import { useCrownsStore } from '../../../stores/crownsStore'
import { CourtTensionBar } from './CourtTensionBar'
import { PatronsList } from './PatronsList'
import { CourtChronicle } from './CourtChronicle'
import { InvestCrownsModal } from '../actions/InvestCrownsModal'
import './PlaceCourtView.css'
import type { PlaceCourtState, CourtSide } from '../../../types/court'

interface PlaceCourtViewProps {
  placeId: string
  placeTitle: string
}

export function PlaceCourtView({ placeId, placeTitle }: PlaceCourtViewProps) {
  const userId = usePlayerStore(s => s.userId)
  const balance = useCrownsStore(s => s.balance)
  const [state, setState] = useState<PlaceCourtState | null>(null)
  const [loading, setLoading] = useState(true)
  const [investTarget, setInvestTarget] = useState<{
    expeditionId: string
    expeditionName: string
    side: CourtSide
    currentScore: number
  } | null>(null)

  const fetchState = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_place_court_state', {
      p_place_id: placeId,
      p_user_id: userId,
    })
    setLoading(false)
    if (error || (data as Record<string, unknown>).error) {
      console.error('court state error', error || data)
      return
    }
    setState(data as PlaceCourtState)
  }, [placeId, userId])

  useEffect(() => { void fetchState() }, [fetchState])

  if (loading || !state) {
    return <div className="court-loading">Chargement de la Cour…</div>
  }

  const { veilleur, scoreVeilleur, threats, menaceHaute, status, topPatrons, chronicle, callerContext } = state
  const isMember = callerContext.isMemberOfVeilleur
  const userChallengerExp = callerContext.challengerExpeditions[0]  // si déjà membre d'une expé challenger

  // Build target options for buttons
  const handleSupport = () => {
    setInvestTarget({
      expeditionId: veilleur.expeditionId,
      expeditionName: veilleur.name,
      side: 'defense',
      currentScore: scoreVeilleur - 50,  // visible défense uniquement
    })
  }

  const handleChallenge = () => {
    if (userChallengerExp) {
      const t = threats.find(x => x.expeditionId === userChallengerExp)
      setInvestTarget({
        expeditionId: userChallengerExp,
        expeditionName: t?.name ?? 'Mon expédition',
        side: 'attack',
        currentScore: t?.score ?? 0,
      })
    } else {
      // V1 simplifié : on ne propose pas de créer/rejoindre une expé challenger ici.
      // Pour V1, on laisse l'absence de bouton Défier. Évolution V2 : modale de création/sélection d'expé.
      console.warn('Challenge sans expé challenger active : flow à implémenter V2')
    }
  }

  return (
    <div className="court-view">
      <h3 className="court-section-title">La Cour</h3>

      <CourtTensionBar
        scoreVeilleur={scoreVeilleur}
        menaceHaute={menaceHaute ?? 0}
        status={status}
      />

      <div className="court-veilleur">
        <div className="court-veilleur-name">
          Veilleur : <strong>{veilleur.name}</strong>
          {veilleur.byInfluence && <span className="court-by-influence"> · tient ce lieu à distance</span>}
        </div>
        <div className="court-veilleur-members">
          {veilleur.members.map(m => (
            <span key={m.userId} className="court-member-pill">{m.displayName}</span>
          ))}
        </div>
      </div>

      <div className="court-actions">
        <button onClick={handleSupport} disabled={balance < 1}>
          {isMember ? 'Renforcer la veille' : 'Soutenir le veilleur'}
        </button>
        {!isMember && userChallengerExp && (
          <button className="challenge" onClick={handleChallenge} disabled={balance < 1}>
            Défier
          </button>
        )}
      </div>
      {balance < 1 && (
        <p className="court-no-balance">Vous n'avez plus de Couronnes. Récoltez sur vos lieux veillés ou résolvez des énigmes.</p>
      )}

      <PatronsList patrons={topPatrons} currentUserId={userId ?? undefined} />

      <CourtChronicle entries={chronicle} />

      {investTarget && state && (
        <InvestCrownsModal
          placeId={placeId}
          placeTitle={placeTitle}
          expeditionId={investTarget.expeditionId}
          expeditionName={investTarget.expeditionName}
          side={investTarget.side}
          scoreToBeat={state.scoreToBeat ?? undefined}
          currentScore={investTarget.currentScore}
          balance={balance}
          onClose={() => setInvestTarget(null)}
          onSuccess={() => { void fetchState() }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2 — CSS**

```css
/* apps/explore-web/src/components/places/details/PlaceCourtView.css */
.court-view { display: flex; flex-direction: column; gap: 8px; padding: 16px 0; }
.court-section-title { font-size: 18px; margin: 0 0 8px; }
.court-loading { padding: 24px; text-align: center; opacity: 0.7; font-style: italic; }
.court-veilleur { padding: 8px 0; }
.court-veilleur-name { font-size: 15px; }
.court-by-influence { opacity: 0.7; font-style: italic; }
.court-veilleur-members { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.court-member-pill {
  font-size: 13px; padding: 3px 8px; background: rgba(0,0,0,0.06); border-radius: 12px;
}
.court-actions { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
.court-actions button {
  padding: 10px 16px; border: none; border-radius: 4px; cursor: pointer;
  font-size: 15px; background: #6b3f1f; color: #fff;
}
.court-actions button.challenge { background: #a04830; }
.court-actions button:disabled { opacity: 0.5; cursor: not-allowed; }
.court-no-balance { font-size: 13px; opacity: 0.7; font-style: italic; }
```

- [ ] **Step 3 — Build + commit**

```bash
pnpm --filter explore-web build
git add apps/explore-web/src/components/places/details/PlaceCourtView.{tsx,css}
git commit -m "feat(court): PlaceCourtView main component"
```

---

## Task 16 — Frontend : intégrer `PlaceCourtView` dans `PlacePanel.tsx` + drop ancien `InfluenceFrame`

**Files:**
- Modify: `apps/explore-web/src/components/places/views/PlacePanel.tsx`
- Modify: `apps/explore-web/src/pages/MapPage.tsx` (si réf à InfluenceFrame)
- Delete: `apps/explore-web/src/components/places/details/InfluenceFrame.tsx` (si existe)
- Delete: `apps/explore-web/src/components/map/controls/InfluenceToggle.tsx`
- Modify: `apps/explore-web/src/styles/mobile.css` (CSS lié à InfluenceFrame/Toggle)

- [ ] **Step 1 — Identifier les références**

```bash
grep -rn "InfluenceFrame\|InfluenceToggle" apps/explore-web/src/
```

- [ ] **Step 2 — Dans `PlacePanel.tsx`, remplacer `<InfluenceFrame />` par `<PlaceCourtView placeId={place.id} placeTitle={place.title} />`**

Identifier précisément l'endroit (probablement dans la section onglet "Influence" ou au-dessus du contenu principal). Lire le fichier d'abord :

```bash
cat apps/explore-web/src/components/places/views/PlacePanel.tsx | grep -n -A3 -B3 InfluenceFrame
```

Importer `PlaceCourtView` :

```typescript
import { PlaceCourtView } from '../details/PlaceCourtView'
```

Remplacer l'élément JSX existant.

- [ ] **Step 3 — Drop `InfluenceToggle`**

```bash
rm apps/explore-web/src/components/map/controls/InfluenceToggle.tsx
# si CSS associé :
rm apps/explore-web/src/components/map/controls/InfluenceToggle.css 2>/dev/null
```

Retirer toutes les imports/références dans `MapPage.tsx`, `mobile.css`, etc :

```bash
grep -rn "InfluenceToggle" apps/explore-web/src/
# pour chaque match, ouvrir et retirer
```

- [ ] **Step 4 — Drop `InfluenceFrame` si existe**

```bash
ls apps/explore-web/src/components/places/details/InfluenceFrame.tsx 2>/dev/null && rm apps/explore-web/src/components/places/details/InfluenceFrame.tsx
ls apps/explore-web/src/components/places/details/InfluenceFrame.css 2>/dev/null && rm apps/explore-web/src/components/places/details/InfluenceFrame.css
```

- [ ] **Step 5 — Build**

```bash
pnpm --filter explore-web build
```

Si erreur "module not found", chasser les imports orphelins.

- [ ] **Step 6 — Commit**

```bash
git add -A
git commit -m "feat(court): integrate PlaceCourtView in PlacePanel, drop InfluenceFrame/Toggle V0.5"
```

---

## Task 17 — Frontend : Marker variant `by_influence`

**Files:**
- Modify: `apps/explore-web/src/components/map/core/MapMarkers.tsx`
- Modify: CSS associé (probablement inline ou dans `MapMarkers.css`)

- [ ] **Step 1 — Lire le composant**

```bash
cat apps/explore-web/src/components/map/core/MapMarkers.tsx
```

Identifier où le style du marker est défini selon le statut de veille.

- [ ] **Step 2 — Ajouter une variation visuelle si `by_influence === true`**

Approche minimale : ajouter une classe CSS `marker-by-influence` qui modifie l'opacité (ex: `opacity: 0.65`) ou ajoute une bordure pointillée. Le marker doit recevoir le flag depuis les données de `place_veille` (déjà chargées via le store Map ou la RPC qui sert la carte).

Si la donnée n'est pas encore exposée par la RPC carte, la mig récente `get_my_recent_activity` (071) ou la RPC qui retourne les places à afficher doit être étendue. **À vérifier** — si non disponible, ajouter une RPC ou étendre `get_player_profile` pour exposer `byInfluence` pour les lieux concernés du caller.

V1 minimal : si la donnée n'est pas dispo, **skipper cette task** et l'ajouter en V2 (notif et fiche lieu suffisent pour le sprint). Documenter dans CLAUDE.md de la sous-app.

- [ ] **Step 3 — Build + commit (si appliqué)**

```bash
pnpm --filter explore-web build
git add -A
git commit -m "feat(map): variant visuel pour markers veillés par influence"
```

---

## Task 18 — Frontend : `useCourtNotifications` hook

**Files:**
- Create: `apps/explore-web/src/hooks/useCourtNotifications.ts`

- [ ] **Step 1 — Lire `usePlayer.ts` pour comprendre le pattern de subscribe existant**

```bash
sed -n '370,420p' apps/explore-web/src/hooks/usePlayer.ts
```

Identifier comment les types `activity_log` sont consommés (probablement via `supabase.channel(...).on('postgres_changes', ...).subscribe()` ou via `loadRecentActivity` polling).

- [ ] **Step 2 — Créer le hook**

```typescript
// apps/explore-web/src/hooks/useCourtNotifications.ts
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import { useToastStore } from '../stores/toastStore'

const COURT_TYPES = [
  'place_court_attack',
  'place_court_high_threat',
  'place_taken_remote',
  'place_taken_remote_self',
  'place_taken_back_gps',
  'mecene_principal_gained',
] as const

interface ActivityLogRow {
  id: number
  type: string
  actor_id: string | null
  place_id: string | null
  data: Record<string, unknown>
  created_at: string
}

function formatToast(row: ActivityLogRow): string | null {
  const placeTitle = (row.data?.placeTitle as string) ?? 'un lieu'
  const actorName = (row.data?.actorName as string) ?? 'Quelqu''un'
  switch (row.type) {
    case 'place_court_attack':
      return `${actorName} s'intéresse à ${placeTitle}`
    case 'place_court_high_threat':
      return `${placeTitle} est sous forte pression !`
    case 'place_taken_remote':
      return `Vous avez perdu ${placeTitle}`
    case 'place_taken_remote_self':
      return `Vous tenez ${placeTitle} à distance — allez-y physiquement pour le confirmer`
    case 'place_taken_back_gps':
      return `L'ancien veilleur a repris ${placeTitle}`
    case 'mecene_principal_gained':
      return `Vous êtes désormais Mécène Principal de ${placeTitle}`
    default:
      return null
  }
}

export function useCourtNotifications() {
  const userId = usePlayerStore(s => s.userId)
  const showToast = useToastStore(s => s.showToast)  // ou l'équivalent

  useEffect(() => {
    if (!userId) return

    // Subscribe sur activity_log filtré par les types Cour qui concernent ce user.
    // L'attribution aux user (membres expé veilleuse, ancien veilleur, etc.)
    // est complexe — pour V1, on subscribe et on filtre côté client : un toast
    // est affiché si actor_id != userId ET le user est concerné.
    // Pour vraiment cibler, il faudrait une table `user_notifications` séparée.
    // V1 simplifié : on subscribe sur activity_log et on filtre par type uniquement,
    // les toasts s'affichent pour tous les events concernant les lieux où le user
    // est dans une expé.
    // Évolution V2 : table user_notifications dédiée.

    const channel = supabase
      .channel(`court-notif-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        async (payload) => {
          const row = payload.new as ActivityLogRow
          if (!COURT_TYPES.includes(row.type as typeof COURT_TYPES[number])) return
          // Filtre côté client : récupérer si user concerné
          // V1 : pour simplicité, on affiche toujours (potentiel spam, à monitorer).
          const message = formatToast(row)
          if (message) showToast({ message, type: row.type })
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [userId, showToast])
}
```

**Important** : le pattern toast/notification dépend du `toastStore` existant. Adapter selon l'API réelle (méthode `showToast`, `addToast`, etc.).

- [ ] **Step 3 — Brancher le hook dans `App.tsx` ou équivalent**

Trouver où `usePlayer()` est appelé en racine et ajouter `useCourtNotifications()` à côté.

```bash
grep -rn "usePlayer()" apps/explore-web/src/App.tsx apps/explore-web/src/main.tsx
```

- [ ] **Step 4 — Build + commit**

```bash
pnpm --filter explore-web build
git add apps/explore-web/src/hooks/useCourtNotifications.ts apps/explore-web/src/App.tsx
git commit -m "feat(court): useCourtNotifications hook"
```

---

## Task 19 — Hub : vue admin "Bascules récentes"

**Files:**
- Modify: `apps/hub/src/components/Divers.tsx`

Vue minimale pour Uriel : liste des bascules par influence, dernières 30j.

- [ ] **Step 1 — Lire `Divers.tsx` pour comprendre la structure**

```bash
cat apps/hub/src/components/Divers.tsx
```

- [ ] **Step 2 — Ajouter une section "Bascules récentes"**

```typescript
// Ajouter un useEffect qui fetch les events place_taken_remote des 30 derniers jours
useEffect(() => {
  supabase
    .from('activity_log')
    .select('id, place_id, actor_id, data, created_at')
    .eq('type', 'place_taken_remote')
    .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
    .order('created_at', { ascending: false })
    .limit(50)
    .then(({ data }) => setBascules(data ?? []))
}, [])

// Render une table simple : place_title, actor (ancien -> nouveau), created_at
```

Détail de l'UI à improviser selon le style global du Hub (déjà existant). Une table de 4 colonnes suffit pour V1.

- [ ] **Step 3 — Build hub + commit**

```bash
pnpm --filter hub build
git add apps/hub/src/components/Divers.tsx
git commit -m "feat(hub): vue Bascules récentes (V0.7 phase 5)"
```

---

## Task 20 — Test bout en bout en local

- [ ] **Step 1 — Lancer les deux apps en local**

```bash
pnpm dev
# (port 3000 = explore-web, 3001 = hub)
```

- [ ] **Step 2 — Scénarios à tester**

Avec deux comptes de test (A et B, déjà existants en prod ou créés pour l'occasion) :

**Scénario 1 — Énigme rapporte Couronnes**
- Avec compte A, résoudre une énigme daily correctement.
- Modale doit afficher `👑 +N Couronnes`.
- Badge Couronnes en haut de carte doit s'incrémenter.
- Vérifier en SQL : `SELECT balance FROM user_crowns WHERE user_id = '<A>'`.

**Scénario 2 — Investissement défense (mécénat)**
- Compte A non membre de l'expé veilleuse d'un lieu.
- Ouvrir la fiche d'un lieu → section "La Cour" charge.
- Cliquer "Soutenir le veilleur" → modale s'ouvre.
- Investir 5 Couronnes → confirmer.
- Vérifier que le toast/feedback est OK, balance Couronnes décrémente, score veilleur a +5.
- Recharger la fiche → top mécènes inclut compte A à 5.

**Scénario 3 — Investissement attaque + bascule**
- Compte B avec une expé challenger sur le lieu (= membre d'une expé qui n'est PAS l'expé veilleuse). Si pas le cas, créer en local.
- Cliquer "Défier" → modale s'ouvre avec scoreToBeat=50 (ou plus si défense).
- Investir au-delà du seuil pour basculer.
- Vérifier `place_veille` : `expedition_id` a changé, `by_influence = true`, `previous_expedition_id` set.
- Compte A doit recevoir le toast "Vous avez perdu Lieu Y".
- Compte B doit recevoir "Vous tenez Lieu Y à distance".

**Scénario 4 — Reset GPS gratuit**
- Compte A (ancien veilleur déchu) plante GPS sur le lieu (RPC `plant_flag`).
- Vérifier `place_veille` : `expedition_id` revient à l'ancien (compte A), `by_influence = false`, `previous_expedition_id = NULL`.
- Compte B reçoit "L'ancien veilleur a repris Lieu Y".
- `place_court_score` du lieu vide.

**Scénario 5 — Confirmation IRL**
- Refaire scénario 3 (B bascule par influence).
- Compte B plante GPS sur le lieu.
- Vérifier `place_veille` : `by_influence = false`, `previous_expedition_id = NULL`.
- Compte A ne peut plus reset gratis (devra basculer comme tout le monde).

**Scénario 6 — Cap silencieux**
- Compte avec balance = 500.
- Résoudre énigme correcte → modale doit afficher `👑 +0 (stock plein)`.
- Balance reste à 500.

- [ ] **Step 3 — Si tout OK, marker la branche prête**

```bash
git status
git log --oneline -20
```

Vérifier qu'aucun fichier de code n'est non-tracké et qu'on a bien tous les commits attendus.

---

## Task 21 — Update `CLAUDE.md` des sous-apps

**Files:**
- Modify: `apps/explore-web/CLAUDE.md`
- Modify: `apps/hub/CLAUDE.md`

- [ ] **Step 1 — explore-web**

Ajouter dans la section "Spécificités cette app" ou créer une mention V0.7 phase 5 :

> V0.7 phase 5 (5 mai 2026) : système "La Cour" — influence à distance via Couronnes. Composants `PlaceCourtView` + `CourtTensionBar` + `PatronsList` + `CourtChronicle` + `InvestCrownsModal` dans `components/places/`. Hook `useCourtNotifications`. Énigmes (daily/place/fragment) rapportent 1/1/2/3 Couronnes. Drop V0.5 : `InfluenceFrame`, `InfluenceToggle`, `users.influence_stock`, tables `place_influence` / `user_place_influence`.

- [ ] **Step 2 — hub**

Ajouter mention "Bascules récentes" dans `Divers.tsx`.

- [ ] **Step 3 — Commit**

```bash
git add apps/explore-web/CLAUDE.md apps/hub/CLAUDE.md
git commit -m "docs: update CLAUDE.md sous-apps pour V0.7 phase 5"
```

---

## Task 22 — Deploy prod

- [ ] **Step 1 — Merge `v07-phase5-la-cour` → `main`**

```bash
git checkout main
git merge v07-phase5-la-cour --no-ff -m "feat: V0.7 phase 5 - La Cour"
```

- [ ] **Step 2 — Bump APP_VERSION**

Vérifier où est `version.ts` ou `APP_VERSION` :

```bash
grep -rn "APP_VERSION\s*=" apps/explore-web/src/ | head -5
```

Bumper le patch (ex: `0.7.X` → `0.7.X+1`).

```bash
git add <fichier_version>
git commit -m "chore: bump APP_VERSION pour V0.7 phase 5"
```

- [ ] **Step 3 — Deploy explore-web**

```bash
pnpm --filter explore-web build
cd apps/explore-web && netlify deploy --prod --dir "$PWD/dist" --no-build
cd ../..
```

- [ ] **Step 4 — Deploy hub**

```bash
pnpm --filter hub build
cd apps/hub && netlify deploy --prod --dir "$PWD/dist" --functions "$PWD/netlify/functions" --no-build
cd ../..
```

- [ ] **Step 5 — Push `main` + branche feature**

```bash
git push origin main
git push origin v07-phase5-la-cour
```

- [ ] **Step 6 — Vérification prod**

- Ouvrir `https://carte.runesdechene.com`
- Résoudre une énigme → vérifier `+N Couronnes` dans la modale
- Ouvrir fiche d'un lieu veillé → vérifier section "La Cour"
- Vérifier que les ex-éléments InfluenceFrame V0.5 ne s'affichent plus
- Hub : vérifier section "Bascules récentes" dans Divers

---

## Task 23 — Communication users

- [ ] **Step 1 — Email d'annonce**

À envoyer après le deploy, contenu type :

> Sujet : Vous voulez veiller un lieu, mais il est trop loin ?
>
> Cher Veilleur,
>
> La Cour vient d'ouvrir ses portes. Désormais, vous pouvez investir vos Couronnes de Chêne pour soutenir, défier ou prendre à distance des lieux que vous ne pouvez atteindre physiquement. Mécène, conquérant ou tacticien — choisissez votre rôle. Mais souvenez-vous : la marche prime toujours sur l'or. Une simple visite IRL réduit à néant les efforts de vos adversaires.
>
> Et bonus : chaque énigme correcte rapporte désormais des Couronnes en plus de la Gloire et de la Coupe.
>
> Bonne diplomatie. — L'équipe Runes de Chêne

- [ ] **Step 2 — Post Instagram**

Visuel Chevalier Errant + texte court annonçant La Cour. Esthétique voie 3 (sombre/contemplatif). Pas de spoilers d'énigmes ni de mécanique fine, juste l'ouverture du système.

---

## Self-Review Checklist (à compléter avant exécution)

- [ ] **Spec coverage** :
  - D1 (faveur 50) → §invest_crowns / §get_place_court_state ✓
  - D2 (expé-vs-expé) → schéma + RPCs ✓
  - D3 (Couronnes brûlées) → invest_crowns débite `user_crowns`, log dans `place_court_action` ✓
  - D4 (veilleur par influence) → colonnes `by_influence` / `previous_expedition_id` ✓
  - D5 (visibilité asymétrique) → `get_place_court_state` retourne `menaceHaute` (membre veilleur) OU `scoreToBeat` (challenger) ✓
  - D6 (reset GPS) → `plant_flag` cas A/B/C ✓
  - D7 (énigmes 1/1/2/3) → mig 080 ✓
  - D8 (cap silencieux) → `LEAST(500, ...)` ✓
  - D9 (drop V0.5) → mig 077 ✓
  - D10 (notifs 1×/jour cap) → `invest_crowns` check `created_at::date = current_date` ✓
  - D11 (top mécènes cumulatif) → `get_place_court_state` agrège `place_court_action` ✓
  - D12 (sprint unique) → 6 migs + 16 tasks frontend en série ✓

- [ ] **Placeholder scan** :
  - `[PLACER ICI ...]` dans Task 1 et Task 6 et Task 5 → assumé : à compléter au moment de l'exécution avec le verbatim de la mig précédente. Doc explicite.

- [ ] **Type consistency** : `PlaceCourtState`, `Patron`, `ChronicleEntry`, `Threat` — utilisés cohérents partout.

- [ ] **Risque major** : la modif de `plant_flag` (Task 5) est la plus délicate — elle dépend de la structure réelle de la mig 067. Prévoir 30-60 min de prudence sur cette task spécifiquement.

- [ ] **Hors scope reconfirmé** :
  - Push notifications : non
  - Toggle "Tension" carte globale : non
  - `mecene_principal_lost` notif : non (V2)
  - Création/sélection expé challenger pour "Défier" sans expé : V2 minimal (bouton désactivé si pas d'expé challenger active sur le lieu)
  - Marker variant `by_influence` : V2 si la donnée carte ne l'expose pas déjà

---

**Plan ready.** Estimation : ~12-16h de travail si tout va bien (migrations 6h + frontend 6h + tests/deploy 2h). Festival 12 mai = J+7, marge confortable.
