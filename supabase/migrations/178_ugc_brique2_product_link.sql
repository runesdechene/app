-- 178_ugc_brique2_product_link.sql
-- UGC Brique 2 : lien photo -> produit Shopify (galeries fiches produit) + vue du mur.

-- 1. Colonnes de liaison produit, par image (curation au niveau image, cf. Brique 1bis-A)
alter table public.hub_submission_images
  add column if not exists shopify_product_id     text,
  add column if not exists shopify_product_handle text,
  add column if not exists shopify_product_title  text,
  add column if not exists shopify_media_id        text;

comment on column public.hub_submission_images.shopify_product_id is
  'ID produit Shopify (legacyResourceId numerique) — cle de jointure et de push';
comment on column public.hub_submission_images.shopify_media_id is
  'ID de l image produit Shopify renvoye au push (REST products/{id}/images.json) — null = non poussee';

-- 2. RPC : lier une image a un produit Shopify (remplace le champ libre product_worn)
create or replace function public.set_submission_image_shopify_product(
  p_image_id  uuid,
  p_product_id text,
  p_handle     text,
  p_title      text
) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  update hub_submission_images
     set shopify_product_id     = nullif(btrim(p_product_id), ''),
         shopify_product_handle = nullif(btrim(p_handle), ''),
         shopify_product_title  = nullif(btrim(p_title), '')
   where id = p_image_id;
end; $$;

-- 3. RPC : enregistrer l ID image Shopify apres un push reussi
create or replace function public.set_submission_image_media(
  p_image_id uuid,
  p_media_id text
) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  update hub_submission_images
     set shopify_media_id = nullif(btrim(p_media_id), '')
   where id = p_image_id;
end; $$;

-- 4. RPC : delier (apres suppression cote Shopify)
create or replace function public.clear_submission_image_shopify_product(
  p_image_id uuid
) returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  update hub_submission_images
     set shopify_product_id     = null,
         shopify_product_handle = null,
         shopify_product_title  = null,
         shopify_media_id        = null
   where id = p_image_id;
end; $$;

-- 5. Vue lecture seule du mur : photos approuvees + consentement diffusion (lue par seo-pages, service key)
create or replace view public.movement_wall_photos as
select
  i.id                     as image_id,
  i.image_url,
  i.shopify_product_handle,
  i.shopify_product_title,
  s.submitter_name,
  s.submitter_instagram,
  s.message,
  s.created_at
from public.hub_submission_images i
join public.hub_photo_submissions s on s.id = i.submission_id
where i.status = 'approved'
  and s.status = 'approved'
  and s.consent_brand_usage = true;
