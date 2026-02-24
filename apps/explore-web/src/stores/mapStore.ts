import { create } from 'zustand'

interface PlaceOverride {
  tagTitle?: string
  tagColor?: string
  score?: number
  claimed?: boolean
  factionId?: string
  factionPattern?: string
}

interface MapState {
  selectedPlaceId: string | null
  setSelectedPlaceId: (id: string | null) => void

  /** ID du joueur dont le profil est ouvert (global) */
  selectedPlayerId: string | null
  setSelectedPlayerId: (id: string | null) => void

  /** Demande de fly-to depuis l'extérieur (toasts, etc.) */
  pendingFlyTo: { lng: number; lat: number; placeId?: string } | null
  requestFlyTo: (target: { lng: number; lat: number; placeId?: string }) => void
  clearPendingFlyTo: () => void

  /** Overrides locaux pour tester les territoires (tag, likes) */
  placeOverrides: Map<string, PlaceOverride>
  setPlaceOverride: (placeId: string, override: PlaceOverride) => void

  /** IDs de lieux supprimes localement (pour retirer les marqueurs sans recharger) */
  deletedPlaceIds: Set<string>
  markPlaceDeleted: (placeId: string) => void
}

export const useMapStore = create<MapState>((set) => ({
  selectedPlaceId: null,
  setSelectedPlaceId: (id) => set({ selectedPlaceId: id }),

  selectedPlayerId: null,
  setSelectedPlayerId: (id) => set({ selectedPlayerId: id }),

  pendingFlyTo: null,
  requestFlyTo: (target) => set({ pendingFlyTo: target }),
  clearPendingFlyTo: () => set({ pendingFlyTo: null }),

  placeOverrides: new Map(),
  setPlaceOverride: (placeId, override) =>
    set((state) => {
      const next = new Map(state.placeOverrides)
      next.set(placeId, { ...next.get(placeId), ...override })
      return { placeOverrides: next }
    }),

  deletedPlaceIds: new Set(),
  markPlaceDeleted: (placeId) =>
    set((state) => {
      const next = new Set(state.deletedPlaceIds)
      next.add(placeId)
      return { deletedPlaceIds: next }
    }),
}))
