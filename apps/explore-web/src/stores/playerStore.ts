import { create } from 'zustand'
import { safeStorage } from '../lib/safeStorage'

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

  /** V0.7 — Niveau du joueur */
  level: number
  xpTotal: number
  xpToNextLevel: number
  xpForNextLevel: number
  veteranFirstEra: boolean
  levelInitialized: boolean
  setLevelState: (s: { level: number; xpTotal: number; xpToNextLevel: number; xpForNextLevel: number; veteranFirstEra: boolean }) => void

  /** Position GPS du joueur */
  userPosition: { lng: number; lat: number } | null
  setUserPosition: (pos: { lng: number; lat: number } | null) => void

  /** V0.7+ Brouillage GPS — toggle privacy (défaut true). Pour les autres uniquement, soi voit toujours sa vraie position. */
  brouillerPistes: boolean
  setBrouillerPistes: (v: boolean) => void

  /** V0.7+ Brouillage GPS — position publique floutée (50 km autour de userPosition), calculée 1x par session puis stable. */
  publicPosition: { lng: number; lat: number } | null
  setPublicPosition: (pos: { lng: number; lat: number } | null) => void

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
  /** Titres affichés sur la carte (max 3, ordonnés) */
  displayedTitles: string[]
  setDisplayedTitles: (titles: string[]) => void


  /** Mode coloration carte : true = billes colorées par faction */
  factionColorMode: boolean
  setFactionColorMode: (on: boolean) => void

  /** Admin */
  isAdmin: boolean
  setIsAdmin: (v: boolean) => void

  /** Tutorial complété */
  tutorialCompletedAt: string | null
  setTutorialCompletedAt: (v: string | null) => void

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

  // Cachés en safeStorage — même raison qu'influenceStock : éviter le flash "0 Gloire" au démarrage
  // le temps que get_my_informations charge. La valeur est resync depuis la BD à l'init.
  explorationPoints: Number(safeStorage.get('explorationPoints')) || 0,
  setExplorationPoints: (pts) => set((state) => {
    safeStorage.set('explorationPoints', String(pts))
    return { explorationPoints: pts, glory: pts + state.eruditionPoints }
  }),

  eruditionPoints: Number(safeStorage.get('eruditionPoints')) || 0,
  setEruditionPoints: (pts) => set((state) => {
    safeStorage.set('eruditionPoints', String(pts))
    return { eruditionPoints: pts, glory: state.explorationPoints + pts }
  }),

  // Persisté en safeStorage pour éviter le flash "0" au démarrage le temps que get_my_informations charge.
  // La valeur est resync avec la BD dès que le profil arrive — le cache n'autorité pas, il évite juste le flash.
  influenceStock: Number(safeStorage.get('influenceStock')) || 0,
  setInfluenceStock: (stock) => {
    safeStorage.set('influenceStock', String(stock))
    set({ influenceStock: stock })
  },

  // Dérivé d'explorationPoints + eruditionPoints, mais initialisé depuis le cache pour le rendu instantané du badge
  glory: (Number(safeStorage.get('explorationPoints')) || 0) + (Number(safeStorage.get('eruditionPoints')) || 0),

  // V0.7 — Niveau (synchronisé via useLevel / get_player_profile)
  level: 1,
  xpTotal: 0,
  xpToNextLevel: 5,
  xpForNextLevel: 5,
  veteranFirstEra: false,
  levelInitialized: false,
  setLevelState: (s) => set({
    level: s.level,
    xpTotal: s.xpTotal,
    xpToNextLevel: s.xpToNextLevel,
    xpForNextLevel: s.xpForNextLevel,
    veteranFirstEra: s.veteranFirstEra,
    levelInitialized: true,
  }),

  userPosition: null,
  setUserPosition: (pos) => set({ userPosition: pos }),

  brouillerPistes: true,
  setBrouillerPistes: (v) => set({ brouillerPistes: v }),

  publicPosition: null,
  setPublicPosition: (pos) => set({ publicPosition: pos }),

  userName: null,
  setUserName: (name) => set({ userName: name }),

  userAvatarUrl: null,
  setUserAvatarUrl: (url) => set({ userAvatarUrl: url }),

  unlockedGeneralTitles: [],
  displayedGeneralTitleIds: [],
  factionTitle2: null,
  displayedTitles: [],
  setDisplayedTitles: (titles) => set({ displayedTitles: titles }),


  factionColorMode: safeStorage.get('factionColorMode') === 'true',
  setFactionColorMode: (on) => {
    safeStorage.set('factionColorMode', String(on))
    set({ factionColorMode: on })
  },

  isAdmin: false,
  setIsAdmin: (v) => set({ isAdmin: v }),

  tutorialCompletedAt: null,
  setTutorialCompletedAt: (v) => set({ tutorialCompletedAt: v }),

  loading: true,
  setLoading: (loading) => set({ loading }),
}))
