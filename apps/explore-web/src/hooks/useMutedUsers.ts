import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'

/**
 * V0.7+ Mute soft (anti-harcèlement). Le muté n'a aucun feedback (pas d'humiliation publique).
 * Effet client : emoji-throws du muted ignorés, réactions du muted sur ma note non affichées.
 */
export function useMutedUsers() {
  const userId = usePlayerStore(s => s.userId)
  const [mutedIds, setMutedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!userId) {
      setMutedIds(new Set())
      return
    }
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase.rpc('get_muted_user_ids')
      if (cancelled) return
      if (error || !data) {
        setMutedIds(new Set())
      } else {
        const ids = (data as Array<{ user_id: string }>).map(r => r.user_id)
        setMutedIds(new Set(ids))
      }
    })()
    return () => { cancelled = true }
  }, [userId])

  const muteUser = useCallback(async (targetId: string) => {
    setMutedIds(prev => new Set(prev).add(targetId))
    const { error } = await supabase.rpc('mute_user', { p_target_user_id: targetId })
    if (error) {
      setMutedIds(prev => {
        const n = new Set(prev)
        n.delete(targetId)
        return n
      })
      throw error
    }
  }, [])

  const unmuteUser = useCallback(async (targetId: string) => {
    setMutedIds(prev => {
      const n = new Set(prev)
      n.delete(targetId)
      return n
    })
    const { error } = await supabase.rpc('unmute_user', { p_target_user_id: targetId })
    if (error) {
      setMutedIds(prev => new Set(prev).add(targetId))
      throw error
    }
  }, [])

  const isMuted = useCallback((id: string) => mutedIds.has(id), [mutedIds])

  return { mutedIds, muteUser, unmuteUser, isMuted }
}
