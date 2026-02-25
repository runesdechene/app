import { create } from 'zustand'

export interface GameToast {
  id: string
  type: 'claim' | 'discover' | 'explore' | 'new_place' | 'new_user' | 'like' | 'fortify'
  message: string
  color?: string
  /** Texte(s) à mettre en avant (bold) dans le message */
  highlights?: string[]
  /** @deprecated — utiliser highlights[] */
  highlight?: string
  /** URL d'icone faction (remplace l'emoji par défaut) */
  iconUrl?: string
  /** ID du joueur (pour clic → ouvrir profil) */
  actorId?: string
  /** ID du lieu (pour clic → fly to + ouvrir panel) */
  placeId?: string
  /** Coordonnées du lieu */
  placeLocation?: { latitude: number; longitude: number }
  timestamp: number
}

interface ToastState {
  toasts: GameToast[]
  addToast: (toast: Omit<GameToast, 'id'>) => void
  removeToast: (id: string) => void
  clearAll: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    set((state) => {
      const next = [...state.toasts, { ...toast, id }]
      next.sort((a, b) => a.timestamp - b.timestamp)
      return { toasts: next }
    })
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearAll: () => set({ toasts: [] }),
}))
