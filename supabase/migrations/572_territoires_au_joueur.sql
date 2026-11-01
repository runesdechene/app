-- WHY: un territoire est au joueur seul, jamais à une Compagnie, et n'en chevauche aucun autre
-- (Uriel, 01/11/2026). À Dijon, un joueur qui revendiquait tantôt pour lui, tantôt pour Le Lys de Fer
-- avait deux territoires emmêlés ; et les Compagnies se retirent peu à peu. Désormais :
--   1. la clé est le joueur qui tient le lieu, qu'il l'ait revendiqué pour lui ou pour une Compagnie ;
--   2. deux formes ne se croisent plus : le territoire qui a le plus de lieux garde la zone commune
--      (à égalité, l'ordre de son premier lieu), l'autre s'arrête à sa bordure. Les entailles autour
--      des lieux des autres (570) sont faites avant : les lieux du plus petit restent dans sa forme ;
--   3. une entaille ne dépasse plus la moitié de l'écart avec mon lieu le plus proche (150 m au plus) :
--      en ville, 8 lieux à moins de 150 m d'un lieu d'un autre sortaient de leur propre territoire.
-- `territoires_revendiques` perd `compagnie` (toujours vide désormais) : aucun front déployé ne la lit.
-- Définitions live copiées entières (pg_get_functiondef de la 570 et de la 571), puis modifiées.
-- SCHEMA CHECKED (2026-11-01) : aucune colonne nouvelle, celles des 569-571 ; noms_de_territoire n'a
-- aucune ligne en 'c:%' (vérifié), rien à reprendre.
CREATE OR REPLACE FUNCTION public._territoires()
RETURNS TABLE (cle text, lieux text[], forme extensions.geometry)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions' AS $function$
  WITH tous AS (
    -- Tous les lieux tenus, V1 comprise : ceux que la forme d'un autre doit contourner.
    SELECT v.place_id,
           'j:' || v.veilleur_user_id AS cle,
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
  ),
  entaillees AS (
    SELECT f.cle, f.lieux,
           row_number() OVER (ORDER BY cardinality(f.lieux) DESC, f.lieux[1]) AS rang,
           -- L'entaille autour du lieu d'un autre s'arrête à mi-chemin du plus proche des miens :
           -- deux voisins se partagent l'écart, et mon lieu reste dans ma forme.
           COALESCE(ST_Difference(f.forme, (
             SELECT ST_Union(ST_Buffer(a.pt::geography, LEAST(150, (
                      SELECT min(ST_Distance(a.pt::geography, g.pt::geography)) / 2
                      FROM grappes g WHERE g.place_id = ANY (f.lieux)
                    )))::geometry)
             FROM tous a
             WHERE a.cle <> f.cle AND ST_DWithin(a.pt::geography, f.forme::geography, 150)
           )), f.forme) AS forme
    FROM formes f
  ),
  seules AS (
    SELECT e.cle, e.lieux,
           COALESCE(ST_Difference(e.forme, (
             SELECT ST_Union(d.forme) FROM entaillees d
             WHERE d.rang < e.rang AND ST_Intersects(d.forme, e.forme)
           )), e.forme) AS forme
    FROM entaillees e
  )
  SELECT cle, lieux, ST_ForcePolygonCCW(forme)
  FROM seules
  WHERE NOT ST_IsEmpty(forme);
$function$;

CREATE OR REPLACE FUNCTION public.territoires_revendiques()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions' AS $function$
  SELECT COALESCE(json_agg(json_build_object(
    'id', t.lieux[1],
    'nom', n.nom,
    'moi', public._territoire_a_moi(t.cle, (auth.uid())::text),
    'lieux', cardinality(t.lieux),
    'forme', ST_AsGeoJSON(t.forme, 5)::json,
    'ancre', json_build_array(round(ST_X(ST_Centroid(t.forme))::numeric, 5),
                              round(ST_YMax(t.forme)::numeric, 5)),
    -- Ceux qui l'ont revendiqué avec lui (les expéditions de ses lieux), lui excepté.
    'compagnons', (SELECT count(DISTINCT m.user_id)
                   FROM place_veille v
                   JOIN expedition_members m ON m.expedition_id = v.expedition_id
                   WHERE v.place_id = ANY (t.lieux) AND m.user_id IS DISTINCT FROM v.veilleur_user_id),
    'joueur', (SELECT json_build_object(
                 'id', u.id,
                 'nom', user_public_name(u.id, u.display_name, u.first_name),
                 'avatar', u.avatar_url,
                 'niveau', public._level_from_xp(COALESCE(u.xp_total, 0)),
                 'titre', (SELECT public._nom_titre(ti, u.title_gender)
                           FROM unnest(u.displayed_title_ids_v3) WITH ORDINALITY AS x(tid, ord)
                           JOIN titles ti ON ti.id = x.tid AND ti.type = 'general'
                           ORDER BY x.ord LIMIT 1),
                 'signe', (SELECT json_build_object('nom', tf.name, 'imageUrl', COALESCE(tf.image_url, tf.icon_url))
                           FROM title_fragments tf
                           WHERE tf.id = u.signe_fragment_id AND tf.visible
                             AND COALESCE(tf.image_url, tf.icon_url) IS NOT NULL
                             AND EXISTS (SELECT 1 FROM user_fragments uf
                                         WHERE uf.user_id = u.id AND uf.fragment_id = tf.id)))
               FROM users u WHERE t.cle = 'j:' || u.id)
  )), '[]'::json)
  FROM public._territoires() t
  CROSS JOIN LATERAL (SELECT COALESCE(
    (SELECT nt.nom FROM noms_de_territoire nt
     WHERE nt.cle = t.cle AND nt.place_id = ANY (t.lieux)
     ORDER BY nt.nomme_le DESC LIMIT 1),
    (SELECT mode() WITHIN GROUP (ORDER BY
              COALESCE(NULLIF(x.title, ''), user_public_name(u.id, u.display_name, u.first_name)))
     FROM place_veille v
     LEFT JOIN expeditions x ON x.id = v.expedition_id
     LEFT JOIN users u ON u.id = v.veilleur_user_id
     WHERE v.place_id = ANY (t.lieux))
  ) AS nom) n;
$function$;
