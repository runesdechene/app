-- 333_mod_list_places_masked_filter.sql
-- WHY : la page de modération n'avait aucun moyen de retrouver les lieux masqués
-- (masquer = retrait réversible ; il faut pouvoir les revoir/démasquer). On étend
-- p_filter de mod_list_places pour accepter 'masked' (ne renvoie que masked=true,
-- indépendamment du statut vérifié). Les autres filtres sont inchangés : un lieu
-- masqué reste visible dans 'unverified'/'all' (il porte un badge « masqué »).
-- Corps copié de la def LIVE (mig 332), seule la branche 'masked' ajoutée aux deux
-- clauses WHERE.
--
-- Réversible : restaurer le corps mig 332.

BEGIN;

CREATE OR REPLACE FUNCTION public.mod_list_places(
  p_search text DEFAULT NULL::text,
  p_filter text DEFAULT 'unverified'::text,
  p_tag_id text DEFAULT NULL::text,
  p_limit  integer DEFAULT 50,
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
     AND (p_filter <> 'masked'     OR p.masked = true)
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
      AND (p_filter <> 'masked'     OR p.masked = true)
      AND (p_tag_id IS NULL OR EXISTS (
            SELECT 1 FROM public.place_tags pt
             WHERE pt.place_id = p.id AND pt.tag_id = p_tag_id))
    ORDER BY (p.verified_at IS NOT NULL), p.created_at DESC
    LIMIT GREATEST(p_limit, 1) OFFSET GREATEST(p_offset, 0)
  ) r;

  RETURN json_build_object('total', v_total, 'rows', COALESCE(v_rows, '[]'::json));
END; $function$;

COMMIT;
