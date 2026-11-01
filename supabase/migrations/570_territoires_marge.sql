-- WHY: deux corrections des territoires (Uriel, 01/11/2026), vues à Nice : 5 lieux tenus dans 571 m
-- faisaient un cercle de près de 4 km qui couvrait les lieux des autres.
--   1. La marge autour des lieux passe de 1,5 km à 300 m : le liseré colle aux lieux (Figma 873:2576).
--   2. Un territoire ne mange jamais un lieu tenu par un autre (V1 comprise) : la forme s'entaille de
--      150 m autour de lui — une enclave, ou deux morceaux si le lieu la coupe.
-- Les anneaux sont orientés comme le veut GeoJSON (ST_ForcePolygonCCW : l'extérieur dans le sens
-- trigonométrique, les enclaves dans l'autre) : la carte pose ses pointillés à gauche du trait, donc
-- toujours dedans.
-- Définition live copiée entière (pg_get_functiondef de la 569) ; signature inchangée.
-- SCHEMA CHECKED (2026-11-01) : aucune colonne nouvelle, celles de la 569.
CREATE OR REPLACE FUNCTION public._territoires()
RETURNS TABLE (cle text, lieux text[], forme extensions.geometry)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions' AS $function$
  WITH tous AS (
    -- Tous les lieux tenus, V1 comprise : ceux que la forme d'un autre doit contourner.
    SELECT v.place_id,
           CASE WHEN v.pour_compagnie IS NOT NULL THEN 'c:' || v.pour_compagnie
                ELSE 'j:' || v.veilleur_user_id END AS cle,
           ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326) AS pt,
           EXISTS (SELECT 1 FROM revendications r
                   WHERE r.place_id = v.place_id AND r.user_id = v.veilleur_user_id) AS gps_v2
    FROM place_veille v
    JOIN places p ON p.id = v.place_id
    WHERE v.veilleur_user_id IS NOT NULL AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
  ),
  grappes AS (
    -- shortcut: les 5 km sont mesurés en Web Mercator à la latitude de la France (46°), l'écart
    -- grandit loin d'elle ; passer en géographie si la carte s'ouvre au monde.
    SELECT place_id, cle, pt,
           ST_ClusterDBSCAN(ST_Transform(pt, 3857), eps => 5000 / cos(radians(46)), minpoints => 2)
             OVER (PARTITION BY cle) AS g
    FROM tous
    WHERE gps_v2
  ),
  formes AS (
    SELECT cle, array_agg(place_id ORDER BY place_id) AS lieux,
           ST_Buffer(ST_ConvexHull(ST_Collect(pt))::geography, 300)::geometry AS forme
    FROM grappes
    WHERE g IS NOT NULL
    GROUP BY cle, g
  )
  SELECT f.cle, f.lieux,
         ST_ForcePolygonCCW(COALESCE(ST_Difference(f.forme, (
           SELECT ST_Union(ST_Buffer(a.pt::geography, 150)::geometry)
           FROM tous a
           WHERE a.cle <> f.cle AND ST_DWithin(a.pt::geography, f.forme::geography, 150)
         )), f.forme))
  FROM formes f;
$function$;
