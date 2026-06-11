-- 234_place_meta_edit_gate_and_set_tags.sql
-- WHY :
--  1) Le gate de rename_place (mig 227) autorisait à tort le RENOMMAGE pour un
--     simple « sortie du brouillard » (places_discovered = révélation à distance).
--     Révéler un lieu depuis la carte ne doit PAS donner le droit d'éditer son
--     identité. → on retire places_discovered.
--  2) On veut pouvoir éditer aussi les TAGS d'un lieu, sous la même autorisation.
--
-- Gate canonique « éditer l'identité du lieu » (nom + tags) :
--     Ajouteur (author_id)
--   OU a été sur place au moins une fois (place_explorers / visite GPS)
--   OU veilleur, à distance ou sur place (place_veille.veilleur_user_id)
-- Identité dérivée du JWT (_caller_user_id, mig 227), jamais d'un param client.
--
-- Réversible : rétablir l'ancien corps de rename_place (mig 227) + DROP set_place_tags.

BEGIN;

-- Helper partagé : l'appelant peut-il éditer l'identité de ce lieu ?
CREATE OR REPLACE FUNCTION public._can_edit_place_meta(p_place_id text, p_caller text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $gate$
  SELECT p_caller IS NOT NULL AND (
       EXISTS (SELECT 1 FROM public.places         WHERE id       = p_place_id AND author_id        = p_caller)
    OR EXISTS (SELECT 1 FROM public.place_explorers WHERE place_id = p_place_id AND user_id          = p_caller)
    OR EXISTS (SELECT 1 FROM public.place_veille    WHERE place_id = p_place_id AND veilleur_user_id = p_caller)
  );
$gate$;

ALTER FUNCTION public._can_edit_place_meta(text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._can_edit_place_meta(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._can_edit_place_meta(text, text) TO authenticated, service_role;

-- rename_place : même corps que mig 227, mais gate délégué au helper (plus de
-- places_discovered ; + place_veille).
CREATE OR REPLACE FUNCTION public.rename_place(
  p_user_id text, p_place_id text, p_title text  -- p_user_id : déprécié, ignoré (identité = JWT)
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $rename$
DECLARE
  v_caller  text := public._caller_user_id();
  v_trimmed text;
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

  IF NOT public._can_edit_place_meta(p_place_id, v_caller) THEN
    RETURN json_build_object('error', 'not_allowed');
  END IF;

  UPDATE public.places SET title = v_trimmed, updated_at = NOW() WHERE id = p_place_id;
  RETURN json_build_object('success', true, 'title', v_trimmed);
END;
$rename$;

ALTER FUNCTION public.rename_place(text, text, text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rename_place(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_place(text, text, text) TO authenticated, service_role;

-- set_place_tags : remplace l'ensemble des tags d'un lieu (1 à 3, ordonnés ;
-- le premier devient is_primary). Même gate que le renommage.
CREATE OR REPLACE FUNCTION public.set_place_tags(p_place_id text, p_tag_ids text[])
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $tags$
DECLARE
  v_caller text := public._caller_user_id();
  v_n      int  := COALESCE(array_length(p_tag_ids, 1), 0);
BEGIN
  IF v_caller IS NULL THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) THEN
    RETURN json_build_object('error', 'place_not_found');
  END IF;

  IF v_n < 1 THEN
    RETURN json_build_object('error', 'no_tags');
  END IF;
  IF v_n > 3 THEN
    RETURN json_build_object('error', 'too_many_tags');
  END IF;
  -- doublons interdits
  IF (SELECT count(DISTINCT tid) FROM unnest(p_tag_ids) tid) <> v_n THEN
    RETURN json_build_object('error', 'duplicate_tag');
  END IF;
  -- tous les tags doivent exister
  IF EXISTS (
    SELECT 1 FROM unnest(p_tag_ids) tid
    WHERE NOT EXISTS (SELECT 1 FROM public.tags WHERE id = tid)
  ) THEN
    RETURN json_build_object('error', 'invalid_tag');
  END IF;

  IF NOT public._can_edit_place_meta(p_place_id, v_caller) THEN
    RETURN json_build_object('error', 'not_allowed');
  END IF;

  DELETE FROM public.place_tags WHERE place_id = p_place_id;
  INSERT INTO public.place_tags (place_id, tag_id, is_primary, created_at)
  SELECT p_place_id, t.tag_id, (t.ord = 1), NOW()
  FROM unnest(p_tag_ids) WITH ORDINALITY AS t(tag_id, ord);

  UPDATE public.places SET updated_at = NOW() WHERE id = p_place_id;

  RETURN json_build_object('success', true, 'tagIds', p_tag_ids);
END;
$tags$;

ALTER FUNCTION public.set_place_tags(text, text[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_place_tags(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_place_tags(text, text[]) TO authenticated, service_role;

COMMIT;
