-- 233_fix_defi_visit_uses_place_explorers.sql
-- WHY : le défi « Visite un <type de lieu> » ne se validait jamais. _defi_progress
-- comptait l'action 'visit' depuis places_discovered WHERE method='gps' — or une
-- visite GPS (visit_place_gps → _visit_place_gps_internal) écrit dans une table
-- TOTALEMENT différente : place_explorers. places_discovered.method='gps' ne couvre
-- que les lieux *découverts* directement sur place ; visiter en GPS un lieu déjà
-- révélé à distance (cas ultra fréquent) n'y crée AUCUNE ligne → progression bloquée
-- à 0, et claim_defi (qui réutilise _defi_progress) refusait la réclamation.
--
-- FIX : pour 'visit', compter l'UNION dédupliquée (user_id, place_id) de :
--   - place_explorers (visited_at)            → la vraie table de présence GPS
--   - places_discovered method='gps'          → 1res découvertes sur place (compat,
--                                                 ne régresse pas l'ancien comptage)
-- L'UNION sur (user_id, place_id) évite tout double comptage quand un lieu est dans
-- les deux. 'reveal' reste sur places_discovered method='remote' (inchangé).
--
-- Source : def LIVE de _defi_progress (pg_get_functiondef). Seul le bloc reveal/visit
-- change (scindé en deux). add/veilleur/enigma identiques au live.
-- Réversible : restaurer la branche IN ('reveal','visit') d'origine.

CREATE OR REPLACE FUNCTION public._defi_progress(p_action text, p_tag_id text, p_user_id text, p_collective boolean, p_ws timestamp with time zone)
 RETURNS integer
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  IF p_action = 'enigma' THEN
    SELECT count(*) INTO n FROM public.enigma_responses e
     WHERE e.responded_at >= p_ws AND (p_collective OR e.user_id = p_user_id);
  ELSIF p_action = 'reveal' THEN
    SELECT count(*) INTO n FROM public.places_discovered pd
     WHERE pd.method = 'remote'
       AND pd.discovered_at >= p_ws
       AND (p_collective OR pd.user_id = p_user_id)
       AND (p_tag_id IS NULL OR EXISTS (
             SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pd.place_id AND pt.tag_id = p_tag_id));
  ELSIF p_action = 'visit' THEN
    SELECT count(*) INTO n FROM (
      SELECT pe.user_id, pe.place_id
        FROM public.place_explorers pe
       WHERE pe.visited_at >= p_ws
         AND (p_collective OR pe.user_id = p_user_id)
         AND (p_tag_id IS NULL OR EXISTS (
               SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pe.place_id AND pt.tag_id = p_tag_id))
      UNION
      SELECT pd.user_id, pd.place_id
        FROM public.places_discovered pd
       WHERE pd.method = 'gps'
         AND pd.discovered_at >= p_ws
         AND (p_collective OR pd.user_id = p_user_id)
         AND (p_tag_id IS NULL OR EXISTS (
               SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pd.place_id AND pt.tag_id = p_tag_id))
    ) x;
  ELSIF p_action = 'add' THEN
    SELECT count(*) INTO n FROM public.places p
     WHERE p.created_at >= p_ws
       AND (p_collective OR p.author_id = p_user_id)
       AND (p_tag_id IS NULL OR EXISTS (
             SELECT 1 FROM public.place_tags pt WHERE pt.place_id = p.id AND pt.tag_id = p_tag_id));
  ELSIF p_action = 'veilleur' THEN
    SELECT count(*) INTO n FROM public.place_veille pv
     WHERE pv.by_influence = false AND pv.planted_at >= p_ws
       AND (p_collective OR pv.veilleur_user_id = p_user_id)
       AND (p_tag_id IS NULL OR EXISTS (
             SELECT 1 FROM public.place_tags pt WHERE pt.place_id = pv.place_id AND pt.tag_id = p_tag_id));
  ELSE
    n := 0;
  END IF;
  RETURN COALESCE(n, 0);
END; $function$;
