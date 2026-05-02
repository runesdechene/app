# Micro-social emoji + notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre aux voyageurs (1) de poser une note texte ≤200 char visible 24h sur leur avatar, (2) de réagir avec des emojis sur la note d'un autre voyageur, (3) de lancer des emojis qui volent en arc d'un avatar à l'autre façon Zenly (surclick libre, visible par tous), (4) de mute soft un voyageur. Pas de notif push, pas de stockage des emoji-throws (temps réel pur).

**Architecture:** Notes et réactions stockées en DB (persistance courte 24h via filtrage WHERE). Emoji-throws diffusés via Supabase Realtime broadcast channel `emoji-throws` (zéro DB). Les RPCs `react_to_note` et `throw_emoji` valident l'emoji contre une whitelist `allowed_emojis` (~33 emojis curés RdC). Animations CSS via `offset-path: path(...)` pour les courbes en arc. Mute soft via colonne array `users.muted_user_ids`.

**Tech Stack:** Supabase (Postgres + Realtime broadcast), React 18 + TypeScript strict, Zustand, MapLibre GL, CSS animations natives.

**Spec source:** [`docs/superpowers/specs/2026-05-02-v07-micro-social-emoji-notes-design.md`](../specs/2026-05-02-v07-micro-social-emoji-notes-design.md).

---

## File Structure

### Créés

- `supabase/migrations/055_v07_micro_social_emoji_notes.sql` — schéma complet : colonnes notes, tables `note_reactions`/`note_reports`/`allowed_emojis`, colonne `muted_user_ids`, RPCs
- `apps/explore-web/src/hooks/useUserNote.ts` — édition de sa propre note + fetch
- `apps/explore-web/src/hooks/useNoteReactions.ts` — abonnement realtime aux réactions sur sa note
- `apps/explore-web/src/hooks/useEmojiThrows.ts` — abonnement realtime au channel `emoji-throws` + queue d'animations
- `apps/explore-web/src/hooks/useMutedUsers.ts` — fetch + mute/unmute + état local
- `apps/explore-web/src/components/social/NoteBubble.tsx` — bulle parchemin sous l'avatar
- `apps/explore-web/src/components/social/NoteBubble.css`
- `apps/explore-web/src/components/social/NoteReactionsRow.tsx` — pills compteurs sous la note
- `apps/explore-web/src/components/social/NoteReactionsRow.css`
- `apps/explore-web/src/components/social/EmojiPicker.tsx` — popover grille emoji (5×7)
- `apps/explore-web/src/components/social/EmojiPicker.css`
- `apps/explore-web/src/components/social/FlyingEmojiLayer.tsx` — couche animations CSS
- `apps/explore-web/src/components/social/FlyingEmojiLayer.css`
- `apps/explore-web/src/lib/emojiBank.ts` — banque curée RdC (~33 emojis, source frontend de vérité)

### Modifiés

- `apps/explore-web/src/components/map/PlayerProfileModal.tsx` — édition note, bouton mute, bouton signaler
- `apps/explore-web/src/components/map/OnlinePlayerMarkers.tsx` — render NoteBubble + tap → EmojiPicker
- `apps/explore-web/src/components/map/ExploreMap.tsx` — intégrer FlyingEmojiLayer en absolu au-dessus de la carte
- `apps/explore-web/src/stores/playersStore.ts` — ajout des champs `noteText`/`notePostedAt` par joueur
- `apps/explore-web/src/hooks/usePresence.ts` — propager `noteText`/`notePostedAt` dans le payload presence

### Conventions

- **Migrations** : numérotation continue, 055 (suit 054 du brouillage GPS)
- **TypeScript strict** : pas de `any`, pas de `console.log`
- **Performance** : limit 20 animations CSS concurrentes côté `FlyingEmojiLayer`
- **Sécurité** : whitelist emoji côté serveur via `allowed_emojis` table

---

## Task 1 — Migration SQL complète

**Files:**
- Create: `supabase/migrations/055_v07_micro_social_emoji_notes.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- 055_v07_micro_social_emoji_notes.sql
-- V0.7+ Micro-social : notes éphémères 24h + réactions emoji + lancer d'emoji (Zenly-style)

-- ============================================================
-- 1. Notes sur le profil
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS note_text text CHECK (length(note_text) <= 200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS note_posted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_users_active_notes ON users(note_posted_at) WHERE note_posted_at IS NOT NULL;

-- RPC : poser/modifier sa note
CREATE OR REPLACE FUNCTION set_note(p_text text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_text IS NULL OR length(trim(p_text)) = 0 THEN
    RAISE EXCEPTION 'note_empty';
  END IF;
  IF length(p_text) > 200 THEN
    RAISE EXCEPTION 'note_too_long';
  END IF;
  -- Si on repose une note, on wipe les anciennes réactions (clean state)
  DELETE FROM note_reactions WHERE note_user_id = auth.uid();
  UPDATE users
  SET note_text = p_text, note_posted_at = NOW()
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION set_note TO authenticated;

-- RPC : effacer sa note
CREATE OR REPLACE FUNCTION clear_note()
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM note_reactions WHERE note_user_id = auth.uid();
  UPDATE users
  SET note_text = NULL, note_posted_at = NULL
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION clear_note TO authenticated;

-- ============================================================
-- 2. Whitelist emojis curée RdC
-- ============================================================

CREATE TABLE IF NOT EXISTS allowed_emojis (
  emoji text PRIMARY KEY,
  category text NOT NULL,
  display_order integer NOT NULL DEFAULT 0
);

INSERT INTO allowed_emojis (emoji, category, display_order) VALUES
  -- Salutations / chaleur
  ('👋', 'salutation', 1), ('❤️', 'salutation', 2), ('🤝', 'salutation', 3),
  ('😊', 'salutation', 4), ('👏', 'salutation', 5), ('🥰', 'salutation', 6),
  ('🙏', 'salutation', 7),
  -- Nature / éléments
  ('🌳', 'nature', 10), ('🌿', 'nature', 11), ('🍃', 'nature', 12),
  ('🍂', 'nature', 13), ('🌧️', 'nature', 14), ('☀️', 'nature', 15),
  ('🌙', 'nature', 16), ('🔥', 'nature', 17),
  -- Marche / aventure
  ('🥾', 'aventure', 20), ('🪨', 'aventure', 21), ('🗝️', 'aventure', 22),
  ('🪶', 'aventure', 23), ('🦅', 'aventure', 24),
  -- Lieux / patrimoine
  ('⛪', 'patrimoine', 30), ('🏛️', 'patrimoine', 31), ('🛖', 'patrimoine', 32),
  ('🪦', 'patrimoine', 33), ('🪵', 'patrimoine', 34),
  -- Convivial / gourmand
  ('☕', 'convivial', 40), ('🍞', 'convivial', 41), ('🍷', 'convivial', 42),
  -- Esprit / honneur
  ('⚔️', 'esprit', 50), ('🛡️', 'esprit', 51), ('🌫️', 'esprit', 52), ('🐺', 'esprit', 53),
  -- Récompense / hommage
  ('🪙', 'recompense', 60)
ON CONFLICT (emoji) DO NOTHING;

GRANT SELECT ON allowed_emojis TO authenticated;

-- Helper : check qu'un emoji est dans la whitelist
CREATE OR REPLACE FUNCTION is_allowed_emoji(p_emoji text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM allowed_emojis WHERE emoji = p_emoji);
$$;

-- ============================================================
-- 3. Réactions sur notes
-- ============================================================

CREATE TABLE IF NOT EXISTS note_reactions (
  note_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reactor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (note_user_id, reactor_user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_note_reactions_by_note ON note_reactions(note_user_id);

-- RPC : réagir à une note
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
  -- Vérifier que l'auteur a une note active (< 24h)
  SELECT (note_posted_at IS NOT NULL AND note_posted_at >= NOW() - INTERVAL '24 hours')
  INTO v_note_active
  FROM users WHERE id = p_note_user_id;
  IF NOT v_note_active THEN
    RAISE EXCEPTION 'note_not_active';
  END IF;
  -- Vérifier emoji whitelist
  IF NOT is_allowed_emoji(p_emoji) THEN
    RAISE EXCEPTION 'emoji_not_allowed';
  END IF;
  -- Insert (idempotent : 1 emoji par paire user × emoji)
  INSERT INTO note_reactions (note_user_id, reactor_user_id, emoji)
  VALUES (p_note_user_id, auth.uid(), p_emoji)
  ON CONFLICT (note_user_id, reactor_user_id, emoji) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION react_to_note TO authenticated;

-- RPC : récupérer les réactions agrégées sur une note
CREATE OR REPLACE FUNCTION get_note_reactions(p_note_user_id uuid)
RETURNS TABLE(emoji text, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nr.emoji, COUNT(*)::bigint
  FROM note_reactions nr
  JOIN users u ON u.id = nr.note_user_id
  WHERE nr.note_user_id = p_note_user_id
    AND u.note_posted_at IS NOT NULL
    AND u.note_posted_at >= NOW() - INTERVAL '24 hours'
  GROUP BY nr.emoji
  ORDER BY COUNT(*) DESC, nr.emoji;
$$;

GRANT EXECUTE ON FUNCTION get_note_reactions TO authenticated;

-- ============================================================
-- 4. Lancer d'emoji (broadcast realtime, pas de stockage)
-- ============================================================

-- RPC : valide l'emoji, broadcast sur le channel 'emoji-throws'
-- Note : Supabase Realtime ne nécessite pas d'INSERT — le client publie directement
-- via channel.send(). Cette RPC sert uniquement à valider la whitelist côté serveur
-- avant que le client ne broadcast (anti-spoof).
-- En pratique, on choisit ici de FAIRE le broadcast côté serveur via pg_notify pour
-- forcer la validation. Alternative : valider côté client + Postgres function trigger.
-- Implémentation choisie : valider via RPC, le client appelle l'RPC qui retourne OK,
-- puis le client broadcast via channel.send(). Le serveur ne broadcast pas lui-même.
CREATE OR REPLACE FUNCTION validate_emoji_throw(p_emoji text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_allowed_emoji(p_emoji) THEN
    RAISE EXCEPTION 'emoji_not_allowed';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION validate_emoji_throw TO authenticated;

-- ============================================================
-- 5. Mute soft
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS muted_user_ids uuid[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION mute_user(p_target_user_id uuid)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE users
  SET muted_user_ids = array_append(
    array_remove(muted_user_ids, p_target_user_id),  -- anti-doublon
    p_target_user_id
  )
  WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION mute_user TO authenticated;

CREATE OR REPLACE FUNCTION unmute_user(p_target_user_id uuid)
RETURNS void
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE users
  SET muted_user_ids = array_remove(muted_user_ids, p_target_user_id)
  WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION unmute_user TO authenticated;

CREATE OR REPLACE FUNCTION get_muted_user_ids()
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unnest(muted_user_ids) FROM users WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION get_muted_user_ids TO authenticated;

-- ============================================================
-- 6. Modération des notes
-- ============================================================

CREATE TABLE IF NOT EXISTS note_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reporter_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_text_at_report text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_reports_unresolved ON note_reports(created_at DESC);

CREATE OR REPLACE FUNCTION report_note(p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_note text;
BEGIN
  SELECT note_text INTO v_note FROM users WHERE id = p_target_user_id;
  IF v_note IS NULL THEN
    RAISE EXCEPTION 'no_note_to_report';
  END IF;
  INSERT INTO note_reports (reported_user_id, reporter_user_id, note_text_at_report)
  VALUES (p_target_user_id, auth.uid(), v_note);
END;
$$;

GRANT EXECUTE ON FUNCTION report_note TO authenticated;
```

- [ ] **Step 2 : Appliquer la migration en local**

```bash
cd "apps/explore-web" && pnpm dlx supabase db push
```

Expected : ✅ migration `055_v07_micro_social_emoji_notes.sql` appliquée. Vérifier dans Studio que les colonnes/tables sont créées et `allowed_emojis` contient ~33 rows.

- [ ] **Step 3 : Tester les RPCs manuellement**

Via Supabase Studio (local) → SQL Editor, après avoir un user connecté :
```sql
-- Set + clear note
SELECT set_note('Café au pied du chêne, qui passe ?');
SELECT note_text, note_posted_at FROM users WHERE id = auth.uid();
SELECT clear_note();

-- Whitelist
SELECT is_allowed_emoji('👋');     -- true
SELECT is_allowed_emoji('💩');     -- false
SELECT validate_emoji_throw('👋'); -- OK
-- SELECT validate_emoji_throw('💩'); -- raise emoji_not_allowed

-- Mute
SELECT mute_user('00000000-0000-0000-0000-000000000001'::uuid);
SELECT * FROM get_muted_user_ids();
SELECT unmute_user('00000000-0000-0000-0000-000000000001'::uuid);
```

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/055_v07_micro_social_emoji_notes.sql
git commit -m "feat(v0.7+): migration micro-social — notes 24h + reactions + emoji whitelist + mute soft

- users.note_text/note_posted_at + RPCs set_note/clear_note (limite 200 char)
- Table allowed_emojis avec seed ~33 emojis curés RdC
- Table note_reactions + RPC react_to_note (1 emoji par paire user×emoji)
- RPC get_note_reactions (compteurs agrégés, filtrage 24h auto)
- RPC validate_emoji_throw (anti-spoof côté client)
- users.muted_user_ids + RPCs mute/unmute/get
- Table note_reports + RPC report_note"
```

---

## Task 2 — Banque emoji frontend + hooks notes/mute

**Files:**
- Create: `apps/explore-web/src/lib/emojiBank.ts`
- Create: `apps/explore-web/src/hooks/useUserNote.ts`
- Create: `apps/explore-web/src/hooks/useMutedUsers.ts`

- [ ] **Step 1 : Créer la banque emoji frontend**

```typescript
// apps/explore-web/src/lib/emojiBank.ts
// Banque emoji curée RdC — miroir frontend de la table allowed_emojis (mig 055).
// Utilisée pour le rendu du picker. La validation finale est côté serveur.

export interface EmojiEntry {
  emoji: string
  category: 'salutation' | 'nature' | 'aventure' | 'patrimoine' | 'convivial' | 'esprit' | 'recompense'
}

export const EMOJI_BANK: EmojiEntry[] = [
  { emoji: '👋', category: 'salutation' },
  { emoji: '❤️', category: 'salutation' },
  { emoji: '🤝', category: 'salutation' },
  { emoji: '😊', category: 'salutation' },
  { emoji: '👏', category: 'salutation' },
  { emoji: '🥰', category: 'salutation' },
  { emoji: '🙏', category: 'salutation' },
  { emoji: '🌳', category: 'nature' },
  { emoji: '🌿', category: 'nature' },
  { emoji: '🍃', category: 'nature' },
  { emoji: '🍂', category: 'nature' },
  { emoji: '🌧️', category: 'nature' },
  { emoji: '☀️', category: 'nature' },
  { emoji: '🌙', category: 'nature' },
  { emoji: '🔥', category: 'nature' },
  { emoji: '🥾', category: 'aventure' },
  { emoji: '🪨', category: 'aventure' },
  { emoji: '🗝️', category: 'aventure' },
  { emoji: '🪶', category: 'aventure' },
  { emoji: '🦅', category: 'aventure' },
  { emoji: '⛪', category: 'patrimoine' },
  { emoji: '🏛️', category: 'patrimoine' },
  { emoji: '🛖', category: 'patrimoine' },
  { emoji: '🪦', category: 'patrimoine' },
  { emoji: '🪵', category: 'patrimoine' },
  { emoji: '☕', category: 'convivial' },
  { emoji: '🍞', category: 'convivial' },
  { emoji: '🍷', category: 'convivial' },
  { emoji: '⚔️', category: 'esprit' },
  { emoji: '🛡️', category: 'esprit' },
  { emoji: '🌫️', category: 'esprit' },
  { emoji: '🐺', category: 'esprit' },
  { emoji: '🪙', category: 'recompense' },
]

export function isAllowedEmoji(emoji: string): boolean {
  return EMOJI_BANK.some(e => e.emoji === emoji)
}
```

- [ ] **Step 2 : Créer `useUserNote`**

```typescript
// apps/explore-web/src/hooks/useUserNote.ts
import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'

interface UserNote {
  text: string | null
  postedAt: string | null
}

export function useUserNote() {
  const userId = usePlayerStore(s => s.userId)
  const [note, setNote] = useState<UserNote>({ text: null, postedAt: null })
  const [loading, setLoading] = useState(true)

  // Fetch initial
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    async function fetchNote() {
      const { data, error } = await supabase
        .from('users')
        .select('note_text, note_posted_at')
        .eq('id', userId!)
        .single()
      if (cancelled) return
      if (error || !data) {
        setNote({ text: null, postedAt: null })
      } else {
        // Filtrer si > 24h (le serveur n'a pas encore wipe)
        const expired = data.note_posted_at &&
          new Date(data.note_posted_at).getTime() < Date.now() - 24 * 60 * 60 * 1000
        setNote({
          text: expired ? null : data.note_text,
          postedAt: expired ? null : data.note_posted_at,
        })
      }
      setLoading(false)
    }
    fetchNote()
    return () => { cancelled = true }
  }, [userId])

  const setNoteText = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (trimmed.length === 0) {
      const { error } = await supabase.rpc('clear_note')
      if (error) throw error
      setNote({ text: null, postedAt: null })
      return
    }
    if (trimmed.length > 200) throw new Error('note_too_long')
    const { error } = await supabase.rpc('set_note', { p_text: trimmed })
    if (error) throw error
    setNote({ text: trimmed, postedAt: new Date().toISOString() })
  }, [])

  const clearNote = useCallback(async () => {
    const { error } = await supabase.rpc('clear_note')
    if (error) throw error
    setNote({ text: null, postedAt: null })
  }, [])

  return { note, loading, setNoteText, clearNote }
}
```

- [ ] **Step 3 : Créer `useMutedUsers`**

```typescript
// apps/explore-web/src/hooks/useMutedUsers.ts
import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'

export function useMutedUsers() {
  const userId = usePlayerStore(s => s.userId)
  const [mutedIds, setMutedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    async function fetchMuted() {
      const { data, error } = await supabase.rpc('get_muted_user_ids')
      if (cancelled) return
      if (!error && data) {
        const ids = (data as Array<{ user_id: string }>).map(r => r.user_id)
        setMutedIds(new Set(ids))
      }
    }
    fetchMuted()
    return () => { cancelled = true }
  }, [userId])

  const muteUser = useCallback(async (targetId: string) => {
    setMutedIds(prev => new Set([...prev, targetId]))
    const { error } = await supabase.rpc('mute_user', { p_target_user_id: targetId })
    if (error) {
      setMutedIds(prev => { const n = new Set(prev); n.delete(targetId); return n })
      throw error
    }
  }, [])

  const unmuteUser = useCallback(async (targetId: string) => {
    setMutedIds(prev => { const n = new Set(prev); n.delete(targetId); return n })
    const { error } = await supabase.rpc('unmute_user', { p_target_user_id: targetId })
    if (error) {
      setMutedIds(prev => new Set([...prev, targetId]))
      throw error
    }
  }, [])

  const isMuted = useCallback((id: string) => mutedIds.has(id), [mutedIds])

  return { mutedIds, muteUser, unmuteUser, isMuted }
}
```

- [ ] **Step 4 : Commit**

```bash
git add apps/explore-web/src/lib/emojiBank.ts apps/explore-web/src/hooks/useUserNote.ts apps/explore-web/src/hooks/useMutedUsers.ts
git commit -m "feat(v0.7+): banque emoji RdC + hooks useUserNote + useMutedUsers"
```

---

## Task 3 — Hook `useEmojiThrows` + propagation notes via presence

**Files:**
- Create: `apps/explore-web/src/hooks/useEmojiThrows.ts`
- Modify: `apps/explore-web/src/hooks/usePresence.ts`
- Modify: `apps/explore-web/src/stores/playersStore.ts`

- [ ] **Step 1 : Étendre `playersStore` avec `noteText`/`notePostedAt`**

Modifier `apps/explore-web/src/stores/playersStore.ts`. Identifier l'interface du joueur (probablement `OtherPlayer`) et ajouter :

```typescript
noteText?: string | null
notePostedAt?: string | null
```

Et propager ces champs dans `setPlayer` / la signature.

- [ ] **Step 2 : Propager les notes dans `usePresence.ts`**

Modifier le payload de `usePresence.ts` (en plus des modifs faites dans le plan brouillage GPS). Dans `buildPayload()`, fetch + inclure :

```typescript
// Au-dessus de buildPayload, lire la note depuis playerStore (si on l'y a stockée)
// Pour cohérence, on stocke noteText et notePostedAt aussi dans le playerStore principal
```

Ajouter les champs dans `PlayerState` (playerStore.ts) :
```typescript
ownNoteText: string | null
ownNotePostedAt: string | null
setOwnNote: (text: string | null, postedAt: string | null) => void
```

Et faire en sorte que `useUserNote` met à jour ce store en plus de son state local. Modifier `useUserNote.ts` Step 2 pour ajouter `usePlayerStore.getState().setOwnNote(...)` après chaque action.

Dans `usePresence.ts buildPayload`, lire et envoyer :
```typescript
const ownNoteText = state.ownNoteText
const ownNotePostedAt = state.ownNotePostedAt
return {
  // ... champs existants ...
  noteText: ownNoteText,
  notePostedAt: ownNotePostedAt,
}
```

Étendre l'interface `PresencePayload` en conséquence et la propagation dans `setPlayer` du `playersStore`.

- [ ] **Step 3 : Créer `useEmojiThrows`**

```typescript
// apps/explore-web/src/hooks/useEmojiThrows.ts
// Subscribe au channel realtime "emoji-throws" + queue d'animations
// + fonction pour broadcaster un nouveau throw depuis le client courant.
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import { useMutedUsers } from './useMutedUsers'
import { isAllowedEmoji } from '../lib/emojiBank'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface FlyingEmoji {
  id: string                // unique pour le rendu
  fromUserId: string
  toUserId: string
  emoji: string
  startedAt: number         // timestamp ms (départ animation)
}

const MAX_CONCURRENT = 20
const ANIM_DURATION_MS = 1300
const CLIENT_THROTTLE_MS = 100  // 10 throws/sec max par client

export function useEmojiThrows() {
  const userId = usePlayerStore(s => s.userId)
  const { isMuted } = useMutedUsers()
  const [flying, setFlying] = useState<FlyingEmoji[]>([])
  const channelRef = useRef<RealtimeChannel | null>(null)
  const lastThrowAtRef = useRef<number>(0)

  // Cleanup auto des animations terminées
  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - ANIM_DURATION_MS - 200
      setFlying(prev => prev.filter(f => f.startedAt > cutoff))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Subscribe au channel
  useEffect(() => {
    if (!userId) return

    const channel = supabase.channel('emoji-throws')
    channel
      .on('broadcast', { event: 'throw' }, ({ payload }) => {
        const { from, to, emoji } = payload as { from: string; to: string; emoji: string }
        if (!isAllowedEmoji(emoji)) return
        if (isMuted(from)) return
        // On accepte tous les throws — le filtrage "viewport" est laissé au composant FlyingEmojiLayer
        setFlying(prev => {
          if (prev.length >= MAX_CONCURRENT) return prev   // drop si saturé
          return [...prev, {
            id: `${from}-${to}-${Date.now()}-${Math.random()}`,
            fromUserId: from,
            toUserId: to,
            emoji,
            startedAt: Date.now(),
          }]
        })
      })
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [userId, isMuted])

  const throwEmoji = useCallback(async (toUserId: string, emoji: string) => {
    if (!userId) return
    if (!isAllowedEmoji(emoji)) return
    // Client-side throttle
    const now = Date.now()
    if (now - lastThrowAtRef.current < CLIENT_THROTTLE_MS) return
    lastThrowAtRef.current = now

    // Validation côté serveur (anti-spoof emoji)
    const { error } = await supabase.rpc('validate_emoji_throw', { p_emoji: emoji })
    if (error) return

    // Broadcast
    if (channelRef.current && channelRef.current.state === 'joined') {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'throw',
        payload: { from: userId, to: toUserId, emoji },
      })
    }

    // Affichage local immédiat (optimiste)
    setFlying(prev => {
      if (prev.length >= MAX_CONCURRENT) return prev
      return [...prev, {
        id: `${userId}-${toUserId}-${Date.now()}-${Math.random()}`,
        fromUserId: userId,
        toUserId,
        emoji,
        startedAt: Date.now(),
      }]
    })
  }, [userId])

  return { flying, throwEmoji }
}
```

- [ ] **Step 4 : Commit**

```bash
git add apps/explore-web/src/hooks/useEmojiThrows.ts apps/explore-web/src/hooks/usePresence.ts apps/explore-web/src/hooks/useUserNote.ts apps/explore-web/src/stores/playerStore.ts apps/explore-web/src/stores/playersStore.ts
git commit -m "feat(v0.7+): hook useEmojiThrows (channel realtime + queue) + propagation note via presence"
```

---

## Task 4 — Composants `NoteBubble` + `NoteReactionsRow` + hook `useNoteReactions`

**Files:**
- Create: `apps/explore-web/src/components/social/NoteBubble.tsx`
- Create: `apps/explore-web/src/components/social/NoteBubble.css`
- Create: `apps/explore-web/src/components/social/NoteReactionsRow.tsx`
- Create: `apps/explore-web/src/components/social/NoteReactionsRow.css`
- Create: `apps/explore-web/src/hooks/useNoteReactions.ts`

- [ ] **Step 1 : Créer le hook `useNoteReactions`**

```typescript
// apps/explore-web/src/hooks/useNoteReactions.ts
// Fetch + maintien des compteurs de réactions sur la note d'un user (ou la sienne).
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface ReactionCount {
  emoji: string
  count: number
}

export function useNoteReactions(noteUserId: string | null) {
  const [reactions, setReactions] = useState<ReactionCount[]>([])

  const refetch = useCallback(async () => {
    if (!noteUserId) { setReactions([]); return }
    const { data, error } = await supabase.rpc('get_note_reactions', { p_note_user_id: noteUserId })
    if (error || !data) { setReactions([]); return }
    setReactions((data as Array<{ emoji: string; count: number }>).map(r => ({
      emoji: r.emoji,
      count: Number(r.count),
    })))
  }, [noteUserId])

  useEffect(() => { refetch() }, [refetch])

  const addReaction = useCallback(async (targetUserId: string, emoji: string) => {
    const { error } = await supabase.rpc('react_to_note', {
      p_note_user_id: targetUserId,
      p_emoji: emoji,
    })
    if (error) throw error
    if (targetUserId === noteUserId) await refetch()
  }, [noteUserId, refetch])

  return { reactions, refetch, addReaction }
}
```

- [ ] **Step 2 : Créer `NoteBubble.css`**

```css
/* apps/explore-web/src/components/social/NoteBubble.css */
.note-bubble {
  background: #fdf3d6;
  border: 1px solid #c8a874;
  border-radius: 8px;
  padding: 0.4rem 0.6rem;
  max-width: 180px;
  font-size: 0.8rem;
  color: #3a2a1a;
  font-style: italic;
  line-height: 1.3;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
  position: relative;
  pointer-events: auto;
}

.note-bubble::before {
  content: '';
  position: absolute;
  top: -5px;
  left: 50%;
  transform: translateX(-50%) rotate(45deg);
  width: 8px;
  height: 8px;
  background: #fdf3d6;
  border-top: 1px solid #c8a874;
  border-left: 1px solid #c8a874;
}

.note-bubble__author {
  display: block;
  font-size: 0.62rem;
  font-style: normal;
  color: #7a4a1a;
  font-weight: 600;
  margin-bottom: 0.15rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.note-bubble__text {
  word-wrap: break-word;
}
```

- [ ] **Step 3 : Créer `NoteBubble.tsx`**

```tsx
// apps/explore-web/src/components/social/NoteBubble.tsx
import './NoteBubble.css'

interface NoteBubbleProps {
  authorName: string
  text: string
  onTap?: () => void  // pour ouvrir le picker de réaction
}

export function NoteBubble({ authorName, text, onTap }: NoteBubbleProps) {
  return (
    <div className="note-bubble" onClick={onTap}>
      <span className="note-bubble__author">{authorName}</span>
      <div className="note-bubble__text">{text}</div>
    </div>
  )
}
```

- [ ] **Step 4 : Créer `NoteReactionsRow.css`**

```css
/* apps/explore-web/src/components/social/NoteReactionsRow.css */
.note-reactions-row {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.note-reaction-pill {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 10px;
  padding: 1px 5px;
  font-size: 0.78rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  gap: 1px;
}

.note-reaction-pill__count {
  font-size: 0.6rem;
  color: #5a3a1a;
  font-weight: 600;
}
```

- [ ] **Step 5 : Créer `NoteReactionsRow.tsx`**

```tsx
// apps/explore-web/src/components/social/NoteReactionsRow.tsx
import type { ReactionCount } from '../../hooks/useNoteReactions'
import './NoteReactionsRow.css'

interface NoteReactionsRowProps {
  reactions: ReactionCount[]
}

export function NoteReactionsRow({ reactions }: NoteReactionsRowProps) {
  if (reactions.length === 0) return null
  return (
    <div className="note-reactions-row">
      {reactions.map(r => (
        <span key={r.emoji} className="note-reaction-pill">
          <span>{r.emoji}</span>
          <span className="note-reaction-pill__count">{r.count}</span>
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 6 : Commit**

```bash
git add apps/explore-web/src/components/social/NoteBubble.tsx apps/explore-web/src/components/social/NoteBubble.css apps/explore-web/src/components/social/NoteReactionsRow.tsx apps/explore-web/src/components/social/NoteReactionsRow.css apps/explore-web/src/hooks/useNoteReactions.ts
git commit -m "feat(v0.7+): composants NoteBubble + NoteReactionsRow + hook useNoteReactions"
```

---

## Task 5 — Composants `EmojiPicker` + `FlyingEmojiLayer`

**Files:**
- Create: `apps/explore-web/src/components/social/EmojiPicker.tsx`
- Create: `apps/explore-web/src/components/social/EmojiPicker.css`
- Create: `apps/explore-web/src/components/social/FlyingEmojiLayer.tsx`
- Create: `apps/explore-web/src/components/social/FlyingEmojiLayer.css`

- [ ] **Step 1 : Créer `EmojiPicker.css`**

```css
/* apps/explore-web/src/components/social/EmojiPicker.css */
.emoji-picker {
  background: #fff;
  border: 1px solid #d4a574;
  border-radius: 12px;
  padding: 0.4rem;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.2rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  position: relative;
  pointer-events: auto;
  z-index: 100;
}

.emoji-picker::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 7px solid #d4a574;
}

.emoji-picker__pick {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.1s, transform 0.05s;
  user-select: none;
  background: transparent;
  border: none;
}

.emoji-picker__pick:hover { background: #fde6c4; }
.emoji-picker__pick:active { transform: scale(0.92); background: #f9d29a; }
```

- [ ] **Step 2 : Créer `EmojiPicker.tsx`**

```tsx
// apps/explore-web/src/components/social/EmojiPicker.tsx
import { EMOJI_BANK } from '../../lib/emojiBank'
import './EmojiPicker.css'

interface EmojiPickerProps {
  onPick: (emoji: string) => void
}

export function EmojiPicker({ onPick }: EmojiPickerProps) {
  return (
    <div className="emoji-picker" onClick={e => e.stopPropagation()}>
      {EMOJI_BANK.map(({ emoji }) => (
        <button
          key={emoji}
          type="button"
          className="emoji-picker__pick"
          onClick={() => onPick(emoji)}
          aria-label={`Envoyer ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3 : Créer `FlyingEmojiLayer.css`**

```css
/* apps/explore-web/src/components/social/FlyingEmojiLayer.css */
.flying-emoji-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 50;
}

.flying-emoji {
  position: absolute;
  font-size: 1.6rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  pointer-events: none;
  animation: flying-emoji-anim 1.3s ease-out forwards;
  offset-rotate: 0deg;
}

@keyframes flying-emoji-anim {
  0%   { offset-distance: 0%;   opacity: 0; transform: scale(0.5); }
  8%   { opacity: 1; transform: scale(1.2); }
  85%  { offset-distance: 85%;  opacity: 1; transform: scale(1); }
  100% { offset-distance: 100%; opacity: 0; transform: scale(0.7); }
}
```

- [ ] **Step 4 : Créer `FlyingEmojiLayer.tsx`**

```tsx
// apps/explore-web/src/components/social/FlyingEmojiLayer.tsx
// Couche absolue au-dessus de la carte qui rend les emojis volants.
// Reçoit en props la liste des throws actifs et une fonction pour récupérer
// les coordonnées pixel des avatars (from / to) sur la carte.
import { useMemo } from 'react'
import type { FlyingEmoji } from '../../hooks/useEmojiThrows'
import './FlyingEmojiLayer.css'

export interface AvatarPositionResolver {
  (userId: string): { x: number; y: number } | null
}

interface FlyingEmojiLayerProps {
  flying: FlyingEmoji[]
  resolveAvatar: AvatarPositionResolver
  viewportWidth: number
  viewportHeight: number
}

export function FlyingEmojiLayer({
  flying,
  resolveAvatar,
  viewportWidth,
  viewportHeight,
}: FlyingEmojiLayerProps) {
  // Filtrer ceux qui ne sont pas visibles (au moins 1 endpoint hors viewport étendu)
  const visible = useMemo(() => {
    return flying.flatMap(f => {
      const from = resolveAvatar(f.fromUserId)
      const to = resolveAvatar(f.toUserId)
      if (!from || !to) return []
      // Au moins l'un des 2 dans le viewport
      const margin = 100
      const inViewport = (p: { x: number; y: number }) =>
        p.x >= -margin && p.x <= viewportWidth + margin &&
        p.y >= -margin && p.y <= viewportHeight + margin
      if (!inViewport(from) && !inViewport(to)) return []
      // Calculer le sommet de la courbe quadratique (au milieu, surélevé de 60-80px)
      const midX = (from.x + to.x) / 2
      const midY = (from.y + to.y) / 2 - 70
      const path = `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`
      return [{ ...f, path }]
    })
  }, [flying, resolveAvatar, viewportWidth, viewportHeight])

  return (
    <div className="flying-emoji-layer">
      {visible.map(f => (
        <div
          key={f.id}
          className="flying-emoji"
          style={{ offsetPath: `path('${f.path}')` } as React.CSSProperties}
        >
          {f.emoji}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/components/social/EmojiPicker.tsx apps/explore-web/src/components/social/EmojiPicker.css apps/explore-web/src/components/social/FlyingEmojiLayer.tsx apps/explore-web/src/components/social/FlyingEmojiLayer.css
git commit -m "feat(v0.7+): EmojiPicker (grille 5×7) + FlyingEmojiLayer (animations CSS offset-path)"
```

---

## Task 6 — Intégration `PlayerProfileModal` (édition note + mute + signaler)

**Files:**
- Modify: `apps/explore-web/src/components/map/PlayerProfileModal.tsx`

- [ ] **Step 1 : Lire la structure actuelle de `PlayerProfileModal`**

Identifier l'emplacement où ajouter :
- Édition de la note si profil = utilisateur courant
- Affichage de la note + reactions row + bouton signaler si profil d'un autre
- Bouton mute / unmute si profil d'un autre

- [ ] **Step 2 : Ajouter les hooks et imports en haut du composant**

```tsx
import { useUserNote } from '../../hooks/useUserNote'
import { useNoteReactions } from '../../hooks/useNoteReactions'
import { useMutedUsers } from '../../hooks/useMutedUsers'
import { supabase } from '../../lib/supabase'
```

Et au début du composant principal (où on a déjà `userId` du joueur dont on affiche le profil et `currentUserId` de l'utilisateur courant) :

```tsx
const isOwnProfile = profileUserId === currentUserId

// Pour le profil propre : édition de la note
const { note: ownNote, setNoteText, clearNote } = useUserNote()

// Pour le profil d'un autre : récupérer sa note depuis le store des players ou via fetch
// (Le composant existant a probablement déjà un fetch du profil. On ajoute note_text dans la sélection.)

// Reactions sur la note affichée
const { reactions, refetch: refetchReactions, addReaction } = useNoteReactions(profileUserId)

// Mute
const { isMuted, muteUser, unmuteUser } = useMutedUsers()
```

- [ ] **Step 3 : Ajouter le bloc "note" en haut du contenu, juste sous le header**

Si profil propre :
```tsx
<div className="profile-note-edit">
  <label className="profile-note-edit__label">Mon mot du moment</label>
  <textarea
    className="profile-note-edit__input"
    value={ownNote.text || ''}
    onChange={e => { /* géré au blur pour éviter spam RPC */ }}
    onBlur={async e => {
      const text = e.target.value.trim()
      if (text === (ownNote.text || '')) return
      try {
        if (text.length === 0) await clearNote()
        else await setNoteText(text)
      } catch (err) {
        console.error('Failed to save note:', err)
      }
    }}
    maxLength={200}
    placeholder="Laisse un mot pour les autres voyageurs… (24h max, ≤200 char)"
  />
  <div className="profile-note-edit__counter">
    {(ownNote.text || '').length}/200
  </div>
</div>
```

Si profil d'un autre joueur (et qu'il a une note active) :
```tsx
{otherPlayerNote && (
  <div className="profile-note-display">
    <span className="profile-note-display__author">{otherPlayerName}</span>
    <p className="profile-note-display__text">{otherPlayerNote}</p>
    <NoteReactionsRow reactions={reactions} />
    <button
      type="button"
      className="profile-note-display__report"
      onClick={async () => {
        const ok = window.confirm('Signaler cette note pour modération ?')
        if (!ok) return
        try {
          await supabase.rpc('report_note', { p_target_user_id: profileUserId })
          alert('Signalement envoyé.')
        } catch (err) {
          console.error(err)
        }
      }}
    >
      ⚠️ Signaler
    </button>
  </div>
)}
```

- [ ] **Step 4 : Ajouter le bouton mute/unmute si profil d'un autre**

Dans une zone "actions" du modal (à côté d'éventuels boutons existants, ou ajouter un footer) :

```tsx
{!isOwnProfile && (
  <button
    type="button"
    className="profile-action-btn"
    onClick={async () => {
      try {
        if (isMuted(profileUserId)) await unmuteUser(profileUserId)
        else await muteUser(profileUserId)
      } catch (err) {
        console.error(err)
      }
    }}
  >
    {isMuted(profileUserId)
      ? '🔔 Recevoir à nouveau les emojis de ce voyageur'
      : '🔕 Ne plus recevoir d\'emojis de ce voyageur'}
  </button>
)}
```

- [ ] **Step 5 : Étendre la requête de fetch du profil pour inclure `note_text` et `note_posted_at`**

Localiser le `supabase.rpc('get_player_profile', ...)` ou le `.select(...)` existant qui charge le profil. Ajouter `note_text, note_posted_at` à la sélection. Filtrer côté client si `note_posted_at` est trop vieux (> 24h).

Si la RPC `get_player_profile` ne retourne pas ces champs, soit (a) faire un fetch additionnel via `.from('users').select('note_text, note_posted_at').eq('id', profileUserId).single()`, soit (b) **modifier la RPC `get_player_profile`** pour les inclure (préférable). La RPC est dans `supabase/migrations/045_v07_levels_player_profile.sql`. Si modification, créer une nouvelle migration `056_v07_get_player_profile_notes.sql` qui `CREATE OR REPLACE FUNCTION get_player_profile(...)` avec les nouveaux champs.

- [ ] **Step 6 : Ajouter le CSS minimal pour les nouveaux éléments**

Dans `PlayerProfileModal.css` (ou un fichier équivalent) :

```css
.profile-note-edit { margin: 1rem 0; padding: 0.75rem; background: #fdf3d6; border: 1px solid #c8a874; border-radius: 8px; }
.profile-note-edit__label { display: block; font-size: 0.75rem; text-transform: uppercase; color: #7a4a1a; font-weight: 600; margin-bottom: 0.4rem; letter-spacing: 0.04em; }
.profile-note-edit__input { width: 100%; min-height: 60px; border: 1px solid #c8a874; border-radius: 6px; padding: 0.4rem; font-family: inherit; font-style: italic; font-size: 0.9rem; resize: vertical; background: #fff; color: #3a2a1a; }
.profile-note-edit__counter { text-align: right; font-size: 0.7rem; color: #7a4a1a; margin-top: 0.2rem; }
.profile-note-display { margin: 1rem 0; padding: 0.75rem; background: #fdf3d6; border: 1px solid #c8a874; border-radius: 8px; }
.profile-note-display__author { display: block; font-size: 0.65rem; text-transform: uppercase; color: #7a4a1a; font-weight: 600; letter-spacing: 0.04em; margin-bottom: 0.3rem; }
.profile-note-display__text { font-style: italic; color: #3a2a1a; margin: 0 0 0.5rem 0; }
.profile-note-display__report { background: none; border: 1px dashed #b87878; color: #8a4a4a; font-size: 0.75rem; padding: 0.2rem 0.5rem; border-radius: 4px; cursor: pointer; }
.profile-action-btn { width: 100%; margin-top: 0.75rem; padding: 0.5rem; background: #f0e0c0; border: 1px solid #c8a874; border-radius: 6px; cursor: pointer; font-size: 0.9rem; color: #3a2a1a; }
```

- [ ] **Step 7 : Tester in-browser**

Lancer le dev server, ouvrir un profil propre → vérifier édition note. Ouvrir un profil d'un autre (via 2 onglets / 2 comptes) → vérifier l'affichage de la note + bouton mute + signaler.

- [ ] **Step 8 : Commit**

```bash
git add apps/explore-web/src/components/map/PlayerProfileModal.tsx apps/explore-web/src/components/map/PlayerProfileModal.css supabase/migrations/056_v07_get_player_profile_notes.sql
git commit -m "feat(v0.7+): PlayerProfileModal — édition note + bouton mute + signaler"
```

---

## Task 7 — Intégration carte : `OnlinePlayerMarkers` + `ExploreMap`

**Files:**
- Modify: `apps/explore-web/src/components/map/OnlinePlayerMarkers.tsx`
- Modify: `apps/explore-web/src/components/map/ExploreMap.tsx`

- [ ] **Step 1 : Modifier `OnlinePlayerMarkers` pour rendre `NoteBubble` sous chaque avatar avec note**

Lire `OnlinePlayerMarkers.tsx`, identifier la boucle qui rend chaque avatar marker. Ajouter conditionnellement un `<NoteBubble />` :

```tsx
import { NoteBubble } from '../social/NoteBubble'
import { NoteReactionsRow } from '../social/NoteReactionsRow'
import { useNoteReactions } from '../../hooks/useNoteReactions'

// Dans le rendu de chaque player :
{player.noteText && /* TODO check 24h */ (
  <div style={{ position: 'absolute', top: <pos>, left: <pos>, transform: 'translate(-50%, 100%)' }}>
    <NoteBubble authorName={player.name} text={player.noteText} onTap={() => openEmojiPickerForNote(player.userId)} />
    {/* Réactions empilées sous la bulle */}
    {/* Composant petit qui fetch les réactions de ce player.userId — voir useNoteReactions */}
  </div>
)}
```

Pour les réactions, créer un sous-composant inline `<NoteReactionsForPlayer userId={player.userId} />` qui appelle `useNoteReactions(userId)` et rend `NoteReactionsRow`.

**Important** : afficher uniquement à zoom rapproché (≥ 12). Récupérer le zoom courant via le store `useMapStore` ou une prop.

- [ ] **Step 2 : Ajouter le tap sur avatar → ouverture du `EmojiPicker`**

Toujours dans `OnlinePlayerMarkers`, intercepter le `onClick` sur l'avatar marker. Au lieu (ou en plus) d'ouvrir `PlayerProfileModal`, ouvrir un picker au-dessus de l'avatar :

```tsx
const [pickerForUserId, setPickerForUserId] = useState<string | null>(null)
const { throwEmoji } = useEmojiThrows()

// Sur l'avatar :
onClick={() => setPickerForUserId(player.userId)}

// Conditionnel rendu du picker :
{pickerForUserId === player.userId && (
  <div style={{ position: 'absolute', top: <pos avatar>, left: <pos avatar>, transform: 'translate(-50%, -110%)' }}>
    <EmojiPicker onPick={async (emoji) => {
      await throwEmoji(player.userId, emoji)
      // Picker reste ouvert pour le surclick — fermé seulement si tap dehors
    }} />
  </div>
)}

// Tap dehors pour fermer (ajouter un overlay ou écouter onBlur global)
```

Pour fermer au tap dehors, ajouter un effet :
```tsx
useEffect(() => {
  if (!pickerForUserId) return
  const onClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('.emoji-picker') && !target.closest('.player-marker')) {
      setPickerForUserId(null)
    }
  }
  document.addEventListener('click', onClickOutside)
  return () => document.removeEventListener('click', onClickOutside)
}, [pickerForUserId])
```

- [ ] **Step 3 : Modifier `ExploreMap.tsx` pour ajouter `FlyingEmojiLayer`**

Dans `ExploreMap.tsx`, après le rendu de la carte MapLibre :

```tsx
import { FlyingEmojiLayer } from '../social/FlyingEmojiLayer'
import { useEmojiThrows } from '../../hooks/useEmojiThrows'

// Dans le composant :
const { flying } = useEmojiThrows()
const mapRef = useRef<maplibregl.Map | null>(null)
const [viewportSize, setViewportSize] = useState({ w: 0, h: 0 })

// Au mount + sur resize :
useEffect(() => {
  const update = () => {
    setViewportSize({ w: window.innerWidth, h: window.innerHeight })
  }
  update()
  window.addEventListener('resize', update)
  return () => window.removeEventListener('resize', update)
}, [])

// Resolver pour convertir userId → coordonnées pixel sur la carte
const resolveAvatar = useCallback((userId: string) => {
  const map = mapRef.current
  if (!map) return null
  const player = usePlayersStore.getState().players.get(userId)
  // ou usePlayerStore pour soi
  if (!player?.position) return null
  const point = map.project([player.position.lng, player.position.lat])
  return { x: point.x, y: point.y }
}, [])

// Rendu :
<div className="explore-map-container" style={{ position: 'relative' }}>
  <div ref={mapContainerRef} className="explore-map" />
  <FlyingEmojiLayer
    flying={flying}
    resolveAvatar={resolveAvatar}
    viewportWidth={viewportSize.w}
    viewportHeight={viewportSize.h}
  />
</div>
```

**Important** : le `resolveAvatar` doit aussi gérer **soi** (l'utilisateur courant) — utiliser `usePlayerStore.userPosition` si l'userId correspond.

- [ ] **Step 4 : Tester in-browser end-to-end**

```bash
cd "apps/explore-web" && pnpm dev
```

Test 1 — Note :
- Profil propre → écrire une note → blur → vérifier qu'elle apparaît sur ma carte (sous mon avatar) à zoom rapproché
- 2e onglet (autre compte) → vérifier que ma note apparaît sous mon avatar pour lui aussi

Test 2 — Réaction :
- Sur 2e onglet, tap sur ma bulle de note → picker ouvre → choisir 👋
- Vérifier qu'un 👋 vole de l'autre compte vers moi
- Vérifier que le compteur "👋 1" apparaît sous ma note (re-fetch via re-render — peut nécessiter un re-fetch manuel ou un realtime listener pour être instant ; OK acceptable au refresh)

Test 3 — Throw :
- Sur 2e onglet, tap sur l'avatar de mon premier compte → picker → choisir 🔥
- Vérifier que 🔥 vole vers moi
- Surclick : taper plusieurs emojis vite → vérifier rafale

Test 4 — Mute :
- Profil de l'autre → bouton mute → vérifier que ses emojis suivants ne s'affichent plus chez moi

- [ ] **Step 5 : Commit**

```bash
git add apps/explore-web/src/components/map/OnlinePlayerMarkers.tsx apps/explore-web/src/components/map/ExploreMap.tsx
git commit -m "feat(v0.7+): intégration carte — NoteBubble + EmojiPicker au tap + FlyingEmojiLayer"
```

---

## Task 8 — Validation finale, deploy prod, smoke test

**Files:**
- Modify: `apps/explore-web/CHANGELOG.md`

- [ ] **Step 1 : Lint + build**

```bash
cd "apps/explore-web" && pnpm build
```

Expected : build OK sans erreur TypeScript.

- [ ] **Step 2 : Push migration en prod**

```bash
cd "apps/explore-web" && pnpm dlx supabase db push --linked
```

Expected : migrations 055 (et 056 si appliquée) en prod.

- [ ] **Step 3 : Vérifier `allowed_emojis` en prod**

Via Supabase Studio (prod) :
```sql
SELECT count(*) FROM allowed_emojis;
```
Expected : 33.

- [ ] **Step 4 : Deploy frontend (Netlify)**

```bash
cd "apps/explore-web" && netlify deploy --prod --dir "$PWD/dist" --no-build
```

- [ ] **Step 5 : Smoke test prod sur 2 devices**

- Compte A : poser une note "Café au pied du chêne, qui passe ?"
- Compte B : voir la note sur la carte
- Compte B : tap sur la note → réagir avec 👋 → vérifier que A voit "👋 1"
- Compte B : tap sur l'avatar de A → throw 🔥 → vérifier que A voit l'animation
- Compte A : ouvrir le profil de B → mute → B throw un 🌳 → vérifier que A ne voit pas l'animation

- [ ] **Step 6 : Mettre à jour CHANGELOG**

```markdown
## V0.7+ — Micro-social : emoji + notes éphémères

- 📜 Pose une **note** sur ton avatar (≤200 char, visible 24h pour les autres voyageurs)
- 👍 **Réagis** à la note d'un voyageur avec un emoji RdC (compteurs empilés sous la note)
- 🚀 **Lance un emoji** (façon Zenly) en tapant sur l'avatar d'un voyageur — l'emoji vole en arc, surclick autorisé pour les rafales
- 🔕 **Mute soft** un voyageur depuis son profil pour ne plus recevoir ses emojis
- ⚠️ **Signaler** une note inappropriée pour modération
- Banque emoji curée RdC (~33), pas d'Unicode complet
- Pas de notif push — temps réel pur sur la carte
```

```bash
git add apps/explore-web/CHANGELOG.md
git commit -m "docs(v0.7+): changelog micro-social emoji + notes"
git push
```

---

## Récapitulatif

**Effort total estimé** : ~4 jours

| Task | Effort | Sortie |
|---|---|---|
| Task 1 — Migration SQL | ~4h | Schéma complet (notes, reactions, emoji whitelist, mute, reports) |
| Task 2 — Banque + hooks notes/mute | ~2h | `emojiBank.ts`, `useUserNote`, `useMutedUsers` |
| Task 3 — Hook useEmojiThrows + presence | ~3h | Channel realtime, queue d'animations, propagation note via presence |
| Task 4 — NoteBubble + NoteReactionsRow + useNoteReactions | ~3h | Composants UI notes |
| Task 5 — EmojiPicker + FlyingEmojiLayer | ~3h | Picker grille + animations CSS offset-path |
| Task 6 — PlayerProfileModal | ~3h | Édition note, mute, signaler |
| Task 7 — Intégration carte | ~5h | NoteBubble sous avatars, picker au tap, layer animations |
| Task 8 — Deploy prod + smoke test | ~2h | Live en prod, test multi-devices |

**Risques connus** :

- **`offset-path` CSS** : supporté par tous les navigateurs cibles (Chrome/Safari/Firefox récents) — vérifier sur device bas de gamme.
- **Realtime channel** : Supabase a une limite de messages/sec par projet. Le client throttle à 10/sec pour limiter l'impact.
- **Performance avec 50+ avatars + 20 anims** : tester sur device bas de gamme (≤2GB RAM Android). Fallback : réduire `MAX_CONCURRENT` à 10.
- **Réactions live** : pour V0.7+ on accepte que les compteurs ne se mettent à jour qu'au prochain `refetch` ou re-render. Pour vraiment du live, ajouter un channel realtime `note-reactions:{noteUserId}` que l'auteur de la note écoute (V0.7++).
- **Tap dehors pour fermer le picker** : peut entrer en conflit avec d'autres interactions de la carte. Tester sur mobile.

**Conditions de "DONE"** :

- ✅ Migration 055 appliquée en prod
- ✅ Notes éditables depuis profil propre, expirent à 24h, affichées sous l'avatar à zoom rapproché
- ✅ Réactions emoji empilées sous la note du destinataire, compteurs corrects
- ✅ Lancer d'emoji fonctionnel multi-devices avec animation visible
- ✅ Mute soft fonctionnel
- ✅ Bouton signaler fonctionnel (entrée dans `note_reports`)
- ✅ Smoke test 2-devices validé en prod
