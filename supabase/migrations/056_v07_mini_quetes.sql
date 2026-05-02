-- 056_v07_mini_quetes.sql
-- WHY: Mini-quêtes journalières V0.7+ — 4 quêtes fixes par jour, reset minuit local du user.
--      Auto-tracking via les RPCs/triggers existants (places_discovered, enigma_responses,
--      crown_harvest, react_to_note, validate_emoji_throw). Récompense uniquement en XP
--      (pas de Couronnes pour les 4 dailies V0.7+, mais l'archi le supporte).
--
-- Spec : docs/superpowers/specs/2026-05-02-v07-mini-quetes-journalieres-design.md
-- Plan : docs/superpowers/plans/2026-05-02-mini-quetes-journalieres-implementation.md
--
-- Notes architecturales :
--   - users.id = varchar(255) → toutes les FK et user_ids en text
--   - Pas de broadcast Supabase Realtime côté serveur (pg_notify ne fonctionne pas pour broadcast).
--     Le client subscribe à postgres_changes sur user_quest_progress (filtré sur user_id et
--     completed_at IS NOT NULL) pour catch les complétions et afficher le toast.
--   - XP attribué via UPDATE direct sur users.xp_total (pattern V0.7.0 existant, cf. _trg_xp_*)
--   - increment_quest_progress est SECURITY DEFINER mais appelée depuis triggers et RPCs
--     SECURITY DEFINER existantes : la chaîne reste cohérente.

-- ============================================================
-- 1. Schéma : timezone user + tables polymorphes
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Paris';

CREATE TABLE IF NOT EXISTS public.quest_templates (
  id text PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('daily', 'weekly', 'editorial', 'local', 'campement_issued', 'expedition')),
  wording text NOT NULL,
  icon text NOT NULL,
  tracker_kind text NOT NULL,
  threshold integer NOT NULL,
  reward_xp integer NOT NULL,
  reward_couronnes integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_quest_progress (
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quest_template_id text NOT NULL REFERENCES public.quest_templates(id),
  date_local date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  rewarded boolean NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, quest_template_id, date_local)
);

CREATE INDEX IF NOT EXISTS idx_user_quest_progress_today
  ON public.user_quest_progress(user_id, date_local);

GRANT SELECT ON public.quest_templates TO authenticated;
GRANT SELECT ON public.user_quest_progress TO authenticated;

-- Realtime : permettre au client d'écouter les complétions sur sa propre progression
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_quest_progress;

-- ============================================================
-- 2. Seed des 4 dailies V0.7+
-- ============================================================

INSERT INTO public.quest_templates
  (id, type, wording, icon, tracker_kind, threshold, reward_xp, reward_couronnes, display_order)
VALUES
  ('daily_moisson', 'daily', 'Récupère la moisson d''au moins 2 lieux', '🪙', 'moisson_claims', 2, 3, 0, 1),
  ('daily_brouillard', 'daily', 'Lève le brouillard sur 2 lieux', '🌫️', 'discoveries', 2, 5, 0, 2),
  ('daily_enigme', 'daily', 'Tente l''énigme du jour', '🗝️', 'enigma_attempt', 1, 5, 0, 3),
  ('daily_emoji', 'daily', 'Lance un emoji à un voyageur ou réagis à sa note', '👋', 'social_action', 1, 3, 0, 4)
ON CONFLICT (id) DO UPDATE SET
  wording = EXCLUDED.wording,
  icon = EXCLUDED.icon,
  threshold = EXCLUDED.threshold,
  reward_xp = EXCLUDED.reward_xp,
  display_order = EXCLUDED.display_order,
  active = true;

-- ============================================================
-- 3. Helper : date locale du user (selon sa timezone)
-- ============================================================

CREATE OR REPLACE FUNCTION public._user_date_local(p_user_id text)
  RETURNS date
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT (NOW() AT TIME ZONE COALESCE(timezone, 'Europe/Paris'))::date
    FROM public.users WHERE id = p_user_id;
$$;

-- ============================================================
-- 4. RPC update_user_timezone (appelée à chaque session côté client)
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_user_timezone(p_timezone text)
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
    SET timezone = COALESCE(p_timezone, 'Europe/Paris'),
        updated_at = NOW()
    WHERE id = v_user_id;
  RETURN json_build_object('ok', true, 'timezone', COALESCE(p_timezone, 'Europe/Paris'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_timezone(text) TO authenticated;

-- ============================================================
-- 5. RPC get_user_quests_today
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_quests_today()
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
  SET search_path TO 'public'
AS $$
  WITH today AS (SELECT public._user_date_local(auth.uid()::text) AS d)
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
    FROM public.quest_templates qt
    LEFT JOIN public.user_quest_progress uqp
      ON uqp.quest_template_id = qt.id
      AND uqp.user_id = auth.uid()::text
      AND uqp.date_local = (SELECT d FROM today)
    WHERE qt.type = 'daily' AND qt.active
    ORDER BY qt.display_order;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_quests_today() TO authenticated;

-- ============================================================
-- 6. RPC increment_quest_progress (appelée par hooks et triggers)
-- ============================================================
-- Renvoie la liste des quêtes nouvellement complétées (pour toast côté appelant
-- direct) — les complétions par trigger sont aussi captées par le subscribe
-- postgres_changes côté client (UPDATE de completed_at).

CREATE OR REPLACE FUNCTION public.increment_quest_progress(
  p_user_id text,
  p_tracker_kind text,
  p_amount integer DEFAULT 1
)
  RETURNS TABLE(completed_template_id text, reward_xp integer)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_date_local date;
  v_template RECORD;
  v_progress RECORD;
BEGIN
  IF p_user_id IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  v_date_local := public._user_date_local(p_user_id);
  IF v_date_local IS NULL THEN RETURN; END IF;

  FOR v_template IN
    SELECT id, threshold, reward_xp, reward_couronnes
      FROM public.quest_templates
      WHERE type = 'daily' AND active AND tracker_kind = p_tracker_kind
  LOOP
    INSERT INTO public.user_quest_progress (user_id, quest_template_id, date_local, count)
      VALUES (p_user_id, v_template.id, v_date_local, p_amount)
      ON CONFLICT (user_id, quest_template_id, date_local) DO UPDATE SET
        count = public.user_quest_progress.count + EXCLUDED.count
      RETURNING * INTO v_progress;

    IF v_progress.count >= v_template.threshold AND v_progress.completed_at IS NULL THEN
      UPDATE public.user_quest_progress
        SET completed_at = NOW(),
            rewarded = true
        WHERE user_id = p_user_id
          AND quest_template_id = v_template.id
          AND date_local = v_date_local
          AND completed_at IS NULL;

      -- Attribution XP (pattern V0.7.0 — UPDATE direct sur xp_total)
      UPDATE public.users
        SET xp_total = xp_total + v_template.reward_xp
        WHERE id = p_user_id;

      -- Pas de distribution Couronnes pour V0.7+ (les 4 dailies ont reward_couronnes = 0).
      -- Si reward_couronnes > 0 dans un futur template : ajouter ici un INSERT/UPDATE sur
      -- user_crowns avec respect du plafond 500 (cf. mig 021).

      completed_template_id := v_template.id;
      reward_xp := v_template.reward_xp;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_quest_progress(text, text, integer) TO authenticated;

-- ============================================================
-- 7. Triggers d'auto-tracking
-- ============================================================
-- 7.1 Découvertes : places_discovered AFTER INSERT
--     S'exécute en parallèle des triggers XP existants (mig 042).
--     PK (user_id, place_id) garantit qu'une découverte = 1 INSERT max.

CREATE OR REPLACE FUNCTION public._trg_quest_progress_discovered()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.increment_quest_progress(NEW.user_id, 'discoveries', 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quest_progress_discovered ON public.places_discovered;
CREATE TRIGGER trg_quest_progress_discovered
  AFTER INSERT ON public.places_discovered
  FOR EACH ROW EXECUTE FUNCTION public._trg_quest_progress_discovered();

-- 7.2 Énigmes : enigma_responses AFTER INSERT
--     Toute tentative compte (correct OU incorrect — la spec dit "tente").

CREATE OR REPLACE FUNCTION public._trg_quest_progress_enigma()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.increment_quest_progress(NEW.user_id, 'enigma_attempt', 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quest_progress_enigma ON public.enigma_responses;
CREATE TRIGGER trg_quest_progress_enigma
  AFTER INSERT ON public.enigma_responses
  FOR EACH ROW EXECUTE FUNCTION public._trg_quest_progress_enigma();

-- 7.3 Moisson : crown_harvest AFTER INSERT OR UPDATE
--     PK (place_id, user_id) → INSERT pour première moisson sur ce lieu, UPDATE
--     pour les suivantes (timer 24h écoulé). Les 2 cas comptent comme +1 moisson_claim.

CREATE OR REPLACE FUNCTION public._trg_quest_progress_moisson()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.increment_quest_progress(NEW.user_id, 'moisson_claims', 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quest_progress_moisson_ins ON public.crown_harvest;
DROP TRIGGER IF EXISTS trg_quest_progress_moisson_upd ON public.crown_harvest;
CREATE TRIGGER trg_quest_progress_moisson_ins
  AFTER INSERT ON public.crown_harvest
  FOR EACH ROW EXECUTE FUNCTION public._trg_quest_progress_moisson();
CREATE TRIGGER trg_quest_progress_moisson_upd
  AFTER UPDATE OF last_harvested_at ON public.crown_harvest
  FOR EACH ROW
  WHEN (NEW.last_harvested_at IS DISTINCT FROM OLD.last_harvested_at)
  EXECUTE FUNCTION public._trg_quest_progress_moisson();

-- 7.4 Social : modifie react_to_note (mig 055) pour ajouter le hook quête
--     + redéfinit validate_emoji_throw en VOLATILE (était STABLE) pour pouvoir
--     appeler increment_quest_progress (qui fait des UPDATE).

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

  -- Hook quête V0.7+
  PERFORM public.increment_quest_progress(v_user_id, 'social_action', 1);

  RETURN json_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_emoji_throw(p_emoji text)
  RETURNS json
  LANGUAGE plpgsql
  -- VOLATILE (default) — était STABLE en mig 055, on doit modifier la DB via le hook quête.
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user_id text := auth.uid()::text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF NOT public.is_allowed_emoji(p_emoji) THEN
    RAISE EXCEPTION 'emoji_not_allowed';
  END IF;

  -- Hook quête V0.7+
  PERFORM public.increment_quest_progress(v_user_id, 'social_action', 1);

  RETURN json_build_object('ok', true);
END;
$$;
