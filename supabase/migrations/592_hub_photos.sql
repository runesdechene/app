-- WHY: la vue « Photos » du Hub montre toutes les photos et où elles sont publiées (fiche produit,
-- mur, communauté) ; hub_contributions pagine par contribution, pas par photo.
-- SCHEMA CHECKED (2026-11-11) : hub_submission_images (id, submission_id, image_url, created_at,
--   shopify_product_title, shopify_media_id, show_on_wall, show_in_community) ;
--   hub_photo_submissions (id, submitter_name, status, created_at) — information_schema.

CREATE OR REPLACE FUNCTION public.hub_photos()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT _is_admin() THEN PERFORM _refus('Réservé à l’équipe', 'role'); END IF;
  -- shortcut: tout d'un bloc (134 photos le 11/11) ; paginer quand la vue ralentira.
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', i.id,
             'url', i.image_url,
             'contribution', s.id,
             'nom', s.submitter_name,
             'statut', s.status,
             'quand', COALESCE(i.created_at, s.created_at),
             'produit_titre', i.shopify_product_title,
             'fiche', COALESCE(i.shopify_media_id, '') <> '',
             'mur', i.show_on_wall,
             'communaute', i.show_in_community
           ) ORDER BY COALESCE(i.created_at, s.created_at) DESC, i.id)
      FROM hub_submission_images i
      JOIN hub_photo_submissions s ON s.id = i.submission_id
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_photos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_photos() TO authenticated;
