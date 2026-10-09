-- Test des migrations 349-351 dans une transaction annulée. Rien n'est conservé.
BEGIN;
\ir ../../migrations/349_postgis_geo_reference.sql
\ir ../../migrations/350_geo_reference_donnees.sql
\ir ../../migrations/351_places_departement_pays.sql
DO $test$
DECLARE
  n_dep int; n_pays int; marseille text; rome text; nice text; ain text;
  tournai text; saint_malo text;
  rattaches int; etrangers int; orphelins int;
BEGIN
  SELECT count(*) INTO n_dep FROM public.geo_departements;
  SELECT count(*) INTO n_pays FROM public.geo_pays;
  SELECT nom INTO marseille FROM public.geo_departements
   WHERE extensions.ST_Contains(geom, extensions.ST_SetSRID(extensions.ST_MakePoint(5.3698, 43.2965), 4326));
  SELECT nom_fr INTO rome FROM public.geo_pays
   WHERE extensions.ST_Contains(geom, extensions.ST_SetSRID(extensions.ST_MakePoint(12.4964, 41.9028), 4326));
  SELECT de_nom INTO nice FROM public.geo_departements WHERE code = '06';
  SELECT de_nom INTO ain FROM public.geo_departements WHERE code = '01';
  -- Frontière : Tournai (Belgique, à 20 km de Lille) ne doit pas devenir « Nord ».
  SELECT coalesce(departement, '-') || '/' || pays INTO tournai FROM public._rattacher_lieu(50.6056, 3.3888);
  -- Bord de mer : Saint-Malo, sur la côte.
  SELECT coalesce(departement, '-') || '/' || pays INTO saint_malo FROM public._rattacher_lieu(48.6493, -2.0257);
  SELECT count(*) FILTER (WHERE departement IS NOT NULL),
         count(*) FILTER (WHERE pays IS NOT NULL AND departement IS NULL),
         count(*) FILTER (WHERE pays IS NULL AND latitude IS NOT NULL)
    INTO rattaches, etrangers, orphelins
    FROM public.places;
  RAISE EXCEPTION 'BILAN dep=% pays=% marseille=% rome=% 06=% 01=% tournai=% saint_malo=% rattaches=% etrangers=% orphelins=%',
    n_dep, n_pays, marseille, rome, nice, ain, tournai, saint_malo, rattaches, etrangers, orphelins;
END $test$;
ROLLBACK;
