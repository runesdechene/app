import { create } from 'zustand'
import type { MapVeille } from '../types/veille'

interface VeillesState {
  /** Map placeId → veille (avec members). Source de vérité pour VeilleMarkers. */
  veilles: Map<string, MapVeille>
  setVeilles: (list: MapVeille[]) => void
  upsertVeille: (v: MapVeille) => void
  removeVeille: (placeId: string) => void
}

export const useVeillesStore = create<VeillesState>(set => ({
  veilles: new Map(),
  setVeilles: (list) => set({ veilles: new Map(list.map(v => [v.placeId, v])) }),
  upsertVeille: (v) => set(state => {
    const next = new Map(state.veilles)
    next.set(v.placeId, v)
    return { veilles: next }
  }),
  removeVeille: (placeId) => set(state => {
    const next = new Map(state.veilles)
    next.delete(placeId)
    return { veilles: next }
  }),
}))
