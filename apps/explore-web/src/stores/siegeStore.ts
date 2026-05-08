import { create } from 'zustand'
import type { FeatureCollection, Point } from 'geojson'
import { supabase } from '../lib/supabase'

export interface SiegeRow {
  place_id: string
  latitude: number
  longitude: number
  challenger_count: number
  max_challenger_score: number
}

interface SiegeStoreState {
  rows: SiegeRow[]
  loading: boolean
  /** GeoJSON dérivé pour MapLibre source — recalculé à chaque set des rows. */
  geojson: FeatureCollection<Point>

  refresh: () => Promise<void>
  reset: () => void
}

const EMPTY_GEOJSON: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] }

function rowsToGeoJSON(rows: SiegeRow[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: rows.map((r) => ({
      type: 'Feature',
      id: r.place_id,
      geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
      properties: {
        placeId: r.place_id,
        challengerCount: r.challenger_count,
        maxChallengerScore: r.max_challenger_score,
      },
    })),
  }
}

/**
 * Lieux "en siège" — au moins une expédition challenger a investi des Couronnes
 * contre l'expé veilleur. Source unique pour le layer GeoJSON MapLibre dédié.
 *
 * Performance : le rendu se fait en symbol layer GPU (pas en Marker DOM) —
 * critique vu qu'on peut avoir plusieurs centaines de lieux en siège à terme.
 */
export const useSiegeStore = create<SiegeStoreState>((set) => ({
  rows: [],
  loading: false,
  geojson: EMPTY_GEOJSON,

  refresh: async () => {
    set({ loading: true })
    const { data, error } = await supabase.rpc('list_places_in_siege')
    if (error) {
      console.error('[siege] list_places_in_siege error:', error.message, error.details, error.hint)
      set({ loading: false })
      return
    }
    const rows = (data as SiegeRow[]) ?? []
    set({ rows, geojson: rowsToGeoJSON(rows), loading: false })
  },

  reset: () => set({ rows: [], geojson: EMPTY_GEOJSON, loading: false }),
}))
