-- 227_rename_place_align_contribute_gate.sql
-- WHY : rename_place (baseline 001) refusait TOUT renommage en pratique.
--   1) Garde `auth.uid()::text = p_user_id` : les comptes legacy (shopify-*/firebase-*)
--      ont un users.id qui n'égale JAMAIS auth.uid() → 'unauthorized' systématique.
--   2) Garde `type='carnet'` : vestige V0 (carnet remplacé par la description
--      collaborative, mig 195/196) → 'must_have_carnet' systématique.
-- FIX : autoriser via la condition du bouton Contribuer — créateur OU visiteur GPS
--   OU découvreur à distance — MAIS en liant l'identité au JWT, pas à un paramètre
--   client (spoofable). On dérive l'id interne via auth.uid() (helper _caller_user_id),
--   et p_user_id n'est plus utilisé pour l'autorisation (conservé pour compat de
--   signature avec le front ; déprécié).
-- NB : on NE peut pas exiger users.id = auth.uid() (ça re-casserait les comptes
--   legacy). Le helper résout d'abord par id (comptes migrés), sinon par email
--   (email_address est UNIQUE NOT NULL ; pont identique à handle_new_user mig 170).

BEGIN;

-- Helper canonique : identité interne de l'appelant, dérivée du JWT (jamais d'un param).
-- Réutilisable pour durcir les autres RPCs (delete_place, contributions, rate) plus tard.
CREATE OR REPLACE FUNCTION public._caller_user_id()
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- Comptes récents : users.id == auth.uid().
  SELECT id INTO v_id FROM public.users WHERE id = v_uid::text;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Comptes legacy (shopify-*/firebase-*) : pont par email (UNIQUE, NOT NULL).
  SELECT u.id INTO v_id
  FROM public.users u
  WHERE u.email_address <> ''
    AND LOWER(u.email_address) = LOWER((SELECT email FROM auth.users WHERE id = v_uid));
  RETURN v_id;
END;
$$;

ALTER FUNCTION public._caller_user_id() OWNER TO postgres;
REVOKE ALL ON FUNCTION public._caller_user_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._caller_user_id() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rename_place(
  p_user_id text, p_place_id text, p_title text  -- p_user_id : déprécié, ignoré (identité = JWT)
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_caller   text := public._caller_user_id();
  v_trimmed  text;
  v_can_edit boolean;
BEGIN
  IF v_caller IS NULL THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  v_trimmed := TRIM(p_title);
  IF v_trimmed = '' OR v_trimmed IS NULL THEN
    RETURN json_build_object('error', 'empty_title');
  END IF;
  IF LENGTH(v_trimmed) > 255 THEN
    RETURN json_build_object('error', 'title_too_long');
  END IF;

  -- Même condition que le bouton Contribuer, mais sur l'identité dérivée du JWT :
  -- créateur OU visiteur GPS OU découvreur à distance.
  SELECT
       EXISTS(SELECT 1 FROM places           WHERE id       = p_place_id AND author_id = v_caller)
    OR EXISTS(SELECT 1 FROM place_explorers   WHERE place_id = p_place_id AND user_id   = v_caller)
    OR EXISTS(SELECT 1 FROM places_discovered WHERE place_id = p_place_id AND user_id   = v_caller)
  INTO v_can_edit;

  IF NOT v_can_edit THEN
    RETURN json_build_object('error', 'not_allowed');
  END IF;

  UPDATE places SET title = v_trimmed, updated_at = NOW() WHERE id = p_place_id;

  RETURN json_build_object('success', true, 'title', v_trimmed);
END;
$$;

ALTER FUNCTION public.rename_place(text, text, text) OWNER TO postgres;
-- anon révoqué : renommer exige une session authentifiée.
REVOKE ALL ON FUNCTION public.rename_place(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_place(text, text, text) TO authenticated, service_role;

COMMIT;
