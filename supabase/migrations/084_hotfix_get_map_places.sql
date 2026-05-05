-- 084_hotfix_get_map_places.sql
-- WHY : HOTFIX URGENT. La RPC get_map_places (baseline mig 001) fait des
-- LEFT JOIN LATERAL sur la table `place_influence` que la mig 077 a droppée.
-- Conséquence prod (5 mai 2026 nuit) :
--   - get_map_places plante avec "relation place_influence does not exist"
--   - usePlaces ne reçoit pas de places → carte vide
--   - Minimap (qui dépend du geojson) disparaît aussi
--
-- ROOT CAUSE : encore une violation de la règle B1. J'ai droppé `place_influence`
-- sans auditer les RPCs qui faisaient des JOIN dessus. Audit aurait montré
-- get_map_places dans la baseline mig 001 lignes 2613+ (LATERAL place_influence
-- 6 fois dans 3 branches de CASE).
--
-- FIX : reécriture de get_map_places en supprimant tous les JOIN sur
-- place_influence. Les champs `faction`, `totalInfluence`, `influenceByFaction`
-- retournés deviennent stables :
--   - faction = NULL (la vraie info "faction du lieu" est désormais dans
--     place_veille via la Veille V0.7, à intégrer dans une future itération)
--   - totalInfluence = 0
--   - influenceByFaction = {}
-- Le frontend (usePlaces.ts) utilise déjà `?? 0` et `?? {}` en fallback,
-- donc compatible.
--
-- Évolution V2 : remplacer ces champs par les données issues de place_veille
-- (faction du veilleur courant) pour que la carte garde sa coloration tribale.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_map_places(
  p_type            text DEFAULT 'all',
  p_latitude        double precision DEFAULT NULL,
  p_longitude       double precision DEFAULT NULL,
  p_latitude_delta  double precision DEFAULT NULL,
  p_longitude_delta double precision DEFAULT NULL,
  p_limit           integer DEFAULT 100,
  p_user_id         text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  IF p_type = 'all' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id, 'title', t.title, 'color', t.color, 'background', t.background
          ) ELSE NULL END,
        'faction', NULL,
        'claimedByName', NULL,
        'claimedById', NULL,
        'fortificationLevel', 0,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0) + COALESCE(vw.views_count, 0) * 0.1 + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'totalInfluence', 0,
        'influenceByFaction', '{}'::json
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count FROM places_liked GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count FROM places_viewed GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count FROM places_explored GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;

  ELSIF p_type = 'popular' THEN
    SELECT json_agg(row_data) INTO v_result
    FROM (
      SELECT json_build_object(
        'id', p.id,
        'title', p.title,
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id, 'title', t.title, 'color', t.color, 'background', t.background
          ) ELSE NULL END,
        'faction', NULL,
        'claimedByName', NULL,
        'claimedById', NULL,
        'fortificationLevel', 0,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0) + COALESCE(vw.views_count, 0) * 0.1 + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'totalInfluence', 0,
        'influenceByFaction', '{}'::json
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN places_viewed pv ON pv.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count FROM places_liked GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count FROM places_viewed GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count FROM places_explored GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
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
        'type', json_build_object('id', pt.id, 'title', pt.title),
        'primaryTag', CASE
          WHEN t.id IS NOT NULL THEN json_build_object(
            'id', t.id, 'title', t.title, 'color', t.color, 'background', t.background
          ) ELSE NULL END,
        'faction', NULL,
        'claimedByName', NULL,
        'claimedById', NULL,
        'fortificationLevel', 0,
        'location', json_build_object('latitude', p.latitude, 'longitude', p.longitude),
        'likes', COALESCE(lk.likes_count, 0),
        'score', ROUND(
          COALESCE(lk.likes_count, 0) + COALESCE(vw.views_count, 0) * 0.1 + COALESCE(ex.explored_count, 0) * 2
        )::int,
        'totalInfluence', 0,
        'influenceByFaction', '{}'::json
      ) AS row_data
      FROM places p
      LEFT JOIN place_types pt ON pt.id = p.place_type_id
      LEFT JOIN place_tags ptag ON ptag.place_id = p.id AND ptag.is_primary = TRUE
      LEFT JOIN tags t ON t.id = ptag.tag_id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS likes_count FROM places_liked GROUP BY place_id
      ) lk ON lk.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS views_count FROM places_viewed GROUP BY place_id
      ) vw ON vw.place_id = p.id
      LEFT JOIN (
        SELECT place_id, COUNT(*)::int AS explored_count FROM places_explored GROUP BY place_id
      ) ex ON ex.place_id = p.id
      WHERE p.place_type_id = 'lieu'
      ORDER BY p.created_at DESC
      LIMIT p_limit
    ) sub;
  END IF;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;

GRANT ALL ON FUNCTION public.get_map_places(text, double precision, double precision, double precision, double precision, integer, text)
  TO anon, authenticated, service_role;

COMMIT;
