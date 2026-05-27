-- 181_ugc_curation_toggles.sql
-- UX curation par photo : toggle "Mur communautaire global" (show_on_wall) + suppression unitaire.
-- Le bloc produit ne depend plus du statut image 'approved' (suppression du bouton Garder manuel) :
-- la curation se fait via les toggles de destination, la photo non voulue est supprimee (delete).

-- 1. Toggle Mur communautaire global (sans effet tant que le mur est HS, mais le choix est memorise)
ALTER TABLE public.hub_submission_images
  ADD COLUMN IF NOT EXISTS show_on_wall boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.set_submission_image_wall(p_image_id uuid, p_show boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.hub_submission_images SET show_on_wall = COALESCE(p_show, false) WHERE id = p_image_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.set_submission_image_wall(uuid, boolean) TO anon, authenticated, service_role;

-- 2. Suppression unitaire d'une photo (la ligne ; le fichier storage + l'image Shopify sont retires cote Hub avant l'appel)
CREATE OR REPLACE FUNCTION public.delete_submission_image(p_image_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.hub_submission_images WHERE id = p_image_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.delete_submission_image(uuid) TO anon, authenticated, service_role;

-- 3. get_community_photos_by_product : ne depend plus du statut image 'approved'.
--    Gate = soumission approuvee + consentement marque + show_in_community + produit relie.
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
    AND s.status = 'approved'
    AND s.consent_brand_usage = true
    AND i.shopify_product_handle = NULLIF(btrim(p_handle), '')
  ORDER BY s.created_at DESC, i.sort_order ASC;
$$;
GRANT EXECUTE ON FUNCTION public.get_community_photos_by_product(text) TO anon, authenticated, service_role;
