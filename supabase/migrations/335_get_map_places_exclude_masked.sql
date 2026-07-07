-- 335_get_map_places_exclude_masked.sql
-- WHY : la modération Hub permet de « Masquer » un lieu (retrait réversible pour les
-- lieux qui n'ont rien à faire sur l'app), mais get_map_places — qui alimente TOUS
-- les marqueurs de la carte (usePlaces charge 5000 lieux) et donc la recherche
-- (filtrée client-side sur ce même jeu) — ne filtrait jamais masked. Résultat : un
-- lieu masqué restait visible carte + recherche. On ajoute `AND p.masked = false`
-- aux deux branches (popular / else). Corps copié de la def LIVE, seul ce filtre ajouté.
-- (Portée volontairement limitée : get_place_by_id / get_place_detail_v05 restent
--  accessibles par lien direct — décision Uriel.)
--
-- Réversible : retirer `AND p.masked = false` des deux WHERE.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_map_places(
  p_type text DEFAULT 'all'::text,
  p_latitude double precision DEFAULT NULL::double precision,
  p_longitude double precision DEFAULT NULL::double precision,
  p_latitude_delta double precision DEFAULT NULL::double precision,
  p_longitude_delta double precision DEFAULT NULL::double precision,
  p_limit integer DEFAULT 100,
  p_user_id text DEFAULT NULL::text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'address', p.address,
        'eraId', p.era_id,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE WHEN t.id IS NOT NULL THEN json_build_object(
          'id', t.id, 'title', t.title, 'color', t.color, 'background', t.background) ELSE NULL END,
        'tagIds', COALESCE((SELECT array_agg(pt2.tag_id) FROM place_tags pt2 WHERE pt2.place_id = p.id), ARRAY[]::text[]),
        'faction', NULL,
        'claimedByName', NULL,
        'claimedById', NULL,
        'fortificationLevel', 0,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(COALESCE(lk.likes_count, 0) + COALESCE(vw.views_count, 0) * 0.1 + COALESCE(ex.explored_count, 0) * 2)::int,
        'totalInfluence', 0,
        'influenceByFaction', '{}'::json
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN (SELECT place_id, COUNT(*)::int AS likes_count FROM places_liked GROUP BY place_id) lk ON lk.place_id = p.id
      LEFT JOIN (SELECT place_id, COUNT(*)::int AS views_count FROM places_viewed GROUP BY place_id) vw ON vw.place_id = p.id
      LEFT JOIN (SELECT place_id, COUNT(*)::int AS explored_count FROM places_explored GROUP BY place_id) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu' AND p.masked = false
      GROUP BY p.id, pt.id, t.id, lk.likes_count, vw.views_count, ex.explored_count
      ORDER BY COUNT(pv.id) DESC
      LIMIT p_limit
    ) sub;
  ELSE
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'address', p.address,
        'eraId', p.era_id,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE WHEN t.id IS NOT NULL THEN json_build_object(
          'id', t.id, 'title', t.title, 'color', t.color, 'background', t.background) ELSE NULL END,
        'tagIds', COALESCE((SELECT array_agg(pt2.tag_id) FROM place_tags pt2 WHERE pt2.place_id = p.id), ARRAY[]::text[]),
        'faction', NULL,
        'claimedByName', NULL,
        'claimedById', NULL,
        'fortificationLevel', 0,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(COALESCE(lk.likes_count, 0) + COALESCE(vw.views_count, 0) * 0.1 + COALESCE(ex.explored_count, 0) * 2)::int,
        'totalInfluence', 0,
        'influenceByFaction', '{}'::json
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN (SELECT place_id, COUNT(*)::int AS likes_count FROM places_liked GROUP BY place_id) lk ON lk.place_id = p.id
      LEFT JOIN (SELECT place_id, COUNT(*)::int AS views_count FROM places_viewed GROUP BY place_id) vw ON vw.place_id = p.id
      LEFT JOIN (SELECT place_id, COUNT(*)::int AS explored_count FROM places_explored GROUP BY place_id) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu' AND p.masked = false
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$function$;

COMMIT;
