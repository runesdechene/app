import { create } from 'zustand'

interface FogState {
  /** IDs des lieux découverts par l'utilisateur (lookup O(1)) */
  discoveredIds: Set<string>
  setDiscoveredIds: (ids: string[]) => void
  addDiscoveredId: (id: string) => void

  /** Faction du joueur (pour auto-découverte) */
  userFactionId: string | null
  setUserFactionId: (id: string | null) => void

  /** ID interne de l'utilisateur (table users) */
  userId: string | null
  setUserId: (id: string | null) => void

  /** Énergie quotidienne */
  energy: number
  maxEnergy: number
  setEnergy: (energy: number) => void

  /** Position GPS du joueur */
  userPosition: { lng: number; lat: number } | null
  setUserPosition: (pos: { lng: number; lat: number } | null) => void

  /** URL de l'avatar du joueur (Supabase storage) */
  userAvatarUrl: string | null
  setUserAvatarUrl: (url: string | null) => void

  /** Chargement initial */
  loading: boolean
  setLoading: (loading: boolean) => void
}

export const useFogStore = create<FogState>((set) => ({
  discoveredIds: new Set(),
  setDiscoveredIds: (ids) => set({ discoveredIds: new Set(ids) }),
  addDiscoveredId: (id) =>
    set((state) => {
      const next = new Set(state.discoveredIds)
      next.add(id)
      return { discoveredIds: next }
    }),

  userFactionId: null,
  setUserFactionId: (id) => set({ userFactionId: id }),

  userId: null,
  setUserId: (id) => set({ userId: id }),

  energy: 5,
  maxEnergy: 5,
  setEnergy: (energy) => set({ energy }),

  userPosition: null,
  setUserPosition: (pos) => set({ userPosition: pos }),

  userAvatarUrl: null,
  setUserAvatarUrl: (url) => set({ userAvatarUrl: url }),

  loading: true,
  setLoading: (loading) => set({ loading }),
}))
