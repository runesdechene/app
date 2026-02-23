import { useEffect, useRef, useState } from 'react'
import { useFogStore } from '../../stores/fogStore'
import { supabase } from '../../lib/supabase'

const CYCLE_SECONDS = 7200 // 2h → +0.5/h (12 pts/jour)

export function EnergyIndicator() {
  const energy = useFogStore(s => s.energy)
  const maxEnergy = useFogStore(s => s.maxEnergy)
  const userId = useFogStore(s => s.userId)
  const setEnergy = useFogStore(s => s.setEnergy)
  const nextPointIn = useFogStore(s => s.nextPointIn)
  const setNextPointIn = useFogStore(s => s.setNextPointIn)
  const isAdmin = useFogStore(s => s.isAdmin)
  const [resetting, setResetting] = useState(false)

  const isFull = energy >= maxEnergy

  // Energie fractionnaire en temps reel (taux fixe 1)
  const elapsedInTick = CYCLE_SECONDS - nextPointIn
  const fractionOfTick = CYCLE_SECONDS > 0 ? elapsedInTick / CYCLE_SECONDS : 0
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
      useFogStore.getState().setConquestPoints(d.conquestPoints ?? 0)
      useFogStore.getState().setConquestNextPointIn(d.conquestNextPointIn ?? 0)
      useFogStore.getState().setConstructionPoints(d.constructionPoints ?? 0)
      useFogStore.getState().setConstructionNextPointIn(d.constructionNextPointIn ?? 0)
    }
  }

  async function handleReset() {
    if (!userId || resetting || isFull) return
    setResetting(true)

    const { data } = await supabase.rpc('reset_user_energy', { p_user_id: userId })

    if (data?.energy !== undefined) {
      setEnergy(data.energy)
    } else {
      setEnergy(maxEnergy)
    }
    setResetting(false)
  }

  function formatEnergy(n: number): string {
    if (n >= maxEnergy) return String(maxEnergy)
    const rounded = Math.floor(n * 10) / 10
    return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1)
  }

  const fillPercent = (fractionalEnergy / maxEnergy) * 100

  return (
    <div className="energy-indicator">
      <div className="energy-main">
        <span className="energy-icon">&#9889;</span>
        <span className="energy-count">{formatEnergy(fractionalEnergy)}/{maxEnergy}</span>
        <div className="energy-bar">
          <div className="energy-bar-fill" style={{ width: `${fillPercent}%` }} />
        </div>
        {!isFull && isAdmin && (
          <button
            className="energy-reset-btn"
            onClick={handleReset}
            disabled={resetting}
            title="Recharger l'énergie (admin)"
          >
            {resetting ? '...' : '⚡'}
          </button>
        )}
      </div>

      <div className="energy-sub">
        <span className="energy-rate">+0.5/h</span>
      </div>

    </div>
  )
}
