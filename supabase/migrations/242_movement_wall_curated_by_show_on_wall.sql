-- 242_movement_wall_curated_by_show_on_wall.sql
-- WHY : feature « Mur du Mouvement » (repo hub, 2026-06-12). La curation passe du
-- statut image (i.status) au seul flag i.show_on_wall. Ré-adoptée en NNN pour
-- aligner le `db push` de ce repo. Idempotente (CREATE OR REPLACE VIEW), déjà en prod.
CREATE OR REPLACE VIEW public.movement_wall_photos AS
 SELECT i.id AS image_id,
    i.image_url,
    i.shopify_product_handle,
    i.shopify_product_title,
    s.submitter_name,
    s.submitter_instagram,
    s.message,
    s.created_at
   FROM hub_submission_images i
     JOIN hub_photo_submissions s ON s.id = i.submission_id
  WHERE s.status = 'approved'::text
    AND s.consent_brand_usage = true
    AND i.show_on_wall = true;
