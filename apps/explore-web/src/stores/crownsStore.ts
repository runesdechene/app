import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { safeStorage } from '../lib/safeStorage'
import type { CrownsState, HarvestResult, HarvestablePlace } from '../types/crowns'

interface CrownsStoreState {
  /** Stock courant (cap 500). Initialisé depuis safeStorage pour éviter le flash 0 au boot. */
  balance: number
  /** Plein → coffre absent côté carte. */
  capped: boolean
  /** Map placeId → metadata récolte (gain attendu, eligibleAt) */
  harvestable: Map<string, HarvestablePlace>
  /** Lookup rapide pour le filtrage carte */
  harvestableSet: Set<string>

  /** Recharge balance + harvestable depuis la BD */
  refresh: (userId: string) => Promise<void>
  /** Récolte un coffre (appelle la RPC, met à jour la balance + retire de la liste) */
  harvest: (userId: string, placeId: string) => Promise<HarvestResult>

  /** Reset (déconnexion) */
  reset: () => void
}

export const useCrownsStore = create<CrownsStoreState>((set, get) => ({
  balance: Number(safeStorage.get('crownsBalance')) || 0,
  capped: false,
  harvestable: new Map(),
  harvestableSet: new Set(),

  refresh: async (userId) => {
    if (!userId) return
    const { data, error } = await supabase.rpc('get_my_crowns_state', { p_user_id: userId })
    if (error) {
      console.error('[crowns] get_my_crowns_state error:', error.message, error.details, error.hint)
      return
    }
    const state = data as CrownsState | null
    if (!state) return

    safeStorage.set('crownsBalance', String(state.balance))

    const map = new Map<string, HarvestablePlace>()
    const setIds = new Set<string>()
    for (const h of state.harvestable) {
      map.set(h.placeId, h)
      setIds.add(h.placeId)
    }

    set({
      balance: state.balance,
      capped: state.capped,
      harvestable: map,
      harvestableSet: setIds,
    })
  },

  harvest: async (userId, placeId) => {
    const { data, error } = await supabase.rpc('harvest_crown', {
      p_user_id: userId,
      p_place_id: placeId,
    })
    if (error) {
      console.error('[crowns] harvest_crown error:', error.message, error.details, error.hint)
      return { error: 'unauthorized' }
    }
    const result = data as HarvestResult

    if ('success' in result && result.success) {
      // Met à jour la balance immédiatement + retire le coffre de la liste
      safeStorage.set('crownsBalance', String(result.balance))
      const nextMap = new Map(get().harvestable)
      const nextSet = new Set(get().harvestableSet)
      nextMap.delete(placeId)
      nextSet.delete(placeId)
      set({
        balance: result.balance,
        capped: result.balance >= 500,
        harvestable: nextMap,
        harvestableSet: nextSet,
      })
    }
    return result
  },

  reset: () => {
    safeStorage.set('crownsBalance', '0')
    set({
      balance: 0,
      capped: false,
      harvestable: new Map(),
      harvestableSet: new Set(),
    })
  },
}))
