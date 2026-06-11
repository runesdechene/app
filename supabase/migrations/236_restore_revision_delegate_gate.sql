-- 236_restore_revision_delegate_gate.sql
-- WHY : restore_place_description_revision gardait une pré-vérification
-- _has_discovered (ancien gate « sorti du brouillard ») AVANT de déléguer à
-- edit_place_description. Depuis mig 235, edit_place_description applique le bon
-- gate « Présence ou veille » (_can_edit_place_meta, lié au JWT). La pré-vérif est
-- donc à la fois redondante ET incohérente : un veilleur sans ligne places_discovered
-- serait bloqué à tort. On la retire et on délègue entièrement le contrôle d'accès.
--
-- Réversible : restaurer le IF NOT _has_discovered(...) en tête.

CREATE OR REPLACE FUNCTION public.restore_place_description_revision(
  p_user_id text, p_place_id text, p_revision_id bigint  -- p_user_id : déprécié, ignoré (gate aval = JWT)
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_content text;
BEGIN
  -- L'autorisation (« Présence ou veille ») est appliquée par edit_place_description.
  SELECT content INTO v_content FROM place_description_revisions
  WHERE id = p_revision_id AND place_id = p_place_id;
  IF v_content IS NULL THEN RETURN json_build_object('error','revision_not_found'); END IF;
  RETURN public.edit_place_description(p_user_id, p_place_id, v_content);
END;
$function$;

ALTER FUNCTION public.restore_place_description_revision(text, text, bigint) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.restore_place_description_revision(text, text, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_place_description_revision(text, text, bigint) TO authenticated, service_role;
