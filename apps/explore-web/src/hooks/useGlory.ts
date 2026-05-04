import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayerStore } from '../stores/playerStore'
import type { GloryState, GloryResult } from '../types/glory'

// V0.7 phase 3.5 — Lecture de la Gloire (lifetime + compteurs bruts).
// Calcul à la volée via RPC get_my_glory : pas de polling, refresh manuel.

export function useGlory(autoLoad = false, pollMs = 0) {
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
    setState(parsed as GloryState)
  }, [userId])

  useEffect(() => {
    if (autoLoad && userId) refresh()
  }, [autoLoad, userId, refresh])

  useEffect(() => {
    if (!pollMs || pollMs <= 0 || !userId) return
    const id = window.setInterval(() => { refresh() }, pollMs)
    return () => window.clearInterval(id)
  }, [pollMs, userId, refresh])

  return { state, loading, error, refresh }
}
