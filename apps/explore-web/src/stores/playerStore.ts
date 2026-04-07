import { create } from 'zustand'

interface PlayerState {
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

  /** Titre de la faction du joueur */
  userFactionTitle: string | null
  setUserFactionTitle: (title: string | null) => void

  /** URL du pattern/icône de la faction du joueur */
  userFactionPattern: string | null
  setUserFactionPattern: (url: string | null) => void

  /** ID interne de l'utilisateur (table users) */
  userId: string | null
  setUserId: (id: string | null) => void

  /** Énergie et régénération */
  energy: number
  maxEnergy: number
  energyCycle: number
  setEnergy: (energy: number) => void
  nextPointIn: number
  setNextPointIn: (seconds: number) => void
  setEnergyCycle: (seconds: number) => void

  /** Points de Conquête + régénération */
  conquestPoints: number
  maxConquest: number
  conquestCycle: number
  conquestNextPointIn: number
  setConquestPoints: (pts: number) => void
  setConquestNextPointIn: (seconds: number) => void
  setConquestCycle: (seconds: number) => void

  /** Points de Construction + régénération */
  constructionPoints: number
  maxConstruction: number
  constructionCycle: number
  constructionNextPointIn: number
  setConstructionPoints: (pts: number) => void
  setConstructionNextPointIn: (seconds: number) => void
  setConstructionCycle: (seconds: number) => void

  /** Vitalité + régénération */
  vitalitePoints: number
  maxVitalite: number
  vitaliteCycle: number
  vitaliteNextPointIn: number
  setVitalitePoints: (pts: number) => void
  setVitaliteNextPointIn: (seconds: number) => void
  setVitaliteCycle: (seconds: number) => void


  /** V0.5 — Points d'exploration (terrain, GPS, ajout lieu, photos) */
  explorationPoints: number
  setExplorationPoints: (pts: number) => void

  /** V0.5 — Points d'érudition (énigmes quotidiennes, énigmes de lieu) */
  eruditionPoints: number
  setEruditionPoints: (pts: number) => void

  /** V0.5 — Stock d'influence dépensable sur les lieux */
  influenceStock: number
  setInfluenceStock: (stock: number) => void

  /** V0.5 — Gloire = explorationPoints + eruditionPoints */
  glory: number

  /** Position GPS du joueur */
  userPosition: { lng: number; lat: number } | null
  setUserPosition: (pos: { lng: number; lat: number } | null) => void

  /** Prénom du joueur (pour le chat, toasts, etc.) */
  userName: string | null
  setUserName: (name: string | null) => void

  /** URL de l'avatar du joueur (Supabase storage) */
  userAvatarUrl: string | null
  setUserAvatarUrl: (url: string | null) => void

  /** Titres du joueur */
  unlockedGeneralTitles: Array<{ id: number; name: string; icon: string; unlocks: string[]; order: number }>
  displayedGeneralTitleIds: number[]
  factionTitle2: { id: number; name: string; icon: string; unlocks: string[] } | null
  /** Titre prioritaire (affiché sur la carte) */
  primaryTitle: string | null
  setPrimaryTitle: (title: string | null) => void


  /** Mode coloration carte : true = billes colorées par faction */
  factionColorMode: boolean
  setFactionColorMode: (on: boolean) => void

  /** Admin */
  isAdmin: boolean
  setIsAdmin: (v: boolean) => void

  /** Chargement initial */
  loading: boolean
  setLoading: (loading: boolean) => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
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

  userFactionTitle: null,
  setUserFactionTitle: (title) => set({ userFactionTitle: title }),

  userFactionPattern: null,
  setUserFactionPattern: (url) => set({ userFactionPattern: url }),

  userId: null,
  setUserId: (id) => set({ userId: id }),

  energy: 3,
  maxEnergy: 3,
  energyCycle: 7200,
  setEnergy: (energy) => set({ energy }),
  nextPointIn: 0,
  setNextPointIn: (seconds) => set({ nextPointIn: seconds }),
  setEnergyCycle: (seconds) => set({ energyCycle: seconds }),

  conquestPoints: 3,
  maxConquest: 3,
  conquestCycle: 14400,
  conquestNextPointIn: 0,
  setConquestPoints: (pts) => set({ conquestPoints: pts }),
  setConquestNextPointIn: (seconds) => set({ conquestNextPointIn: seconds }),
  setConquestCycle: (seconds) => set({ conquestCycle: seconds }),

  constructionPoints: 3,
  maxConstruction: 3,
  constructionCycle: 14400,
  constructionNextPointIn: 0,
  setConstructionPoints: (pts) => set({ constructionPoints: pts }),
  setConstructionNextPointIn: (seconds) => set({ constructionNextPointIn: seconds }),
  setConstructionCycle: (seconds) => set({ constructionCycle: seconds }),

  vitalitePoints: 3,
  maxVitalite: 3,
  vitaliteCycle: 14400,
  vitaliteNextPointIn: 0,
  setVitalitePoints: (pts) => set({ vitalitePoints: pts }),
  setVitaliteNextPointIn: (seconds) => set({ vitaliteNextPointIn: seconds }),
  setVitaliteCycle: (seconds) => set({ vitaliteCycle: seconds }),


  explorationPoints: 0,
  setExplorationPoints: (pts) => set((state) => ({ explorationPoints: pts, glory: pts + state.eruditionPoints })),

  eruditionPoints: 0,
  setEruditionPoints: (pts) => set((state) => ({ eruditionPoints: pts, glory: state.explorationPoints + pts })),

  influenceStock: 0,
  setInfluenceStock: (stock) => set({ influenceStock: stock }),

  glory: 0,

  userPosition: null,
  setUserPosition: (pos) => set({ userPosition: pos }),

  userName: null,
  setUserName: (name) => set({ userName: name }),

  userAvatarUrl: null,
  setUserAvatarUrl: (url) => set({ userAvatarUrl: url }),

  unlockedGeneralTitles: [],
  displayedGeneralTitleIds: [],
  factionTitle2: null,
  primaryTitle: null,
  setPrimaryTitle: (title) => set({ primaryTitle: title }),


  factionColorMode: localStorage.getItem('factionColorMode') === 'true',
  setFactionColorMode: (on) => {
    localStorage.setItem('factionColorMode', String(on))
    set({ factionColorMode: on })
  },

  isAdmin: false,
  setIsAdmin: (v) => set({ isAdmin: v }),

  loading: true,
  setLoading: (loading) => set({ loading }),
}))
