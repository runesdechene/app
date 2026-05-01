import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import type { CoupeState } from '../types/coupe'

/**
 * V0.7 phase 3 — Lecture de l'état Coupe des Héritages.
 *
 * Pas de polling : refresh manuel (à l'ouverture du modal) + au mount initial.
 * La RPC `get_coupe_state` calcule à la volée depuis les sources, donc on a
 * toujours des données fraîches au moment où on lit.
 */
export function useCoupe(autoLoad = false) {
  const userId = usePlayerStore(s => s.userId)
  const [state, setState] = useState<CoupeState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) {
      setState(null)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('get_coupe_state', {
      p_user_id: userId,
      p_season_id: null,
    })
    setLoading(false)
    if (rpcError) {
      console.error('[coupe] get_coupe_state error:', rpcError.message, rpcError.details, rpcError.hint)
      setError(rpcError.message)
      return
    }
    const parsed = data as CoupeState | { error: string } | null
    if (parsed && 'error' in parsed) {
      setError(parsed.error)
      return
    }
    setState(parsed as CoupeState)
  }, [userId])

  useEffect(() => {
    if (autoLoad && userId) refresh()
  }, [autoLoad, userId, refresh])

  return { state, loading, error, refresh }
}
