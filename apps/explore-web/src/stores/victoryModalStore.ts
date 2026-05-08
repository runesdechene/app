import { create } from 'zustand'

/**
 * V0.7.6 (8/05) — Store pour la VictoryModal qui s'affiche quand l'utilisateur
 * a pris un lieu par mécénat. Trigger depuis useCourtNotifications, consommé
 * dans MapPage.
 */
export interface VictoryPayload {
  placeTitle: string
  fromVacant: boolean
  factionColor: string | null
}

interface VictoryModalStoreState {
  pending: VictoryPayload | null
  show: (payload: VictoryPayload) => void
  dismiss: () => void
}

export const useVictoryModalStore = create<VictoryModalStoreState>((set) => ({
  pending: null,
  show: (payload) => set({ pending: payload }),
  dismiss: () => set({ pending: null }),
}))
