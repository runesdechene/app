-- WHY: Hub V2, plan 2 : la liste des lieux à modérer. mod_list_places filtre les « non vérifiés » sur
--      tout l'historique (3 508 lieux) alors que la pastille du menu compte ceux depuis la bascule
--      (12 au 14/10) : la liste doit dire la même chose que la pastille. Corps repris de la définition
--      live de mod_list_places ; changent seulement le nom, la garde (_is_admin), les filtres
--      (a_moderer, verifies, masques, tous) et la recherche (position, sans joker) ; le filtre par
--      nature garde le paramètre p_nature (id de tag). Bascule : minuit à Paris, le 07/10/2026.
-- SCHEMA CHECKED (14/10/2026, live) : pg_get_functiondef de mod_list_places copiée entière.

CREATE OR REPLACE FUNCTION public.hub_lieux(p_filtre text DEFAULT 'a_moderer'::text, p_recherche text DEFAULT NULL::text, p_nature text DEFAULT NULL::text, p_limite integer DEFAULT 50, p_decalage integer DEFAULT 0)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total  int;
  v_rows   json;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  IF p_filtre NOT IN ('a_moderer','verifies','masques','tous') THEN PERFORM _refus('Filtre inconnu', 'filtre'); END IF;

  SELECT count(*) INTO v_total
    FROM public.places p
   WHERE (NULLIF(lower(btrim(p_recherche)),'') IS NULL OR position(lower(btrim(p_recherche)) IN lower(p.title)) > 0)
     AND (p_filtre <> 'a_moderer' OR (p.masked = false AND p.verified_at IS NULL AND p.created_at >= '2026-10-07 00:00:00+02'::timestamptz))
     AND (p_filtre <> 'verifies'  OR (p.masked = false AND p.verified_at IS NOT NULL))
     AND (p_filtre <> 'masques'   OR p.masked = true)
     AND (p_nature IS NULL OR EXISTS (
           SELECT 1 FROM public.place_tags pt
            WHERE pt.place_id = p.id AND pt.tag_id = p_nature));

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
    WHERE (NULLIF(lower(btrim(p_recherche)),'') IS NULL OR position(lower(btrim(p_recherche)) IN lower(p.title)) > 0)
      AND (p_filtre <> 'a_moderer' OR (p.masked = false AND p.verified_at IS NULL AND p.created_at >= '2026-10-07 00:00:00+02'::timestamptz))
      AND (p_filtre <> 'verifies'  OR (p.masked = false AND p.verified_at IS NOT NULL))
      AND (p_filtre <> 'masques'   OR p.masked = true)
      AND (p_nature IS NULL OR EXISTS (
            SELECT 1 FROM public.place_tags pt
             WHERE pt.place_id = p.id AND pt.tag_id = p_nature))
    ORDER BY (p.verified_at IS NOT NULL), p.created_at DESC
    LIMIT GREATEST(p_limite, 1) OFFSET GREATEST(p_decalage, 0)
  ) r;

  RETURN json_build_object('total', v_total, 'rows', COALESCE(v_rows, '[]'::json));
END; $function$;

REVOKE ALL ON FUNCTION public.hub_lieux(text, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_lieux(text, text, text, integer, integer) TO authenticated;
