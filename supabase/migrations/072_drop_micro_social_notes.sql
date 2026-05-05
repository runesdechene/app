-- 072_drop_micro_social_notes.sql
-- WHY: Sprint Purification (mai 2026) — Uriel doute de l'utilité des notes
--      éphémères (mig 055). On vire la NOTE complètement, on garde l'envoi
--      d'EMOJI (FlyingEmojiLayer + EmojiPicker + RPCs throw_emoji /
--      validate_emoji_throw + table allowed_emojis + mute_user/unmute_user
--      qui restent utilisés pour modérer les emojis-throws).
--
-- Migrations historiques rinçées par ce DROP :
--   - 055 (init notes/réactions/reports + emojis + mute)
--   - 057 (publication realtime users.note_*)
--   - 059 (durcissement set_note/clear_note)
--   - 063 (ajout get_note_reactors)
--   - 064 (réécriture react_to_note avec notify)
--
-- L'historique reste dans Git pour réintroduction propre si besoin.

-- ============================================================
-- 0. Retirer la publication realtime des colonnes notes (mig 057)
--    Sinon le DROP COLUMN plus bas planterait. On retire users de la
--    publication, c'est le moins invasif (state pré-057 restauré).
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.users;
  END IF;
END $$;

-- ============================================================
-- 1. Modération des notes (signalement)
-- ============================================================

DROP FUNCTION IF EXISTS public.report_note(text);
DROP TABLE IF EXISTS public.note_reports;

-- ============================================================
-- 2. Réactions sur notes (counts + reactors détaillés)
-- ============================================================

DROP FUNCTION IF EXISTS public.react_to_note(text, text);
DROP FUNCTION IF EXISTS public.get_note_reactions(text);
DROP FUNCTION IF EXISTS public.get_note_reactors(text);
DROP TABLE IF EXISTS public.note_reactions;

-- ============================================================
-- 3. Notes elles-mêmes (RPCs + colonnes + index)
-- ============================================================

DROP FUNCTION IF EXISTS public.set_note(text);
DROP FUNCTION IF EXISTS public.clear_note();

DROP INDEX IF EXISTS public.idx_users_active_notes;

ALTER TABLE public.users
  DROP COLUMN IF EXISTS note_text,
  DROP COLUMN IF EXISTS note_posted_at;

-- KEEP (whitelist confirmée Uriel 2026-05-05) :
--   - allowed_emojis + is_allowed_emoji        → utilisés par throw_emoji
--   - validate_emoji_throw                     → anti-spoof emoji-throws
--   - mute_user / unmute_user / get_muted_user_ids + users.muted_user_ids
--                                              → modération propre aux emojis
