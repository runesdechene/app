-- 072_drop_micro_social_notes.sql
-- WHY: Sprint Purification (mai 2026) — Uriel doute de l'utilité des notes
--      éphémères (mig 055). On vire la NOTE complètement, on garde l'envoi
--      d'EMOJI (FlyingEmojiLayer + EmojiPicker + RPCs throw_emoji /
--      validate_emoji_throw + table allowed_emojis + mute_user/unmute_user
--      qui restent utilisés pour modérer les emojis-throws).
--
-- Drop chirurgical : tout ce qui dépend de la "note 24h sur le profil" et
-- des "réactions emoji sur cette note", plus la modération note_reports.
-- L'historique reste dans Git (mig 055) pour réintroduction propre si besoin.

-- ============================================================
-- 1. Modération des notes (signalement)
-- ============================================================

DROP FUNCTION IF EXISTS public.report_note(text);
DROP TABLE IF EXISTS public.note_reports;

-- ============================================================
-- 2. Réactions sur notes
-- ============================================================

DROP FUNCTION IF EXISTS public.react_to_note(text, text);
DROP FUNCTION IF EXISTS public.get_note_reactions(text);
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
