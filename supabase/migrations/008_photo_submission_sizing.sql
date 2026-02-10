-- ============================================
-- AJOUT CHAMPS TAILLE PRODUIT / MODELE
-- pour les soumissions photos communautaires
-- ============================================

-- Nouvelles colonnes sur hub_photo_submissions
ALTER TABLE hub_photo_submissions ADD COLUMN IF NOT EXISTS product_size TEXT;
ALTER TABLE hub_photo_submissions ADD COLUMN IF NOT EXISTS model_height_cm NUMERIC;
ALTER TABLE hub_photo_submissions ADD COLUMN IF NOT EXISTS model_shoulder_width_cm NUMERIC;

-- Mettre a jour la fonction create_photo_submission
DROP FUNCTION IF EXISTS public.create_photo_submission(VARCHAR, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT);
CREATE OR REPLACE FUNCTION public.create_photo_submission(
  p_user_id VARCHAR(255),
  p_submitter_name TEXT,
  p_submitter_email TEXT,
  p_submitter_instagram TEXT,
  p_location_name TEXT DEFAULT NULL,
  p_location_zip TEXT DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_consent_brand BOOLEAN DEFAULT FALSE,
  p_consent_account BOOLEAN DEFAULT FALSE,
  p_submitter_role TEXT DEFAULT 'client',
  p_product_size TEXT DEFAULT NULL,
  p_model_height_cm NUMERIC DEFAULT NULL,
  p_model_shoulder_width_cm NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO hub_photo_submissions (
    user_id, submitter_name, submitter_email, submitter_instagram,
    location_name, location_zip,
    message, consent_brand_usage, consent_account_creation, status, submitter_role,
    product_size, model_height_cm, model_shoulder_width_cm
  ) VALUES (
    p_user_id, p_submitter_name, p_submitter_email, p_submitter_instagram,
    p_location_name, p_location_zip,
    p_message, p_consent_brand, p_consent_account, 'pending', p_submitter_role,
    p_product_size, p_model_height_cm, p_model_shoulder_width_cm
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_photo_submission TO anon, authenticated;
