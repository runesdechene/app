import { create } from 'zustand'

interface MapState {
  selectedPlaceId: string | null
  setSelectedPlaceId: (id: string | null) => void
}

export const useMapStore = create<MapState>((set) => ({
  selectedPlaceId: null,
  setSelectedPlaceId: (id) => set({ selectedPlaceId: id }),
}))
