-- 227_rename_place_align_contribute_gate.sql
-- WHY : rename_place (baseline 001) refusait TOUT renommage en pratique.
--   1) Garde `auth.uid()::text = p_user_id` : les comptes réels ont un users.id
--      legacy (shopify-*/firebase-*) qui n'égale JAMAIS auth.uid() → 'unauthorized'.
--      Aucune autre RPC de l'app ne vérifie auth.uid() : elles trustent p_user_id.
--   2) Garde `type='carnet'` : vestige V0 (le carnet personnel a été remplacé par la
--      description collaborative, mig 195/196). Plus aucun flux ne crée ce type pour
--      la fiche → 'must_have_carnet' systématique.
-- FIX : aligner l'autorisation sur le bouton Contribuer (front canContribute) :
--   créateur OU visiteur GPS OU découvreur à distance, en trustant p_user_id comme
--   delete_place / edit_place_description. (places_discovered est un sur-ensemble :
--   création, visite GPS et découverte distante y insèrent toutes une ligne.)

BEGIN;

CREATE OR REPLACE FUNCTION public.rename_place(
  p_user_id text, p_place_id text, p_title text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_trimmed  text;
  v_can_edit boolean;
BEGIN
  v_trimmed := TRIM(p_title);

  IF v_trimmed = '' OR v_trimmed IS NULL THEN
    RETURN json_build_object('error', 'empty_title');
  END IF;
  IF LENGTH(v_trimmed) > 255 THEN
    RETURN json_build_object('error', 'title_too_long');
  END IF;

  -- Même condition que le bouton Contribuer : créateur OU visiteur GPS OU découvreur à distance.
  SELECT
       EXISTS(SELECT 1 FROM places           WHERE id       = p_place_id AND author_id = p_user_id)
    OR EXISTS(SELECT 1 FROM place_explorers   WHERE place_id = p_place_id AND user_id   = p_user_id)
    OR EXISTS(SELECT 1 FROM places_discovered WHERE place_id = p_place_id AND user_id   = p_user_id)
  INTO v_can_edit;

  IF NOT v_can_edit THEN
    RETURN json_build_object('error', 'not_allowed');
  END IF;

  UPDATE places SET title = v_trimmed, updated_at = NOW() WHERE id = p_place_id;

  RETURN json_build_object('success', true, 'title', v_trimmed);
END;
$$;

ALTER FUNCTION public.rename_place(text, text, text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.rename_place(text, text, text) TO anon, authenticated, service_role;

COMMIT;
