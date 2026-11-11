-- WHY: une photo jointe à un avis publié est affichée avec l'avis (Kelly A., photo importée de
-- Judge.me) : la vue « Photos » la disait « nulle part ». hub_photos rend aussi « avis ».
-- SCHEMA CHECKED (2026-11-11) : hub_photo_submissions.rating_products, rating_experience (integer),
--   status (text) — information_schema. Définition de départ : 592, appliquée le jour même.

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
             'communaute', i.show_in_community,
             -- un avis approuvé s'affiche avec ses photos (mig 588 : la note fait l'avis)
             'avis', s.status = 'approved'
                     AND (s.rating_products IS NOT NULL OR s.rating_experience IS NOT NULL)
           ) ORDER BY COALESCE(i.created_at, s.created_at) DESC, i.id)
      FROM hub_submission_images i
      JOIN hub_photo_submissions s ON s.id = i.submission_id
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.hub_photos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hub_photos() TO authenticated;
