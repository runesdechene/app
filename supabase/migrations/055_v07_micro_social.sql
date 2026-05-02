-- 055_v07_micro_social.sql
-- WHY: Micro-social V0.7+ — notes éphémères 24h + réactions emoji + lancer d'emoji (Zenly-style)
--      + mute soft + signalement modération.
--
-- Spec : docs/superpowers/specs/2026-05-02-v07-micro-social-emoji-notes-design.md
-- Plan : docs/superpowers/plans/2026-05-02-micro-social-emoji-notes-implementation.md
--
-- Notes architecturales :
--   - users.id est varchar(255) (legacy Firebase IDs migrés en uuid::text via auto-migration usePlayer)
--     donc TOUTES les FK et arrays vers users.id utilisent `text`, pas `uuid`.
--   - auth.uid() retourne uuid → on cast en ::text pour matcher users.id.
--   - Notes broadcastées via presence channel (cf. usePresence) en plus du fallback DB pour la
--     persistence inter-sessions. La DB est source de vérité 24h.
--   - Emoji-throws : zéro DB, channel Supabase Realtime broadcast. La RPC validate_emoji_throw
--     sert d'anti-spoof (whitelist côté serveur) avant que le client ne broadcast.

-- ============================================================
-- 1. Notes sur le profil (≤200 char, durée 24h)
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS note_text text CHECK (length(note_text) <= 200);
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS note_posted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_users_active_notes
  ON public.users(note_posted_at)
  WHERE note_posted_at IS NOT NULL;

-- RPC set_note : pose ou met à jour la note + reset des réactions précédentes
CREATE OR REPLACE FUNCTION public.set_note(p_text text)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
  v_trimmed text := trim(coalesce(p_text, ''));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF length(v_trimmed) = 0 THEN
    RAISE EXCEPTION 'note_empty';
  END IF;
  IF length(v_trimmed) > 200 THEN
    RAISE EXCEPTION 'note_too_long';
  END IF;

  -- Reset les réactions de l'ancienne note (clean state)
  DELETE FROM public.note_reactions WHERE note_user_id = v_user_id;

  UPDATE public.users
    SET note_text = v_trimmed,
        note_posted_at = NOW(),
        updated_at = NOW()
    WHERE id = v_user_id;

  RETURN json_build_object('ok', true, 'text', v_trimmed, 'posted_at', NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_note(text) TO authenticated;

-- RPC clear_note : efface note + réactions
CREATE OR REPLACE FUNCTION public.clear_note()
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  DELETE FROM public.note_reactions WHERE note_user_id = v_user_id;

  UPDATE public.users
    SET note_text = NULL,
        note_posted_at = NULL,
        updated_at = NOW()
    WHERE id = v_user_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_note() TO authenticated;

-- ============================================================
-- 2. Whitelist emojis curée RdC (~33)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.allowed_emojis (
  emoji text PRIMARY KEY,
  category text NOT NULL,
  display_order integer NOT NULL DEFAULT 0
);

INSERT INTO public.allowed_emojis (emoji, category, display_order) VALUES
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

GRANT SELECT ON public.allowed_emojis TO authenticated;

CREATE OR REPLACE FUNCTION public.is_allowed_emoji(p_emoji text)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.allowed_emojis WHERE emoji = p_emoji);
$$;

GRANT EXECUTE ON FUNCTION public.is_allowed_emoji(text) TO authenticated;

-- ============================================================
-- 3. Réactions sur notes (1 emoji par paire user×emoji)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.note_reactions (
  note_user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reactor_user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (note_user_id, reactor_user_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_note_reactions_by_note ON public.note_reactions(note_user_id);

CREATE OR REPLACE FUNCTION public.react_to_note(p_note_user_id text, p_emoji text)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
  v_note_active boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  -- Vérifier que l'auteur a une note active (< 24h)
  SELECT (note_posted_at IS NOT NULL AND note_posted_at >= NOW() - INTERVAL '24 hours')
    INTO v_note_active
    FROM public.users WHERE id = p_note_user_id;
  IF NOT COALESCE(v_note_active, false) THEN
    RAISE EXCEPTION 'note_not_active';
  END IF;

  IF NOT public.is_allowed_emoji(p_emoji) THEN
    RAISE EXCEPTION 'emoji_not_allowed';
  END IF;

  INSERT INTO public.note_reactions (note_user_id, reactor_user_id, emoji)
    VALUES (p_note_user_id, v_user_id, p_emoji)
    ON CONFLICT (note_user_id, reactor_user_id, emoji) DO NOTHING;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.react_to_note(text, text) TO authenticated;

-- Compteurs agrégés sur la note d'un user (filtre 24h auto)
CREATE OR REPLACE FUNCTION public.get_note_reactions(p_note_user_id text)
  RETURNS TABLE(emoji text, count bigint)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT nr.emoji, COUNT(*)::bigint
    FROM public.note_reactions nr
    JOIN public.users u ON u.id = nr.note_user_id
    WHERE nr.note_user_id = p_note_user_id
      AND u.note_posted_at IS NOT NULL
      AND u.note_posted_at >= NOW() - INTERVAL '24 hours'
    GROUP BY nr.emoji
    ORDER BY COUNT(*) DESC, nr.emoji;
$$;

GRANT EXECUTE ON FUNCTION public.get_note_reactions(text) TO authenticated;

-- ============================================================
-- 4. Lancer d'emoji — anti-spoof côté serveur (broadcast côté client)
-- ============================================================
-- Pas de stockage : le client appelle validate_emoji_throw, si OK il broadcast
-- via channel.send() sur le channel Realtime 'emoji-throws'.

CREATE OR REPLACE FUNCTION public.validate_emoji_throw(p_emoji text)
  RETURNS json
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_allowed_emoji(p_emoji) THEN
    RAISE EXCEPTION 'emoji_not_allowed';
  END IF;
  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_emoji_throw(text) TO authenticated;

-- ============================================================
-- 5. Mute soft (anti-harcèlement V0.7+, block dur reporté)
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS muted_user_ids text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.mute_user(p_target_user_id text)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF v_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'cannot_mute_self';
  END IF;
  UPDATE public.users
    SET muted_user_ids = array_append(
          array_remove(muted_user_ids, p_target_user_id),  -- dédup
          p_target_user_id
        ),
        updated_at = NOW()
    WHERE id = v_user_id;
  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mute_user(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.unmute_user(p_target_user_id text)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  UPDATE public.users
    SET muted_user_ids = array_remove(muted_user_ids, p_target_user_id),
        updated_at = NOW()
    WHERE id = v_user_id;
  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unmute_user(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_muted_user_ids()
  RETURNS TABLE(user_id text)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT unnest(muted_user_ids) FROM public.users WHERE id = auth.uid()::text;
$$;

GRANT EXECUTE ON FUNCTION public.get_muted_user_ids() TO authenticated;

-- ============================================================
-- 6. Modération des notes (signalement → review Hub admin)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.note_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reporter_user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  note_text_at_report text NOT NULL,
  resolved_at timestamptz,
  resolved_by text REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_reports_unresolved
  ON public.note_reports(created_at DESC)
  WHERE resolved_at IS NULL;

CREATE OR REPLACE FUNCTION public.report_note(p_target_user_id text)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
  v_note text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF v_user_id = p_target_user_id THEN
    RAISE EXCEPTION 'cannot_report_self';
  END IF;
  SELECT note_text INTO v_note FROM public.users WHERE id = p_target_user_id;
  IF v_note IS NULL THEN
    RAISE EXCEPTION 'no_note_to_report';
  END IF;
  INSERT INTO public.note_reports (reported_user_id, reporter_user_id, note_text_at_report)
    VALUES (p_target_user_id, v_user_id, v_note);
  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_note(text) TO authenticated;
