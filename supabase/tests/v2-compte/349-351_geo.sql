-- Test des migrations 349-351 dans une transaction annulée. Rien n'est conservé.
BEGIN;
\ir ../../migrations/349_postgis_geo_reference.sql
\ir ../../migrations/350_geo_reference_donnees.sql
DO $test$
DECLARE n_dep int; n_pays int; marseille text; rome text; nice text; ain text;
BEGIN
  SELECT count(*) INTO n_dep FROM public.geo_departements;
  SELECT count(*) INTO n_pays FROM public.geo_pays;
  SELECT nom INTO marseille FROM public.geo_departements
   WHERE extensions.ST_Contains(geom, extensions.ST_SetSRID(extensions.ST_MakePoint(5.3698, 43.2965), 4326));
  SELECT nom_fr INTO rome FROM public.geo_pays
   WHERE extensions.ST_Contains(geom, extensions.ST_SetSRID(extensions.ST_MakePoint(12.4964, 41.9028), 4326));
  SELECT de_nom INTO nice FROM public.geo_departements WHERE code = '06';
  SELECT de_nom INTO ain FROM public.geo_departements WHERE code = '01';
  RAISE EXCEPTION 'BILAN dep=% pays=% marseille=% rome=% 06=% 01=%', n_dep, n_pays, marseille, rome, nice, ain;
END $test$;
ROLLBACK;
