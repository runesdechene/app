import { useEffect, useRef } from 'react'
import { usePlayerStore } from '../stores/playerStore'
import { supabase } from '../lib/supabase'

/**
 * Shared interval ticking the energy countdown (V0.5 unified gauge).
 * Call once at app level.
 */
export function useResourceTimers() {
  const userId = usePlayerStore(s => s.userId)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!userId) return

    timerRef.current = setInterval(() => {
      const s = usePlayerStore.getState()

      // Energy countdown
      if (s.energy < s.maxEnergy && s.nextPointIn > 0) {
        if (s.nextPointIn <= 1) refetchResources(userId)
        else s.setNextPointIn(s.nextPointIn - 1)
      }
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [userId])
}

async function refetchResources(userId: string) {
  try {
    const { data, error } = await supabase.rpc('get_user_energy', { p_user_id: userId })
    if (error) {
      console.warn('[useResourceTimers] get_user_energy failed', error)
      return
    }
    if (!data) return
    const d = data as Record<string, number>
    usePlayerStore.setState({
      energy: d.energy ?? 0,
      nextPointIn: d.nextPointIn ?? 0,
      energyCycle: d.energyCycle ?? 7200,
    })
  } catch (err) {
    console.warn('[useResourceTimers] get_user_energy threw', err)
  }
}
