import { create } from 'zustand'

interface FogState {
  /** IDs des lieux découverts par l'utilisateur (lookup O(1)) */
  discoveredIds: Set<string>
  setDiscoveredIds: (ids: string[]) => void
  addDiscoveredId: (id: string) => void

  /** Faction du joueur (pour auto-découverte) */
  userFactionId: string | null
  setUserFactionId: (id: string | null) => void

  /** Couleur de la faction du joueur */
  userFactionColor: string | null
  setUserFactionColor: (color: string | null) => void

  /** URL du pattern/icône de la faction du joueur */
  userFactionPattern: string | null
  setUserFactionPattern: (url: string | null) => void

  /** ID interne de l'utilisateur (table users) */
  userId: string | null
  setUserId: (id: string | null) => void

  /** Énergie et régénération */
  energy: number
  maxEnergy: number
  setEnergy: (energy: number) => void
  nextPointIn: number
  setNextPointIn: (seconds: number) => void

  /** Points de Conquête + régénération */
  conquestPoints: number
  maxConquest: number
  conquestNextPointIn: number
  setConquestPoints: (pts: number) => void
  setConquestNextPointIn: (seconds: number) => void

  /** Points de Construction + régénération */
  constructionPoints: number
  maxConstruction: number
  constructionNextPointIn: number
  setConstructionPoints: (pts: number) => void
  setConstructionNextPointIn: (seconds: number) => void

  /** Notoriété personnelle */
  notorietyPoints: number
  setNotorietyPoints: (pts: number) => void

  /** Position GPS du joueur */
  userPosition: { lng: number; lat: number } | null
  setUserPosition: (pos: { lng: number; lat: number } | null) => void

  /** Prénom du joueur (pour le chat, toasts, etc.) */
  userName: string | null
  setUserName: (name: string | null) => void

  /** URL de l'avatar du joueur (Supabase storage) */
  userAvatarUrl: string | null
  setUserAvatarUrl: (url: string | null) => void

  /** Admin */
  isAdmin: boolean
  setIsAdmin: (v: boolean) => void

  /** Chargement initial */
  loading: boolean
  setLoading: (loading: boolean) => void
}

export const useFogStore = create<FogState>((set) => ({
  discoveredIds: new Set(),
  setDiscoveredIds: (ids) => set({ discoveredIds: new Set(ids) }),
  addDiscoveredId: (id) =>
    set((state) => {
      const next = new Set(state.discoveredIds)
      next.add(id)
      return { discoveredIds: next }
    }),

  userFactionId: null,
  setUserFactionId: (id) => set({ userFactionId: id }),

  userFactionColor: null,
  setUserFactionColor: (color) => set({ userFactionColor: color }),

  userFactionPattern: null,
  setUserFactionPattern: (url) => set({ userFactionPattern: url }),

  userId: null,
  setUserId: (id) => set({ userId: id }),

  energy: 5,
  maxEnergy: 5,
  setEnergy: (energy) => set({ energy }),
  nextPointIn: 0,
  setNextPointIn: (seconds) => set({ nextPointIn: seconds }),

  conquestPoints: 5,
  maxConquest: 5,
  conquestNextPointIn: 0,
  setConquestPoints: (pts) => set({ conquestPoints: pts }),
  setConquestNextPointIn: (seconds) => set({ conquestNextPointIn: seconds }),

  constructionPoints: 5,
  maxConstruction: 5,
  constructionNextPointIn: 0,
  setConstructionPoints: (pts) => set({ constructionPoints: pts }),
  setConstructionNextPointIn: (seconds) => set({ constructionNextPointIn: seconds }),

  notorietyPoints: 0,
  setNotorietyPoints: (pts) => set({ notorietyPoints: pts }),

  userPosition: null,
  setUserPosition: (pos) => set({ userPosition: pos }),

  userName: null,
  setUserName: (name) => set({ userName: name }),

  userAvatarUrl: null,
  setUserAvatarUrl: (url) => set({ userAvatarUrl: url }),

  isAdmin: false,
  setIsAdmin: (v) => set({ isAdmin: v }),

  loading: true,
  setLoading: (loading) => set({ loading }),
}))
