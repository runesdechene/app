import { create } from 'zustand'

export type MobilePanel = 'notifications' | 'chat' | 'profile' | null

interface MobileNavState {
  activePanel: MobilePanel
  /** Timestamp de la dernière ouverture du panneau notifications */
  notificationsSeenAt: number
  /** Timestamp de la dernière ouverture du panneau chat */
  chatSeenAt: number
  togglePanel: (panel: Exclude<MobilePanel, null>) => void
  closePanel: () => void
}

export const useMobileNavStore = create<MobileNavState>((set) => ({
  activePanel: null,
  notificationsSeenAt: Date.now(),
  chatSeenAt: Date.now(),
  togglePanel: (panel) =>
    set((s) => {
      const opening = s.activePanel !== panel
      return {
        activePanel: opening ? panel : null,
        notificationsSeenAt: opening && panel === 'notifications' ? Date.now() : s.notificationsSeenAt,
        chatSeenAt: opening && panel === 'chat' ? Date.now() : s.chatSeenAt,
      }
    }),
  closePanel: () => set({ activePanel: null }),
}))
