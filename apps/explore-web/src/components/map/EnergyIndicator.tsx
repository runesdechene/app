import { useEffect, useRef } from 'react'
import { useFogStore } from '../../stores/fogStore'
import { supabase } from '../../lib/supabase'

export function EnergyIndicator() {
  const energy = useFogStore(s => s.energy)
  const maxEnergy = useFogStore(s => s.maxEnergy)
  const cycleSeconds = useFogStore(s => s.energyCycle)
  const userId = useFogStore(s => s.userId)
  const setEnergy = useFogStore(s => s.setEnergy)
  const nextPointIn = useFogStore(s => s.nextPointIn)
  const setNextPointIn = useFogStore(s => s.setNextPointIn)
  const bonusEnergy = useFogStore(s => s.bonusEnergy)

  const isFull = energy >= maxEnergy

  // Energie fractionnaire en temps reel (taux fixe 1)
  const elapsedInTick = cycleSeconds - nextPointIn
  const fractionOfTick = cycleSeconds > 0 ? elapsedInTick / cycleSeconds : 0
  const fractionalEnergy = isFull
    ? maxEnergy
    : Math.min(energy + fractionOfTick, maxEnergy)

  // Countdown timer
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)

    if (isFull || nextPointIn <= 0) return

    timerRef.current = setInterval(() => {
      const current = useFogStore.getState().nextPointIn
      if (current <= 1) {
        if (timerRef.current) clearInterval(timerRef.current)
        refetchEnergy()
      } else {
        setNextPointIn(current - 1)
      }
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isFull, nextPointIn > 0])

  async function refetchEnergy() {
    if (!userId) return
    const { data } = await supabase.rpc('get_user_energy', { p_user_id: userId })
    if (data) {
      const d = data as Record<string, number>
      setEnergy(d.energy ?? 0)
      setNextPointIn(d.nextPointIn ?? 0)
      useFogStore.getState().setEnergyCycle(d.energyCycle ?? 7200)
      useFogStore.getState().setConquestPoints(d.conquestPoints ?? 0)
      useFogStore.getState().setConquestNextPointIn(d.conquestNextPointIn ?? 0)
      useFogStore.getState().setConquestCycle(d.conquestCycle ?? 14400)
      useFogStore.getState().setConstructionPoints(d.constructionPoints ?? 0)
      useFogStore.getState().setConstructionNextPointIn(d.constructionNextPointIn ?? 0)
      useFogStore.getState().setConstructionCycle(d.constructionCycle ?? 14400)
      useFogStore.getState().setBonusEnergy(d.bonusEnergy ?? 0)
      useFogStore.getState().setBonusConquest(d.bonusConquest ?? 0)
      useFogStore.getState().setBonusConstruction(d.bonusConstruction ?? 0)
    }
  }

  function formatEnergy(n: number): string {
    if (n >= maxEnergy) return String(maxEnergy)
    const rounded = Math.floor(n * 10) / 10
    return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1)
  }

  const fillPercent = (fractionalEnergy / maxEnergy) * 100
  const regenBonus = cycleSeconds < 7200 ? 'bonus' : cycleSeconds > 7200 ? 'malus' : ''

  return (
    <div className={`energy-indicator${regenBonus ? ` regen-${regenBonus}` : ''}`}>
      <div className="energy-main">
        <span className="energy-icon">&#9889;</span>
        <span className="energy-count">
          {formatEnergy(fractionalEnergy)}/<span className={bonusEnergy > 0 ? 'max-bonus' : bonusEnergy < 0 ? 'max-malus' : ''}>{maxEnergy}</span>
        </span>
        <div className="energy-bar">
          <div className="energy-bar-fill" style={{ width: `${fillPercent}%` }} />
        </div>
      </div>

      <div className="energy-sub">
        <span className="energy-rate">+{(3600 / cycleSeconds).toFixed(2)}/h</span>
      </div>

    </div>
  )
}
