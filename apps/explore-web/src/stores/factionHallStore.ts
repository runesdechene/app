import { create } from 'zustand'

/**
 * Hall de Compagnie global : ouvert depuis n'importe où (profil, scoreboard,
 * explorateur…), rendu UNE seule fois au niveau carte. Évite d'empiler le Hall
 * dans une autre modale et les guerres de z-index.
 *
 * `onBack` : si fourni (ex. ouvert depuis l'explorateur), le Hall affiche un
 * bouton « ← Retour » qui exécute ce callback (typiquement : rouvrir l'explorateur).
 */
interface FactionHallState {
  openId: string | null
  onBack: (() => void) | null
  open: (factionId: string, onBack?: () => void) => void
  close: () => void
}

export const useFactionHallStore = create<FactionHallState>((set) => ({
  openId: null,
  onBack: null,
  open: (factionId, onBack) => set({ openId: factionId, onBack: onBack ?? null }),
  close: () => set({ openId: null, onBack: null }),
}))
