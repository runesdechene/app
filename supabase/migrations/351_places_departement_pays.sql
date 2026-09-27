-- 351 — Chaque lieu connaît son département (France) ou son pays (ailleurs)
--
-- WHY : base de la ligne « Noble représentant de … » du profil (zone Compte) et du futur jalon
-- « régions parcourues ». Rattachement en base, par PostGIS, à l'insertion : aucun service
-- externe. Les contours sont simplifiés : un lieu au bord de mer peut tomber juste hors de son
-- département. Règle, dans l'ordre :
--   1. le point est dans un département            → ce département, France ;
--   2. il est dans un autre pays que la France      → ce pays (un lieu belge près de Lille
--                                                      ne doit pas devenir « Nord ») ;
--   3. sinon, le département le plus proche à moins de 20 km, puis le pays le plus proche.

ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS departement text,
  ADD COLUMN IF NOT EXISTS pays text;

CREATE OR REPLACE FUNCTION public._rattacher_lieu(p_lat float8, p_lng float8)
RETURNS TABLE(departement text, pays text)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $$
  WITH pt AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326) AS g
  ),
  dep_dedans AS (
    SELECT d.nom FROM geo_departements d, pt WHERE ST_Contains(d.geom, pt.g) LIMIT 1
  ),
  pays_dedans AS (
    SELECT p.nom_fr FROM geo_pays p, pt WHERE ST_Contains(p.geom, pt.g) LIMIT 1
  ),
  dep_proche AS (
    SELECT d.nom FROM geo_departements d, pt
     WHERE ST_DWithin(d.geom::geography, pt.g::geography, 20000)
     ORDER BY ST_Distance(d.geom::geography, pt.g::geography) LIMIT 1
  ),
  pays_proche AS (
    SELECT p.nom_fr FROM geo_pays p, pt
     WHERE ST_DWithin(p.geom::geography, pt.g::geography, 20000)
     ORDER BY ST_Distance(p.geom::geography, pt.g::geography) LIMIT 1
  )
  SELECT
    CASE
      WHEN EXISTS (SELECT 1 FROM dep_dedans) THEN (SELECT nom FROM dep_dedans)
      WHEN (SELECT nom_fr FROM pays_dedans) IS DISTINCT FROM 'France'
       AND EXISTS (SELECT 1 FROM pays_dedans) THEN NULL
      ELSE (SELECT nom FROM dep_proche)
    END AS departement,
    CASE
      WHEN EXISTS (SELECT 1 FROM dep_dedans) THEN 'France'
      WHEN EXISTS (SELECT 1 FROM pays_dedans) THEN (SELECT nom_fr FROM pays_dedans)
      WHEN EXISTS (SELECT 1 FROM dep_proche) THEN 'France'
      ELSE (SELECT nom_fr FROM pays_proche)
    END AS pays
  WHERE p_lat IS NOT NULL AND p_lng IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public._rattacher_lieu(float8, float8) FROM PUBLIC, anon, authenticated;

-- SECURITY DEFINER : les tables de contours ne sont pas lisibles par `authenticated` (mig 349).
CREATE OR REPLACE FUNCTION public._trg_places_rattacher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  SELECT r.departement, r.pays INTO NEW.departement, NEW.pays
    FROM public._rattacher_lieu(NEW.latitude, NEW.longitude) r;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._trg_places_rattacher() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS places_rattacher ON public.places;
CREATE TRIGGER places_rattacher
  BEFORE INSERT OR UPDATE OF latitude, longitude ON public.places
  FOR EACH ROW EXECUTE FUNCTION public._trg_places_rattacher();

-- Remplissage des lieux existants. Aucun déclencheur UPDATE sur places : sans effet de bord.
UPDATE public.places p
   SET (departement, pays) = (
     SELECT r.departement, r.pays FROM public._rattacher_lieu(p.latitude, p.longitude) r
   );
