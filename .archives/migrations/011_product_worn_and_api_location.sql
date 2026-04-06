-- ============================================
-- 1. Ajouter colonne product_worn (produit porte - reference interne)
-- ============================================

ALTER TABLE hub_photo_submissions
ADD COLUMN IF NOT EXISTS product_worn TEXT;

-- ============================================
-- 2. RPC pour modifier le produit porte
-- ============================================

CREATE OR REPLACE FUNCTION public.update_submission_product_worn(
  p_submission_id UUID,
  p_product_worn TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE hub_photo_submissions
  SET product_worn = p_product_worn
  WHERE id = p_submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_submission_product_worn TO authenticated;

-- ============================================
-- 3. Mettre a jour get_approved_photos_by_tag pour inclure location_name + product_worn
-- ============================================

DROP FUNCTION IF EXISTS public.get_approved_photos_by_tag(TEXT);

CREATE OR REPLACE FUNCTION public.get_approved_photos_by_tag(p_tag_name TEXT)
RETURNS TABLE (
  id UUID,
  submitter_name TEXT,
  submitter_instagram TEXT,
  location_name TEXT,
  location_zip TEXT,
  product_size TEXT,
  model_height_cm NUMERIC,
  product_worn TEXT,
  message TEXT,
  created_at TIMESTAMPTZ,
  image_url TEXT,
  image_sort_order INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT 
      ps.id,
      ps.submitter_name,
      ps.submitter_instagram,
      ps.location_name,
      ps.location_zip,
      ps.product_size,
      ps.model_height_cm,
      ps.product_worn,
      ps.message,
      ps.created_at,
      si.image_url,
      si.sort_order AS image_sort_order
    FROM hub_photo_submissions ps
    INNER JOIN hub_photo_submission_tags pst ON pst.submission_id = ps.id
    INNER JOIN hub_photo_tags pt ON pt.id = pst.tag_id
    LEFT JOIN hub_submission_images si ON si.submission_id = ps.id
    WHERE ps.status = 'approved'
      AND lower(trim(pt.name)) = lower(trim(p_tag_name))
    ORDER BY ps.created_at DESC, si.sort_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_approved_photos_by_tag TO anon, authenticated;
