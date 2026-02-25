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

  /** Mode ajout de lieu */
  addPlaceMode: boolean
  setAddPlaceMode: (active: boolean) => void

  /** Coordonnées du centre de la carte (pour le viseur d'ajout) */
  pendingNewPlaceCoords: { lng: number; lat: number } | null
  setPendingNewPlaceCoords: (coords: { lng: number; lat: number } | null) => void

  /** Compteur de rafraîchissement des lieux (incrémenté après création/suppression) */
  placesRefreshKey: number
  incrementPlacesRefreshKey: () => void

  /** Mode de style de la carte : jeu (épuré), détaillé (parchemin+routes), satellite */
  mapStyleMode: 'game' | 'detailed' | 'satellite'
  setMapStyleMode: (mode: 'game' | 'detailed' | 'satellite') => void
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

  addPlaceMode: false,
  setAddPlaceMode: (active) => set({ addPlaceMode: active }),

  pendingNewPlaceCoords: null,
  setPendingNewPlaceCoords: (coords) => set({ pendingNewPlaceCoords: coords }),

  placesRefreshKey: 0,
  incrementPlacesRefreshKey: () => set((state) => ({ placesRefreshKey: state.placesRefreshKey + 1 })),

  mapStyleMode: 'game',
  setMapStyleMode: (mode) => set({ mapStyleMode: mode }),
}))
