-- WHY: la frise des époques (spec docs/superpowers/specs/2026-10-10-frise-des-epoques-design.md).
-- Le nom d'une période ne se convertit pas d'un calendrier à l'autre : « Monde post-1945 » perd son
-- année. filtres_de_carte renvoie les bornes de chaque époque, que la frise écrit dans le
-- calendrier du joueur. Définition de départ : la live du 10/10 (dernière version, mig 396).
-- SCHEMA CHECKED (2026-10-10) :
--   eras.id          : character varying — confirmed via information_schema
--   eras.name        : character varying — confirmed
--   eras.year_start  : integer — confirmed
--   eras.year_end    : integer — confirmed
--   eras.sort_order  : smallint — confirmed
--   tags.id, tags.title, tags.icon, tags.color : character varying — confirmed
--   tags."order"     : integer — confirmed

UPDATE eras SET name = 'Après-guerre mondiale' WHERE id = 'post-1945';

CREATE OR REPLACE FUNCTION public.filtres_de_carte()
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'natures', COALESCE((
      SELECT json_agg(json_build_object('id', t.id, 'nom', t.title, 'icone', t.icon, 'couleur', t.color)
        ORDER BY t."order", t.title)
      FROM tags t), '[]'::json),
    'epoques', COALESCE((
      SELECT json_agg(json_build_object('id', e.id, 'nom', e.name, 'debut', e.year_start, 'fin', e.year_end)
        ORDER BY e.id IN ('unknown', 'not-applicable'), e.sort_order)
      FROM eras e), '[]'::json));
$function$;

REVOKE ALL ON FUNCTION public.filtres_de_carte() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.filtres_de_carte() TO authenticated;
