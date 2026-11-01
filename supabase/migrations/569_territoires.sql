-- WHY: les territoires reviennent sur la carte (Uriel, 01/11/2026). Dès 2 lieux tenus à moins de
-- 5 km par le même joueur, ou la même Compagnie quand la revendication est faite pour elle, un
-- liseré se dessine autour d'eux et grandit à chaque lieu. Seules les revendications GPS de la V2
-- comptent (le tenant a sa ligne dans `revendications`) : les lieux tenus depuis la V1 gardent leur
-- nom mais ne dessinent rien. La clé est le joueur ou la Compagnie, jamais le nom saisi.
-- Un territoire se recalcule à chaque lecture (il grandit, se coupe, fusionne) : son nom est donc
-- posé sur ses lieux. Il porte le dernier nom choisi parmi eux, sinon le nom de revendication le
-- plus porté ; un lieu repris par un autre ne garde pas le nom.
-- SCHEMA CHECKED (2026-11-01) :
--   place_veille.place_id, veilleur_user_id : TEXT ; pour_compagnie : VARCHAR — information_schema
--   revendications(place_id TEXT, user_id VARCHAR, pour_compagnie VARCHAR) — information_schema
--   places.latitude, longitude : REAL ; PostGIS installé — pg_extension

CREATE TABLE public.noms_de_territoire (
  place_id text NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  cle text NOT NULL, -- 'j:<joueur>' ou 'c:<compagnie>', comme _territoires()
  nom text NOT NULL CHECK (char_length(nom) BETWEEN 1 AND 40),
  nomme_le timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (place_id, cle)
);
-- Aucune politique : on n'y passe que par les fonctions ci-dessous.
ALTER TABLE public.noms_de_territoire ENABLE ROW LEVEL SECURITY;


-- Les territoires du moment : la clé du propriétaire, ses lieux, la forme autour d'eux.
CREATE FUNCTION public._territoires()
RETURNS TABLE (cle text, lieux text[], forme extensions.geometry)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions' AS $function$
  WITH tenus AS (
    SELECT v.place_id,
           CASE WHEN v.pour_compagnie IS NOT NULL THEN 'c:' || v.pour_compagnie
                ELSE 'j:' || v.veilleur_user_id END AS cle,
           ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326) AS pt
    FROM place_veille v
    JOIN places p ON p.id = v.place_id
    WHERE v.veilleur_user_id IS NOT NULL AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
      AND EXISTS (SELECT 1 FROM revendications r
                  WHERE r.place_id = v.place_id AND r.user_id = v.veilleur_user_id)
  ),
  grappes AS (
    -- shortcut: les 5 km sont mesurés en Web Mercator à la latitude de la France (46°), l'écart
    -- grandit loin d'elle ; passer en géographie si la carte s'ouvre au monde.
    SELECT place_id, cle, pt,
           ST_ClusterDBSCAN(ST_Transform(pt, 3857), eps => 5000 / cos(radians(46)), minpoints => 2)
             OVER (PARTITION BY cle) AS g
    FROM tenus
  )
  SELECT cle, array_agg(place_id ORDER BY place_id),
         ST_Buffer(ST_ConvexHull(ST_Collect(pt))::geography, 1500)::geometry
  FROM grappes
  WHERE g IS NOT NULL
  GROUP BY cle, g;
$function$;
REVOKE ALL ON FUNCTION public._territoires() FROM PUBLIC, anon, authenticated;


-- Le territoire est à moi s'il est à mon nom, ou à une Compagnie dont je suis membre.
CREATE FUNCTION public._territoire_a_moi(p_cle text, p_moi text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $function$
  SELECT p_cle = 'j:' || p_moi
      OR (p_cle LIKE 'c:%' AND public._role_compagnie(substr(p_cle, 3), p_moi) IS NOT NULL);
$function$;
REVOKE ALL ON FUNCTION public._territoire_a_moi(text, text) FROM PUBLIC, anon, authenticated;


-- Pour la carte : chaque territoire, désigné par l'un de ses lieux, avec son nom, sa forme et le
-- point où inscrire le nom (sous la forme). Réservé aux comptes : la carte des visiteurs floute
-- les positions (migration 392), une forme les trahirait.
CREATE FUNCTION public.territoires_revendiques()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions' AS $function$
  SELECT COALESCE(json_agg(json_build_object(
    'id', t.lieux[1],
    'nom', n.nom,
    'moi', public._territoire_a_moi(t.cle, (auth.uid())::text),
    'lieux', cardinality(t.lieux),
    'forme', ST_AsGeoJSON(t.forme, 5)::json,
    'etiquette', json_build_array(round(ST_X(ST_Centroid(t.forme))::numeric, 5),
                                  round(ST_YMin(t.forme)::numeric, 5))
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
REVOKE ALL ON FUNCTION public.territoires_revendiques() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.territoires_revendiques() TO authenticated;


-- Renommer le territoire qui contient ce lieu : le nom se pose sur tous ses lieux du moment.
CREATE FUNCTION public.renommer_territoire(p_lieu text, p_nom text)
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
  IF NOT public._territoire_a_moi(v_cle, v_moi) THEN
    RAISE EXCEPTION 'Ce territoire n''est pas le tien' USING ERRCODE = '42501';
  END IF;

  INSERT INTO noms_de_territoire (place_id, cle, nom)
  SELECT unnest(v_lieux), v_cle, v_nom
  ON CONFLICT (place_id, cle) DO UPDATE SET nom = EXCLUDED.nom, nomme_le = now();
END;
$function$;
REVOKE ALL ON FUNCTION public.renommer_territoire(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.renommer_territoire(text, text) TO authenticated;
