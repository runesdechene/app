# Mini-quêtes journalières Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer 4 quêtes journalières fixes (moisson 2 lieux + brouillard 2 lieux + énigme du jour + emoji social) qui rapportent +16 XP/jour max, avec auto-tracking via les actions joueur existantes (RPCs `harvest_crown`, `_answer_enigma_internal`, trigger `_trg_xp_discovered_insert`, RPCs micro-social `throw_emoji`/`react_to_note`). Reset à minuit local. Toast non-intrusif à chaque complétion.

**Architecture:** Tables polymorphes `quest_templates` + `user_quest_progress` (anticipe types futurs `weekly`/`local`/`editorial`/`expedition`). Auto-tracking via RPC `increment_quest_progress` appelée depuis chaque RPC d'action source. Realtime broadcast sur `user-events:{user_id}` à la complétion. Frontend : bouton 🗒️ dans le HUD ouvre `QuestsPanel` (modale).

**Tech Stack:** Supabase (Postgres), Supabase Realtime, React 18 + TypeScript strict, Zustand.

**Spec source:** [`docs/superpowers/specs/2026-05-02-v07-mini-quetes-journalieres-design.md`](../specs/2026-05-02-v07-mini-quetes-journalieres-design.md).

**Dépendance préalable** : Plan micro-social emoji + notes ([`2026-05-02-micro-social-emoji-notes-implementation.md`](2026-05-02-micro-social-emoji-notes-implementation.md)) doit être implémenté en premier — la quête #4 dépend des RPCs `throw_emoji` et `react_to_note`.

---

## File Structure

### Créés

- `supabase/migrations/057_v07_mini_quetes_journalieres.sql` — schéma + seed + RPCs + hooks dans les RPCs existantes
- `apps/explore-web/src/hooks/useUserQuests.ts` — fetch + state local + subscriber realtime quest_completed
- `apps/explore-web/src/components/quests/QuestsPanel.tsx` — modale Tableau de Quêtes du jour
- `apps/explore-web/src/components/quests/QuestsPanel.css`
- `apps/explore-web/src/components/quests/QuestRow.tsx` — une ligne de quête (icône + titre + récompense + état)
- `apps/explore-web/src/components/quests/QuestRow.css`

### Modifiés

- `supabase/migrations/057_*.sql` — modifie aussi `harvest_crown`, `_answer_enigma_internal`, ajoute trigger `_trg_quest_progress_discovered`, modifie `throw_emoji`, `react_to_note` (de la mig 055)
- `apps/explore-web/src/components/map/MobileNavbar.tsx` — bouton 🗒️ ouvre QuestsPanel
- `apps/explore-web/src/stores/toastStore.ts` — éventuel ajout d'un type `quest_completed` si pas déjà présent

### Conventions

- Migration numérotée 057 (suit 056 du plan micro-social — ou 056 si pas créée par micro-social)
- Auto-tracking : `increment_quest_progress` est `SECURITY INVOKER` car appelée depuis des RPCs SECURITY DEFINER (elle hérite des permissions)
- Reset minuit local : `users.timezone` mis à jour à chaque session via le hook frontend

---

## Task 1 — Migration SQL : tables, seed, RPCs

**Files:**
- Create: `supabase/migrations/057_v07_mini_quetes_journalieres.sql`

- [ ] **Step 1 : Écrire la partie schéma + seed**

```sql
-- 057_v07_mini_quetes_journalieres.sql
-- V0.7+ Mini-quêtes journalières : 4 quêtes fixes par jour, reset minuit local

-- ============================================================
-- 1. Schéma
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Paris';

CREATE TABLE IF NOT EXISTS quest_templates (
  id text PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('daily', 'weekly', 'editorial', 'local', 'campement_issued', 'expedition')),
  wording text NOT NULL,
  icon text NOT NULL,
  tracker_kind text NOT NULL,        -- 'discoveries' | 'enigma_attempt' | 'social_action' | 'moisson_claims'
  threshold integer NOT NULL,
  reward_xp integer NOT NULL,
  reward_couronnes integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_quest_progress (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_template_id text NOT NULL REFERENCES quest_templates(id),
  date_local date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  rewarded boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, quest_template_id, date_local)
);

CREATE INDEX IF NOT EXISTS idx_user_quest_progress_today ON user_quest_progress(user_id, date_local);

-- ============================================================
-- 2. Seed des 4 templates
-- ============================================================

INSERT INTO quest_templates (id, type, wording, icon, tracker_kind, threshold, reward_xp, reward_couronnes, display_order) VALUES
  ('daily_moisson', 'daily', 'Récupère la moisson d''au moins 2 lieux', '🪙', 'moisson_claims', 2, 3, 0, 1),
  ('daily_brouillard', 'daily', 'Lève le brouillard sur 2 lieux', '🌫️', 'discoveries', 2, 5, 0, 2),
  ('daily_enigme', 'daily', 'Tente l''énigme du jour', '🗝️', 'enigma_attempt', 1, 5, 0, 3),
  ('daily_emoji', 'daily', 'Lance un emoji à un voyageur ou réagis à sa note', '👋', 'social_action', 1, 3, 0, 4)
ON CONFLICT (id) DO UPDATE SET
  wording = EXCLUDED.wording,
  icon = EXCLUDED.icon,
  threshold = EXCLUDED.threshold,
  reward_xp = EXCLUDED.reward_xp,
  display_order = EXCLUDED.display_order;
```

- [ ] **Step 2 : Ajouter les RPCs (suite de la migration 057)**

```sql
-- ============================================================
-- 3. RPC update_user_timezone
-- ============================================================

CREATE OR REPLACE FUNCTION update_user_timezone(p_timezone text)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE users SET timezone = COALESCE(p_timezone, 'Europe/Paris') WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION update_user_timezone TO authenticated;

-- ============================================================
-- 4. Helper : date locale du user
-- ============================================================

CREATE OR REPLACE FUNCTION _user_date_local(p_user_id uuid)
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (NOW() AT TIME ZONE COALESCE(timezone, 'Europe/Paris'))::date
  FROM users WHERE id = p_user_id;
$$;

-- ============================================================
-- 5. RPC get_user_quests_today
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_quests_today()
RETURNS TABLE(
  template_id text,
  wording text,
  icon text,
  threshold integer,
  reward_xp integer,
  reward_couronnes integer,
  count integer,
  completed boolean,
  display_order integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH today AS (SELECT _user_date_local(auth.uid()) AS d)
  SELECT
    qt.id,
    qt.wording,
    qt.icon,
    qt.threshold,
    qt.reward_xp,
    qt.reward_couronnes,
    COALESCE(uqp.count, 0),
    (uqp.completed_at IS NOT NULL),
    qt.display_order
  FROM quest_templates qt
  LEFT JOIN user_quest_progress uqp
    ON uqp.quest_template_id = qt.id
    AND uqp.user_id = auth.uid()
    AND uqp.date_local = (SELECT d FROM today)
  WHERE qt.type = 'daily' AND qt.active
  ORDER BY qt.display_order;
$$;

GRANT EXECUTE ON FUNCTION get_user_quests_today TO authenticated;

-- ============================================================
-- 6. RPC increment_quest_progress (called by hooks)
-- ============================================================

CREATE OR REPLACE FUNCTION increment_quest_progress(
  p_user_id uuid,
  p_tracker_kind text,
  p_amount integer DEFAULT 1
)
RETURNS TABLE(completed_template_id text, reward_xp integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_local date;
  v_template RECORD;
  v_progress RECORD;
  v_new_count integer;
BEGIN
  v_date_local := _user_date_local(p_user_id);
  IF v_date_local IS NULL THEN RETURN; END IF;

  FOR v_template IN
    SELECT id, threshold, reward_xp, reward_couronnes
    FROM quest_templates
    WHERE type = 'daily' AND active AND tracker_kind = p_tracker_kind
  LOOP
    -- Upsert le progress
    INSERT INTO user_quest_progress (user_id, quest_template_id, date_local, count)
    VALUES (p_user_id, v_template.id, v_date_local, p_amount)
    ON CONFLICT (user_id, quest_template_id, date_local) DO UPDATE SET
      count = user_quest_progress.count + EXCLUDED.count
    RETURNING * INTO v_progress;

    v_new_count := v_progress.count;

    -- Vérifier complétion (1 fois max grâce à completed_at IS NULL)
    IF v_new_count >= v_template.threshold AND v_progress.completed_at IS NULL THEN
      UPDATE user_quest_progress
      SET completed_at = NOW(), rewarded = true
      WHERE user_id = p_user_id
        AND quest_template_id = v_template.id
        AND date_local = v_date_local
        AND completed_at IS NULL
      RETURNING quest_template_id INTO v_template.id;

      -- Attribuer XP via la table users (champ xp_total existant V0.7.0)
      -- Note : adapter selon mécanique XP réelle du projet (peut être un trigger sur autre table)
      UPDATE users SET xp_total = xp_total + v_template.reward_xp
      WHERE id = p_user_id;

      -- Attribuer Couronnes si reward_couronnes > 0 (V0.7+ aucune n'en distribue)
      IF v_template.reward_couronnes > 0 THEN
        -- Réutiliser la mécanique Couronnes existante (table crowns ou équivalent)
        -- À adapter selon l'archi V0.7.0 livrée. Pour les 4 templates V0.7+, reward_couronnes = 0.
        NULL;
      END IF;

      -- Broadcast realtime quest_completed
      PERFORM pg_notify(
        'realtime',
        json_build_object(
          'channel', 'user-events:' || p_user_id::text,
          'event', 'quest_completed',
          'payload', json_build_object(
            'quest_template_id', v_template.id,
            'reward_xp', v_template.reward_xp
          )
        )::text
      );

      completed_template_id := v_template.id;
      reward_xp := v_template.reward_xp;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_quest_progress TO authenticated;
```

- [ ] **Step 3 : Hooker les RPCs existantes (toujours dans la mig 057)**

```sql
-- ============================================================
-- 7. Hooks dans les RPCs d'action existantes
-- ============================================================

-- 7.1 Moisson : modifier harvest_crown pour appeler increment_quest_progress
-- Récupérer la version actuelle (mig 029) et l'enrichir.
-- Pour ne pas dupliquer le code, on préfère un trigger sur la table de récolte.
-- Si la mécanique V0.7.0 utilise une table `crown_harvests` (à vérifier),
-- on ajoute un trigger AFTER INSERT.

CREATE OR REPLACE FUNCTION _trg_quest_progress_moisson()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM increment_quest_progress(NEW.user_id::uuid, 'moisson_claims', 1);
  RETURN NEW;
END;
$$;

-- À adapter au nom réel de la table de récolte. Inspecter mig 021 + 029 pour identifier.
-- Hypothèse : table `crown_harvests(user_id text, place_id text, harvested_at timestamptz)`.
-- Si nom différent, ajuster ICI.
DROP TRIGGER IF EXISTS trg_quest_progress_moisson ON crown_harvests;
CREATE TRIGGER trg_quest_progress_moisson
  AFTER INSERT ON crown_harvests
  FOR EACH ROW EXECUTE FUNCTION _trg_quest_progress_moisson();

-- 7.2 Découvertes : trigger sur la table `discovered_places`
-- Le trigger _trg_xp_discovered_insert (mig 042/049/050) existe déjà sur cette table,
-- on ajoute le nôtre en parallèle, sans toucher à l'existant.

CREATE OR REPLACE FUNCTION _trg_quest_progress_discovered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM increment_quest_progress(NEW.user_id::uuid, 'discoveries', 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quest_progress_discovered ON discovered_places;
CREATE TRIGGER trg_quest_progress_discovered
  AFTER INSERT ON discovered_places
  FOR EACH ROW EXECUTE FUNCTION _trg_quest_progress_discovered();

-- 7.3 Énigme du jour : trigger sur la table `enigma_answers` (ou équivalent)
-- _answer_enigma_internal (mig 003) écrit dans cette table. On hook au INSERT.

CREATE OR REPLACE FUNCTION _trg_quest_progress_enigma()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ne tracker que les réponses à l'énigme DU JOUR (pas les énigmes de fragment)
  IF TG_TABLE_NAME = 'enigma_answers' THEN
    PERFORM increment_quest_progress(NEW.user_id::uuid, 'enigma_attempt', 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quest_progress_enigma ON enigma_answers;
CREATE TRIGGER trg_quest_progress_enigma
  AFTER INSERT ON enigma_answers
  FOR EACH ROW EXECUTE FUNCTION _trg_quest_progress_enigma();

-- 7.4 Emoji social : modifier les RPCs throw_emoji et react_to_note (mig 055)
-- Pour ne pas réécrire les RPCs entières, on les "augmente" via CREATE OR REPLACE.
-- (À recoller intégralement les RPCs du plan micro-social ici, en ajoutant l'appel)

CREATE OR REPLACE FUNCTION react_to_note(p_note_user_id uuid, p_emoji text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_note_active boolean;
BEGIN
  SELECT (note_posted_at IS NOT NULL AND note_posted_at >= NOW() - INTERVAL '24 hours')
  INTO v_note_active
  FROM users WHERE id = p_note_user_id;
  IF NOT v_note_active THEN
    RAISE EXCEPTION 'note_not_active';
  END IF;
  IF NOT is_allowed_emoji(p_emoji) THEN
    RAISE EXCEPTION 'emoji_not_allowed';
  END IF;
  INSERT INTO note_reactions (note_user_id, reactor_user_id, emoji)
  VALUES (p_note_user_id, auth.uid(), p_emoji)
  ON CONFLICT (note_user_id, reactor_user_id, emoji) DO NOTHING;
  -- Hook quête mini-quêtes V0.7+
  PERFORM increment_quest_progress(auth.uid(), 'social_action', 1);
END;
$$;

CREATE OR REPLACE FUNCTION validate_emoji_throw(p_emoji text)
RETURNS void
LANGUAGE plpgsql
VOLATILE        -- était STABLE en mig 055, on passe VOLATILE car increment_quest_progress est volatile
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_allowed_emoji(p_emoji) THEN
    RAISE EXCEPTION 'emoji_not_allowed';
  END IF;
  -- Hook quête mini-quêtes V0.7+
  PERFORM increment_quest_progress(auth.uid(), 'social_action', 1);
END;
$$;
```

**Note importante** : les noms exacts des tables `crown_harvests`, `discovered_places`, `enigma_answers` doivent être confirmés par lecture des migrations 021/029 (moisson), 042/049 (discovered), 003/007 (enigma). Si différents, ajuster les `ON <table>` correspondants. Le pattern reste valide.

- [ ] **Step 4 : Appliquer la migration en local**

```bash
cd "apps/explore-web" && pnpm dlx supabase db push
```

Expected : migration appliquée. Vérifier dans Studio que `quest_templates` contient 4 rows.

- [ ] **Step 5 : Tester `get_user_quests_today` manuellement**

```sql
SELECT * FROM get_user_quests_today();
```

Expected : 4 rows (les 4 quêtes du jour) avec `count = 0`, `completed = false`.

- [ ] **Step 6 : Tester `increment_quest_progress` manuellement**

```sql
-- Simuler une découverte (avec un user_id réel de la base locale)
SELECT * FROM increment_quest_progress(
  '<user-uuid>'::uuid,
  'discoveries',
  1
);
-- Re-fetch
SELECT * FROM get_user_quests_today();
-- count daily_brouillard = 1, completed = false (threshold = 2)

SELECT * FROM increment_quest_progress(
  '<user-uuid>'::uuid,
  'discoveries',
  1
);
SELECT * FROM get_user_quests_today();
-- count daily_brouillard = 2, completed = true, +5 XP attribué
```

- [ ] **Step 7 : Commit**

```bash
git add supabase/migrations/057_v07_mini_quetes_journalieres.sql
git commit -m "feat(v0.7+): migration mini-quêtes journalières — schéma + 4 templates seed + hooks RPCs

- Tables quest_templates + user_quest_progress (polymorphes pour types futurs)
- Seed des 4 dailies : moisson, brouillard, énigme, emoji social
- RPC get_user_quests_today (lookup par date locale du user)
- RPC increment_quest_progress (auto-tracking + completion + XP attribution + broadcast)
- Triggers sur tables d'action : crown_harvests, discovered_places, enigma_answers
- Hooks dans react_to_note et validate_emoji_throw (mig 055) pour social_action
- Colonne users.timezone + RPC update_user_timezone"
```

---

## Task 2 — Hook `useUserQuests` + sync timezone

**Files:**
- Create: `apps/explore-web/src/hooks/useUserQuests.ts`
- Create: `apps/explore-web/src/hooks/useTimezoneSync.ts`

- [ ] **Step 1 : Créer `useTimezoneSync`**

```typescript
// apps/explore-web/src/hooks/useTimezoneSync.ts
// À appeler une fois au niveau App. Met à jour users.timezone à chaque session
// pour que le reset des quêtes journalières soit aligné sur le device.
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'

export function useTimezoneSync() {
  const userId = usePlayerStore(s => s.userId)

  useEffect(() => {
    if (!userId) return
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!tz) return
    supabase.rpc('update_user_timezone', { p_timezone: tz }).then(({ error }) => {
      if (error) {
        // Non-bloquant — tombera sur le default 'Europe/Paris'
      }
    })
  }, [userId])
}
```

- [ ] **Step 2 : Brancher `useTimezoneSync` dans `App.tsx`**

Lire `apps/explore-web/src/App.tsx`, trouver l'endroit où `usePresence()` est déjà appelé, ajouter `useTimezoneSync()` juste à côté :

```tsx
import { useTimezoneSync } from './hooks/useTimezoneSync'

// Dans le composant :
useTimezoneSync()
```

- [ ] **Step 3 : Créer `useUserQuests`**

```typescript
// apps/explore-web/src/hooks/useUserQuests.ts
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import { useToastStore } from '../stores/toastStore'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface UserQuest {
  templateId: string
  wording: string
  icon: string
  threshold: number
  rewardXp: number
  rewardCouronnes: number
  count: number
  completed: boolean
  displayOrder: number
}

interface QuestRow {
  template_id: string
  wording: string
  icon: string
  threshold: number
  reward_xp: number
  reward_couronnes: number
  count: number
  completed: boolean
  display_order: number
}

export function useUserQuests() {
  const userId = usePlayerStore(s => s.userId)
  const addToast = useToastStore(s => s.addToast)
  const [quests, setQuests] = useState<UserQuest[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_user_quests_today')
    if (error || !data) {
      setLoading(false)
      return
    }
    const mapped: UserQuest[] = (data as QuestRow[]).map(r => ({
      templateId: r.template_id,
      wording: r.wording,
      icon: r.icon,
      threshold: r.threshold,
      rewardXp: r.reward_xp,
      rewardCouronnes: r.reward_couronnes,
      count: r.count,
      completed: r.completed,
      displayOrder: r.display_order,
    }))
    setQuests(mapped)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!userId) return
    refetch()
  }, [userId, refetch])

  // Subscriber realtime quest_completed
  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel(`user-events:${userId}`)
    channel
      .on('broadcast', { event: 'quest_completed' }, ({ payload }) => {
        const { quest_template_id, reward_xp } = payload as { quest_template_id: string; reward_xp: number }
        const completed = quests.find(q => q.templateId === quest_template_id)
        if (completed) {
          addToast({
            type: 'quest_completed',
            message: `Quête accomplie : ${completed.wording}`,
            highlights: [completed.wording],
            iconUrl: undefined,
            timestamp: Date.now(),
          })
        } else {
          addToast({
            type: 'quest_completed',
            message: `Quête accomplie · +${reward_xp} XP`,
            highlights: [],
            timestamp: Date.now(),
          })
        }
        refetch()
      })
      .subscribe()
    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [userId, quests, addToast, refetch])

  return { quests, loading, refetch }
}
```

- [ ] **Step 4 : Vérifier que `toastStore` accepte le type `quest_completed`**

Lire `apps/explore-web/src/stores/toastStore.ts`. Si l'union `type` ne contient pas `'quest_completed'`, l'ajouter :

```typescript
type ToastType = 'new_user' | 'quest_completed' | /* ... autres existants ... */
```

Et adapter le rendu dans le composant Toast (probablement `GameToast.tsx`) si une couleur/icône spécifique est attendue. Sinon, fallback sur l'affichage générique.

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/hooks/useUserQuests.ts apps/explore-web/src/hooks/useTimezoneSync.ts apps/explore-web/src/App.tsx apps/explore-web/src/stores/toastStore.ts
git commit -m "feat(v0.7+): hooks useUserQuests + useTimezoneSync — fetch quêtes + subscriber realtime + sync TZ"
```

---

## Task 3 — Composants `QuestRow` + `QuestsPanel`

**Files:**
- Create: `apps/explore-web/src/components/quests/QuestRow.tsx`
- Create: `apps/explore-web/src/components/quests/QuestRow.css`
- Create: `apps/explore-web/src/components/quests/QuestsPanel.tsx`
- Create: `apps/explore-web/src/components/quests/QuestsPanel.css`

- [ ] **Step 1 : Créer `QuestRow.css`**

```css
/* apps/explore-web/src/components/quests/QuestRow.css */
.quest-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  background: rgba(245, 235, 210, 0.55);
  border: 1px solid rgba(120, 90, 40, 0.18);
  transition: opacity 0.2s;
}

.quest-row--completed {
  background: rgba(180, 220, 180, 0.35);
  border-color: rgba(80, 140, 80, 0.4);
  opacity: 0.7;
}

.quest-row__icon {
  font-size: 1.6rem;
  flex-shrink: 0;
  line-height: 1.1;
}

.quest-row__body {
  flex: 1;
  min-width: 0;
}

.quest-row__title {
  font-size: 1rem;
  line-height: 1.3;
  margin: 0 0 0.3rem 0;
  color: #3a2a1a;
}

.quest-row--completed .quest-row__title {
  text-decoration: line-through;
  color: #5a4a3a;
}

.quest-row__progress {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  color: #7a4a1a;
  margin-bottom: 0.3rem;
}

.quest-row__bar {
  flex: 1;
  height: 6px;
  background: rgba(120, 90, 40, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.quest-row__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #c8a874, #a07a4a);
  transition: width 0.3s;
}

.quest-row__reward {
  font-size: 0.85rem;
  font-weight: 600;
  color: #5a3a1a;
  background: rgba(255, 255, 255, 0.6);
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
  display: inline-block;
}

.quest-row--completed .quest-row__reward {
  background: rgba(180, 220, 180, 0.6);
  color: #3a5a3a;
}

.quest-row__check {
  color: #3a7a3a;
  font-size: 1.2rem;
  flex-shrink: 0;
  align-self: center;
}
```

- [ ] **Step 2 : Créer `QuestRow.tsx`**

```tsx
// apps/explore-web/src/components/quests/QuestRow.tsx
import type { UserQuest } from '../../hooks/useUserQuests'
import './QuestRow.css'

interface QuestRowProps {
  quest: UserQuest
}

export function QuestRow({ quest }: QuestRowProps) {
  const progressPct = Math.min(100, (quest.count / quest.threshold) * 100)
  const className = quest.completed ? 'quest-row quest-row--completed' : 'quest-row'

  return (
    <div className={className}>
      <div className="quest-row__icon">{quest.icon}</div>
      <div className="quest-row__body">
        <p className="quest-row__title">{quest.wording}</p>
        {!quest.completed && quest.threshold > 1 && (
          <div className="quest-row__progress">
            <span>{quest.count} / {quest.threshold}</span>
            <div className="quest-row__bar">
              <div className="quest-row__bar-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}
        <span className="quest-row__reward">+{quest.rewardXp} XP{quest.rewardCouronnes > 0 ? ` · +${quest.rewardCouronnes} 🪙` : ''}</span>
      </div>
      {quest.completed && <div className="quest-row__check">✓</div>}
    </div>
  )
}
```

- [ ] **Step 3 : Créer `QuestsPanel.css`**

```css
/* apps/explore-web/src/components/quests/QuestsPanel.css */
.quests-panel-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(40, 30, 20, 0.55);
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.quests-panel {
  background: #fdf3d6;
  border: 1px solid #c8a874;
  border-radius: 12px;
  max-width: 480px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  font-size: 16px;
  color: #3a2a1a;
}

.quests-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(120, 90, 40, 0.18);
}

.quests-panel__title-block {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.quests-panel__title {
  margin: 0;
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.5rem;
  color: #5a3a1a;
}

.quests-panel__date {
  font-size: 0.8rem;
  color: #7a4a1a;
  opacity: 0.85;
}

.quests-panel__close {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #7a4a1a;
  padding: 0;
  width: 2rem;
  height: 2rem;
}

.quests-panel__body {
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.quests-panel__footer {
  padding: 0.75rem 1.25rem;
  border-top: 1px solid rgba(120, 90, 40, 0.1);
  font-size: 0.78rem;
  color: #7a4a1a;
  text-align: center;
  opacity: 0.8;
}
```

- [ ] **Step 4 : Créer `QuestsPanel.tsx`**

```tsx
// apps/explore-web/src/components/quests/QuestsPanel.tsx
import { useUserQuests } from '../../hooks/useUserQuests'
import { QuestRow } from './QuestRow'
import './QuestsPanel.css'

interface QuestsPanelProps {
  isOpen: boolean
  onClose: () => void
}

function formatDateLocal(): string {
  const now = new Date()
  return now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formatResetTime(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return tomorrow.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function QuestsPanel({ isOpen, onClose }: QuestsPanelProps) {
  const { quests, loading } = useUserQuests()

  if (!isOpen) return null

  const completedCount = quests.filter(q => q.completed).length

  return (
    <div className="quests-panel-backdrop" onClick={onClose}>
      <div className="quests-panel" onClick={e => e.stopPropagation()}>
        <div className="quests-panel__header">
          <div className="quests-panel__title-block">
            <h2 className="quests-panel__title">Quêtes du jour</h2>
            <span className="quests-panel__date">
              {formatDateLocal()} · {completedCount} / {quests.length} accomplies
            </span>
          </div>
          <button className="quests-panel__close" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="quests-panel__body">
          {loading ? (
            <p style={{ opacity: 0.7, textAlign: 'center' }}>Chargement…</p>
          ) : quests.length === 0 ? (
            <p style={{ opacity: 0.7, textAlign: 'center' }}>Pas de quêtes aujourd'hui.</p>
          ) : (
            quests.map(q => <QuestRow key={q.templateId} quest={q} />)
          )}
        </div>
        <div className="quests-panel__footer">
          Reset à minuit · prochaine échéance ≈ {formatResetTime()}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/components/quests/QuestRow.tsx apps/explore-web/src/components/quests/QuestRow.css apps/explore-web/src/components/quests/QuestsPanel.tsx apps/explore-web/src/components/quests/QuestsPanel.css
git commit -m "feat(v0.7+): composants QuestRow + QuestsPanel"
```

---

## Task 4 — Bouton 🗒️ dans le HUD

**Files:**
- Modify: `apps/explore-web/src/components/map/MobileNavbar.tsx`

- [ ] **Step 1 : Lire la structure de `MobileNavbar.tsx`** et repérer où ajouter le bouton

- [ ] **Step 2 : Ajouter l'état + le bouton + le rendu**

```tsx
import { useState } from 'react'
import { QuestsPanel } from '../quests/QuestsPanel'
import { useUserQuests } from '../../hooks/useUserQuests'

// Dans le composant :
const [questsOpen, setQuestsOpen] = useState(false)
const { quests } = useUserQuests()
const incompleteCount = quests.filter(q => !q.completed).length

// Dans le rendu de la navbar, ajouter un bouton (style cohérent avec les autres) :
<button
  type="button"
  className="mobile-navbar__btn"   /* ou la classe existante */
  onClick={() => setQuestsOpen(true)}
  aria-label="Quêtes du jour"
>
  🗒️
  {incompleteCount > 0 && (
    <span className="mobile-navbar__btn-badge">{incompleteCount}</span>
  )}
</button>

// À la fin du composant (avec les autres modales) :
<QuestsPanel isOpen={questsOpen} onClose={() => setQuestsOpen(false)} />
```

- [ ] **Step 3 : (Optionnel) ajouter du CSS pour le badge si pas existant**

Si `mobile-navbar__btn-badge` n'existe pas, l'ajouter dans le CSS de la navbar :
```css
.mobile-navbar__btn-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: #d4a574;
  color: white;
  border-radius: 9px;
  font-size: 0.7rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 4 : Tester in-browser**

```bash
cd "apps/explore-web" && pnpm dev
```

- Bouton 🗒️ visible avec badge "4" (4 quêtes pas encore faites)
- Click → modale s'ouvre, 4 quêtes affichées avec count 0/threshold
- Faire une action déclencheur (ex : lever le brouillard sur 1 lieu) → vérifier que le compteur passe à 1/2 (refresh manuel pour V0.7+, OK)
- Lever le brouillard sur un 2e lieu → toast "Quête accomplie : Lève le brouillard sur 2 lieux" + ✓ dans la modale + +5 XP

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/components/map/MobileNavbar.tsx
git commit -m "feat(v0.7+): bouton 🗒️ Quêtes du jour dans la navbar (avec badge)"
```

---

## Task 5 — Validation finale, deploy prod, smoke test

**Files:**
- Modify: `apps/explore-web/CHANGELOG.md`

- [ ] **Step 1 : Lint + build**

```bash
cd "apps/explore-web" && pnpm build
```

- [ ] **Step 2 : Push migration en prod**

```bash
cd "apps/explore-web" && pnpm dlx supabase db push --linked
```

- [ ] **Step 3 : Vérifier `quest_templates` en prod**

```sql
SELECT * FROM quest_templates WHERE type = 'daily';
```
Expected : 4 rows.

- [ ] **Step 4 : Deploy frontend**

```bash
cd "apps/explore-web" && netlify deploy --prod --dir "$PWD/dist" --no-build
```

- [ ] **Step 5 : Smoke test prod**

- Compte test : ouvrir l'app, cliquer 🗒️ → 4 quêtes du jour visibles
- Compléter chaque quête à tour de rôle :
  - Lever le brouillard sur 2 lieux (créer 2 découvertes) → toast + ✓ + +5 XP
  - Récupérer la moisson de 2 lieux veillés → toast + +3 XP
  - Tenter l'énigme du jour → toast + +5 XP
  - Lancer un emoji à un voyageur (avec le micro-social déjà déployé) → toast + +3 XP
- Vérifier le total XP gagné : +16 XP
- Attendre minuit local → vérifier que les quêtes se réinitialisent (ou simuler en avançant le device de quelques heures)

- [ ] **Step 6 : Mettre à jour CHANGELOG**

```markdown
## V0.7+ — Mini-quêtes journalières

- 🗒️ **Tableau de Quêtes du jour** accessible via la navbar (badge avec nb de quêtes restantes)
- 4 quêtes fixes par jour (reset minuit local) :
  - 🪙 Récupère la moisson d'au moins 2 lieux (+3 XP)
  - 🌫️ Lève le brouillard sur 2 lieux (+5 XP)
  - 🗝️ Tente l'énigme du jour (+5 XP)
  - 👋 Lance un emoji à un voyageur ou réagis à sa note (+3 XP)
- **Toasts** non-intrusifs à chaque complétion
- Auto-tracking via les actions joueur existantes — aucune action explicite à faire
```

```bash
git add apps/explore-web/CHANGELOG.md
git commit -m "docs(v0.7+): changelog mini-quêtes journalières"
git push
```

---

## Récapitulatif

**Effort total estimé** : ~2.5 jours

| Task | Effort | Sortie |
|---|---|---|
| Task 1 — Migration SQL | ~4h | Schéma + seed + RPCs + 3 triggers + 2 RPCs hookées |
| Task 2 — Hooks useUserQuests + useTimezoneSync | ~2h | Fetch + state + realtime listener |
| Task 3 — QuestRow + QuestsPanel | ~3h | UI complète |
| Task 4 — Bouton navbar | ~1h | Bouton 🗒️ avec badge |
| Task 5 — Deploy prod + smoke test | ~2h | Live |

**Risques connus** :

- **Noms de tables incertains** : `crown_harvests`, `discovered_places`, `enigma_answers` à confirmer en lisant les migrations 021/029, 042/049, 003/007 respectivement. Si les noms diffèrent, ajuster les triggers en conséquence.
- **`pg_notify('realtime', ...)`** : la syntaxe exacte pour broadcaster un event Supabase Realtime depuis Postgres dépend de la config du projet. Alternative robuste : faire un INSERT dans une table tampon `realtime_events` et écouter via `supabase.channel().on('postgres_changes', ...)`. Si `pg_notify` ne fonctionne pas en prod, basculer sur cette approche.
- **Mécanique XP** : `UPDATE users SET xp_total = xp_total + N` est l'approche directe. Si le projet a une fonction `add_user_xp(p_user, p_amount)` à utiliser à la place (V0.7.0 mig 040+), l'appeler. Vérifier avec `_user_level_state` (mig 047).
- **Triggers idempotents** : si on re-applique la mig en prod, `DROP TRIGGER IF EXISTS` garantit l'idempotence.

**Conditions de "DONE"** :

- ✅ Migration 057 appliquée en prod
- ✅ 4 quêtes du jour visibles dans le panel
- ✅ Auto-tracking fonctionnel pour les 4 trackers (moisson, discoveries, enigma_attempt, social_action)
- ✅ Toast affiché à chaque complétion
- ✅ +XP attribué (visible sur le profil)
- ✅ Reset journalier à minuit local
- ✅ Smoke test prod validé sur 1 device avec les 4 quêtes complétées
