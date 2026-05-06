import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useVoronoiTuningStore } from '../stores/voronoiTuningStore'

interface CourtInvestedRow {
  placeId: string
  crownsTotal: number
}

/** Charge la map placeId → Couronnes investies au mount.
 *  Alimente le store voronoiTuning pour pondérer les territoires sur la carte
 *  côté tous les users (pas seulement admin).
 *  V0.7.3 — calibration prod 1.6 / 0.9 / 10 km. */
export function useCourtInvestedLoad(isAuthenticated: boolean) {
  const setCrownsByPlace = useVoronoiTuningStore(s => s.setCrownsByPlace)

  useEffect(() => {
    if (!isAuthenticated) return
    void (async () => {
      const { data, error } = await supabase.rpc('get_court_invested_per_place')
      if (error) {
        console.error('[useCourtInvestedLoad] error', error)
        return
      }
      const rows = (data as CourtInvestedRow[]) ?? []
      const map = new Map<string, number>()
      for (const r of rows) map.set(r.placeId, r.crownsTotal)
      setCrownsByPlace(map)
    })()
  }, [isAuthenticated, setCrownsByPlace])
}
