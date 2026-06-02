# Défis & Missions — Étape 1 (app) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer côté app (explore-web + DB) les Défis (perso pool tournant + communautaire à compteur partagé) et l'ossature des Missions (entité + fenêtre joueur + salon commun), butin en Couronnes/XP.

**Architecture:** Réutilise le moteur de quêtes mig 056 (Défis perso), ajoute `community_quests` (compteur partagé + récompense de tous les contributeurs) et `missions`/`mission_*` (entité + salon realtime calqué sur le chat d'Expédition). Le front consolide tout dans `QuestsBoardPanel` (3 sections) + une `MissionModal` plein écran. Butin avancé (Gloire/titre/code) = Étape 2.

**Tech Stack:** Supabase (Postgres, RPC SECURITY DEFINER, triggers, Realtime postgres_changes), React 18 + Vite + TS strict, Zustand. **Aucun runner de test** : vérifs par SQL d'assertion (Supabase MCP `execute_sql`), `pnpm --filter explore-web build` (tsc strict), et contrôle navigateur.

**Conventions repo (rappels) :** migrations numérotées `supabase/migrations/NNN_*.sql` (prochaine = **183**) ; `users.id` = `varchar(255)` → tous les `user_id` en `text` ; RPC `SECURITY DEFINER SET search_path TO 'public'` ; pas de `any` ; pas de `console.log` en prod ; `.env` à la **racine du monorepo** (préfixe `VITE_`).

---

## File Structure

**Migrations (DB) :**
- Create: `supabase/migrations/183_community_quests.sql` — défi communautaire (tables + trigger + récompense)
- Create: `supabase/migrations/184_missions_schema.sql` — `missions` + participants + salon (tables + RPCs)
- Create: `supabase/migrations/185_daily_quests_consolidation.sql` — rotation pool + consolidation `get_today_quests_state`
- Create: `supabase/migrations/186_seed_daily_quest_pool.sql` — bibliothèque de Défis perso curés

**Front explore-web :**
- Create: `apps/explore-web/src/hooks/useRealtimeChat.ts` — chat générique (table + filtre paramétrés), extrait de `useExpeditionChat`
- Modify: `apps/explore-web/src/components/expeditions/ExpeditionChat.tsx` — accepter une source de messages générique (rétro-compat)
- Create: `apps/explore-web/src/lib/missionsApi.ts` — wrappers RPC missions
- Create: `apps/explore-web/src/types/mission.ts` — types Mission/MissionMessage/MissionSubmission
- Create: `apps/explore-web/src/stores/missionsStore.ts` — état missions + `pendingOpenMissionSlug`
- Create: `apps/explore-web/src/components/missions/MissionModal.tsx` + `.css` — fenêtre Mission (onglets Mission/Salon)
- Create: `apps/explore-web/src/components/missions/MissionSalon.tsx` — onglet salon (réutilise ExpeditionChat)
- Create: `apps/explore-web/src/components/quests/CommunityQuestCard.tsx` — carte défi communautaire (barre partagée)
- Create: `apps/explore-web/src/components/quests/MissionEntryCard.tsx` — carte d'entrée Mission dans le HUD
- Modify: `apps/explore-web/src/components/quests/QuestsBoardPanel.tsx` — 3 sections (Défis du jour / Défi de la semaine / Missions)
- Modify: `apps/explore-web/src/stores/dailyQuestsStore.ts` — inchangé d'interface (la RPC consolidée garde le contrat `DailyQuest[]`)
- Modify: `apps/explore-web/src/components/map/MapPage.tsx` (ou `ExpeditionsHud.tsx`) — montage `MissionModal` via `pendingOpenMissionSlug`

---

## Task 1 — Migration `183_community_quests.sql` (défi communautaire)

**Files:**
- Create: `supabase/migrations/183_community_quests.sql`

- [ ] **Step 1 — Trouver l'identifiant `place_type` « château » (pré-requis du seed)**

Exécuter (Supabase MCP `execute_sql` ou psql) :
```sql
SELECT id, title FROM public.place_types ORDER BY title;
```
Expected: noter l'`id` correspondant à « Château » (ex. `chateau`). On le réutilise dans `place_type_filter`. Si aucun type château n'existe, `place_type_filter = NULL` (= n'importe quel lieu) et on garde le wording « lieux ».

- [ ] **Step 2 — Écrire la migration**

```sql
-- 183_community_quests.sql
-- Défi communautaire : objectif collectif à compteur PARTAGÉ global (cycle ~7j).
-- À l'atteinte de la cible, TOUS les contributeurs (>=1) sont récompensés (idempotent).
-- Auto-track via trigger AFTER INSERT ON places (filtré par place_type optionnel).

CREATE TABLE IF NOT EXISTS public.community_quests (
  id            text PRIMARY KEY,                 -- slug ex. 'chateaux_juin'
  wording       text NOT NULL,
  icon          text NOT NULL DEFAULT '🏰',
  tracker_kind  text NOT NULL,                    -- ex. 'place_added'
  place_type_filter text,                         -- NULL = tout lieu ; sinon place_types.id ciblé
  target        integer NOT NULL CHECK (target > 0),
  current_count integer NOT NULL DEFAULT 0,
  starts_at     timestamptz NOT NULL DEFAULT now(),
  ends_at       timestamptz,
  reward_xp       integer NOT NULL DEFAULT 0,
  reward_couronnes integer NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','active','reached','closed')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_quest_contributions (
  quest_id    text NOT NULL REFERENCES public.community_quests(id) ON DELETE CASCADE,
  user_id     text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  count       integer NOT NULL DEFAULT 0,
  rewarded_at timestamptz,
  PRIMARY KEY (quest_id, user_id)
);

GRANT SELECT ON public.community_quests TO authenticated;
GRANT SELECT ON public.community_quest_contributions TO authenticated;

-- ── Incrément + atteinte ──────────────────────────────────────────────
-- Crédite la contribution du user et le compteur partagé de la quête active
-- du bon tracker_kind. À l'atteinte de la cible, récompense tous les contributeurs.
CREATE OR REPLACE FUNCTION public.increment_community_quest(
  p_user_id text, p_tracker_kind text, p_place_type text, p_amount integer DEFAULT 1
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_q RECORD;
  v_contrib RECORD;
BEGIN
  IF p_user_id IS NULL OR p_amount <= 0 THEN RETURN; END IF;

  FOR v_q IN
    SELECT * FROM public.community_quests
     WHERE status = 'active'
       AND tracker_kind = p_tracker_kind
       AND (place_type_filter IS NULL OR place_type_filter = p_place_type)
       AND (ends_at IS NULL OR ends_at > now())
  LOOP
    INSERT INTO public.community_quest_contributions (quest_id, user_id, count)
      VALUES (v_q.id, p_user_id, p_amount)
      ON CONFLICT (quest_id, user_id)
      DO UPDATE SET count = public.community_quest_contributions.count + EXCLUDED.count;

    UPDATE public.community_quests
       SET current_count = current_count + p_amount
       WHERE id = v_q.id
       RETURNING * INTO v_q;

    -- Atteinte → bascule + récompense de tous les contributeurs (idempotent via rewarded_at)
    IF v_q.current_count >= v_q.target AND v_q.status = 'active' THEN
      UPDATE public.community_quests SET status = 'reached' WHERE id = v_q.id;

      FOR v_contrib IN
        SELECT * FROM public.community_quest_contributions
         WHERE quest_id = v_q.id AND rewarded_at IS NULL
      LOOP
        IF v_q.reward_couronnes > 0 THEN
          INSERT INTO public.user_crowns (user_id, balance, updated_at)
            VALUES (v_contrib.user_id, LEAST(500, v_q.reward_couronnes), now())
            ON CONFLICT (user_id) DO UPDATE SET
              balance = LEAST(500, public.user_crowns.balance + v_q.reward_couronnes),
              updated_at = now();
        END IF;
        IF v_q.reward_xp > 0 THEN
          UPDATE public.users SET xp_total = xp_total + v_q.reward_xp
            WHERE id = v_contrib.user_id;
        END IF;
        UPDATE public.community_quest_contributions
           SET rewarded_at = now()
           WHERE quest_id = v_q.id AND user_id = v_contrib.user_id;
      END LOOP;
    END IF;
  END LOOP;
END; $$;

-- ── Trigger sur places (ajout d'un lieu) ──────────────────────────────
CREATE OR REPLACE FUNCTION public._trg_community_quest_place_added()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.author_id IS NOT NULL THEN
    PERFORM public.increment_community_quest(NEW.author_id, 'place_added', NEW.place_type_id, 1);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_community_quest_place_added ON public.places;
CREATE TRIGGER trg_community_quest_place_added
  AFTER INSERT ON public.places
  FOR EACH ROW EXECUTE FUNCTION public._trg_community_quest_place_added();

-- ── Lecture front ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_active_community_quest(p_user_id text)
  RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE WHEN q.id IS NULL THEN NULL ELSE json_build_object(
    'id', q.id, 'wording', q.wording, 'icon', q.icon,
    'target', q.target, 'current', q.current_count,
    'endsAt', q.ends_at,
    'reward', json_build_object('crowns', q.reward_couronnes, 'xp', q.reward_xp),
    'myContribution', COALESCE(c.count, 0)
  ) END
  FROM (SELECT * FROM public.community_quests WHERE status = 'active'
        ORDER BY starts_at DESC LIMIT 1) q
  LEFT JOIN public.community_quest_contributions c
    ON c.quest_id = q.id AND c.user_id = p_user_id;
$$;
GRANT EXECUTE ON FUNCTION public.get_active_community_quest(text) TO authenticated, service_role;
```

- [ ] **Step 3 — Appliquer la migration**

Appliquer via Supabase MCP `apply_migration` (name `183_community_quests`) ou CLI. 
Expected: succès, aucune erreur de contrainte.

- [ ] **Step 4 — Test SQL : compteur partagé + récompense idempotente**

```sql
-- seed une quête active cible=2, reward 5 couronnes
INSERT INTO public.community_quests (id, wording, tracker_kind, target, status, reward_couronnes)
VALUES ('test_cq', 'test', 'place_added', 2, 'active', 5);
-- 2 users contribuent
SELECT public.increment_community_quest('USER_A','place_added',NULL,1);
SELECT public.increment_community_quest('USER_B','place_added',NULL,1);
-- assertions
SELECT current_count, status FROM public.community_quests WHERE id='test_cq';      -- 2, 'reached'
SELECT user_id, rewarded_at IS NOT NULL FROM public.community_quest_contributions WHERE quest_id='test_cq'; -- 2 lignes, rewarded=true
-- re-trigger ne re-paie pas
SELECT public.increment_community_quest('USER_A','place_added',NULL,1);
-- cleanup
DELETE FROM public.community_quests WHERE id='test_cq';
```
Expected: `current_count=2`, `status='reached'`, les 2 contributeurs `rewarded`. Remplacer `USER_A/B` par 2 `users.id` réels.

- [ ] **Step 5 — Commit**

```bash
git add supabase/migrations/183_community_quests.sql
git commit -m "feat(db): défi communautaire à compteur partagé (mig 183)"
```

---

## Task 2 — Migration `184_missions_schema.sql` (entité Mission + salon)

**Files:**
- Create: `supabase/migrations/184_missions_schema.sql`

- [ ] **Step 1 — Écrire la migration (schéma + RPCs)**

```sql
-- 184_missions_schema.sql
-- Missions à thème (pilotées Hub). Salon commun (adhésion ouverte) calqué sur le chat
-- d'Expédition (mig 104/107). La liaison avec l'UGC se fait via hub_photo_submissions.quest_ref = missions.slug.

CREATE TABLE IF NOT EXISTS public.missions (
  slug            text PRIMARY KEY,
  title           text NOT NULL,
  eyebrow         text,
  call            text,
  brief           text,
  emblem          text DEFAULT '🎯',
  cover_image_url text,
  deliverable_kind text NOT NULL DEFAULT 'photo'
                   CHECK (deliverable_kind IN ('photo','video','other')),
  product_handle  text,        -- optionnel : galerie communauté par produit
  cta_label       text,
  cta_url         text,
  starts_at       timestamptz, ends_at timestamptz,
  floor_glory     integer NOT NULL DEFAULT 0,
  floor_crowns    integer NOT NULL DEFAULT 0,
  reward_hint     text,
  salon_intro     text,
  notify_on_launch boolean NOT NULL DEFAULT true,
  featured_on_home boolean NOT NULL DEFAULT false,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','published','passed','archived')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mission_participants (
  mission_slug text NOT NULL REFERENCES public.missions(slug) ON DELETE CASCADE,
  user_id      text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mission_slug, user_id)
);

CREATE TABLE IF NOT EXISTS public.mission_messages (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mission_slug text NOT NULL REFERENCES public.missions(slug) ON DELETE CASCADE,
  user_id      text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content      text NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mission_messages_slug ON public.mission_messages(mission_slug, created_at);

CREATE TABLE IF NOT EXISTS public.mission_message_reads (
  mission_slug text NOT NULL REFERENCES public.missions(slug) ON DELETE CASCADE,
  user_id      text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mission_slug, user_id)
);

GRANT SELECT ON public.missions, public.mission_participants TO authenticated, anon;
GRANT SELECT ON public.mission_messages TO authenticated;

-- Realtime : le client subscribe aux INSERT du salon
ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_messages;

-- ── Adhésion ouverte (relever la mission / entrer au salon) ───────────
CREATE OR REPLACE FUNCTION public.join_mission(p_mission_slug text)
  RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_user_id text := auth.uid()::text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  INSERT INTO public.mission_participants (mission_slug, user_id)
    VALUES (p_mission_slug, v_user_id) ON CONFLICT DO NOTHING;
  RETURN json_build_object('ok', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.join_mission(text) TO authenticated;

-- ── Salon : envoi message (réservé aux participants) ──────────────────
CREATE OR REPLACE FUNCTION public.send_mission_message(p_mission_slug text, p_content text)
  RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_user_id text := auth.uid()::text; v_status text; v_id bigint;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  IF coalesce(length(p_content),0) NOT BETWEEN 1 AND 500 THEN
    RETURN json_build_object('success', false, 'error', 'invalid_content_length'); END IF;
  SELECT status INTO v_status FROM public.missions WHERE slug = p_mission_slug;
  IF v_status IS NULL THEN RETURN json_build_object('success', false, 'error', 'mission_not_found'); END IF;
  IF v_status NOT IN ('published') THEN
    RETURN json_build_object('success', false, 'error', 'salon_closed'); END IF;  -- lecture seule si passed/archived
  IF NOT EXISTS (SELECT 1 FROM public.mission_participants
                 WHERE mission_slug = p_mission_slug AND user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'not_participant'); END IF;
  INSERT INTO public.mission_messages (mission_slug, user_id, content)
    VALUES (p_mission_slug, v_user_id, p_content) RETURNING id INTO v_id;
  RETURN json_build_object('success', true, 'message_id', v_id);
END; $$;
GRANT EXECUTE ON FUNCTION public.send_mission_message(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_mission_messages_read(p_mission_slug text)
  RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_user_id text := auth.uid()::text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'auth_required'; END IF;
  INSERT INTO public.mission_message_reads (mission_slug, user_id, last_read_at)
    VALUES (p_mission_slug, v_user_id, now())
    ON CONFLICT (mission_slug, user_id) DO UPDATE SET last_read_at = now();
  RETURN json_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.mark_mission_messages_read(text) TO authenticated;

-- ── État Mission (fenêtre joueur) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_mission_state(p_slug text)
  RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE WHEN m.slug IS NULL THEN NULL ELSE json_build_object(
    'slug', m.slug, 'title', m.title, 'eyebrow', m.eyebrow, 'call', m.call,
    'brief', m.brief, 'emblem', m.emblem, 'coverImageUrl', m.cover_image_url,
    'deliverableKind', m.deliverable_kind,
    'productHandle', m.product_handle, 'ctaLabel', m.cta_label, 'ctaUrl', m.cta_url,
    'startsAt', m.starts_at, 'endsAt', m.ends_at,
    'floor', json_build_object('glory', m.floor_glory, 'crowns', m.floor_crowns),
    'rewardHint', m.reward_hint, 'salonIntro', m.salon_intro, 'status', m.status,
    'participantsCount', (SELECT count(*) FROM public.mission_participants WHERE mission_slug = m.slug),
    'isParticipant', EXISTS (SELECT 1 FROM public.mission_participants
                             WHERE mission_slug = m.slug AND user_id = auth.uid()::text)
  ) END
  FROM public.missions m WHERE m.slug = p_slug;
$$;
GRANT EXECUTE ON FUNCTION public.get_mission_state(text) TO authenticated, anon;

-- ── Galerie des contributions (médias approuvés liés à la mission) ────
-- Calquée sur get_community_photos_by_product (mig 180/181). N'expose jamais team_note/email.
CREATE OR REPLACE FUNCTION public.get_mission_submissions(p_slug text)
  RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(json_agg(json_build_object(
    'submissionId', s.id, 'imageUrl', i.image_url,
    'submitterName', s.submitter_name, 'createdAt', s.created_at
  ) ORDER BY s.created_at DESC), '[]'::json)
  FROM public.hub_submission_images i
  JOIN public.hub_photo_submissions s ON s.id = i.submission_id
  WHERE s.quest_ref = p_slug
    AND s.status = 'approved' AND i.status = 'approved'
    AND s.consent_brand_usage = true;
$$;
GRANT EXECUTE ON FUNCTION public.get_mission_submissions(text) TO authenticated, anon;

-- ── Statut de MA soumission pour cette mission (pour le bandeau "en attente") ──
CREATE OR REPLACE FUNCTION public.get_my_mission_submission_status(p_slug text)
  RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT status FROM public.hub_photo_submissions
   WHERE quest_ref = p_slug AND user_id = auth.uid()::text
   ORDER BY created_at DESC LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_mission_submission_status(text) TO authenticated;
```

- [ ] **Step 2 — Appliquer la migration** (`apply_migration` name `184_missions_schema`). Expected: succès.

- [ ] **Step 3 — Test SQL : salon réservé aux participants**

```sql
INSERT INTO public.missions (slug, title, status) VALUES ('test_m', 'Test', 'published');
-- non-participant → refus (simuler via SET request.jwt.claim.sub si dispo, sinon vérifier la logique)
SELECT public.get_mission_state('test_m');     -- isParticipant=false, participantsCount=0
-- cleanup
DELETE FROM public.missions WHERE slug='test_m';
```
Expected: `get_mission_state` renvoie l'objet, `isParticipant=false`. (Le test d'autorisation d'envoi se fait en navigateur Task 6.)

- [ ] **Step 4 — Commit**
```bash
git add supabase/migrations/184_missions_schema.sql
git commit -m "feat(db): entité Mission + salon commun realtime (mig 184)"
```

---

## Task 3 — Migration `185_daily_quests_consolidation.sql` (pool tournant + 1 RPC unifiée)

**Files:**
- Create: `supabase/migrations/185_daily_quests_consolidation.sql`

> Objectif : `get_today_quests_state(p_user_id)` (consommée par `QuestsBoardPanel` via `dailyQuestsStore`)
> devient la **source unique** : (a) Défis perso = sous-ensemble **déterministe par date** des templates
> `type='daily'` du moteur 056, rendus avec leur progression réelle. On garde le **contrat de sortie**
> `DailyQuest[]` (`id,type,title,description,icon,progress,target,reward{type,amount},completedAt`).

- [ ] **Step 1 — Écrire la migration**

```sql
-- 185_daily_quests_consolidation.sql
-- Consolide get_today_quests_state sur le moteur quest_templates (mig 056) avec
-- sélection déterministe par date (mêmes défis pour tous le même jour) + progression réelle.

CREATE OR REPLACE FUNCTION public.get_today_quests_state(p_user_id text)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_date date;
  v_pick_count int := 4;          -- taille du lot perso
  v_seed bigint;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN RETURN '[]'::json; END IF;
  v_date := public._user_date_local(p_user_id);
  -- graine stable par jour (mêmes templates pour tous)
  v_seed := ('x' || md5(v_date::text))::bit(32)::bigint;

  RETURN (
    WITH picked AS (
      SELECT qt.*
      FROM public.quest_templates qt
      WHERE qt.type = 'daily' AND qt.active
      ORDER BY ((qt.display_order * 2654435761) # v_seed)   -- tri pseudo-aléatoire déterministe
      LIMIT v_pick_count
    )
    SELECT COALESCE(json_agg(json_build_object(
      'id',          p.id,
      'type',        'daily',
      'title',       p.wording,
      'description', p.wording,
      'icon',        p.icon,
      'progress',    LEAST(COALESCE(up.count,0), p.threshold),
      'target',      p.threshold,
      'reward',      json_build_object(
                       'type', CASE WHEN p.reward_couronnes > 0 THEN 'crowns' ELSE 'xp' END,
                       'amount', CASE WHEN p.reward_couronnes > 0 THEN p.reward_couronnes ELSE p.reward_xp END),
      'completedAt', up.completed_at
    ) ORDER BY p.display_order), '[]'::json)
    FROM picked p
    LEFT JOIN public.user_quest_progress up
      ON up.quest_template_id = p.id AND up.user_id = p_user_id AND up.date_local = v_date
  );
END; $$;
GRANT EXECUTE ON FUNCTION public.get_today_quests_state(text) TO authenticated, service_role;
```

- [ ] **Step 2 — Appliquer** (`apply_migration` name `185_daily_quests_consolidation`). Expected: succès, remplace la version mig 125.

- [ ] **Step 3 — Test SQL : déterminisme par date**

```sql
SELECT json_array_length(public.get_today_quests_state('UN_USER_ID_REEL'));
```
Expected: ≤ 4 ; deux appels le même jour renvoient le **même** ensemble d'`id`. (Remplacer par un `users.id` réel ; nécessite que la session soit ce user — sinon tester la sous-requête `picked` isolément avec une graine fixe.)

- [ ] **Step 4 — Commit**
```bash
git add supabase/migrations/185_daily_quests_consolidation.sql
git commit -m "feat(db): consolide get_today_quests_state sur le moteur 056 + rotation déterministe (mig 185)"
```

---

## Task 4 — Migration `186_seed_daily_quest_pool.sql` (bibliothèque de Défis perso)

**Files:**
- Create: `supabase/migrations/186_seed_daily_quest_pool.sql`

- [ ] **Step 1 — Écrire le seed (ton bonapartiste, tracker_kind existants mig 056)**

```sql
-- 186_seed_daily_quest_pool.sql
-- Bibliothèque de Défis perso (type='daily'), piochés en lot déterministe par get_today_quests_state.
-- tracker_kind existants (mig 056) : discoveries, enigma_attempt, moisson_claims, social_action.
INSERT INTO public.quest_templates
  (id, type, wording, icon, tracker_kind, threshold, reward_xp, reward_couronnes, display_order, active)
VALUES
  ('daily_pool_discover3', 'daily', 'Lève le brouillard sur 3 terres inconnues', '🌫️', 'discoveries', 3, 6, 0, 10, true),
  ('daily_pool_discover5', 'daily', 'Révèle 5 lieux à la communauté', '🗺️', 'discoveries', 5, 10, 0, 11, true),
  ('daily_pool_moisson3',  'daily', 'Récolte la moisson de 3 fiefs', '🪙', 'moisson_claims', 3, 5, 0, 12, true),
  ('daily_pool_enigme',    'daily', 'Affronte l''énigme du jour', '🗝️', 'enigma_attempt', 1, 5, 0, 13, true),
  ('daily_pool_social',    'daily', 'Salue un compagnon de route', '👋', 'social_action', 1, 3, 0, 14, true)
ON CONFLICT (id) DO UPDATE SET
  wording = EXCLUDED.wording, icon = EXCLUDED.icon, threshold = EXCLUDED.threshold,
  reward_xp = EXCLUDED.reward_xp, display_order = EXCLUDED.display_order, active = true;
```

> Note : la maille « châteaux » côté **perso** nécessiterait un `tracker_kind='castle_discoveries'` (nouveau
> trigger filtré par place_type sur `places_discovered`). Hors-scope de ce seed (le « 10 châteaux » vit côté
> **communautaire**, Task 1). Ajout possible ultérieur si on veut un défi perso château.

- [ ] **Step 2 — Appliquer + vérifier**
```sql
SELECT id, wording FROM public.quest_templates WHERE type='daily' AND id LIKE 'daily_pool_%';
```
Expected: 5 lignes.

- [ ] **Step 3 — Commit**
```bash
git add supabase/migrations/186_seed_daily_quest_pool.sql
git commit -m "feat(db): seed bibliothèque de Défis perso (mig 186)"
```

---

## Task 5 — Hook chat générique `useRealtimeChat`

**Files:**
- Create: `apps/explore-web/src/hooks/useRealtimeChat.ts`
- Modify: `apps/explore-web/src/components/expeditions/ExpeditionChat.tsx` (rendre la source de messages injectable, rétro-compat)

> `useExpeditionChat` (src/hooks/useExpeditionChat.ts) est couplé à `voyage_messages`/`voyage_id`.
> On extrait un hook générique paramétré par table + colonne de filtre, sans casser l'existant.

- [ ] **Step 1 — Écrire `useRealtimeChat.ts`** (copie fidèle du pattern existant, paramétré)

```typescript
import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface ChatMessage {
  id: number
  userId: string
  content: string
  createdAt: string
}

interface Options {
  table: string          // ex. 'mission_messages'
  filterField: string    // ex. 'mission_slug'
  filterValue: string | null
  active?: boolean
}

// Subscribe AVANT le fetch initial (capture les INSERT pendant le SELECT, dédup par id).
export function useRealtimeChat({ table, filterField, filterValue, active = true }: Options) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const seen = useRef<Set<number>>(new Set())

  const push = useCallback((m: ChatMessage) => {
    if (seen.current.has(m.id)) return
    seen.current.add(m.id)
    setMessages((prev) => [...prev, m].sort((a, b) => a.id - b.id))
  }, [])

  useEffect(() => {
    if (!filterValue) return
    seen.current = new Set()
    setMessages([])
    let cancelled = false

    const channel = supabase
      .channel(`chat:${table}:${filterValue}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table, filter: `${filterField}=eq.${filterValue}` },
        (payload) => {
          const r = payload.new as Record<string, unknown>
          push({ id: r.id as number, userId: r.user_id as string, content: r.content as string, createdAt: r.created_at as string })
        })
      .subscribe()

    // fetch initial
    supabase.from(table).select('id, user_id, content, created_at')
      .eq(filterField, filterValue).order('id', { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return
        for (const r of data) push({ id: r.id, userId: r.user_id, content: r.content, createdAt: r.created_at })
      })

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [table, filterField, filterValue, push])

  // re-sync au retour de focus tab (parité avec useExpeditionChat)
  useEffect(() => {
    if (!active || !filterValue) return
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      supabase.from(table).select('id, user_id, content, created_at')
        .eq(filterField, filterValue).order('id', { ascending: true })
        .then(({ data }) => { if (data) for (const r of data) push({ id: r.id, userId: r.user_id, content: r.content, createdAt: r.created_at }) })
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [active, table, filterField, filterValue, push])

  return { messages }
}
```

- [ ] **Step 2 — Vérifier le build**

Run: `pnpm --filter explore-web build`
Expected: PASS (tsc strict, 0 erreur). Le hook n'est pas encore consommé — on valide juste qu'il compile.

- [ ] **Step 3 — Commit**
```bash
git add apps/explore-web/src/hooks/useRealtimeChat.ts
git commit -m "feat(explore-web): hook useRealtimeChat générique (table/filtre paramétrés)"
```

---

## Task 6 — Types + API + store Missions

**Files:**
- Create: `apps/explore-web/src/types/mission.ts`
- Create: `apps/explore-web/src/lib/missionsApi.ts`
- Create: `apps/explore-web/src/stores/missionsStore.ts`

- [ ] **Step 1 — `types/mission.ts`**

```typescript
export interface MissionFloor { glory: number; crowns: number }
export interface MissionState {
  slug: string; title: string; eyebrow: string | null; call: string | null
  brief: string | null; emblem: string | null; coverImageUrl: string | null
  deliverableKind: 'photo' | 'video' | 'other'
  productHandle: string | null; ctaLabel: string | null; ctaUrl: string | null
  startsAt: string | null; endsAt: string | null
  floor: MissionFloor; rewardHint: string | null; salonIntro: string | null
  status: 'draft' | 'published' | 'passed' | 'archived'
  participantsCount: number; isParticipant: boolean
}
export interface MissionSubmission {
  submissionId: string; imageUrl: string; submitterName: string; createdAt: string
}
export type MySubmissionStatus = 'pending' | 'approved' | 'archived' | null
```

- [ ] **Step 2 — `lib/missionsApi.ts`** (pattern `expeditionsApi.ts` : `supabase.rpc`)

```typescript
import { supabase } from './supabase'
import type { MissionState, MissionSubmission, MySubmissionStatus } from '../types/mission'

export async function getMissionState(slug: string): Promise<MissionState | null> {
  const { data, error } = await supabase.rpc('get_mission_state', { p_slug: slug })
  if (error) throw error
  return (data as MissionState | null) ?? null
}
export async function getMissionSubmissions(slug: string): Promise<MissionSubmission[]> {
  const { data, error } = await supabase.rpc('get_mission_submissions', { p_slug: slug })
  if (error) throw error
  return (data as MissionSubmission[]) ?? []
}
export async function getMySubmissionStatus(slug: string): Promise<MySubmissionStatus> {
  const { data, error } = await supabase.rpc('get_my_mission_submission_status', { p_slug: slug })
  if (error) throw error
  return (data as MySubmissionStatus) ?? null
}
export async function joinMission(slug: string): Promise<void> {
  const { error } = await supabase.rpc('join_mission', { p_mission_slug: slug })
  if (error) throw error
}
export async function sendMissionMessage(slug: string, content: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('send_mission_message', { p_mission_slug: slug, p_content: content })
  if (error) return { success: false, error: error.message }
  const d = data as { success: boolean; error?: string }
  return { success: d.success, error: d.error }
}
export async function markMissionRead(slug: string): Promise<void> {
  await supabase.rpc('mark_mission_messages_read', { p_mission_slug: slug })
}
```

- [ ] **Step 3 — `stores/missionsStore.ts`** (pattern `dailyQuestsStore`, + `pendingOpenMissionSlug` pour l'orchestration d'ouverture)

```typescript
import { create } from 'zustand'

interface MissionsStoreState {
  pendingOpenMissionSlug: string | null
  openMissionSlug: string | null
  requestOpen: (slug: string) => void
  consumePending: () => void
  close: () => void
}
export const useMissionsStore = create<MissionsStoreState>((set) => ({
  pendingOpenMissionSlug: null,
  openMissionSlug: null,
  requestOpen: (slug) => set({ pendingOpenMissionSlug: slug }),
  consumePending: () => set((s) => ({ openMissionSlug: s.pendingOpenMissionSlug, pendingOpenMissionSlug: null })),
  close: () => set({ openMissionSlug: null }),
}))
```

- [ ] **Step 4 — Build**

Run: `pnpm --filter explore-web build`
Expected: PASS.

- [ ] **Step 5 — Commit**
```bash
git add apps/explore-web/src/types/mission.ts apps/explore-web/src/lib/missionsApi.ts apps/explore-web/src/stores/missionsStore.ts
git commit -m "feat(explore-web): types + API + store Missions"
```

---

## Task 7 — Fenêtre Mission (modale plein écran, onglets Mission/Salon)

**Files:**
- Create: `apps/explore-web/src/components/missions/MissionSalon.tsx`
- Create: `apps/explore-web/src/components/missions/MissionModal.tsx`
- Create: `apps/explore-web/src/components/missions/MissionModal.css`
- Modify: `apps/explore-web/src/components/map/MapPage.tsx` (montage via `pendingOpenMissionSlug`)

> S'inspire de `ExpeditionModal` (createPortal, onglets sticky, tokens parchemin `ExpeditionModal.css`).
> Maquette de référence : `.superpowers/brainstorm/1406-*/content/event-window-v2.html`.

- [ ] **Step 1 — `MissionSalon.tsx`** (réutilise `useRealtimeChat` + le rendu bulles de `ExpeditionChat`)

```tsx
import { useEffect, useState } from 'react'
import { useRealtimeChat } from '../../hooks/useRealtimeChat'
import { sendMissionMessage, markMissionRead } from '../../lib/missionsApi'

export function MissionSalon({ slug, intro, readOnly }: { slug: string; intro: string | null; readOnly: boolean }) {
  const { messages } = useRealtimeChat({ table: 'mission_messages', filterField: 'mission_slug', filterValue: slug })
  const [draft, setDraft] = useState('')
  useEffect(() => { markMissionRead(slug) }, [slug, messages.length])

  async function handleSend() {
    const c = draft.trim()
    if (!c) return
    setDraft('')
    const r = await sendMissionMessage(slug, c)
    if (!r.success) setDraft(c)   // restaure en cas d'échec
  }

  return (
    <div className="mission-salon">
      {intro && <div className="mission-salon-intro">📌 {intro}</div>}
      <div className="mission-salon-messages">
        {messages.map((m) => (
          <div key={m.id} className="mission-salon-msg">
            <span className="mission-salon-author">{m.userId}</span>
            <span className="mission-salon-bubble">{m.content}</span>
          </div>
        ))}
      </div>
      {!readOnly && (
        <div className="mission-salon-input">
          <input value={draft} maxLength={500} onChange={(e) => setDraft(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Écrire au salon…" />
          <button onClick={handleSend}>➤</button>
        </div>
      )}
    </div>
  )
}
```

> Note : le rendu nom d'auteur peut être enrichi (avatar/display_name) en réutilisant un lookup participants
> dans une itération ultérieure. Pour cette étape, l'`user_id` brut suffit (parité fonctionnelle, pas esthétique).

- [ ] **Step 2 — `MissionModal.tsx`** (onglets Mission/Salon, charge l'état + galerie)

```tsx
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getMissionState, getMissionSubmissions, getMySubmissionStatus, joinMission } from '../../lib/missionsApi'
import type { MissionState, MissionSubmission, MySubmissionStatus } from '../../types/mission'
import { MissionSalon } from './MissionSalon'
import './MissionModal.css'

export function MissionModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [m, setM] = useState<MissionState | null>(null)
  const [subs, setSubs] = useState<MissionSubmission[]>([])
  const [myStatus, setMyStatus] = useState<MySubmissionStatus>(null)
  const [tab, setTab] = useState<'mission' | 'salon'>('mission')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const state = await getMissionState(slug)
      setM(state)
      if (state) {
        if (!state.isParticipant) { await joinMission(slug); state.isParticipant = true }
        setSubs(await getMissionSubmissions(slug))
        setMyStatus(await getMySubmissionStatus(slug))
      }
      setLoading(false)
    })()
  }, [slug])

  if (loading || !m) {
    return createPortal(<div className="mission-modal-overlay" onClick={onClose}>
      <div className="mission-modal-loading">Chargement…</div></div>, document.body)
  }

  const daysLeft = m.endsAt ? Math.max(0, Math.ceil((new Date(m.endsAt).getTime() - Date.now()) / 86400000)) : null
  const readOnlySalon = m.status !== 'published'

  return createPortal(
    <div className="mission-modal-overlay" onClick={onClose}>
      <div className="mission-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mission-modal-tabs" role="tablist">
          <button className={tab === 'mission' ? 'is-active' : ''} onClick={() => setTab('mission')}>Mission</button>
          <button className={tab === 'salon' ? 'is-active' : ''} onClick={() => setTab('salon')}>Salon</button>
          <button className="mission-modal-close" onClick={onClose} aria-label="Fermer">×</button>
        </div>

        {tab === 'mission' ? (
          <div className="mission-modal-main">
            <div className="mission-modal-intro">
              <div className="mission-modal-eyebrow">{m.eyebrow ?? 'Mission'} · {m.participantsCount} engagés</div>
              <h2 className="mission-modal-title">{m.title}</h2>
              {m.call && <div className="mission-modal-call">« {m.call} »</div>}
            </div>
            <div className="mission-modal-cover" style={m.coverImageUrl ? { backgroundImage: `url(${m.coverImageUrl})` } : undefined}>
              {daysLeft != null && <span className="mission-modal-jx">J-{daysLeft}</span>}
              {!m.coverImageUrl && <span className="mission-modal-emblem">{m.emblem}</span>}
            </div>

            <section className="mission-modal-section">
              <h3>Butin</h3>
              <div className="mission-modal-rewards">
                {m.floor.glory > 0 && <span className="mm-rw">🎖️ {m.floor.glory} Gloire</span>}
                {m.floor.crowns > 0 && <span className="mm-rw">🪙 {m.floor.crowns} Couronnes</span>}
                {m.rewardHint && <span className="mm-rw gold">{m.rewardHint}</span>}
              </div>
            </section>

            {m.brief && <section className="mission-modal-section"><h3>La mission</h3><p className="mission-modal-brief">{m.brief}</p>
              {m.ctaUrl && <a className="mission-modal-cta" href={m.ctaUrl} target="_blank" rel="noopener noreferrer">🛒 {m.ctaLabel ?? 'Voir le produit'}</a>}
            </section>}

            {myStatus === 'pending' && <div className="mission-modal-status">⏳ Ton offrande est en cours d'examen par l'État-Major.</div>}

            <section className="mission-modal-section">
              <h3>Les contributions · {subs.length}</h3>
              <div className="mission-modal-gallery">
                {subs.map((s) => (
                  <div key={s.submissionId} className="mission-modal-tile" style={{ backgroundImage: `url(${s.imageUrl})` }}>
                    <span className="mission-modal-tile-name">{s.submitterName}</span>
                  </div>
                ))}
              </div>
            </section>

            {m.status === 'published' && (
              <a className="mission-modal-primary" href={`https://hub.runesdechene.com/soumettre-contenu?quete=${m.slug}`}
                 target="_blank" rel="noopener noreferrer">📷 Présenter mon livrable</a>
            )}
          </div>
        ) : (
          <MissionSalon slug={m.slug} intro={m.salonIntro} readOnly={readOnlySalon} />
        )}
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] **Step 3 — `MissionModal.css`** (reprend les tokens parchemin de `ExpeditionModal.css`)

Créer le fichier en s'inspirant de `apps/explore-web/src/components/expeditions/ExpeditionModal.css` :
overlay `rgba(40,30,20,.5)` z-index 9510 ; modale `#f5e9d4`, `100dvh` mobile, `90vh` desktop ;
onglets sticky (cf. `.expedition-modal-mobile-tabs`) ; cover `aspect-ratio:16/9` gradient bronze ;
boutons `#2a1f10`/`#faf2dd` ; galerie `grid repeat(3,1fr)` tuiles `aspect-ratio:1`. (Copier les valeurs
exactes du fichier de référence pour cohérence visuelle.)

- [ ] **Step 4 — Monter la modale via le store** dans `apps/explore-web/src/components/map/MapPage.tsx`

Ajouter (près du montage `ExpeditionsHud`/modales) :
```tsx
import { MissionModal } from '../missions/MissionModal'
import { useMissionsStore } from '../../stores/missionsStore'
// …
const openMissionSlug = useMissionsStore((s) => s.openMissionSlug)
const consumePending = useMissionsStore((s) => s.consumePending)
const closeMission = useMissionsStore((s) => s.close)
useEffect(() => { consumePending() }, [/* déclenché par les ouvertures */])
// …dans le JSX :
{openMissionSlug && <MissionModal slug={openMissionSlug} onClose={closeMission} />}
```
> Suivre exactement le pattern d'orchestration `pendingOpenExpeditionId` repéré dans `ExpeditionsHud`/`MapPage`
> (consume au render). Adapter `consumePending` à un effet déclenché quand `pendingOpenMissionSlug` change.

- [ ] **Step 5 — Build**

Run: `pnpm --filter explore-web build`
Expected: PASS.

- [ ] **Step 6 — Vérif navigateur**

`pnpm --filter explore-web dev`, seed une mission `published` en SQL (`INSERT INTO missions(slug,title,status,call,floor_crowns) VALUES('demo','Démo','published','Test',10)`), déclencher `useMissionsStore.getState().requestOpen('demo')` depuis la console.
Expected: la modale s'ouvre, onglets Mission/Salon fonctionnent, l'envoi d'un message apparaît en realtime, le bouton « Présenter mon livrable » pointe vers `/soumettre-contenu?quete=demo`.

- [ ] **Step 7 — Commit**
```bash
git add apps/explore-web/src/components/missions/ apps/explore-web/src/components/map/MapPage.tsx
git commit -m "feat(explore-web): fenêtre Mission (onglets Mission/Salon, galerie, salon realtime)"
```

---

## Task 8 — QuestsBoardPanel : 3 sections

**Files:**
- Create: `apps/explore-web/src/components/quests/CommunityQuestCard.tsx`
- Create: `apps/explore-web/src/components/quests/MissionEntryCard.tsx`
- Modify: `apps/explore-web/src/components/quests/QuestsBoardPanel.tsx`

- [ ] **Step 1 — `CommunityQuestCard.tsx`** (barre partagée + ma contribution)

```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'

interface CQ { id: string; wording: string; icon: string; target: number; current: number; myContribution: number }

export function CommunityQuestCard() {
  const userId = usePlayerStore((s) => s.userId)
  const [cq, setCq] = useState<CQ | null>(null)
  useEffect(() => {
    if (!userId) return
    supabase.rpc('get_active_community_quest', { p_user_id: userId }).then(({ data }) => setCq(data as CQ | null))
  }, [userId])
  if (!cq) return null
  const pct = Math.min(100, Math.round((cq.current / cq.target) * 100))
  return (
    <div className="community-quest-card">
      <div className="cqc-head">{cq.icon} {cq.wording}</div>
      <div className="cqc-bar"><div className="cqc-bar-fill" style={{ width: `${pct}%` }} /></div>
      <div className="cqc-meta">{cq.current}/{cq.target} · ta contribution : {cq.myContribution}</div>
    </div>
  )
}
```

- [ ] **Step 2 — `MissionEntryCard.tsx`** (carte d'entrée → ouvre la MissionModal)

```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMissionsStore } from '../../stores/missionsStore'

interface ActiveMission { slug: string; title: string; emblem: string | null }

export function MissionEntryCard() {
  const [m, setM] = useState<ActiveMission | null>(null)
  const requestOpen = useMissionsStore((s) => s.requestOpen)
  useEffect(() => {
    supabase.from('missions').select('slug, title, emblem').eq('status', 'published')
      .order('starts_at', { ascending: false }).limit(1)
      .then(({ data }) => setM((data?.[0] as ActiveMission) ?? null))
  }, [])
  if (!m) return null
  return (
    <button className="mission-entry-card" onClick={() => requestOpen(m.slug)}>
      <span className="mec-emblem">{m.emblem ?? '🎯'}</span>
      <span className="mec-title">{m.title}</span>
      <span className="mec-go">→</span>
    </button>
  )
}
```

- [ ] **Step 3 — Modifier `QuestsBoardPanel.tsx`** (3 sections titrées)

Remplacer le bloc `.qbp-content` (repéré lignes ~71-74) par :
```tsx
<div className="qbp-content">
  <section className="qbp-section"><h4 className="qbp-section-title">Défis du jour</h4><DailyQuestsList /></section>
  <section className="qbp-section"><h4 className="qbp-section-title">Le défi de la semaine</h4><CommunityQuestCard /></section>
  <section className="qbp-section"><h4 className="qbp-section-title">Mission</h4><MissionEntryCard /></section>
  <ExpeditionsList onOpenExpedition={onOpenExpedition} />
</div>
```
Ajouter les imports `CommunityQuestCard`, `MissionEntryCard`. Ajouter les styles `.qbp-section-title`,
`.community-quest-card`, `.cqc-*`, `.mission-entry-card`, `.mec-*` dans le CSS du panneau (suivre les
tokens existants du fichier CSS du QuestsBoardPanel).

- [ ] **Step 4 — Build**

Run: `pnpm --filter explore-web build`
Expected: PASS.

- [ ] **Step 5 — Vérif navigateur**

Avec la quête communautaire de test (`active`) + la mission `demo` (`published`) seedées : le HUD montre
les 3 sections, la barre communautaire reflète `current/target`, la carte Mission ouvre la fenêtre.

- [ ] **Step 6 — Commit**
```bash
git add apps/explore-web/src/components/quests/
git commit -m "feat(explore-web): QuestsBoardPanel 3 sections (Défis du jour / semaine / Mission)"
```

---

## Self-review (couverture spec Étape 1)

- Défi communautaire compteur partagé + récompense tous contributeurs → Task 1 ✅
- Défis perso pool tournant déterministe + consolidation 125→056 → Tasks 3, 4 ✅
- Entité Mission + salon commun (adhésion ouverte, lecture seule après fin) → Task 2 ✅
- Fenêtre Mission (onglets, galerie, CTA, statut, deep-link studio) → Tasks 6, 7 ✅
- Chat realtime mutualisé → Task 5 ✅
- QuestsBoardPanel 3 sections → Task 8 ✅
- Butin Étape 1 = Couronnes/XP (communautaire) ; butin Mission avancé (Gloire/titre/code) = **Étape 2** ✅

## Points à valider pendant l'exécution
- `place_type` château réel (Task 1 Step 1) avant tout seed de défi communautaire « châteaux ».
- Pattern exact d'orchestration d'ouverture de modale (`pendingOpen*`) à recopier de `ExpeditionsHud`.
- Si `mission_messages.id` doit afficher des avatars/noms : prévoir un lookup participants (itération UI ultérieure, non bloquant).
```
