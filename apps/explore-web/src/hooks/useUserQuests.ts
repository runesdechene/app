import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import { useToastStore } from '../stores/toastStore'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface UserQuest {
  templateId: string
  wording: string
  icon: string
  threshold: number
  rewardXp: number
  rewardCouronnes: number
  count: number
  completed: boolean
  displayOrder: number
}

interface QuestRow {
  template_id: string
  wording: string
  icon: string
  threshold: number
  reward_xp: number
  reward_couronnes: number
  count: number
  completed: boolean
  display_order: number
}

/**
 * V0.7+ Mini-quêtes journalières.
 * Fetch initial via get_user_quests_today + subscribe postgres_changes sur
 * user_quest_progress (UPDATE de completed_at) pour catch les complétions
 * et déclencher le toast.
 */
export function useUserQuests() {
  const userId = usePlayerStore(s => s.userId)
  const addToast = useToastStore(s => s.addToast)
  const [quests, setQuests] = useState<UserQuest[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<RealtimeChannel | null>(null)
  // Conserve la dernière liste connue côté hook pour résoudre wording lors des
  // events realtime sans dépendre du state React (évite de re-subscribe à chaque update).
  const questsRef = useRef<UserQuest[]>([])

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_user_quests_today')
    if (error || !data) {
      setLoading(false)
      return
    }
    const mapped: UserQuest[] = (data as QuestRow[]).map(r => ({
      templateId: r.template_id,
      wording: r.wording,
      icon: r.icon,
      threshold: r.threshold,
      rewardXp: r.reward_xp,
      rewardCouronnes: r.reward_couronnes,
      count: r.count,
      completed: r.completed,
      displayOrder: r.display_order,
    }))
    questsRef.current = mapped
    setQuests(mapped)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!userId) {
      setQuests([])
      setLoading(false)
      return
    }
    void refetch()
  }, [userId, refetch])

  // Subscribe postgres_changes : catch les complétions
  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel(`quest-progress:${userId}`)
    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_quest_progress',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newRow = payload.new as { quest_template_id: string; completed_at: string | null }
          const oldRow = payload.old as { completed_at: string | null }
          // Transition NULL → not-NULL = nouvelle complétion
          if (newRow.completed_at && !oldRow.completed_at) {
            const quest = questsRef.current.find(q => q.templateId === newRow.quest_template_id)
            const wording = quest?.wording ?? 'Quête accomplie'
            const icon = quest?.icon ?? '🎯'
            const xp = quest?.rewardXp ?? 0
            addToast({
              type: 'quest_completed',
              message: `${icon} Quête accomplie : ${wording}${xp > 0 ? ` · +${xp} XP` : ''}`,
              highlights: quest ? [quest.wording] : [],
              timestamp: Date.now(),
            })
            void refetch()
          }
        },
      )
      .subscribe()
    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [userId, addToast, refetch])

  return { quests, loading, refetch }
}
