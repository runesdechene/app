-- 098_court_invested_per_place.sql
-- WHY : alimenter le panel admin de tuning Voronoï pondéré.
-- Retourne un tableau { placeId, crownsTotal } pour tous les lieux qui ont
-- au moins 1 Couronne investie. Lecture publique (panel admin filtré côté
-- frontend par user.role).

BEGIN;

CREATE OR REPLACE FUNCTION public.get_court_invested_per_place()
RETURNS json
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(
    json_agg(json_build_object(
      'placeId',     place_id,
      'crownsTotal', total
    )),
    '[]'::json
  )
  FROM (
    SELECT place_id, SUM(amount)::int AS total
    FROM public.place_court_action
    GROUP BY place_id
    HAVING SUM(amount) > 0
  ) sub;
$$;

GRANT EXECUTE ON FUNCTION public.get_court_invested_per_place()
  TO authenticated, anon, service_role;

COMMIT;
