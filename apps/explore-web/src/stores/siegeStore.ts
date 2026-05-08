import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export type SiegeStatus = 'siege' | 'critical'

export interface SiegeRow {
  place_id: string
  latitude: number
  longitude: number
  challenger_count: number
  max_challenger_score: number
  /** Score du veilleur actuel (= défenseur). null si pas d'investissement défensif. */
  defender_score: number | null
}

interface SiegeStoreState {
  rows: SiegeRow[]
  /** Lookup rapide placeId → statut, recalculé à chaque set des rows. */
  statusByPlaceId: Map<string, SiegeStatus>
  loading: boolean

  refresh: () => Promise<void>
  reset: () => void
}

/**
 * Calcule le statut d'un lieu à partir de l'écart score défenseur / challenger leader.
 * - 'critical' : pas de veilleur défensif, OU le challenger leader >= défenseur
 * - 'siege'    : la défense tient encore (challenger leader < défenseur)
 */
function deriveStatus(row: SiegeRow): SiegeStatus {
  if (row.defender_score == null) return 'critical'
  if (row.max_challenger_score >= row.defender_score) return 'critical'
  return 'siege'
}

function rowsToStatusMap(rows: SiegeRow[]): Map<string, SiegeStatus> {
  const map = new Map<string, SiegeStatus>()
  for (const r of rows) map.set(r.place_id, deriveStatus(r))
  return map
}

/**
 * Lieux "en siège" — au moins une expédition challenger a investi des Couronnes
 * contre l'expé veilleur. Affiché côté UI dans la pilule du veilleur sur la carte
 * (cf. VeilleurNamePills) — pas de layer GeoJSON séparé.
 */
export const useSiegeStore = create<SiegeStoreState>((set) => ({
  rows: [],
  statusByPlaceId: new Map(),
  loading: false,

  refresh: async () => {
    set({ loading: true })
    const { data, error } = await supabase.rpc('list_places_in_siege')
    if (error) {
      console.error('[siege] list_places_in_siege error:', error.message, error.details, error.hint)
      set({ loading: false })
      return
    }
    const rows = (data as SiegeRow[]) ?? []
    set({ rows, statusByPlaceId: rowsToStatusMap(rows), loading: false })
  },

  reset: () => set({ rows: [], statusByPlaceId: new Map(), loading: false }),
}))
