import { create } from 'zustand'

/**
 * Hall de Compagnie global : ouvert depuis n'importe où (profil, scoreboard…),
 * rendu UNE seule fois au niveau carte. Évite d'empiler le Hall dans une autre
 * modale (le profil) et les guerres de z-index.
 */
interface FactionHallState {
  openId: string | null
  open: (factionId: string) => void
  close: () => void
}

export const useFactionHallStore = create<FactionHallState>((set) => ({
  openId: null,
  open: (factionId) => set({ openId: factionId }),
  close: () => set({ openId: null }),
}))
