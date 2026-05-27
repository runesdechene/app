-- 180_ugc_community_block.sql
-- Bloc "Ils nous portent" par produit : avis au niveau soumission (message public deja present
-- + 2 notes /5 + mot prive equipe) et flag d'affichage Communaute par photo.

-- 1. Avis au niveau batch (soumission)
ALTER TABLE public.hub_photo_submissions
  ADD COLUMN IF NOT EXISTS rating_experience int,
  ADD COLUMN IF NOT EXISTS rating_products   int,
  ADD COLUMN IF NOT EXISTS team_note         text;  -- PRIVE : jamais expose publiquement

ALTER TABLE public.hub_photo_submissions DROP CONSTRAINT IF EXISTS hub_photo_submissions_rating_experience_check;
ALTER TABLE public.hub_photo_submissions DROP CONSTRAINT IF EXISTS hub_photo_submissions_rating_products_check;
ALTER TABLE public.hub_photo_submissions
  ADD CONSTRAINT hub_photo_submissions_rating_experience_check CHECK (rating_experience IS NULL OR (rating_experience BETWEEN 1 AND 5)),
  ADD CONSTRAINT hub_photo_submissions_rating_products_check   CHECK (rating_products   IS NULL OR (rating_products   BETWEEN 1 AND 5));

comment on column public.hub_photo_submissions.team_note is
  'PRIVE - mot pour l equipe, ne jamais exposer via RPC anon ni vers Shopify';

-- 2. Destination Communaute par photo
ALTER TABLE public.hub_submission_images
  ADD COLUMN IF NOT EXISTS show_in_community boolean NOT NULL DEFAULT false;

-- 3. create_photo_submission : + 3 params avis (drop ancienne signature puis recree avec DEFAULT)
DROP FUNCTION IF EXISTS public.create_photo_submission(character varying, text, text, text, text, text, text, boolean, boolean, text, text, numeric, numeric, text, text);
CREATE OR REPLACE FUNCTION public.create_photo_submission(
  p_user_id character varying, p_submitter_name text, p_submitter_email text, p_submitter_instagram text,
  p_location_name text DEFAULT NULL, p_location_zip text DEFAULT NULL, p_message text DEFAULT NULL,
  p_consent_brand boolean DEFAULT false, p_consent_account boolean DEFAULT false, p_submitter_role text DEFAULT 'client',
  p_product_size text DEFAULT NULL, p_model_height_cm numeric DEFAULT NULL, p_model_shoulder_width_cm numeric DEFAULT NULL,
  p_departement text DEFAULT NULL, p_quest_ref text DEFAULT NULL,
  p_rating_experience int DEFAULT NULL, p_rating_products int DEFAULT NULL, p_team_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO hub_photo_submissions (
    user_id, submitter_name, submitter_email, submitter_instagram,
    location_name, location_zip,
    message, consent_brand_usage, consent_account_creation, status, submitter_role,
    product_size, model_height_cm, model_shoulder_width_cm,
    departement, quest_ref,
    rating_experience, rating_products, team_note
  ) VALUES (
    p_user_id, p_submitter_name, p_submitter_email, p_submitter_instagram,
    p_location_name, p_location_zip,
    p_message, p_consent_brand, p_consent_account, 'pending', p_submitter_role,
    p_product_size, p_model_height_cm, p_model_shoulder_width_cm,
    NULLIF(btrim(p_departement), ''), NULLIF(btrim(p_quest_ref), ''),
    p_rating_experience, p_rating_products, NULLIF(btrim(p_team_note), '')
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_photo_submission(character varying, text, text, text, text, text, text, boolean, boolean, text, text, numeric, numeric, text, text, int, int, text) TO anon, authenticated, service_role;

-- 4. Toggle destination Communaute (curation Hub)
CREATE OR REPLACE FUNCTION public.set_submission_image_community(p_image_id uuid, p_show boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE hub_submission_images SET show_in_community = COALESCE(p_show, false) WHERE id = p_image_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_submission_image_community(uuid, boolean) TO anon, authenticated, service_role;

-- 5. clear_submission_image_shopify_product : reset AUSSI show_in_community (delier = sortir du bloc)
CREATE OR REPLACE FUNCTION public.clear_submission_image_shopify_product(p_image_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE hub_submission_images
     SET shopify_product_id     = null,
         shopify_product_handle = null,
         shopify_product_title  = null,
         shopify_media_id       = null,
         show_in_community      = false
   WHERE id = p_image_id;
END; $$;

-- 6. Lecture publique (anon) du bloc par produit. N'EXPOSE PAS team_note ni email.
CREATE OR REPLACE FUNCTION public.get_community_photos_by_product(p_handle text)
RETURNS TABLE (
  submission_id uuid,
  image_url text,
  image_sort_order int,
  submitter_name text,
  submitter_instagram text,
  location_name text,
  location_zip text,
  message text,
  rating_experience int,
  rating_products int,
  created_at timestamptz
) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    s.id, i.image_url, i.sort_order,
    s.submitter_name, s.submitter_instagram, s.location_name, s.location_zip,
    s.message, s.rating_experience, s.rating_products, s.created_at
  FROM public.hub_submission_images i
  JOIN public.hub_photo_submissions s ON s.id = i.submission_id
  WHERE i.show_in_community = true
    AND i.status = 'approved'
    AND s.status = 'approved'
    AND s.consent_brand_usage = true
    AND i.shopify_product_handle = NULLIF(btrim(p_handle), '')
  ORDER BY s.created_at DESC, i.sort_order ASC;
$$;
GRANT EXECUTE ON FUNCTION public.get_community_photos_by_product(text) TO anon, authenticated, service_role;
