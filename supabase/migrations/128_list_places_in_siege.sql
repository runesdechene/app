-- 128_list_places_in_siege.sql
-- WHY : nouvelle feature (Uriel 8/05) — afficher une icône sur la carte pour
-- les lieux "en siège" (au moins une expédition challenger a investi des
-- Couronnes contre l'expédition veilleur). Pour ne pas regresser la perf
-- mobile (cf. audit 8/05), l'icône sera rendue via un layer GeoJSON MapLibre
-- (pas un Marker DOM par lieu — 339 lieux concernés actuellement).
--
-- Cette RPC retourne la liste compacte des lieux à marquer "en siège" :
--   - place_id, latitude, longitude (pour la source GeoJSON)
--   - challenger_count : nombre d'expés challengers actives sur ce lieu
--   - max_challenger_score : score max parmi les challengers (intensité)
--
-- "En siège" = au moins une ligne place_court_score avec score > 0 ET dont
-- l'expedition_id est différente de l'expé veilleur actuelle (place_veille).
-- Si pas de veilleur, toute ligne place_court_score > 0 compte (lieu vacant
-- en convoitise — sémantique à affiner plus tard si besoin).
--
-- STABLE, SECURITY DEFINER, lecture seule. Public (anon + authenticated).

BEGIN;

CREATE OR REPLACE FUNCTION public.list_places_in_siege()
RETURNS TABLE(
  place_id              text,
  latitude              real,
  longitude             real,
  challenger_count      integer,
  max_challenger_score  integer
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    p.id                                            AS place_id,
    p.latitude,
    p.longitude,
    COUNT(*)::integer                               AS challenger_count,
    MAX(pcs.score)::integer                         AS max_challenger_score
  FROM public.places p
  JOIN public.place_court_score pcs ON pcs.place_id = p.id
  LEFT JOIN public.place_veille pv ON pv.place_id = p.id
  WHERE
    pcs.score > 0
    AND NOT p.private
    AND NOT p.masked
    AND (
      pv.expedition_id IS NULL
      OR pcs.expedition_id != pv.expedition_id
    )
  GROUP BY p.id, p.latitude, p.longitude;
$$;

GRANT EXECUTE ON FUNCTION public.list_places_in_siege() TO anon, authenticated, service_role;

COMMIT;
