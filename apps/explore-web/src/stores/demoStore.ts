import { create } from 'zustand'

const DEFAULT_MAX_ENERGY = 9

interface DemoStoreState {
  energy: number
  maxEnergy: number
  crownsBalance: number
  discoveredIds: Set<string>
  glory: number
  addDiscovered: (placeId: string) => void
  addGlory: (amount: number) => void
  reset: () => void
}

export const useDemoStore = create<DemoStoreState>((set, get) => ({
  energy: DEFAULT_MAX_ENERGY,
  maxEnergy: DEFAULT_MAX_ENERGY,
  crownsBalance: Infinity,
  discoveredIds: new Set<string>(),
  glory: 0,

  addDiscovered: (placeId) => {
    const next = new Set(get().discoveredIds)
    next.add(placeId)
    set({ discoveredIds: next })
  },

  addGlory: (amount) => set({ glory: get().glory + amount }),

  reset: () => set({
    energy: DEFAULT_MAX_ENERGY,
    maxEnergy: DEFAULT_MAX_ENERGY,
    crownsBalance: Infinity,
    discoveredIds: new Set<string>(),
    glory: 0,
  }),
}))
