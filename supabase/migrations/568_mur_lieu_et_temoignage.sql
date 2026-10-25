-- WHY: le mur des porteurs de la boutique devient un fil d'avis, une carte par personne
-- (Uriel, 25/10/2026). La vue doit donner le lieu de la photo (texte libre saisi au Hub,
-- rempli sur 10 témoignages sur 23) et l'identifiant du témoignage, pour regrouper les
-- photos d'une même personne. Définition live copiée entière ; on ajoute deux colonnes à la fin.
-- SCHEMA CHECKED (2026-10-25) :
--   hub_photo_submissions.location_name : TEXT — confirmed via information_schema
--   hub_photo_submissions.id            : UUID — confirmed
--   définition live : pg_get_viewdef('public.movement_wall_photos') ; security_invoker posé en 322, repris ici
CREATE OR REPLACE VIEW public.movement_wall_photos
WITH (security_invoker = true) AS
 SELECT i.id AS image_id,
    i.image_url,
    i.shopify_product_handle,
    i.shopify_product_title,
    s.submitter_name,
    s.submitter_instagram,
    s.message,
    s.created_at,
    s.rating_experience,
    s.rating_products,
    s.location_name,
    s.id AS submission_id
   FROM hub_submission_images i
     JOIN hub_photo_submissions s ON s.id = i.submission_id
  WHERE s.status = 'approved'::text AND s.consent_brand_usage = true AND i.show_on_wall = true;
