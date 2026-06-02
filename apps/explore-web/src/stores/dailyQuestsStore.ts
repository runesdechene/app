import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { DailyQuest, QuestRewardPopup } from '../types/dailyQuest'

interface DailyQuestsStoreState {
  quests: DailyQuest[]
  loading: boolean
  pendingRewards: QuestRewardPopup[]

  /** Recharge la liste depuis la BD (RPC get_today_quests_state).
   *  Auto-claim les quêtes complétées non encore réclamées et empile
   *  les récompenses dans pendingRewards. */
  refresh: (userId: string) => Promise<void>
  /** Retire la première récompense de la file (après affichage). */
  shiftReward: () => void
  /** Reset (déconnexion). */
  reset: () => void
}

export const useDailyQuestsStore = create<DailyQuestsStoreState>((set) => ({
  quests: [],
  loading: false,
  pendingRewards: [],

  refresh: async (userId) => {
    if (!userId) return
    set({ loading: true })
    const { data, error } = await supabase.rpc('get_today_quests_state', { p_user_id: userId })
    if (error) {
      console.error('[quests] get_today_quests_state error:', error.message, error.details, error.hint)
      set({ loading: false })
      return
    }
    let quests = (data as DailyQuest[]) ?? []
    const toClaim = quests.filter((q) => q.progress >= q.target && !q.claimed)
    if (toClaim.length > 0) {
      const popups: QuestRewardPopup[] = []
      for (const q of toClaim) {
        const { data: r } = await supabase.rpc('claim_daily_quest', { p_template_id: q.id })
        const res = r as {
          ok?: boolean
          alreadyClaimed?: boolean
          icon?: string
          title?: string
          reward?: { xp: number; crowns: number }
        } | null
        if (res?.ok && res.alreadyClaimed === false && res.reward) {
          popups.push({
            icon: res.icon ?? q.icon,
            title: res.title ?? q.title,
            xp: res.reward.xp,
            crowns: res.reward.crowns,
          })
        }
      }
      quests = quests.map((q) => (toClaim.some((c) => c.id === q.id) ? { ...q, claimed: true } : q))
      if (popups.length > 0) set((s) => ({ pendingRewards: [...s.pendingRewards, ...popups] }))
    }
    set({ quests, loading: false })
  },

  shiftReward: () => set((s) => ({ pendingRewards: s.pendingRewards.slice(1) })),

  reset: () => set({ quests: [], loading: false, pendingRewards: [] }),
}))
