import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import { safeStorage } from '../lib/safeStorage'
import type { GloryState, GloryResult } from '../types/glory'

// V0.7 phase 3.5 — Lecture de la Gloire (lifetime + compteurs bruts).
// Calcul à la volée via RPC get_my_glory : pas de polling, refresh manuel.
// Cache localStorage de la balance pour éviter le flash 0 au boot du badge top.

const STORAGE_KEY_GLORY = 'glory_cached'

/** Lit la balance Gloire cachée — utilisable comme valeur initiale par
 *  les composants top-level (NotorietyBadge) pour éviter le flash 0 au boot. */
export function readCachedGlory(): number {
  return Number(safeStorage.get(STORAGE_KEY_GLORY)) || 0
}

export function useGlory(autoLoad = false) {
  const userId = usePlayerStore(s => s.userId)
  const [state, setState] = useState<GloryState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!userId) {
      setState(null)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('get_my_glory', {
      p_user_id: userId,
    })
    setLoading(false)
    if (rpcError) {
      console.error('[glory] get_my_glory error:', rpcError.message, rpcError.details, rpcError.hint)
      setError(rpcError.message)
      return
    }
    const parsed = data as GloryResult | null
    if (parsed && 'error' in parsed) {
      setError(parsed.error)
      return
    }
    const next = parsed as GloryState
    safeStorage.set(STORAGE_KEY_GLORY, String(next.glory))
    setState(next)
  }, [userId])

  useEffect(() => {
    if (autoLoad && userId) refresh()
  }, [autoLoad, userId, refresh])

  return { state, loading, error, refresh }
}
