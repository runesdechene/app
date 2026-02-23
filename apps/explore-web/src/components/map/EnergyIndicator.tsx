import { useEffect, useRef, useState } from 'react'
import { useFogStore } from '../../stores/fogStore'
import { supabase } from '../../lib/supabase'

const CYCLE_SECONDS = 14400 // 4 heures

export function EnergyIndicator() {
  const energy = useFogStore(s => s.energy)
  const maxEnergy = useFogStore(s => s.maxEnergy)
  const userId = useFogStore(s => s.userId)
  const setEnergy = useFogStore(s => s.setEnergy)
  const regenRate = useFogStore(s => s.regenRate)
  const claimedCount = useFogStore(s => s.claimedCount)
  const nextPointIn = useFogStore(s => s.nextPointIn)
  const setRegenInfo = useFogStore(s => s.setRegenInfo)
  const setNextPointIn = useFogStore(s => s.setNextPointIn)
  const isAdmin = useFogStore(s => s.isAdmin)
  const [resetting, setResetting] = useState(false)

  const isFull = energy >= maxEnergy

  // Energie fractionnaire en temps reel
  const elapsedInTick = CYCLE_SECONDS - nextPointIn
  const fractionOfTick = CYCLE_SECONDS > 0 ? elapsedInTick / CYCLE_SECONDS : 0
  const fractionalEnergy = isFull
    ? maxEnergy
    : Math.min(energy + fractionOfTick * regenRate, maxEnergy)

  // Taux par heure (cycle = 4h)
  const ratePerHour = regenRate / 4

  // Countdown timer — decremente chaque seconde
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
      const d = data as {
        energy: number
        regenRate: number
        claimedCount: number
        nextPointIn: number
      }
      setEnergy(d.energy)
      setRegenInfo({
        regenRate: d.regenRate ?? 1,
        claimedCount: d.claimedCount ?? 0,
        nextPointIn: d.nextPointIn ?? 0,
      })
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

  // Formater le nombre : 3 → "3", 3.5 → "3.5", 3.72 → "3.7"
  function formatEnergy(n: number): string {
    if (n >= maxEnergy) return String(maxEnergy)
    const rounded = Math.floor(n * 10) / 10
    return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1)
  }

  // Formater le taux : 0.25 → "0.25", 0.5 → "0.5", 1 → "1"
  function formatRate(n: number): string {
    if (n % 1 === 0) return String(n)
    const s = n.toFixed(2)
    return s.replace(/0+$/, '')
  }

  const fillPercent = (fractionalEnergy / maxEnergy) * 100

  return (
    <div className="energy-indicator">
      {/* Ligne principale : compteur + jauge + reset */}
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

      {/* Ligne secondaire : taux + lieux */}
      <div className="energy-sub">
        <span className="energy-rate">+{formatRate(ratePerHour)}/h</span>
        {claimedCount > 0 && (
          <span className="energy-claimed">{claimedCount} lieu{claimedCount > 1 ? 'x' : ''}</span>
        )}
      </div>
    </div>
  )
}
