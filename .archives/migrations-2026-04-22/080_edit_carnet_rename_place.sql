-- 080_edit_carnet_rename_place.sql
-- RPCs pour supprimer un carnet et renommer un lieu

-- 1. delete_carnet : supprime le carnet d'un joueur sur un lieu
CREATE OR REPLACE FUNCTION public.delete_carnet(
  p_user_id TEXT,
  p_place_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Vérifier que l'appelant est bien le propriétaire
  IF auth.uid()::TEXT != p_user_id THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  DELETE FROM place_contributions
  WHERE user_id = p_user_id
    AND place_id = p_place_id
    AND type = 'carnet';

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_carnet(TEXT, TEXT) TO authenticated;

-- 2. rename_place : renomme un lieu (réservé aux joueurs ayant un carnet dessus)
CREATE OR REPLACE FUNCTION public.rename_place(
  p_user_id TEXT,
  p_place_id TEXT,
  p_title TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_carnet BOOLEAN;
  v_trimmed TEXT;
BEGIN
  -- Vérifier que l'appelant est bien le joueur
  IF auth.uid()::TEXT != p_user_id THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  v_trimmed := TRIM(p_title);

  -- Validation
  IF v_trimmed = '' OR v_trimmed IS NULL THEN
    RETURN json_build_object('error', 'empty_title');
  END IF;

  IF LENGTH(v_trimmed) > 255 THEN
    RETURN json_build_object('error', 'title_too_long');
  END IF;

  -- Vérifier que le joueur a un carnet sur ce lieu
  SELECT EXISTS(
    SELECT 1 FROM place_contributions
    WHERE place_id = p_place_id AND user_id = p_user_id AND type = 'carnet'
  ) INTO v_has_carnet;

  IF NOT v_has_carnet THEN
    RETURN json_build_object('error', 'must_have_carnet');
  END IF;

  UPDATE places
  SET title = v_trimmed, updated_at = NOW()
  WHERE id = p_place_id;

  RETURN json_build_object('success', true, 'title', v_trimmed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rename_place(TEXT, TEXT, TEXT) TO authenticated;
