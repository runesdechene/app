-- 042_v07_levels_triggers.sql
-- WHY : Phase 2 du système Niveaux V0.7.
-- Triggers INSERT/DELETE sur les 5 tables d'action qui incrémentent/décrémentent
-- xp_total des users concernés. Le delta est conditionné par la date :
--   created_at >= xp_epoch → trigger actif
--   created_at <  xp_epoch → no-op (protège l'historique pré-switch)
--
-- Coefficients (cf. spec §5) :
--   places_discovered : +1 / -1
--   place_explorers   : +3 / -3
--   places            : +20 / -20
--   place_contributions type='carnet' : +5 / -5
--   place_contributions type='photo'  : +1 par photo dans images[] / -N
--   veille_history    : +10 / jamais (DELETE no-op — événement immuable)
--   enigma_responses (correct=true) : +1/+1/+2/+3 selon difficulté / jamais

-- Helper interne pour lire xp_epoch depuis app_settings (cast string → bigint timestamp epoch)
CREATE OR REPLACE FUNCTION public._xp_epoch()
RETURNS timestamptz LANGUAGE sql STABLE AS $$
  SELECT to_timestamp((SELECT value::bigint FROM public.app_settings WHERE key='xp_epoch'));
$$;

-- ============================================================
-- TRIGGER : places_discovered (Découvrir, +1)
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_xp_discovered_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.created_at >= public._xp_epoch() THEN
    UPDATE public.users SET xp_total = xp_total + 1 WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_xp_discovered_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.created_at >= public._xp_epoch() THEN
    UPDATE public.users SET xp_total = GREATEST(0, xp_total - 1) WHERE id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_xp_discovered_ins ON public.places_discovered;
DROP TRIGGER IF EXISTS trg_xp_discovered_del ON public.places_discovered;
CREATE TRIGGER trg_xp_discovered_ins AFTER INSERT ON public.places_discovered
  FOR EACH ROW EXECUTE FUNCTION public._trg_xp_discovered_insert();
CREATE TRIGGER trg_xp_discovered_del AFTER DELETE ON public.places_discovered
  FOR EACH ROW EXECUTE FUNCTION public._trg_xp_discovered_delete();

-- ============================================================
-- TRIGGER : place_explorers (Fouler, +3)
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_xp_explorer_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- DISTINCT garanti par PRIMARY KEY (user_id, place_id) sur place_explorers
  IF COALESCE(NEW.visited_at, now()) >= public._xp_epoch() THEN
    UPDATE public.users SET xp_total = xp_total + 3 WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_xp_explorer_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(OLD.visited_at, now()) >= public._xp_epoch() THEN
    UPDATE public.users SET xp_total = GREATEST(0, xp_total - 3) WHERE id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_xp_explorer_ins ON public.place_explorers;
DROP TRIGGER IF EXISTS trg_xp_explorer_del ON public.place_explorers;
CREATE TRIGGER trg_xp_explorer_ins AFTER INSERT ON public.place_explorers
  FOR EACH ROW EXECUTE FUNCTION public._trg_xp_explorer_insert();
CREATE TRIGGER trg_xp_explorer_del AFTER DELETE ON public.place_explorers
  FOR EACH ROW EXECUTE FUNCTION public._trg_xp_explorer_delete();

-- ============================================================
-- TRIGGER : places (Cartographier, +20)
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_xp_place_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.author_id IS NOT NULL AND NEW.created_at >= public._xp_epoch() THEN
    UPDATE public.users SET xp_total = xp_total + 20 WHERE id = NEW.author_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_xp_place_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.author_id IS NOT NULL AND OLD.created_at >= public._xp_epoch() THEN
    UPDATE public.users SET xp_total = GREATEST(0, xp_total - 20) WHERE id = OLD.author_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_xp_place_ins ON public.places;
DROP TRIGGER IF EXISTS trg_xp_place_del ON public.places;
CREATE TRIGGER trg_xp_place_ins AFTER INSERT ON public.places
  FOR EACH ROW EXECUTE FUNCTION public._trg_xp_place_insert();
CREATE TRIGGER trg_xp_place_del AFTER DELETE ON public.places
  FOR EACH ROW EXECUTE FUNCTION public._trg_xp_place_delete();

-- ============================================================
-- TRIGGER : place_contributions (Carnet +5, Photo +1 par photo)
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_xp_contribution_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_delta integer := 0;
BEGIN
  IF NEW.created_at < public._xp_epoch() THEN RETURN NEW; END IF;
  IF NEW.type = 'carnet' THEN
    v_delta := 5;
  ELSIF NEW.type = 'photo' THEN
    -- Compte le nombre de photos dans images[] (logique mig 038)
    v_delta := COALESCE(jsonb_array_length(NEW.images), 0)
             + CASE WHEN (NEW.images IS NULL OR jsonb_array_length(NEW.images) = 0)
                     AND NEW.image_url IS NOT NULL AND NEW.image_url != ''
                    THEN 1 ELSE 0 END;
  END IF;
  IF v_delta > 0 THEN
    UPDATE public.users SET xp_total = xp_total + v_delta WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_xp_contribution_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_delta integer := 0;
BEGIN
  IF OLD.created_at < public._xp_epoch() THEN RETURN OLD; END IF;
  IF OLD.type = 'carnet' THEN
    v_delta := 5;
  ELSIF OLD.type = 'photo' THEN
    v_delta := COALESCE(jsonb_array_length(OLD.images), 0)
             + CASE WHEN (OLD.images IS NULL OR jsonb_array_length(OLD.images) = 0)
                     AND OLD.image_url IS NOT NULL AND OLD.image_url != ''
                    THEN 1 ELSE 0 END;
  END IF;
  IF v_delta > 0 THEN
    UPDATE public.users SET xp_total = GREATEST(0, xp_total - v_delta) WHERE id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_xp_contribution_ins ON public.place_contributions;
DROP TRIGGER IF EXISTS trg_xp_contribution_del ON public.place_contributions;
CREATE TRIGGER trg_xp_contribution_ins AFTER INSERT ON public.place_contributions
  FOR EACH ROW EXECUTE FUNCTION public._trg_xp_contribution_insert();
CREATE TRIGGER trg_xp_contribution_del AFTER DELETE ON public.place_contributions
  FOR EACH ROW EXECUTE FUNCTION public._trg_xp_contribution_delete();

-- ============================================================
-- TRIGGER : veille_history (Plantage +10, INSERT only — événement immuable)
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_xp_plantage_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(NEW.planted_at, now()) >= public._xp_epoch() THEN
    UPDATE public.users SET xp_total = xp_total + 10 WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_xp_plantage_ins ON public.veille_history;
CREATE TRIGGER trg_xp_plantage_ins AFTER INSERT ON public.veille_history
  FOR EACH ROW EXECUTE FUNCTION public._trg_xp_plantage_insert();

-- ============================================================
-- TRIGGER : enigma_responses (Énigme +1/+1/+2/+3, INSERT only — immuable)
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_xp_enigma_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_delta integer := 0;
  v_difficulty text;
BEGIN
  IF NOT NEW.correct THEN RETURN NEW; END IF;
  IF COALESCE(NEW.responded_at, now()) < public._xp_epoch() THEN RETURN NEW; END IF;
  SELECT difficulty INTO v_difficulty FROM public.enigmas WHERE id = NEW.enigma_id;
  v_delta := CASE v_difficulty
    WHEN 'very_easy' THEN 1
    WHEN 'easy'      THEN 1
    WHEN 'medium'    THEN 2
    WHEN 'hard'      THEN 3
    ELSE 1
  END;
  UPDATE public.users SET xp_total = xp_total + v_delta WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_xp_enigma_ins ON public.enigma_responses;
CREATE TRIGGER trg_xp_enigma_ins AFTER INSERT ON public.enigma_responses
  FOR EACH ROW EXECUTE FUNCTION public._trg_xp_enigma_insert();
