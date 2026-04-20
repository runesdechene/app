import { supabase } from './supabase';

export interface PlaceImage {
  id: string;
  url: string;
  thumb?: string;
}

export interface PlaceType {
  id: string;
  title: string;
  color: string;
  images: Record<string, string>;
}

export interface PlaceTag {
  id: string;
  title: string;
  color: string;
  background: string;
  icon: string | null;
  isPrimary: boolean;
}

export interface Place {
  id: string;
  title: string;
  text: string;
  slug: string;
  address: string;
  latitude: number;
  longitude: number;
  images: PlaceImage[];
  accessibility: string | null;
  sensible: boolean;
  seo_description: string | null;
  place_type: PlaceType;
  author_name: string;
  tags: PlaceTag[];
  primaryTag: PlaceTag | null;
}

export interface Contribution {
  id: string;
  type: string;
  title: string;
  content: string;
  image_url: string | null;
  images: string[];
  votes_up: number;
  votes_down: number;
  created_at: string;
  user_name: string;
  user_avatar: string | null;
}

const PAGE_SIZE = 1000;
const TAG_BATCH_SIZE = 300;

export async function getAllPlacesWithSlugs(): Promise<Place[]> {
  let allPlaces: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('places')
      .select(`
        id, title, text, slug, address, latitude, longitude,
        images, accessibility, sensible, seo_description, author_id,
        place_types!inner ( id, title, color, images )
      `)
      .not('slug', 'is', null)
      .eq('private', false)
      .eq('masked', false)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    allPlaces = allPlaces.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const placeIds = allPlaces.map((p: any) => p.id);

  const tagsMap = new Map<string, PlaceTag[]>();
  for (let i = 0; i < placeIds.length; i += TAG_BATCH_SIZE) {
    const batch = placeIds.slice(i, i + TAG_BATCH_SIZE);
    const { data: tagRows, error: tagErr } = await supabase
      .from('place_tags')
      .select('place_id, is_primary, tags(id, title, color, background, icon)')
      .in('place_id', batch);

    if (tagErr) throw tagErr;

    for (const r of (tagRows ?? []) as unknown as Array<{
      place_id: string;
      is_primary: boolean;
      tags: { id: string; title: string; color: string; background: string; icon: string | null } | null;
    }>) {
      if (!r.tags) continue;
      const arr = tagsMap.get(r.place_id) ?? [];
      arr.push({
        id: r.tags.id,
        title: r.tags.title,
        color: r.tags.color,
        background: r.tags.background,
        icon: r.tags.icon,
        isPrimary: r.is_primary,
      });
      tagsMap.set(r.place_id, arr);
    }
  }

  const authorIds = [...new Set(allPlaces.map((p: any) => p.author_id).filter(Boolean))];
  const authorMap = new Map<string, string>();
  for (let i = 0; i < authorIds.length; i += TAG_BATCH_SIZE) {
    const batch = authorIds.slice(i, i + TAG_BATCH_SIZE);
    const { data: authors } = await supabase
      .from('users')
      .select('id, first_name')
      .in('id', batch);
    for (const a of authors ?? []) {
      authorMap.set(a.id, a.first_name ?? '');
    }
  }

  return allPlaces.map((row: any) => {
    const tags = tagsMap.get(row.id) ?? [];
    const primary = tags.find(t => t.isPrimary) ?? tags[0] ?? null;
    return {
      id: row.id,
      title: row.title,
      text: row.text,
      slug: row.slug,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      images: row.images ?? [],
      accessibility: row.accessibility,
      sensible: row.sensible,
      seo_description: row.seo_description,
      place_type: row.place_types,
      author_name: authorMap.get(row.author_id) ?? '',
      tags,
      primaryTag: primary,
    };
  });
}

export async function getPlaceContributions(placeId: string): Promise<Contribution[]> {
  const { data, error } = await supabase
    .from('place_contributions')
    .select(`
      id, type, title, content, image_url, images,
      votes_up, votes_down, created_at,
      users ( first_name, avatar_url )
    `)
    .eq('place_id', placeId)
    .order('votes_up', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    image_url: row.image_url,
    images: row.images ?? [],
    votes_up: row.votes_up ?? 0,
    votes_down: row.votes_down ?? 0,
    created_at: row.created_at,
    user_name: row.users?.first_name ?? 'Explorateur anonyme',
    user_avatar: row.users?.avatar_url ?? null,
  }));
}

export async function getNearbyPlaces(
  latitude: number,
  longitude: number,
  excludeId: string,
  limit = 4
): Promise<Pick<Place, 'title' | 'slug' | 'images' | 'place_type'>[]> {
  const { data, error } = await supabase
    .from('places')
    .select(`
      id, title, slug, images, latitude, longitude,
      place_types!inner ( id, title, color, images )
    `)
    .not('slug', 'is', null)
    .neq('id', excludeId)
    .eq('private', false)
    .eq('masked', false)
    .gte('latitude', latitude - 0.5)
    .lte('latitude', latitude + 0.5)
    .gte('longitude', longitude - 0.5)
    .lte('longitude', longitude + 0.5)
    .limit(20);

  if (error) throw error;

  const places = (data ?? []).map((row: any) => ({
    ...row,
    place_type: row.place_types,
    distance: haversine(latitude, longitude, row.latitude, row.longitude),
  }));

  places.sort((a: any, b: any) => a.distance - b.distance);
  return places.slice(0, limit);
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
