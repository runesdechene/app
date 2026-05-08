import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export type SiegeStatus = 'siege' | 'critical'

export interface SiegeRow {
  place_id: string
  challenger_count: number
  max_challenger_score: number
  /** Score effectif du défenseur (= 50 + défense investie pour veilleur GPS plein,
   *  défense investie seule pour veilleur par influence). Cf. mig 131. */
  defender_effective_score: number
  /** True si le challenger leader a atteint 50% du score effectif défenseur
   *  (= seuil bascule imminente, aligné sur la notif 'place_court_high_threat'). */
  is_at_risk: boolean
}

interface SiegeStoreState {
  rows: SiegeRow[]
  /** Lookup rapide placeId → statut, recalculé à chaque set des rows. */
  statusByPlaceId: Map<string, SiegeStatus>
  loading: boolean

  refresh: () => Promise<void>
  reset: () => void
}

function rowsToStatusMap(rows: SiegeRow[]): Map<string, SiegeStatus> {
  const map = new Map<string, SiegeStatus>()
  for (const r of rows) {
    map.set(r.place_id, r.is_at_risk ? 'critical' : 'siege')
  }
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
