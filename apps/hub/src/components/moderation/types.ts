export interface ModTag {
  id: string
  title: string
  color: string
  background: string
  is_primary: boolean
}

export interface ModListRow {
  id: string
  title: string
  address: string
  latitude: number
  longitude: number
  masked: boolean
  sensible: boolean
  created_at: string
  verified_at: string | null
  author_id: string
  author_name: string | null
  verified_by_name: string | null
  photo_count: number
  visit_count: number
  tags: ModTag[]
}

export type ModFilter = 'unverified' | 'verified' | 'all'

export interface ModListResult {
  total: number
  rows: ModListRow[]
}

export interface ModPlaceDetail {
  id: string
  title: string
  text: string
  address: string
  latitude: number
  longitude: number
  masked: boolean
  sensible: boolean
  created_at: string
  updated_at: string
  verified_at: string | null
  verified_by_name: string | null
  author_id: string
  author_name: string | null
  author_contributions: number | null
  author_places_count: number
  visit_count: number
  discovered_count: number
  rating_avg: number | null
  rating_count: number
  photo_count: number
}
