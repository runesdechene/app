// apps/seo-pages/src/lib/movement.ts
import { supabase } from './supabase';

export interface WallPhoto {
  imageId: string;
  imageUrl: string;
  productHandle: string | null;
  productTitle: string | null;
  submitterName: string | null;
  submitterInstagram: string | null;
  message: string | null;
}

const PAGE_SIZE = 1000;

export async function getMovementWallPhotos(): Promise<WallPhoto[]> {
  const all: WallPhoto[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('movement_wall_photos')
      .select('image_id, image_url, shopify_product_handle, shopify_product_title, submitter_name, submitter_instagram, message, created_at')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data as Array<Record<string, unknown>>) {
      all.push({
        imageId: r.image_id as string,
        imageUrl: r.image_url as string,
        productHandle: (r.shopify_product_handle as string | null) ?? null,
        productTitle: (r.shopify_product_title as string | null) ?? null,
        submitterName: (r.submitter_name as string | null) ?? null,
        submitterInstagram: (r.submitter_instagram as string | null) ?? null,
        message: (r.message as string | null) ?? null,
      });
    }
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}
