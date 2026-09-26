import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'

const DEFAULT_MAX_ENERGY = 9

/**
 * Mémoire de la journée sur la borne. Clé versionnée : si la forme change, on
 * incrémente plutôt que de risquer de relire un état d'une autre version.
 */
const STORAGE_KEY = 'rdc-borne-jour-v1'

/**
 * Hors navigateur (tests, SSR), il n'y a pas de localStorage : on retombe sur
 * une mémoire de processus. La borne, elle, écrit bien dans le navigateur.
 * NB : un navigateur kiosque configuré pour effacer ses données à la fermeture
 * repartira de zéro chaque nuit — c'est acceptable, mais ce n'est pas nous qui
 * le décidons.
 */
const processMemory = new Map<string, string>()
const fallbackStorage: StateStorage = {
  getItem: (name) => processMemory.get(name) ?? null,
  setItem: (name, value) => { processMemory.set(name, value) },
  removeItem: (name) => { processMemory.delete(name) },
}

interface DemoStoreState {
  energy: number
  maxEnergy: number
  crownsBalance: number
  /** Lieux sortis du brouillard sur CETTE borne depuis la dernière remise à zéro. */
  discoveredIds: string[]
  glory: number
  addDiscovered: (placeId: string) => void
  addGlory: (amount: number) => void
  /** Visiteur suivant : session à zéro, mémoire de la journée intacte. */
  reset: () => void
  /** Geste caché : efface aussi les lieux accumulés dans la journée. */
  resetJournee: () => void
}

/** Session d'un visiteur — tout ce qui ne survit PAS au passage au suivant. */
const FRESH_SESSION = {
  energy: DEFAULT_MAX_ENERGY,
  maxEnergy: DEFAULT_MAX_ENERGY,
  crownsBalance: Infinity,
  glory: 0,
}

export const useDemoStore = create<DemoStoreState>()(
  persist(
    (set, get) => ({
      ...FRESH_SESSION,
      discoveredIds: [],

      addDiscovered: (placeId) => {
        const current = get().discoveredIds
        // Idempotent : un lieu rouvert ne doit pas gonfler le compteur du jour.
        if (current.includes(placeId)) return
        set({ discoveredIds: [...current, placeId] })
      },

      addGlory: (amount) => set({ glory: get().glory + amount }),

      reset: () => set({ ...FRESH_SESSION }),

      resetJournee: () => set({ ...FRESH_SESSION, discoveredIds: [] }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() =>
        typeof localStorage !== 'undefined' ? localStorage : fallbackStorage,
      ),
      // Seuls les lieux traversent la journée. L'énergie, les Couronnes et la
      // Gloire appartiennent au visiteur en cours et repartent à zéro.
      partialize: (state) => ({ discoveredIds: state.discoveredIds }),
    },
  ),
)
