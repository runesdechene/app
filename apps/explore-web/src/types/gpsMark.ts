/** Photo d'une marque, déjà uploadée (mêmes champs que places.images). */
export interface GpsMarkImage {
  id: string
  url: string
  thumb: string
}

/** Marque GPS (brouillon de lieu) telle que lue depuis place_drafts. */
export interface GpsMark {
  id: string
  latitude: number
  longitude: number
  accuracyM: number | null
  title: string | null
  images: GpsMarkImage[]
  createdAt: string // ISO
  status: 'open' | 'published'
}

/** Lieu existant proche, candidat à la fusion (RPC find_nearby_places). */
export interface NearbyPlace {
  placeId: string
  title: string
  distanceM: number
}
