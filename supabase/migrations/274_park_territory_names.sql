-- 274_park_territory_names.sql
-- Parking : proposition/vote de noms de territoire gelés jusqu'au SPEC 3 (Territoire & scoring).
-- Tables territory_name_proposals / territory_name_votes CONSERVÉES (aucun DROP, données intactes).
-- Le front masque l'entrée (Task 10) ; ces redéfinitions sont une défense en profondeur : si une
-- RPC est appelée directement, elle refuse poliment au lieu d'écrire.

CREATE OR REPLACE FUNCTION public.propose_territory_name(
  p_user_id text, p_anchor_place_id text, p_name text, p_blob_place_ids text[] DEFAULT '{}'::text[]
) RETURNS json LANGUAGE sql
AS $function$
  SELECT json_build_object('error', 'parked',
    'message', 'Le nommage de territoire est temporairement indisponible.');
$function$;

CREATE OR REPLACE FUNCTION public.vote_territory_name(
  p_user_id text, p_proposal_id uuid, p_value smallint, p_blob_place_ids text[], p_anchor_place_id text
) RETURNS json LANGUAGE sql
AS $function$
  SELECT json_build_object('error', 'parked',
    'message', 'Le nommage de territoire est temporairement indisponible.');
$function$;
