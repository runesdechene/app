import { useEffect, useRef } from 'react'
import { usePlayerStore } from '../stores/playerStore'
import { supabase } from '../lib/supabase'

/**
 * Single shared interval that ticks all 3 resource countdowns (energy, conquest, construction).
 * Replaces the 3 independent setIntervals that were in EnergyIndicator + ResourceIndicator×2.
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
      let needsRefetch = false

      // Energy countdown
      if (s.energy < s.maxEnergy && s.nextPointIn > 0) {
        if (s.nextPointIn <= 1) needsRefetch = true
        else s.setNextPointIn(s.nextPointIn - 1)
      }

      // Conquest countdown
      if (s.conquestPoints < s.maxConquest && s.conquestNextPointIn > 0) {
        if (s.conquestNextPointIn <= 1) needsRefetch = true
        else s.setConquestNextPointIn(s.conquestNextPointIn - 1)
      }

      // Construction countdown
      if (s.constructionPoints < s.maxConstruction && s.constructionNextPointIn > 0) {
        if (s.constructionNextPointIn <= 1) needsRefetch = true
        else s.setConstructionNextPointIn(s.constructionNextPointIn - 1)
      }

      if (needsRefetch) refetchResources(userId)
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [userId])
}

async function refetchResources(userId: string) {
  const { data } = await supabase.rpc('get_user_energy', { p_user_id: userId })
  if (!data) return
  const d = data as Record<string, number>
  usePlayerStore.setState({
    energy: d.energy ?? 0,
    nextPointIn: d.nextPointIn ?? 0,
    energyCycle: d.energyCycle ?? 7200,
    conquestPoints: d.conquestPoints ?? 0,
    conquestNextPointIn: d.conquestNextPointIn ?? 0,
    conquestCycle: d.conquestCycle ?? 14400,
    constructionPoints: d.constructionPoints ?? 0,
    constructionNextPointIn: d.constructionNextPointIn ?? 0,
    constructionCycle: d.constructionCycle ?? 14400,
    bonusEnergy: d.bonusEnergy ?? 0,
    bonusConquest: d.bonusConquest ?? 0,
    bonusConstruction: d.bonusConstruction ?? 0,
  })
}
