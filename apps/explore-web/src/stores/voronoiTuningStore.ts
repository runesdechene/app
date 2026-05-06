import { create } from 'zustand'

// Store admin-only pour tester la formule de Voronoï pondéré en live.
// Pas de persistance backend — purement preview de session.
//
// Formule : rayon_km = min(capKm, baseKm + log10(1 + crowns) × stepKm)

export const VORONOI_TUNING_DEFAULTS = {
  enabled: false,
  baseKm: 1.0,
  stepKm: 0.5,
  capKm: 3.0,
} as const

interface VoronoiTuningState {
  enabled: boolean
  baseKm: number
  stepKm: number
  capKm: number
  /** Map placeId → total Couronnes investies (chargé via get_court_invested_per_place) */
  crownsByPlace: Map<string, number>

  setEnabled: (v: boolean) => void
  setBaseKm: (v: number) => void
  setStepKm: (v: number) => void
  setCapKm: (v: number) => void
  setCrownsByPlace: (map: Map<string, number>) => void
  /** V1 — incrément optimistic après un tap d'investissement */
  bumpCrowns: (placeId: string, delta: number) => void
  reset: () => void
}

export const useVoronoiTuningStore = create<VoronoiTuningState>((set) => ({
  ...VORONOI_TUNING_DEFAULTS,
  crownsByPlace: new Map(),

  setEnabled: (v) => set({ enabled: v }),
  setBaseKm: (v) => set({ baseKm: v }),
  setStepKm: (v) => set({ stepKm: v }),
  setCapKm: (v) => set({ capKm: v }),
  setCrownsByPlace: (map) => set({ crownsByPlace: map }),
  bumpCrowns: (placeId, delta) => set((state) => {
    const next = new Map(state.crownsByPlace)
    next.set(placeId, (next.get(placeId) ?? 0) + delta)
    return { crownsByPlace: next }
  }),
  reset: () => set({ ...VORONOI_TUNING_DEFAULTS }),
}))

/** Calcule le rayon en km selon la formule pondérée. Pure function pour
 *  pouvoir être appelée depuis le main thread (tableau de référence) ET
 *  depuis le worker (sans import du store). */
export function radiusForCrowns(
  crowns: number,
  baseKm: number,
  stepKm: number,
  capKm: number,
): number {
  const c = Math.max(0, crowns)
  const r = baseKm + Math.log10(1 + c) * stepKm
  return Math.min(capKm, r)
}
