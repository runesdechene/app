-- 265_create_gps_mark_rpc.sql
-- WHY : pose et suppression d'une marque GPS. La pose ne crédite RIEN (jeton de
-- présence). created_at estampillé serveur = la preuve d'horodatage.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_gps_mark(
  p_user_id   text,
  p_lat       real,
  p_lng       real,
  p_accuracy  numeric DEFAULT NULL,
  p_title     text    DEFAULT NULL,
  p_images    jsonb   DEFAULT '[]'::jsonb
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
  v_created timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RETURN json_build_object('error', 'no_position');
  END IF;

  INSERT INTO public.place_drafts (user_id, latitude, longitude, accuracy_m, title, images)
  VALUES (p_user_id, p_lat, p_lng, p_accuracy, NULLIF(TRIM(COALESCE(p_title,'')), ''), COALESCE(p_images, '[]'::jsonb))
  RETURNING id, created_at INTO v_id, v_created;

  RETURN json_build_object('success', true, 'id', v_id, 'createdAt', v_created);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_gps_mark(
  p_user_id  text,
  p_draft_id uuid
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_deleted int;
BEGIN
  IF p_user_id IS NULL OR p_user_id != auth.uid()::text THEN
    RETURN json_build_object('error', 'unauthorized');
  END IF;

  DELETE FROM public.place_drafts
  WHERE id = p_draft_id AND user_id = p_user_id AND status = 'open';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN json_build_object('success', v_deleted > 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_gps_mark(text, real, real, numeric, text, jsonb)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_gps_mark(text, uuid)
  TO authenticated, service_role;

COMMIT;
