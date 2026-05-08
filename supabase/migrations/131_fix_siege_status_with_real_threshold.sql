-- 131_fix_siege_status_with_real_threshold.sql
-- WHY : la mig 130 retournait defender_score brut, mais ne reflétait pas la
-- vraie règle de bascule (cf. invest_crowns). Le veilleur "plein" (plant_flag
-- GPS) bénéficie d'un bonus défensif fixe de 50, le veilleur "par influence"
-- non. La bascule imminente (notif 'place_court_high_threat' déjà émise par
-- invest_crowns) se déclenche à 50% du score effectif du défenseur.
--
-- Du coup l'icône posée par la mig 130 marquait 🔥 sur des lieux paisibles
-- (un veilleur GPS sans investissement défensif a defender_score=NULL alors
-- qu'il tient en réalité par son bonus 50).
--
-- Cette mig réaligne la RPC sur la vraie sémantique du jeu :
--   - effective_score = 50 + defender_score (veilleur plein) OU defender_score (veilleur par influence)
--   - is_at_risk = challenger_score >= effective_score / 2 (seuil bascule imminente)
--
-- + Filtre les lieux vacants (pas de veilleur) : pas d'icône à poser puisque
-- pas de pilule veilleur sur la carte pour les vacants.
--
-- DROP préalable obligatoire (changement de RETURNS TABLE).

BEGIN;

DROP FUNCTION IF EXISTS public.list_places_in_siege();

CREATE OR REPLACE FUNCTION public.list_places_in_siege()
RETURNS TABLE(
  place_id                  text,
  challenger_count          integer,
  max_challenger_score      integer,
  defender_effective_score  integer,
  is_at_risk                boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  WITH defenders AS (
    -- Pour chaque lieu veillé : score effectif du défenseur (incluant bonus 50
    -- pour les veilleurs GPS pleins, conformément à invest_crowns).
    SELECT
      pv.place_id,
      pv.expedition_id                                     AS defender_exp,
      pv.by_influence,
      COALESCE(
        (SELECT pcs.score
         FROM public.place_court_score pcs
         WHERE pcs.place_id = pv.place_id
           AND pcs.expedition_id = pv.expedition_id),
        0
      )                                                     AS defender_invested,
      (CASE WHEN COALESCE(pv.by_influence, false) THEN 0 ELSE 50 END
       + COALESCE(
           (SELECT pcs.score
            FROM public.place_court_score pcs
            WHERE pcs.place_id = pv.place_id
              AND pcs.expedition_id = pv.expedition_id),
           0
         )
      )                                                     AS effective_score
    FROM public.place_veille pv
    WHERE pv.expedition_id IS NOT NULL
  ),
  challengers AS (
    SELECT
      pcs.place_id,
      d.defender_exp,
      d.effective_score,
      COUNT(*)::integer                  AS challenger_count,
      MAX(pcs.score)::integer            AS max_challenger_score
    FROM public.place_court_score pcs
    JOIN defenders d ON d.place_id = pcs.place_id
    WHERE pcs.score > 0
      AND pcs.expedition_id != d.defender_exp
    GROUP BY pcs.place_id, d.defender_exp, d.effective_score
  )
  SELECT
    p.id                                                    AS place_id,
    c.challenger_count,
    c.max_challenger_score,
    c.effective_score::integer                              AS defender_effective_score,
    -- Bascule imminente : challenger leader a dépassé 50% du score effectif
    -- défenseur (= seuil 'high_threat' utilisé par invest_crowns pour notif).
    (c.max_challenger_score::numeric >= c.effective_score::numeric / 2.0
     AND c.effective_score > 0)                             AS is_at_risk
  FROM challengers c
  JOIN public.places p ON p.id = c.place_id
  WHERE NOT p.private AND NOT p.masked;
$$;

GRANT EXECUTE ON FUNCTION public.list_places_in_siege() TO anon, authenticated, service_role;

COMMIT;
