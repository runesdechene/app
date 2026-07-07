-- 332_mod_places_images.sql
-- WHY : la page de modération n'affichait aucune image (PlaceRow montrait une vignette
-- emoji). Or juger un lieu douteux passe d'abord par voir sa/ses photo(s). On étend les
-- deux RPC de lecture pour renvoyer les images : mod_list_places gagne `thumb_url` (vignette
-- du 1er cliché — `thumb` si présent, sinon `url` pour les lieux legacy Firebase sans thumb),
-- et mod_get_place gagne `images` (tableau complet {id,url,thumb} pour la galerie du panneau).
-- places.images = jsonb array d'objets. Bodies copiés de la def LIVE (mig 329), seuls les
-- champs image ajoutés.
--
-- Réversible : restaurer les corps mig 329 des deux fonctions.

BEGIN;

CREATE OR REPLACE FUNCTION public.mod_list_places(
  p_search text DEFAULT NULL::text,
  p_filter text DEFAULT 'unverified'::text,
  p_tag_id text DEFAULT NULL::text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
      CASE WHEN jsonb_typeof(p.images) = 'array' AND jsonb_array_length(p.images) > 0
           THEN COALESCE(p.images->0->>'thumb', p.images->0->>'url')
           ELSE NULL END AS thumb_url,
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
END; $function$;

CREATE OR REPLACE FUNCTION public.mod_get_place(p_place_id text)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
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
    'photo_count', CASE WHEN jsonb_typeof(p.images) = 'array' THEN jsonb_array_length(p.images) ELSE 0 END,
    'images', CASE WHEN jsonb_typeof(p.images) = 'array' THEN p.images ELSE '[]'::jsonb END
  ) INTO v_json
  FROM public.places p
  LEFT JOIN public.users au ON au.id = p.author_id
  LEFT JOIN public.users vu ON vu.id = p.verified_by
  WHERE p.id = p_place_id;

  IF v_json IS NULL THEN
    RETURN json_build_object('error','place_not_found');
  END IF;
  RETURN v_json;
END; $function$;

COMMIT;
