-- WHY: plus de blason sur la carte, il prenait trop de place (Uriel, 01/11/2026) : un territoire n'a
-- plus qu'un nom, posé sur sa bordure, et un clic sur ce nom permet à ceux qui le tiennent de le
-- renommer — le joueur, et ceux qui ont revendiqué ses lieux avec lui sur place (« la personne / les
-- personnes concernées »).
--   1. `_tient_le_territoire` remplace `_territoire_a_moi` : le joueur de la clé, ou un membre d'une
--      expédition d'un de ses lieux. `_territoire_a_moi` n'est plus appelée que par les deux fonctions
--      remplacées ici (grep des migrations et des apps, 01/11) : elle part.
--   2. `territoires_revendiques` ne rend plus ce que le blason montrait (`joueur`, `compagnons`) :
--      aucun front déployé ne la lit encore.
--   3. `renommer_territoire` accepte les compagnons.
--   Et les lieux plantés sur place en V1 dessinent aussi un territoire (Uriel, 01/11, vu à
--   Saint-Raphaël : 15 lieux de Gautier plantés sur place en mai-juillet, aucun territoire) ; les
--   prises à distance par l'influence, non. Mesure : 254 territoires pour 41 joueurs, au lieu de 17.
-- Définitions live copiées entières (572 pour _territoires, 574 pour territoires_revendiques, 569
-- pour renommer_territoire).
-- SCHEMA CHECKED (2026-11-01) : expedition_members(expedition_id, user_id), place_veille.expedition_id
-- — migration 537 ; place_veille.by_influence, jamais nul (compté le 01/11 : 1 670 faux, 1 856 vrais).
CREATE OR REPLACE FUNCTION public._territoires()
RETURNS TABLE (cle text, lieux text[], forme extensions.geometry)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions' AS $function$
  -- shortcut: tout se mesure en Web Mercator (mètres de projection), un mètre réel valant 1/cos(46°) à
  -- la latitude de la France ; l'écart grandit loin d'elle. Passer en géographie si la carte s'ouvre au
  -- monde. En géographie, le calcul prenait 21 s pour 254 territoires.
  WITH echelle AS (SELECT 1 / cos(radians(46)) AS k),
  tous AS (
    -- Tous les lieux tenus, prises à distance comprises : ceux que la forme d'un autre doit contourner.
    SELECT v.place_id,
           'j:' || v.veilleur_user_id AS cle,
           ST_Transform(ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326), 3857) AS pt,
           -- Planté sur place, en V1 comme en V2 ; une prise à distance par l'influence (V1) ne compte pas.
           NOT v.by_influence AS sur_place
    FROM place_veille v
    JOIN places p ON p.id = v.place_id
    WHERE v.veilleur_user_id IS NOT NULL AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
  ),
  grappes AS (
    SELECT place_id, cle, pt,
           ST_ClusterDBSCAN(pt, eps => 5000 * (SELECT k FROM echelle), minpoints => 2)
             OVER (PARTITION BY cle) AS g
    FROM tous
    WHERE sur_place
  ),
  formes AS (
    SELECT cle, array_agg(place_id ORDER BY place_id) AS lieux, ST_Collect(pt) AS points,
           ST_Buffer(ST_ConvexHull(ST_Collect(pt)), 300 * (SELECT k FROM echelle)) AS forme
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
             SELECT ST_Union(ST_Buffer(a.pt, LEAST(150 * (SELECT k FROM echelle), ST_Distance(a.pt, f.points) / 2)))
             FROM tous a
             WHERE a.cle <> f.cle
               AND a.pt && ST_Expand(f.forme, 150 * (SELECT k FROM echelle))
               AND ST_DWithin(a.pt, f.forme, 150 * (SELECT k FROM echelle))
           )), f.forme) AS forme
    FROM formes f
  ),
  seules AS (
    SELECT e.cle, e.lieux,
           COALESCE(ST_Difference(e.forme, (
             SELECT ST_Union(d.forme) FROM entaillees d
             WHERE d.rang < e.rang AND d.forme && e.forme AND ST_Intersects(d.forme, e.forme)
           )), e.forme) AS forme
    FROM entaillees e
  )
  SELECT cle, lieux, ST_ForcePolygonCCW(ST_Transform(forme, 4326))
  FROM seules
  WHERE NOT ST_IsEmpty(forme);
$function$;

CREATE FUNCTION public._tient_le_territoire(p_cle text, p_lieux text[], p_moi text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $function$
  SELECT p_cle = 'j:' || p_moi
      OR EXISTS (SELECT 1 FROM place_veille v
                 JOIN expedition_members m ON m.expedition_id = v.expedition_id
                 WHERE v.place_id = ANY (p_lieux) AND m.user_id = p_moi);
$function$;
REVOKE ALL ON FUNCTION public._tient_le_territoire(text, text[], text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.territoires_revendiques()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions' AS $function$
  SELECT COALESCE(json_agg(json_build_object(
    'id', t.lieux[1],
    'nom', n.nom,
    'moi', public._tient_le_territoire(t.cle, t.lieux, (auth.uid())::text),
    'lieux', cardinality(t.lieux),
    'ids', t.lieux,
    'forme', ST_AsGeoJSON(t.forme, 5)::json,
    'ancre', json_build_array(round(ST_X(ST_Centroid(t.forme))::numeric, 5),
                              round(COALESCE(ST_YMax(ST_Intersection(t.forme, ST_MakeLine(
                                ST_SetSRID(ST_MakePoint(ST_X(ST_Centroid(t.forme)), ST_YMin(t.forme) - 1), 4326),
                                ST_SetSRID(ST_MakePoint(ST_X(ST_Centroid(t.forme)), ST_YMax(t.forme) + 1), 4326)))),
                                ST_YMax(t.forme))::numeric, 5))
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

CREATE OR REPLACE FUNCTION public.renommer_territoire(p_lieu text, p_nom text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $function$
DECLARE
  v_moi text := (auth.uid())::text;
  v_nom text := NULLIF(btrim(p_nom), '');
  v_cle text;
  v_lieux text[];
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';
  END IF;
  IF v_nom IS NULL OR char_length(v_nom) > 40 THEN
    RAISE EXCEPTION 'Nom de territoire invalide' USING ERRCODE = '22023';
  END IF;

  SELECT t.cle, t.lieux INTO v_cle, v_lieux FROM public._territoires() t WHERE p_lieu = ANY (t.lieux);
  IF v_cle IS NULL THEN
    RAISE EXCEPTION 'Pas de territoire ici' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public._tient_le_territoire(v_cle, v_lieux, v_moi) THEN
    RAISE EXCEPTION 'Ce territoire n''est pas le tien' USING ERRCODE = '42501';
  END IF;

  INSERT INTO noms_de_territoire (place_id, cle, nom)
  SELECT unnest(v_lieux), v_cle, v_nom
  ON CONFLICT (place_id, cle) DO UPDATE SET nom = EXCLUDED.nom, nomme_le = now();
END;
$function$;

DROP FUNCTION public._territoire_a_moi(text, text);
