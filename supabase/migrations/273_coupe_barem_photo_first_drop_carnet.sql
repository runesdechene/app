-- 273_coupe_barem_photo_first_drop_carnet.sql
-- WHY : barème Coupe — (1) seule la 1ʳᵉ photo d'un membre sur un lieu compte
-- (COUNT(DISTINCT place_id), anti-spam photo) ; (2) retrait du terme `carnet`
-- (type mort en base, remplacé par `description` = récits, volontairement à 0).
-- Delta vs baseline ; le reste de _user_coupe_score est identique. ADDITIF / sûr.

CREATE OR REPLACE FUNCTION public._user_coupe_score(
  p_user_id text,
  p_from timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_to   timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS integer
 LANGUAGE sql STABLE
AS $function$
  SELECT
    COALESCE((SELECT COUNT(*) FROM public.places_discovered
              WHERE user_id = p_user_id
                AND (p_from IS NULL OR discovered_at >= p_from)
                AND (p_to   IS NULL OR discovered_at <  p_to)), 0)
    * public._barem('coupe.discover_remote', 0)

  + COALESCE((SELECT COUNT(DISTINCT place_id) FROM public.place_explorers
              WHERE user_id = p_user_id
                AND (p_from IS NULL OR visited_at >= p_from)
                AND (p_to   IS NULL OR visited_at <  p_to)), 0)
    * public._barem('coupe.visit_gps', 3)

  + COALESCE((SELECT COUNT(*) FROM public.places
              WHERE author_id = p_user_id
                AND (p_from IS NULL OR created_at >= p_from)
                AND (p_to   IS NULL OR created_at <  p_to)), 0)
    * public._barem('coupe.add_place', 7)

  -- Photo : seule la 1ʳᵉ photo par lieu compte (COUNT DISTINCT place_id)
  + COALESCE((SELECT COUNT(DISTINCT place_id) FROM public.place_contributions
              WHERE user_id = p_user_id AND type = 'photo'
                AND (p_from IS NULL OR created_at >= p_from)
                AND (p_to   IS NULL OR created_at <  p_to)), 0)
    * public._barem('coupe.photo', 1)

  -- (terme `carnet` retiré : type mort, récits = `description` volontairement à 0)

  + COALESCE((SELECT COUNT(*) FROM public.veille_history
              WHERE user_id = p_user_id
                AND (p_from IS NULL OR planted_at >= p_from)
                AND (p_to   IS NULL OR planted_at <  p_to)), 0)
    * public._barem('coupe.plant_flag', 2)

  + COALESCE((
      SELECT
        COUNT(*) FILTER (WHERE e.difficulty = 'very_easy') * public._barem('coupe.enigma_very_easy', 1)
      + COUNT(*) FILTER (WHERE e.difficulty = 'easy')      * public._barem('coupe.enigma_easy',      1)
      + COUNT(*) FILTER (WHERE e.difficulty = 'medium')    * public._barem('coupe.enigma_medium',    1)
      + COUNT(*) FILTER (WHERE e.difficulty = 'hard')      * public._barem('coupe.enigma_hard',      1)
      FROM public.enigma_responses er
      JOIN public.enigmas e ON e.id = er.enigma_id
      WHERE er.user_id = p_user_id AND er.correct = TRUE
        AND (p_from IS NULL OR er.responded_at >= p_from)
        AND (p_to   IS NULL OR er.responded_at <  p_to)
    ), 0);
$function$;
