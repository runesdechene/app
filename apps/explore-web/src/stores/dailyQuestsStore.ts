import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { DailyQuest } from '../types/dailyQuest'

interface DailyQuestsStoreState {
  quests: DailyQuest[]
  loading: boolean

  /** Recharge la liste depuis la BD (RPC get_today_quests_state). */
  refresh: (userId: string) => Promise<void>
  /** Reset (déconnexion). */
  reset: () => void
}

export const useDailyQuestsStore = create<DailyQuestsStoreState>((set) => ({
  quests: [],
  loading: false,

  refresh: async (userId) => {
    if (!userId) return
    set({ loading: true })
    const { data, error } = await supabase.rpc('get_today_quests_state', { p_user_id: userId })
    if (error) {
      console.error('[quests] get_today_quests_state error:', error.message, error.details, error.hint)
      set({ loading: false })
      return
    }
    set({ quests: (data as DailyQuest[]) ?? [], loading: false })
  },

  reset: () => set({ quests: [], loading: false }),
}))
