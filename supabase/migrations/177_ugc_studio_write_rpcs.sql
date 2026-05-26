-- 177_ugc_studio_write_rpcs.sql
-- WHY : Brique 1bis-B. Le studio public ecrit departement/quete (envoi) + size (par photo).
-- On etend create_photo_submission + add_submission_image (drop ancienne signature puis recree
-- avec DEFAULT : les appels existants resolvent vers la nouvelle fonction). + config images studio.

-- add_submission_image : + p_size
DROP FUNCTION IF EXISTS public.add_submission_image(uuid, text, text, integer);
CREATE OR REPLACE FUNCTION public.add_submission_image(p_submission_id uuid, p_storage_path text, p_image_url text, p_sort_order integer, p_size text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO hub_submission_images (submission_id, storage_path, image_url, sort_order, size)
  VALUES (p_submission_id, p_storage_path, p_image_url, p_sort_order, NULLIF(p_size, ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.add_submission_image(uuid, text, text, integer, text) TO anon, authenticated, service_role;

-- create_photo_submission : + p_departement, + p_quest_ref (copie baseline + 2 colonnes)
DROP FUNCTION IF EXISTS public.create_photo_submission(character varying, text, text, text, text, text, text, boolean, boolean, text, text, numeric, numeric);
CREATE OR REPLACE FUNCTION public.create_photo_submission(
  p_user_id character varying, p_submitter_name text, p_submitter_email text, p_submitter_instagram text,
  p_location_name text DEFAULT NULL, p_location_zip text DEFAULT NULL, p_message text DEFAULT NULL,
  p_consent_brand boolean DEFAULT false, p_consent_account boolean DEFAULT false, p_submitter_role text DEFAULT 'client',
  p_product_size text DEFAULT NULL, p_model_height_cm numeric DEFAULT NULL, p_model_shoulder_width_cm numeric DEFAULT NULL,
  p_departement text DEFAULT NULL, p_quest_ref text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO hub_photo_submissions (
    user_id, submitter_name, submitter_email, submitter_instagram,
    location_name, location_zip,
    message, consent_brand_usage, consent_account_creation, status, submitter_role,
    product_size, model_height_cm, model_shoulder_width_cm,
    departement, quest_ref
  ) VALUES (
    p_user_id, p_submitter_name, p_submitter_email, p_submitter_instagram,
    p_location_name, p_location_zip,
    p_message, p_consent_brand, p_consent_account, 'pending', p_submitter_role,
    p_product_size, p_model_height_cm, p_model_shoulder_width_cm,
    NULLIF(btrim(p_departement), ''), NULLIF(btrim(p_quest_ref), '')
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_photo_submission(character varying, text, text, text, text, text, text, boolean, boolean, text, text, numeric, numeric, text, text) TO anon, authenticated, service_role;

-- Config images du studio (lue cote public). Defaut bg = image landing ; aside vide => fallback CSS.
INSERT INTO public.app_settings (key, value) VALUES
  ('studio_bg_image_url',    'https://ukpapqssgsxirsgmcvof.supabase.co/storage/v1/object/public/app-assets/landing-image-desktop-1776965256766.webp'),
  ('studio_aside_image_url', '')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_studio_config()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'bg_image_url',    COALESCE((SELECT value FROM app_settings WHERE key='studio_bg_image_url'), ''),
    'aside_image_url', COALESCE((SELECT value FROM app_settings WHERE key='studio_aside_image_url'), ''),
    'welcome_crowns',  COALESCE((SELECT value::int FROM app_settings WHERE key='ugc_welcome_crowns'), 0)
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_studio_config() TO anon, authenticated, service_role;
