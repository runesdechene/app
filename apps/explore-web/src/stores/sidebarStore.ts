import { create } from 'zustand'

export type SidebarTab = 'home' | 'activite' | 'compagnie' | 'maj'

/**
 * État partagé de la sidebar desktop (onglet actif), pour qu'un autre
 * composant (ex. rejoindre une Compagnie depuis la modale) puisse amener
 * la sidebar sur l'onglet « Compagnie » et afficher le hall.
 */
interface SidebarState {
  tab: SidebarTab
  setTab: (tab: SidebarTab) => void
}

export const useSidebarStore = create<SidebarState>((set) => ({
  tab: 'home',
  setTab: (tab) => set({ tab }),
}))
