-- 130_list_places_in_siege_with_defender.sql
-- WHY : étendre list_places_in_siege() pour retourner aussi le score du
-- défenseur (= veilleur actuel) afin de distinguer 2 statuts dans l'UI :
--   - "siege"    : challenger investit mais le veilleur tient encore
--   - "critical" : le challenger leader est >= au défenseur (bascule imminente)
--                  ou pas de veilleur (lieu vacant convoité)
--
-- Uriel veut afficher l'icône directement dans la pilule du veilleur sur la
-- carte (⚔️ siège, 🔥 critique) au lieu d'un layer GeoJSON séparé au-dessus
-- du marker (recadrage 8/05).
--
-- Reprise B1 verbatim de la mig 128. Seule modif : la SELECT principale
-- ajoute un LEFT JOIN sur la ligne place_court_score du défenseur pour
-- ramener defender_score (NULL si pas d'investissement défensif).

BEGIN;

-- Postgres refuse de changer un RETURNS TABLE existant via CREATE OR REPLACE.
-- DROP préalable obligatoire (les seuls callers sont la RPC client front, pas
-- d'autre fonction SQL qui dépende d'elle → safe).
DROP FUNCTION IF EXISTS public.list_places_in_siege();

CREATE OR REPLACE FUNCTION public.list_places_in_siege()
RETURNS TABLE(
  place_id              text,
  latitude              real,
  longitude             real,
  challenger_count      integer,
  max_challenger_score  integer,
  defender_score        integer
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH challengers AS (
    SELECT
      pcs.place_id,
      COUNT(*)::integer        AS challenger_count,
      MAX(pcs.score)::integer  AS max_challenger_score
    FROM public.place_court_score pcs
    LEFT JOIN public.place_veille pv ON pv.place_id = pcs.place_id
    WHERE pcs.score > 0
      AND (pv.expedition_id IS NULL OR pcs.expedition_id != pv.expedition_id)
    GROUP BY pcs.place_id
  )
  SELECT
    p.id                                                  AS place_id,
    p.latitude,
    p.longitude,
    c.challenger_count,
    c.max_challenger_score,
    (
      SELECT pcs2.score::integer
      FROM public.place_court_score pcs2
      JOIN public.place_veille pv2 ON pv2.place_id = pcs2.place_id
                                   AND pv2.expedition_id = pcs2.expedition_id
      WHERE pcs2.place_id = p.id
      LIMIT 1
    )                                                     AS defender_score
  FROM challengers c
  JOIN public.places p ON p.id = c.place_id
  WHERE NOT p.private AND NOT p.masked;
$$;

GRANT EXECUTE ON FUNCTION public.list_places_in_siege() TO anon, authenticated, service_role;

COMMIT;
