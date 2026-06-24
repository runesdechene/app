import { create } from 'zustand'

export interface GameToast {
  id: string
  type: 'claim' | 'discover' | 'explore' | 'new_place' | 'new_user' | 'like' | 'fortify' | 'contribute' | 'revisit' | 'enigma' | 'influence' | 'info' | 'error' | 'plant_flag' | 'harvest_crown' | 'quest_completed' | 'court' | 'faction_join' | 'faction_leave'
  message: string
  color?: string
  /** Texte(s) à mettre en avant (bold) dans le message */
  highlights?: string[]
  /** URL d'icone faction (remplace l'emoji par défaut) */
  iconUrl?: string
  /** Conquete contestee (lieu pris a un autre joueur) */
  contested?: boolean
  /** ID du joueur (pour clic → ouvrir profil) */
  actorId?: string
  /** URL de l'avatar du joueur */
  actorAvatarUrl?: string
  /** ID de l'ancien controleur (conquete contestee) */
  previousActorId?: string
  /** Couleur faction de l'ancien controleur */
  previousActorColor?: string
  /** ID du lieu (pour clic → fly to + ouvrir panel) */
  placeId?: string
  /** Coordonnées du lieu */
  placeLocation?: { latitude: number; longitude: number }
  /** V070 — fragment associé (énigme de fragment) : nom cliquable → ouvre la modale FragmentEnigma */
  fragmentId?: number
  fragmentName?: string
  fragmentIcon?: string | null
  fragmentIconUrl?: string | null
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
      // V0.6 — Fusion harvest_crown : si on récolte plusieurs coffres en rafale,
      // on incrémente le total dans le toast existant au lieu d'en créer un nouveau.
      // Évite le spam quand le user clique 5 coffres en 30s.
      // Fenêtre de fusion : 5 minutes — au-delà, on démarre un nouveau toast
      // (sinon une récolte 1h après agrège bizarrement avec une vieille session).
      const HARVEST_MERGE_WINDOW_MS = 5 * 60 * 1000
      if (toast.type === 'harvest_crown' && toast.actorId) {
        const existing = state.toasts.find(
          t => t.type === 'harvest_crown' && t.actorId === toast.actorId
        )
        if (existing && Date.now() - existing.timestamp < HARVEST_MERGE_WINDOW_MS) {
          const prevMatch = existing.message.match(/(\d+) Couronne/)
          const prev = prevMatch ? parseInt(prevMatch[1], 10) : 1
          const addMatch = toast.message.match(/(\d+) Couronne/)
          const added = addMatch ? parseInt(addMatch[1], 10) : 1
          const total = prev + added
          return {
            toasts: state.toasts.map(t =>
              t.id === existing.id
                ? { ...t, message: `Vous avez récolté ${total} Couronne${total > 1 ? 's' : ''} 🪙`, timestamp: toast.timestamp }
                : t
            ),
          }
        }
      }

      // Fusion : influence du même acteur sur le même lieu → incrémenter le message
      if (toast.type === 'influence' && toast.actorId && toast.placeId) {
        const existing = state.toasts.find(
          t => t.type === 'influence' && t.actorId === toast.actorId && t.placeId === toast.placeId
        )
        if (existing) {
          // Extraire le total actuel du message ("a placé 3 influence")
          const match = existing.message.match(/a plac[ée]+ (\d+) influence/)
          const prev = match ? parseInt(match[1], 10) : 1
          const ptsMatch = toast.message.match(/a plac[ée]+ (\d+) influence/)
          const added = ptsMatch ? parseInt(ptsMatch[1], 10) : 1
          const total = prev + added
          const place = existing.highlights?.[1] || 'un lieu'
          const name = existing.highlights?.[0] || 'Quelqu\'un'
          return {
            toasts: state.toasts.map(t =>
              t.id === existing.id
                ? { ...t, message: `${name} a placé ${total} influence sur ${place}`, timestamp: toast.timestamp }
                : t
            ),
          }
        }
      }

      // Deduplicate: pour new_user, garder un seul toast par acteur
      const dominated = toast.type === 'new_user' && toast.actorId
        ? state.toasts.filter(t => t.type === 'new_user' && t.actorId === toast.actorId)
        : []
      const base = dominated.length > 0
        ? state.toasts.filter(t => !dominated.some(d => d.id === t.id))
        : state.toasts
      const next = [...base, { ...toast, id }]
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
