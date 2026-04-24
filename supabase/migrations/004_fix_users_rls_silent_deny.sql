-- Migration 004 — Fix RLS silent-deny sur public.users
--
-- Cause racine : RLS est ENABLE sur public.users avec policies SELECT + INSERT
-- uniquement (cf 001_baseline_2026-04-22.sql lignes 8043, 8157, 8235, 8715).
-- Pas de policy UPDATE → deny par défaut, sans erreur. Les updates clients sur
-- tutorial_completed_at (MapPage.markTutorialComplete) et last_login_at
-- (usePlayer init) étaient silencieusement ignorés : les nouveaux comptes ne
-- gardaient jamais leur état "tutoriel vu" et revoyaient les slides à chaque
-- relance de l'app.
--
-- Fix : convention monorepo (cf apps/explore-web/CLAUDE.md, règle "RPCs →
-- SECURITY DEFINER"). Deux RPCs qui bypassent RLS proprement avec auth.uid()
-- check, sur le même pattern que update_my_profile.
--
-- Pas de backfill : les comptes bloqués revoient le tuto UNE dernière fois
-- avec le fix en place, et cette fois ça prend.

BEGIN;

-- =============================================================================
-- mark_tutorial_complete : pose tutorial_completed_at = NOW() pour l'user auth
-- =============================================================================
CREATE OR REPLACE FUNCTION public.mark_tutorial_complete(p_user_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  UPDATE public.users
  SET tutorial_completed_at = COALESCE(tutorial_completed_at, NOW()),
      updated_at            = NOW()
  WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;

ALTER FUNCTION public.mark_tutorial_complete(text) OWNER TO postgres;
GRANT ALL ON FUNCTION public.mark_tutorial_complete(text) TO anon;
GRANT ALL ON FUNCTION public.mark_tutorial_complete(text) TO authenticated;
GRANT ALL ON FUNCTION public.mark_tutorial_complete(text) TO service_role;

-- =============================================================================
-- touch_last_login : pose last_login_at = NOW() pour l'user auth
-- =============================================================================
CREATE OR REPLACE FUNCTION public.touch_last_login(p_user_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  UPDATE public.users
  SET last_login_at = NOW()
  WHERE id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;

ALTER FUNCTION public.touch_last_login(text) OWNER TO postgres;
GRANT ALL ON FUNCTION public.touch_last_login(text) TO anon;
GRANT ALL ON FUNCTION public.touch_last_login(text) TO authenticated;
GRANT ALL ON FUNCTION public.touch_last_login(text) TO service_role;

COMMIT;
