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
  author_avatar: string | null;
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

export async function getPlaceBySlug(slug: string): Promise<Place | null> {
  const { data, error } = await supabase
    .from('places')
    .select(`
      id, title, text, slug, address, latitude, longitude,
      images, accessibility, sensible, seo_description, author_id,
      place_types!inner ( id, title, color, images )
    `)
    .eq('slug', slug)
    .eq('private', false)
    .eq('masked', false)
    .single();

  if (error || !data) return null;

  const { data: tagRows } = await supabase
    .from('place_tags')
    .select('place_id, is_primary, tags(id, title, color, background, icon)')
    .eq('place_id', data.id);

  const tags: PlaceTag[] = [];
  for (const r of (tagRows ?? []) as unknown as Array<{
    place_id: string;
    is_primary: boolean;
    tags: { id: string; title: string; color: string; background: string; icon: string | null } | null;
  }>) {
    if (!r.tags) continue;
    tags.push({
      id: r.tags.id,
      title: r.tags.title,
      color: r.tags.color,
      background: r.tags.background,
      icon: r.tags.icon,
      isPrimary: r.is_primary,
    });
  }

  const primary = tags.find(t => t.isPrimary) ?? tags[0] ?? null;

  let authorName = '';
  let authorAvatar: string | null = null;
  if (data.author_id) {
    const { data: author } = await supabase
      .from('users')
      .select('first_name, avatar_url')
      .eq('id', data.author_id)
      .single();
    authorName = author?.first_name ?? '';
    authorAvatar = author?.avatar_url ?? null;
  }

  return {
    id: data.id,
    title: data.title,
    text: data.text,
    slug: data.slug,
    address: data.address,
    latitude: data.latitude,
    longitude: data.longitude,
    images: data.images ?? [],
    accessibility: data.accessibility,
    sensible: data.sensible,
    seo_description: data.seo_description,
    place_type: (data as any).place_types,
    author_name: authorName,
    author_avatar: authorAvatar,
    tags,
    primaryTag: primary,
  };
}

export async function getTotalPlaceCount(): Promise<number> {
  const { count, error } = await supabase
    .from('places')
    .select('*', { count: 'exact', head: true })
    .eq('private', false)
    .eq('masked', false);

  if (error) throw error;
  return count ?? 0;
}
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
  const authorMap = new Map<string, { name: string; avatar: string | null }>();
  for (let i = 0; i < authorIds.length; i += TAG_BATCH_SIZE) {
    const batch = authorIds.slice(i, i + TAG_BATCH_SIZE);
    const { data: authors } = await supabase
      .from('users')
      .select('id, first_name, avatar_url')
      .in('id', batch);
    for (const a of authors ?? []) {
      authorMap.set(a.id, { name: a.first_name ?? '', avatar: a.avatar_url ?? null });
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
      author_name: authorMap.get(row.author_id)?.name ?? '',
      author_avatar: authorMap.get(row.author_id)?.avatar ?? null,
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
    .eq('type', 'carnet')
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

export interface NearbyPlace {
  title: string;
  slug: string;
  images: PlaceImage[];
  primaryTag: PlaceTag | null;
}

export async function getNearbyPlaces(
  latitude: number,
  longitude: number,
  excludeId: string,
  limit = 4
): Promise<NearbyPlace[]> {
  const { data, error } = await supabase
    .from('places')
    .select(`
      id, title, slug, images, latitude, longitude
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

  const sorted = (data ?? [])
    .map((row: any) => ({
      ...row,
      distance: haversine(latitude, longitude, row.latitude, row.longitude),
    }))
    .sort((a: any, b: any) => a.distance - b.distance)
    .slice(0, limit);

  const nearbyIds = sorted.map((p: any) => p.id);
  const tagMap = new Map<string, PlaceTag>();
  if (nearbyIds.length > 0) {
    const { data: tagRows } = await supabase
      .from('place_tags')
      .select('place_id, is_primary, tags(id, title, color, background, icon)')
      .in('place_id', nearbyIds)
      .eq('is_primary', true);

    for (const r of (tagRows ?? []) as unknown as Array<{
      place_id: string;
      is_primary: boolean;
      tags: { id: string; title: string; color: string; background: string; icon: string | null } | null;
    }>) {
      if (!r.tags) continue;
      tagMap.set(r.place_id, {
        id: r.tags.id,
        title: r.tags.title,
        color: r.tags.color,
        background: r.tags.background,
        icon: r.tags.icon,
        isPrimary: true,
      });
    }
  }

  return sorted.map((row: any) => ({
    title: row.title,
    slug: row.slug,
    images: row.images ?? [],
    primaryTag: tagMap.get(row.id) ?? null,
  }));
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
