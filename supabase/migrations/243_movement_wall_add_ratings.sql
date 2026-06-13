-- 243_movement_wall_add_ratings.sql
-- WHY : feature « Mur du Mouvement » (repo hub, 2026-06-12). Ajoute les notes
-- (rating_experience / rating_products) à la vue. Ré-adoptée en NNN pour aligner
-- le `db push` de ce repo. Idempotente (CREATE OR REPLACE VIEW), déjà en prod.
CREATE OR REPLACE VIEW public.movement_wall_photos AS
 SELECT i.id AS image_id,
    i.image_url,
    i.shopify_product_handle,
    i.shopify_product_title,
    s.submitter_name,
    s.submitter_instagram,
    s.message,
    s.created_at,
    s.rating_experience,
    s.rating_products
   FROM hub_submission_images i
     JOIN hub_photo_submissions s ON s.id = i.submission_id
  WHERE s.status = 'approved'::text
    AND s.consent_brand_usage = true
    AND i.show_on_wall = true;
