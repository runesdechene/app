import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Defi, DefisBoard, DefiRewardPopup } from '../types/defi'

interface DefisStoreState {
  board: DefisBoard
  pendingRewards: DefiRewardPopup[]

  /** Recharge le tableau depuis la BD (RPC get_defis_board).
   *  Auto-claim les défis complétés non encore réclamés et empile
   *  les récompenses dans pendingRewards. */
  refresh: (userId: string) => Promise<void>
  /** Retire la première récompense de la file (après affichage). */
  shiftReward: () => void
  /** Reset (déconnexion). */
  reset: () => void
}

const EMPTY_BOARD: DefisBoard = {
  daily: null,
  weeklyIndividual: null,
  weeklyCollective: null,
}

export const useDefisStore = create<DefisStoreState>((set) => ({
  board: EMPTY_BOARD,
  pendingRewards: [],

  refresh: async (userId) => {
    if (!userId) return
    const { data, error } = await supabase.rpc('get_defis_board', { p_user_id: userId })
    if (error) {
      console.error('[defis]', error.message)
      return
    }
    const raw = (data ?? {}) as Partial<DefisBoard>
    const next: DefisBoard = {
      daily: raw.daily ?? null,
      weeklyIndividual: raw.weeklyIndividual ?? null,
      weeklyCollective: raw.weeklyCollective ?? null,
    }

    // auto-claim éligibles
    const popups: DefiRewardPopup[] = []
    for (const d of [next.daily, next.weeklyIndividual, next.weeklyCollective] as Array<Defi | null>) {
      if (!d || d.claimed) continue
      // Collectif : une fois l'objectif atteint (completedAt), le défi est fermé —
      // seul un contributeur d'AVANT cet instant est encore récompensé. Les retardataires
      // sont aussi bloqués côté serveur ('too_late'), mais on évite l'appel inutile.
      const onTime =
        d.scope !== 'collective' ||
        !d.completedAt ||
        (!!d.myFirstContribAt && d.myFirstContribAt <= d.completedAt)
      const eligible =
        d.scope === 'collective'
          ? d.progress >= d.target && d.myContribution >= 1 && onTime
          : d.progress >= d.target
      if (!eligible) continue
      const { data: r } = await supabase.rpc('claim_defi', { p_defi_id: d.id })
      const res = r as {
        ok?: boolean
        alreadyClaimed?: boolean
        icon?: string
        title?: string
        reward?: { crowns: number }
      } | null
      if (res?.ok && res.alreadyClaimed === false && res.reward) {
        popups.push({
          icon: res.icon ?? d.icon,
          title: res.title ?? d.title,
          crowns: res.reward.crowns,
        })
        d.claimed = true
      }
    }

    set((s) => ({
      board: next,
      pendingRewards: popups.length ? [...s.pendingRewards, ...popups] : s.pendingRewards,
    }))
  },

  shiftReward: () => set((s) => ({ pendingRewards: s.pendingRewards.slice(1) })),

  reset: () => set({ board: EMPTY_BOARD, pendingRewards: [] }),
}))
