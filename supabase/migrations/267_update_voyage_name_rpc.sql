-- 267_update_voyage_name_rpc.sql
-- WHY : permettre de renommer une expédition de façon COLLABORATIVE — chef OU
-- participant validé — y compris une fois l'expédition passée. L'édition globale
-- (update_voyage) reste chef + published only et touche date/lieu/slots ; cette
-- RPC dédiée ne modifie QUE le nom, calquée sur update_voyage_call (même modèle
-- d'autorisation : membre validé, statut published|passed).

BEGIN;

CREATE OR REPLACE FUNCTION public.update_voyage_name(p_user_id text, p_voyage_id uuid, p_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_voy public.voyages%ROWTYPE;
  v_authorized boolean;
  v_name text := btrim(coalesce(p_name, ''));
BEGIN
  IF length(v_name) < 3 THEN
    RETURN json_build_object('success', false, 'error', 'name_too_short');
  END IF;
  IF length(v_name) > 80 THEN
    RETURN json_build_object('success', false, 'error', 'name_too_long');
  END IF;

  SELECT * INTO v_voy FROM public.voyages WHERE id = p_voyage_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_found');
  END IF;
  IF v_voy.status NOT IN ('published','passed') THEN
    RETURN json_build_object('success', false, 'error', 'voyage_not_editable');
  END IF;

  v_authorized := v_voy.chief_user_id = p_user_id OR EXISTS (
    SELECT 1 FROM public.voyage_participants
    WHERE voyage_id = p_voyage_id AND user_id = p_user_id AND status = 'validated'
  );
  IF NOT v_authorized THEN
    RETURN json_build_object('success', false, 'error', 'not_authorized');
  END IF;

  UPDATE public.voyages
    SET name = v_name,
        updated_at = now()
    WHERE id = p_voyage_id;

  RETURN json_build_object('success', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.update_voyage_name(text, uuid, text)
  TO authenticated, service_role;

COMMIT;
