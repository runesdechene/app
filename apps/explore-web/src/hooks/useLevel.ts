// apps/explore-web/src/hooks/useLevel.ts

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'

/**
 * Lit l'état niveau du joueur via get_player_profile (qui inclut level, xpTotal,
 * xpToNextLevel, xpForNextLevel, veteranFirstEra).
 * Synchronise avec playerStore. Permet refresh manuel après une action.
 */
export function useLevel(autoLoad = true) {
  const userId = usePlayerStore(s => s.userId)
  const setLevelState = usePlayerStore(s => s.setLevelState)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoading(true); setError(null)
    const { data, error: rpcError } = await supabase.rpc('get_player_profile', { p_user_id: userId })
    setLoading(false)
    if (rpcError) {
      console.error('[useLevel] get_player_profile error:', rpcError.message)
      setError(rpcError.message)
      return
    }
    const profile = data as Record<string, unknown> | null
    if (!profile) return
    setLevelState({
      level: Number(profile.level ?? 1),
      xpTotal: Number(profile.xpTotal ?? 0),
      xpToNextLevel: Number(profile.xpToNextLevel ?? 5),
      xpForNextLevel: Number(profile.xpForNextLevel ?? 5),
      veteranFirstEra: Boolean(profile.veteranFirstEra ?? false),
    })
  }, [userId, setLevelState])

  useEffect(() => {
    if (autoLoad && userId) refresh()
  }, [autoLoad, userId, refresh])

  return { refresh, loading, error }
}
