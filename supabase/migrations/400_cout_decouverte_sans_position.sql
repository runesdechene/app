-- WHY: cout_decouverte (399) sans position : ses paramètres n'avaient pas de valeur par défaut,
--      et les types générés pour la V2 refusaient alors l'appel sans position. Valeurs par
--      défaut NULL, comme decouvrir_lieu ; rien d'autre ne change.
-- SCHEMA CHECKED (01/10/2026) : cout_decouverte(text, numeric, numeric) copiée de sa définition live.

CREATE OR REPLACE FUNCTION public.cout_decouverte(p_id text, p_lat numeric DEFAULT NULL, p_lng numeric DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

DECLARE

  c json;

  e json;

BEGIN

  IF auth.uid() IS NULL THEN

    RAISE EXCEPTION 'Connexion requise' USING ERRCODE = '42501';

  END IF;

  IF NOT public._lieu_visible(p_id) THEN

    RAISE EXCEPTION 'Lieu introuvable' USING ERRCODE = 'P0002';

  END IF;

  c := public._cout_decouverte(p_id, p_lat, p_lng);

  e := public.mon_energie();

  RETURN json_build_object(

    'cout', (c->>'cout')::int,

    'distanceKm', (c->>'distanceKm')::numeric,

    'points', (e->>'points')::int,

    'max', (e->>'max')::int,

    'prochainDans', (e->>'prochainDans')::int,

    'parPoint', (e->>'parPoint')::int);

END;

$function$;
