-- ============================================
-- MIGRATION 088 : Security W4 — auth.uid() wrappers sur RPCs SECURITY DEFINER
-- ============================================
-- Phase 4bis audit pré-lancement (2026-04-15) — suite de 086.
--
-- Audit W4 : 8 RPCs SECURITY DEFINER acceptent p_user_id sans valider
-- que p_user_id = auth.uid(). Escalation triviale : user A peut agir
-- au nom de user B.
--
-- RPCs traitées :
--   answer_enigma, answer_fragment_enigma, contribute_to_place,
--   place_influence_action, revisit_place_gps, unlike_contribution,
--   visit_place_gps, vote_contribution
--
-- Note : claim_daily_fragment_bonus était mentionnée par l'agent mais
-- absente de prod (query pg_proc 2026-04-15), donc non incluse.
--
-- STRATÉGIE : wrapper pattern — on ne touche PAS les bodies (zéro risque
-- de régression logique). On rename l'original en _internal, on crée
-- un wrapper public qui vérifie auth.uid() puis délègue.
--
-- Signatures EXACTES lues depuis pg_get_function_arguments en prod.
-- ============================================

BEGIN;

-- ============================================
-- 1. answer_enigma(text, integer, text)
-- ============================================
ALTER FUNCTION public.answer_enigma(text, integer, text)
  RENAME TO _answer_enigma_internal;

CREATE OR REPLACE FUNCTION public.answer_enigma(
  p_user_id TEXT,
  p_enigma_id INTEGER,
  p_answer TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._answer_enigma_internal(p_user_id, p_enigma_id, p_answer);
END;
$$;

GRANT EXECUTE ON FUNCTION public.answer_enigma(text, integer, text) TO authenticated;
REVOKE ALL ON FUNCTION public._answer_enigma_internal(text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._answer_enigma_internal(text, integer, text) FROM authenticated;

-- ============================================
-- 2. answer_fragment_enigma(text, integer, text, integer)
-- ============================================
ALTER FUNCTION public.answer_fragment_enigma(text, integer, text, integer)
  RENAME TO _answer_fragment_enigma_internal;

CREATE OR REPLACE FUNCTION public.answer_fragment_enigma(
  p_user_id TEXT,
  p_enigma_id INTEGER,
  p_answer TEXT,
  p_fragment_id INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._answer_fragment_enigma_internal(p_user_id, p_enigma_id, p_answer, p_fragment_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.answer_fragment_enigma(text, integer, text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public._answer_fragment_enigma_internal(text, integer, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._answer_fragment_enigma_internal(text, integer, text, integer) FROM authenticated;

-- ============================================
-- 3. contribute_to_place(text, text, text, text, text, text, integer)
-- ============================================
ALTER FUNCTION public.contribute_to_place(text, text, text, text, text, text, integer)
  RENAME TO _contribute_to_place_internal;

CREATE OR REPLACE FUNCTION public.contribute_to_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_type TEXT,
  p_content TEXT DEFAULT NULL,
  p_image_url TEXT DEFAULT NULL,
  p_era_id TEXT DEFAULT NULL,
  p_year_exact INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._contribute_to_place_internal(p_user_id, p_place_id, p_type, p_content, p_image_url, p_era_id, p_year_exact);
END;
$$;

GRANT EXECUTE ON FUNCTION public.contribute_to_place(text, text, text, text, text, text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public._contribute_to_place_internal(text, text, text, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._contribute_to_place_internal(text, text, text, text, text, text, integer) FROM authenticated;

-- ============================================
-- 4. place_influence_action(text, text, integer, numeric, numeric, text)
-- ============================================
ALTER FUNCTION public.place_influence_action(text, text, integer, numeric, numeric, text)
  RENAME TO _place_influence_action_internal;

CREATE OR REPLACE FUNCTION public.place_influence_action(
  p_user_id TEXT,
  p_place_id TEXT,
  p_points INTEGER,
  p_user_lat NUMERIC DEFAULT NULL,
  p_user_lng NUMERIC DEFAULT NULL,
  p_target_faction_id TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._place_influence_action_internal(p_user_id, p_place_id, p_points, p_user_lat, p_user_lng, p_target_faction_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_influence_action(text, text, integer, numeric, numeric, text) TO authenticated;
REVOKE ALL ON FUNCTION public._place_influence_action_internal(text, text, integer, numeric, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._place_influence_action_internal(text, text, integer, numeric, numeric, text) FROM authenticated;

-- ============================================
-- 5. revisit_place_gps(text, text, numeric, numeric)
-- ============================================
ALTER FUNCTION public.revisit_place_gps(text, text, numeric, numeric)
  RENAME TO _revisit_place_gps_internal;

CREATE OR REPLACE FUNCTION public.revisit_place_gps(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC,
  p_user_lng NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._revisit_place_gps_internal(p_user_id, p_place_id, p_user_lat, p_user_lng);
END;
$$;

GRANT EXECUTE ON FUNCTION public.revisit_place_gps(text, text, numeric, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public._revisit_place_gps_internal(text, text, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._revisit_place_gps_internal(text, text, numeric, numeric) FROM authenticated;

-- ============================================
-- 6. unlike_contribution(text, integer)
-- ============================================
ALTER FUNCTION public.unlike_contribution(text, integer)
  RENAME TO _unlike_contribution_internal;

CREATE OR REPLACE FUNCTION public.unlike_contribution(
  p_user_id TEXT,
  p_contribution_id INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._unlike_contribution_internal(p_user_id, p_contribution_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlike_contribution(text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public._unlike_contribution_internal(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._unlike_contribution_internal(text, integer) FROM authenticated;

-- ============================================
-- 7. visit_place_gps(text, text, numeric, numeric)
-- ============================================
ALTER FUNCTION public.visit_place_gps(text, text, numeric, numeric)
  RENAME TO _visit_place_gps_internal;

CREATE OR REPLACE FUNCTION public.visit_place_gps(
  p_user_id TEXT,
  p_place_id TEXT,
  p_user_lat NUMERIC,
  p_user_lng NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._visit_place_gps_internal(p_user_id, p_place_id, p_user_lat, p_user_lng);
END;
$$;

GRANT EXECUTE ON FUNCTION public.visit_place_gps(text, text, numeric, numeric) TO authenticated;
REVOKE ALL ON FUNCTION public._visit_place_gps_internal(text, text, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._visit_place_gps_internal(text, text, numeric, numeric) FROM authenticated;

-- ============================================
-- 8. vote_contribution(text, integer, integer)
-- ============================================
ALTER FUNCTION public.vote_contribution(text, integer, integer)
  RENAME TO _vote_contribution_internal;

CREATE OR REPLACE FUNCTION public.vote_contribution(
  p_user_id TEXT,
  p_contribution_id INTEGER,
  p_vote INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  RETURN public._vote_contribution_internal(p_user_id, p_contribution_id, p_vote);
END;
$$;

GRANT EXECUTE ON FUNCTION public.vote_contribution(text, integer, integer) TO authenticated;
REVOKE ALL ON FUNCTION public._vote_contribution_internal(text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._vote_contribution_internal(text, integer, integer) FROM authenticated;

COMMIT;

-- ============================================
-- SMOKE TESTS post-apply
-- ============================================
-- 1. Login user A, appeler answer_enigma avec p_user_id = <id user B>
--    → {"error": "unauthorized"}
-- 2. Login user A, appeler place_influence_action(user_id=A, ...)
--    → doit fonctionner normalement
-- 3. Login user A, appeler contribute_to_place avec p_user_id = <id user B>
--    → {"error": "unauthorized"}
-- 4. Vote un carnet (user sur son propre compte) → normal
-- 5. Répondre à l'énigme du jour (user sur son propre compte) → normal
-- 6. Visite GPS d'un lieu (user sur son propre compte) → normal
--
-- Si smoke test 2/4/5/6 échoue → REGRESSION critique, rollback immédiat :
--   BEGIN;
--   DROP FUNCTION public.<nom>(sig);
--   ALTER FUNCTION public._<nom>_internal(sig) RENAME TO <nom>;
--   COMMIT;
