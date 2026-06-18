import { supabase } from './supabase'
import type { GpsMark, GpsMarkImage, NearbyPlace } from '../types/gpsMark'

interface DraftRow {
  id: string
  latitude: number
  longitude: number
  accuracy_m: number | null
  title: string | null
  images: GpsMarkImage[] | null
  created_at: string
  status: 'open' | 'published'
}

function rowToMark(r: DraftRow): GpsMark {
  return {
    id: r.id,
    latitude: r.latitude,
    longitude: r.longitude,
    accuracyM: r.accuracy_m,
    title: r.title,
    images: r.images ?? [],
    createdAt: r.created_at,
    status: r.status,
  }
}

/** Liste les marques ouvertes du joueur courant (RLS owner-only). */
export async function fetchMyGpsMarks(): Promise<GpsMark[]> {
  const { data, error } = await supabase
    .from('place_drafts')
    .select('id, latitude, longitude, accuracy_m, title, images, created_at, status')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  if (error) {
    console.warn('[gpsMarksApi] fetch failed', error)
    return []
  }
  return (data as DraftRow[]).map(rowToMark)
}

export async function createGpsMark(args: {
  userId: string; lat: number; lng: number; accuracy: number | null
  title: string | null; images: GpsMarkImage[]
}): Promise<{ id: string; createdAt: string } | { error: string }> {
  const { data, error } = await supabase.rpc('create_gps_mark', {
    p_user_id: args.userId, p_lat: args.lat, p_lng: args.lng,
    p_accuracy: args.accuracy, p_title: args.title, p_images: args.images,
  })
  if (error) return { error: error.message }
  if ((data as { error?: string })?.error) return { error: (data as { error: string }).error }
  return { id: (data as { id: string }).id, createdAt: (data as { createdAt: string }).createdAt }
}

export async function deleteGpsMark(userId: string, draftId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('delete_gps_mark', { p_user_id: userId, p_draft_id: draftId })
  if (error) { console.warn('[gpsMarksApi] delete failed', error); return false }
  return !!(data as { success?: boolean })?.success
}

export async function findNearbyPlaces(lat: number, lng: number, radiusM: number): Promise<NearbyPlace[]> {
  const { data, error } = await supabase.rpc('find_nearby_places', { p_lat: lat, p_lng: lng, p_radius_m: radiusM })
  if (error) { console.warn('[gpsMarksApi] nearby failed', error); return [] }
  return (data as { place_id: string; title: string; distance_m: number; has_veilleur: boolean }[])
    .map(r => ({ placeId: r.place_id, title: r.title, distanceM: r.distance_m, hasVeilleur: r.has_veilleur }))
}

export interface PublishMarkArgs {
  userId: string; draftId: string; title: string; latitude: number; longitude: number
  tagId: string; images: GpsMarkImage[]; address: string; text: string
  eraId: string | null; yearExact: number | null; secondaryTagIds: string[]
  mergeIntoPlaceId: string | null
}

export interface PublishMarkResult {
  success?: boolean; error?: string; mode?: 'created' | 'merged'
  placeId?: string; isGps?: boolean; requiredDiscoveries?: number; currentDiscoveries?: number
}

export async function publishGpsMark(args: PublishMarkArgs): Promise<PublishMarkResult> {
  const { data, error } = await supabase.rpc('publish_gps_mark', {
    p_user_id: args.userId, p_draft_id: args.draftId, p_title: args.title,
    p_latitude: args.latitude, p_longitude: args.longitude, p_tag_id: args.tagId,
    p_images: args.images, p_address: args.address, p_text: args.text,
    p_era_id: args.eraId, p_year_exact: args.yearExact,
    p_secondary_tag_ids: args.secondaryTagIds, p_merge_into_place_id: args.mergeIntoPlaceId,
  })
  if (error) return { error: error.message }
  return data as PublishMarkResult
}
