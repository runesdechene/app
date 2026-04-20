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
}

export interface Contribution {
  id: string;
  type: string;
  title: string;
  content: string;
  image_url: string | null;
  images: PlaceImage[];
  votes_up: number;
  votes_down: number;
  created_at: string;
  user_name: string;
  user_avatar: string | null;
}

export async function getAllPlacesWithSlugs(): Promise<Place[]> {
  const { data, error } = await supabase
    .from('places')
    .select(`
      id, title, text, slug, address, latitude, longitude,
      images, accessibility, sensible, seo_description,
      place_types!inner ( id, title, color, images ),
      users!places_author_id_fkey ( first_name )
    `)
    .not('slug', 'is', null)
    .eq('private', false)
    .eq('masked', false);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
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
    author_name: row.users?.first_name ?? 'Explorateur',
  }));
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
