-- WHY: Missives, lot 1, tâche 9 : l'écran « Envois » du Hub. Une ligne par Missive, la plus récente en tête :
--      son objet, sa liste, son état, sa date (partie, programmée ou écrite), et ce qu'il en est advenu :
--      envoyés (rebonds et plaintes compris : ils sont partis), échecs, ouverts, clics.
-- SCHEMA CHECKED (23/10/2026, live) : missives(id, objet, liste, statut, programmee_le, envoyee_le, cree_le) et
--   missive_envois(missive_id, statut, ouvert_le, clique_le) créées par la 539 ; _is_admin(), _refus(text, text).

CREATE FUNCTION public.hub_envois()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_resultat jsonb;
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', mi.id,
           'objet', mi.objet,
           'liste', mi.liste,
           'statut', mi.statut,
           'date', COALESCE(mi.envoyee_le, mi.programmee_le, mi.cree_le),
           'envoyes', c.envoyes,
           'echecs', c.echecs,
           'ouverts', c.ouverts,
           'clics', c.clics
         ) ORDER BY COALESCE(mi.envoyee_le, mi.programmee_le, mi.cree_le) DESC), '[]'::jsonb)
    INTO v_resultat
    FROM missives mi
    CROSS JOIN LATERAL (
      SELECT count(*) FILTER (WHERE e.statut IN ('envoye', 'rebond', 'plainte')) AS envoyes,
             count(*) FILTER (WHERE e.statut = 'echec') AS echecs,
             count(e.ouvert_le) AS ouverts,
             count(e.clique_le) AS clics
        FROM missive_envois e
       WHERE e.missive_id = mi.id
    ) c;

  RETURN v_resultat;
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_envois() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_envois() TO authenticated;
