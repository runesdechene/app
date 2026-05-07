/**
 * Quête du jour — élément du tableau "Du jour" dans QuestsBoardPanel.
 *
 * Contrat backend : RPC `get_today_quests_state(p_user_id)` retourne un array
 * de DailyQuest. Aujourd'hui une seule quête (daily_discovery_remote), mais le
 * type est ouvert pour accueillir énigme du jour, lieu à visiter, etc. sans
 * changer le contrat front.
 */
export type QuestRewardType = 'crowns' | string

export interface QuestReward {
  type: QuestRewardType
  amount: number
}

export interface DailyQuest {
  id: string
  type: string
  title: string
  description: string
  icon: string
  progress: number
  target: number
  reward: QuestReward
  /** ISO timestamp si accomplie aujourd'hui, null sinon. */
  completedAt: string | null
}
