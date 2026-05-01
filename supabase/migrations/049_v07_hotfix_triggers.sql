-- 049_v07_hotfix_triggers.sql
-- WHY : hotfix critique pour les triggers XP V0.7 (mig 042).
--
-- Bug 1 (P0) : _xp_epoch() faisait value::bigint sur la valeur stockée
-- "1777651273.446156" (float string issu de extract(epoch from now())::text).
-- PostgreSQL refuse le cast direct float-string → bigint.
-- → Tous les triggers plantaient silencieusement, 0 XP gagné depuis mig 042.
-- Fix : value::float8::bigint (passe par float intermediaire).
--
-- Bug 2 (P1) : _trg_xp_discovered_insert/delete référencaient NEW.created_at /
-- OLD.created_at sur places_discovered, dont la vraie colonne est discovered_at.
-- Fix : utiliser discovered_at.

-- ============================================================
-- Fix 1 : _xp_epoch() avec cast float8 → bigint
-- ============================================================
CREATE OR REPLACE FUNCTION public._xp_epoch()
RETURNS timestamptz LANGUAGE sql STABLE AS $$
  SELECT to_timestamp((SELECT value::float8::bigint FROM public.app_settings WHERE key='xp_epoch'));
$$;

-- ============================================================
-- Fix 2 : _trg_xp_discovered_insert/delete avec discovered_at
-- ============================================================
CREATE OR REPLACE FUNCTION public._trg_xp_discovered_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.discovered_at >= public._xp_epoch() THEN
    UPDATE public.users SET xp_total = xp_total + 1 WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._trg_xp_discovered_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.discovered_at >= public._xp_epoch() THEN
    UPDATE public.users SET xp_total = GREATEST(0, xp_total - 1) WHERE id = OLD.user_id;
  END IF;
  RETURN OLD;
END;
$$;

-- Les triggers eux-mêmes restent en place (CREATE TRIGGER de mig 042) — ils référencent
-- les fonctions par nom et notre CREATE OR REPLACE met à jour le body.
