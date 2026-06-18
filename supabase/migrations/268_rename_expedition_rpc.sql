-- 268_rename_expedition_rpc.sql
-- WHY : permettre de renommer une expédition de PLANTAGE (table public.expeditions,
-- titre posé au plant_flag CAS C avec compagnons, cf. mig 247) — par n'importe quel
-- membre de l'expédition (expedition_members). Le titre s'affiche dans « La Cour »
-- de la fiche de lieu (veille à plusieurs). Système DISTINCT du voyage/événement
-- (update_voyage_name, mig 267) : ici c'est la table expeditions / veille.

BEGIN;

CREATE OR REPLACE FUNCTION public.rename_expedition(p_user_id text, p_expedition_id uuid, p_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_name text := btrim(coalesce(p_name, ''));
  v_is_member boolean;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('success', false, 'error', 'unauthorized');
  END IF;
  IF length(v_name) < 3 THEN
    RETURN json_build_object('success', false, 'error', 'name_too_short');
  END IF;
  IF length(v_name) > 60 THEN
    RETURN json_build_object('success', false, 'error', 'name_too_long');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.expedition_members
    WHERE expedition_id = p_expedition_id AND user_id = p_user_id
  ) INTO v_is_member;
  IF NOT v_is_member THEN
    RETURN json_build_object('success', false, 'error', 'not_a_member');
  END IF;

  UPDATE public.expeditions SET title = v_name WHERE id = p_expedition_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'expedition_not_found');
  END IF;

  RETURN json_build_object('success', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.rename_expedition(text, uuid, text)
  TO authenticated, service_role;

COMMIT;
