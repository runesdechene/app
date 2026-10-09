-- 362 : « Noble représentant … » porte la silhouette du département (et d'un pays). Annulé.
BEGIN;
\ir ../../migrations/362_profil_silhouette_attache.sql
DO $test$
DECLARE u text := 'cb16ff47-1ead-4adf-8eff-04d117551541'; a json; s json; pays json;
BEGIN
  a := public.get_profil_explorateur(u) -> 'attache';
  s := public._silhouette((SELECT geom FROM geo_departements WHERE nom = 'Alpes-Maritimes'));
  pays := public._silhouette((SELECT geom FROM geo_pays WHERE nom_fr = 'France'));
  RAISE EXCEPTION 'BILAN texte=% | d_commence_par_M=% | points=% | viewBox_06=% | france_viewBox=% | appelable_par_authenticated=%',
    a ->> 'texte',
    (a -> 'silhouette' ->> 'd') LIKE 'M %',
    array_length(regexp_split_to_array(a -> 'silhouette' ->> 'd', ' L '), 1),
    s ->> 'viewBox',
    pays ->> 'viewBox',
    has_function_privilege('authenticated', 'public._silhouette(extensions.geometry)', 'execute');
END $test$;
ROLLBACK;
