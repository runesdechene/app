-- 112_v07_expeditions_cover_image.sql
-- WHY : permettre au chef d'expédition d'uploader une image perso pour
-- son voyage. Affichée en médaillon rond sur la carte (avec un 🚩 en
-- superposition pour signaler "expédition"). Si pas d'image fournie,
-- le frontend retombe sur l'avatar du chef.
--
-- Path Storage convention : <voyage_id>/cover/<filename>
-- (cf. mig 113 pour la policy SELECT public sur ces chemins)

ALTER TABLE public.voyages ADD COLUMN IF NOT EXISTS cover_image_url text;

-- ============================================================
-- create_voyage (avec cover_image_url initial — peut rester NULL)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_voyage(
  p_user_id text,
  p_name text,
  p_description text,
  p_rdv_at timestamptz,
  p_rdv_lat double precision,
  p_rdv_lng double precision,
  p_rdv_label text,
  p_slots_max integer,
  p_slots_open boolean,
  p_validation_mode text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_active_count integer;
  v_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  IF p_rdv_at IS NOT NULL AND p_rdv_at <= now() THEN
    RETURN json_build_object('success', false, 'error', 'rdv_must_be_in_future');
  END IF;

  IF p_validation_mode NOT IN ('manual','free') THEN
    RETURN json_build_object('success', false, 'error', 'invalid_validation_mode');
  END IF;

  SELECT count(*) INTO v_active_count
  FROM public.voyages
  WHERE chief_user_id = p_user_id AND status = 'published';

  IF v_active_count >= 3 THEN
    RETURN json_build_object('success', false, 'error', 'max_active_voyages_reached');
  END IF;

  INSERT INTO public.voyages(
    chief_user_id, name, description, rdv_at, rdv_lat, rdv_lng, rdv_label,
    slots_max, slots_open, validation_mode
  ) VALUES (
    p_user_id, p_name, p_description, p_rdv_at, p_rdv_lat, p_rdv_lng, p_rdv_label,
    p_slots_max, p_slots_open, p_validation_mode
  ) RETURNING id INTO v_id;

  RETURN json_build_object('success', true, 'voyage_id', v_id);
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_voyage(text,text,text,timestamptz,double precision,double precision,text,integer,boolean,text) TO authenticated;

-- ============================================================
-- set_voyage_cover_image (chef uniquement)
-- Utilisé après upload Storage pour lier le path au voyage.
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_voyage_cover_image(
  p_user_id text,
  p_voyage_id uuid,
  p_storage_path text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_chief text;
BEGIN
  SELECT chief_user_id INTO v_chief FROM public.voyages WHERE id = p_voyage_id;
  IF NOT FOUND OR v_chief <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'not_chief_or_not_found');
  END IF;

  UPDATE public.voyages
    SET cover_image_url = p_storage_path, updated_at = now()
    WHERE id = p_voyage_id;

  RETURN json_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_voyage_cover_image(text,uuid,text) TO authenticated;
