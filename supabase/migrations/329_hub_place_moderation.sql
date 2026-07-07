-- 329_hub_place_moderation.sql
-- WHY : page de modération Hub. Des modérateurs (role='moderator') corrigent les
-- tags des lieux, masquent les hors-sujet, et marquent « vérifié » ce qu'ils ont
-- passé en revue. Canal privilégié dédié : gate par rôle (_is_staff), JAMAIS la
-- garde présence _can_edit_place_meta (pensée joueur), et AUCUNE écriture dans le
-- fil de jeu (place_contributions / activity_log / notifications) — une action de
-- modération n'est pas une contribution. Audit dans place_moderation_log ; les
-- changements de tags restent aussi tracés dans place_tags_revisions.
--
-- Réversible : DROP des 6 fonctions mod_* + _is_staff ; DROP TABLE
-- place_moderation_log ; ALTER TABLE places DROP COLUMN verified_at, verified_by.

BEGIN;

-- 1) État « vérifié » global du lieu -----------------------------------------
ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS verified_by text NULL
    REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.places.verified_at IS
  'Non NULL = lieu passé en revue par un modérateur (page Hub Modération).';

-- 2) Journal d'audit des actions de modération -------------------------------
CREATE TABLE IF NOT EXISTS public.place_moderation_log (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  place_id     varchar(255) NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  moderator_id text NULL REFERENCES public.users(id) ON DELETE SET NULL,
  action       text NOT NULL,   -- set_tags | update | mask | unmask | verify | unverify
  detail       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_place_moderation_log_place
  ON public.place_moderation_log (place_id, created_at DESC);
GRANT SELECT ON public.place_moderation_log TO authenticated, service_role;

-- 3) Gate staff --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._is_staff(p_caller text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $staff$
  SELECT p_caller IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_caller AND role IN ('admin','moderator')
  );
$staff$;
ALTER FUNCTION public._is_staff(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public._is_staff(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._is_staff(text) TO authenticated, service_role;

-- 4) mod_list_places : liste paginée serveur + total ------------------------
CREATE OR REPLACE FUNCTION public.mod_list_places(
  p_search text DEFAULT NULL,
  p_filter text DEFAULT 'unverified',
  p_tag_id text DEFAULT NULL,
  p_limit  int  DEFAULT 50,
  p_offset int  DEFAULT 0
) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $list$
DECLARE
  v_caller text := public._caller_user_id();
  v_total  int;
  v_rows   json;
BEGIN
  IF NOT public._is_staff(v_caller) THEN
    RETURN json_build_object('error','not_staff');
  END IF;

  SELECT count(*) INTO v_total
    FROM public.places p
   WHERE (p_search IS NULL OR p.title ILIKE '%'||p_search||'%')
     AND (p_filter <> 'unverified' OR p.verified_at IS NULL)
     AND (p_filter <> 'verified'   OR p.verified_at IS NOT NULL)
     AND (p_tag_id IS NULL OR EXISTS (
           SELECT 1 FROM public.place_tags pt
            WHERE pt.place_id = p.id AND pt.tag_id = p_tag_id));

  SELECT json_agg(row_to_json(r)) INTO v_rows FROM (
    SELECT
      p.id, p.title, p.address, p.latitude, p.longitude,
      p.masked, p.sensible, p.created_at, p.verified_at, p.author_id,
      COALESCE(au.display_name, au.first_name) AS author_name,
      vu.display_name AS verified_by_name,
      CASE WHEN jsonb_typeof(p.images) = 'array'
           THEN jsonb_array_length(p.images) ELSE 0 END AS photo_count,
      (SELECT count(*) FROM public.place_explorers pe WHERE pe.place_id = p.id) AS visit_count,
      COALESCE((
        SELECT json_agg(json_build_object(
                 'id', t.id, 'title', t.title, 'color', t.color,
                 'background', t.background, 'is_primary', pt.is_primary)
                 ORDER BY pt.is_primary DESC)
          FROM public.place_tags pt JOIN public.tags t ON t.id = pt.tag_id
         WHERE pt.place_id = p.id), '[]'::json) AS tags
    FROM public.places p
    LEFT JOIN public.users au ON au.id = p.author_id
    LEFT JOIN public.users vu ON vu.id = p.verified_by
    WHERE (p_search IS NULL OR p.title ILIKE '%'||p_search||'%')
      AND (p_filter <> 'unverified' OR p.verified_at IS NULL)
      AND (p_filter <> 'verified'   OR p.verified_at IS NOT NULL)
      AND (p_tag_id IS NULL OR EXISTS (
            SELECT 1 FROM public.place_tags pt
             WHERE pt.place_id = p.id AND pt.tag_id = p_tag_id))
    ORDER BY (p.verified_at IS NOT NULL), p.created_at DESC
    LIMIT GREATEST(p_limit, 1) OFFSET GREATEST(p_offset, 0)
  ) r;

  RETURN json_build_object('total', v_total, 'rows', COALESCE(v_rows, '[]'::json));
END; $list$;
ALTER FUNCTION public.mod_list_places(text,text,text,int,int) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mod_list_places(text,text,text,int,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_list_places(text,text,text,int,int) TO authenticated, service_role;

-- 5) mod_get_place : détail complet (panneau d'édition) ---------------------
CREATE OR REPLACE FUNCTION public.mod_get_place(p_place_id text)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $get$
DECLARE
  v_caller text := public._caller_user_id();
  v_json   json;
BEGIN
  IF NOT public._is_staff(v_caller) THEN
    RETURN json_build_object('error','not_staff');
  END IF;

  SELECT json_build_object(
    'id', p.id, 'title', p.title, 'text', p.text, 'address', p.address,
    'latitude', p.latitude, 'longitude', p.longitude,
    'masked', p.masked, 'sensible', p.sensible,
    'created_at', p.created_at, 'updated_at', p.updated_at,
    'verified_at', p.verified_at,
    'verified_by_name', vu.display_name,
    'author_id', p.author_id,
    'author_name', COALESCE(au.display_name, au.first_name),
    'author_contributions', au.contributions_count,
    'author_places_count', (SELECT count(*) FROM public.places pa WHERE pa.author_id = p.author_id),
    'visit_count', (SELECT count(*) FROM public.place_explorers pe WHERE pe.place_id = p.id),
    'discovered_count', (SELECT count(*) FROM public.places_discovered pd WHERE pd.place_id = p.id),
    'rating_avg', (SELECT round(avg(rating)::numeric, 1) FROM public.place_ratings pr WHERE pr.place_id = p.id),
    'rating_count', (SELECT count(*) FROM public.place_ratings pr WHERE pr.place_id = p.id),
    'photo_count', CASE WHEN jsonb_typeof(p.images) = 'array' THEN jsonb_array_length(p.images) ELSE 0 END
  ) INTO v_json
  FROM public.places p
  LEFT JOIN public.users au ON au.id = p.author_id
  LEFT JOIN public.users vu ON vu.id = p.verified_by
  WHERE p.id = p_place_id;

  IF v_json IS NULL THEN
    RETURN json_build_object('error','place_not_found');
  END IF;
  RETURN v_json;
END; $get$;
ALTER FUNCTION public.mod_get_place(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mod_get_place(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_get_place(text) TO authenticated, service_role;

-- 6) mod_set_place_tags : baseline mig 238 SAUF gate = _is_staff -------------
-- (copie-colle de set_place_tags mig 238 ; seule différence : le gate présence
--  _can_edit_place_meta est remplacé par _is_staff, + ligne place_moderation_log.)
CREATE OR REPLACE FUNCTION public.mod_set_place_tags(p_place_id text, p_tag_ids text[])
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $tags$
DECLARE
  v_caller  text := public._caller_user_id();
  v_n       int  := COALESCE(array_length(p_tag_ids, 1), 0);
  v_old_pat jsonb;
  v_old_ids text[];
BEGIN
  IF NOT public._is_staff(v_caller) THEN
    RETURN json_build_object('error','not_staff');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) THEN
    RETURN json_build_object('error','place_not_found');
  END IF;
  IF v_n < 1 THEN RETURN json_build_object('error','no_tags'); END IF;
  IF v_n > 3 THEN RETURN json_build_object('error','too_many_tags'); END IF;
  IF (SELECT count(DISTINCT tid) FROM unnest(p_tag_ids) tid) <> v_n THEN
    RETURN json_build_object('error','duplicate_tag');
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_tag_ids) tid
     WHERE NOT EXISTS (SELECT 1 FROM public.tags WHERE id = tid)
  ) THEN
    RETURN json_build_object('error','invalid_tag');
  END IF;

  SELECT jsonb_object_agg(tag_id, to_jsonb(created_by)),
         array_agg(tag_id ORDER BY is_primary DESC)
    INTO v_old_pat, v_old_ids
    FROM public.place_tags WHERE place_id = p_place_id;

  DELETE FROM public.place_tags WHERE place_id = p_place_id;

  INSERT INTO public.place_tags (place_id, tag_id, is_primary, created_at, created_by)
  SELECT p_place_id, t.tag_id, (t.ord = 1), NOW(),
         CASE WHEN v_old_pat ? t.tag_id
              THEN NULLIF(v_old_pat->>t.tag_id, '')
              ELSE v_caller END
  FROM unnest(p_tag_ids) WITH ORDINALITY AS t(tag_id, ord);

  INSERT INTO public.place_tags_revisions (place_id, changed_by, old_tag_ids, new_tag_ids)
  VALUES (p_place_id, v_caller, COALESCE(v_old_ids, '{}'), p_tag_ids);

  INSERT INTO public.place_moderation_log (place_id, moderator_id, action, detail)
  VALUES (p_place_id, v_caller, 'set_tags',
          jsonb_build_object('old', COALESCE(v_old_ids,'{}'), 'new', p_tag_ids));

  UPDATE public.places SET updated_at = NOW() WHERE id = p_place_id;
  RETURN json_build_object('success', true, 'tagIds', p_tag_ids);
END; $tags$;
ALTER FUNCTION public.mod_set_place_tags(text, text[]) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mod_set_place_tags(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_set_place_tags(text, text[]) TO authenticated, service_role;

-- 7) mod_update_place : title / text / sensible -----------------------------
CREATE OR REPLACE FUNCTION public.mod_update_place(
  p_place_id text, p_title text, p_text text, p_sensible boolean
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $upd$
DECLARE v_caller text := public._caller_user_id();
BEGIN
  IF NOT public._is_staff(v_caller) THEN
    RETURN json_build_object('error','not_staff');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) THEN
    RETURN json_build_object('error','place_not_found');
  END IF;

  UPDATE public.places SET
    title    = COALESCE(NULLIF(TRIM(p_title), ''), title),
    text     = COALESCE(p_text, text),
    sensible = COALESCE(p_sensible, sensible),
    updated_at = NOW()
  WHERE id = p_place_id;

  INSERT INTO public.place_moderation_log (place_id, moderator_id, action, detail)
  VALUES (p_place_id, v_caller, 'update',
          jsonb_build_object('title', p_title, 'sensible', p_sensible));

  RETURN json_build_object('success', true);
END; $upd$;
ALTER FUNCTION public.mod_update_place(text,text,text,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mod_update_place(text,text,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_update_place(text,text,text,boolean) TO authenticated, service_role;

-- 8) mod_set_masked : retrait réversible de l'app ---------------------------
CREATE OR REPLACE FUNCTION public.mod_set_masked(p_place_id text, p_masked boolean)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $mask$
DECLARE v_caller text := public._caller_user_id();
BEGIN
  IF NOT public._is_staff(v_caller) THEN
    RETURN json_build_object('error','not_staff');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) THEN
    RETURN json_build_object('error','place_not_found');
  END IF;

  UPDATE public.places SET masked = p_masked, updated_at = NOW() WHERE id = p_place_id;

  INSERT INTO public.place_moderation_log (place_id, moderator_id, action, detail)
  VALUES (p_place_id, v_caller, CASE WHEN p_masked THEN 'mask' ELSE 'unmask' END, '{}'::jsonb);

  RETURN json_build_object('success', true, 'masked', p_masked);
END; $mask$;
ALTER FUNCTION public.mod_set_masked(text,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mod_set_masked(text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_set_masked(text,boolean) TO authenticated, service_role;

-- 9) mod_set_verified : bascule vérifié -------------------------------------
CREATE OR REPLACE FUNCTION public.mod_set_verified(p_place_id text, p_verified boolean)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $ver$
DECLARE v_caller text := public._caller_user_id();
BEGIN
  IF NOT public._is_staff(v_caller) THEN
    RETURN json_build_object('error','not_staff');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) THEN
    RETURN json_build_object('error','place_not_found');
  END IF;

  IF p_verified THEN
    UPDATE public.places SET verified_at = NOW(), verified_by = v_caller WHERE id = p_place_id;
  ELSE
    UPDATE public.places SET verified_at = NULL, verified_by = NULL WHERE id = p_place_id;
  END IF;

  INSERT INTO public.place_moderation_log (place_id, moderator_id, action, detail)
  VALUES (p_place_id, v_caller, CASE WHEN p_verified THEN 'verify' ELSE 'unverify' END, '{}'::jsonb);

  RETURN json_build_object('success', true, 'verified', p_verified);
END; $ver$;
ALTER FUNCTION public.mod_set_verified(text,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mod_set_verified(text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mod_set_verified(text,boolean) TO authenticated, service_role;

COMMIT;
