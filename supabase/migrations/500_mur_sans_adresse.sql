-- WHY: audit du 11/10/2026 — le mur « Ils nous portent » du thème Shopify appelle cette fonction
--      sans compte ; elle rendait à n'importe qui l'Instagram, la ville et le code postal de ceux
--      qui envoient une photo, que le thème n'affiche même pas (il lit image_url, message,
--      rating_experience, rating_products, submitter_name — sections/rdc_ils-nous-portent-
--      produit.liquid). Ces trois colonnes restent dans la signature (le thème ne casse pas) mais
--      sont vides.
--   get_community_photos_by_product (définition live du 11/10, copiée entière) : seules les trois
--   colonnes changent.
-- SCHEMA CHECKED (11/10/2026, pg_proc live) : la signature RETURNS TABLE inchangée.

CREATE OR REPLACE FUNCTION public.get_community_photos_by_product(p_handle text)
 RETURNS TABLE(submission_id uuid, image_url text, image_sort_order integer, submitter_name text, submitter_instagram text, location_name text, location_zip text, message text, rating_experience integer, rating_products integer, created_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    s.id, i.image_url, i.sort_order,
    -- Le mur n'affiche que le prénom : l'Instagram, la ville et le code postal ne sortent plus.
    s.submitter_name, NULL::text, NULL::text, NULL::text,
    s.message, s.rating_experience, s.rating_products, s.created_at
  FROM public.hub_submission_images i
  JOIN public.hub_photo_submissions s ON s.id = i.submission_id
  WHERE i.show_in_community = true
    AND s.status = 'approved'
    AND s.consent_brand_usage = true
    AND i.shopify_product_handle = NULLIF(btrim(p_handle), '')
  ORDER BY s.created_at DESC, i.sort_order ASC;
$function$;
