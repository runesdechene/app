import { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { InfoModal } from './InfoModal'
import './EnergyIndicator.css'

export function EnergyIndicator() {
  const energy = usePlayerStore(s => s.energy)
  const maxEnergy = usePlayerStore(s => s.maxEnergy)
  const cycleSeconds = usePlayerStore(s => s.energyCycle)
  const nextPointIn = usePlayerStore(s => s.nextPointIn)
  const bonusEnergy = usePlayerStore(s => s.bonusEnergy)
  const influenceStock = usePlayerStore(s => s.influenceStock)

  const isFull = energy >= maxEnergy

  // Energie fractionnaire en temps reel
  const elapsedInTick = cycleSeconds - nextPointIn
  const fractionOfTick = cycleSeconds > 0 ? elapsedInTick / cycleSeconds : 0
  const fractionalEnergy = isFull
    ? maxEnergy
    : Math.min(energy + fractionOfTick, maxEnergy)

  function formatEnergy(n: number): string {
    if (n >= maxEnergy) return maxEnergy.toFixed(1)
    const rounded = Math.floor(n * 10) / 10
    return rounded.toFixed(1)
  }

  const fillPercent = (fractionalEnergy / maxEnergy) * 100
  const regenBonus = cycleSeconds < 7200 ? 'bonus' : cycleSeconds > 7200 ? 'malus' : ''
  const ratePerHour = 3600 / cycleSeconds
  const [showInfo, setShowInfo] = useState(false)

  const baseMax = maxEnergy - bonusEnergy
  const baseCycle = 7200
  const baseRate = 3600 / baseCycle
  const hasRegenBonus = cycleSeconds !== baseCycle

  return (
    <>
      <div className={`energy-indicator${regenBonus ? ` regen-${regenBonus}` : ''}`} onClick={() => setShowInfo(true)} style={{ cursor: 'pointer' }}>
        <div className="energy-main">
          <span className="energy-icon">{'\u26A1'}</span>
          <span className="energy-count">
            {formatEnergy(fractionalEnergy)}/<span className={bonusEnergy > 0 ? 'max-bonus' : bonusEnergy < 0 ? 'max-malus' : ''}>{maxEnergy}</span>
          </span>
          <div className="energy-bar">
            <div className="energy-bar-fill" style={{ width: `${fillPercent}%` }} />
          </div>
        </div>

        <div className="energy-sub">
          <span className="energy-rate">+{ratePerHour.toFixed(2)}/h</span>
          {influenceStock > 0 && (
            <span className="energy-rate" style={{ marginLeft: 6, color: '#8a6b30' }}>
              {'\uD83C\uDFF4'} {influenceStock}
            </span>
          )}
        </div>
      </div>

      {showInfo && (
        <InfoModal
          icon={'\u26A1'}
          title="Energie"
          description="L'energie permet de decouvrir et proteger des lieux. Le cout varie selon le type de lieu. Elle se regenere automatiquement."
          rows={[
            { label: 'Points actuels', value: `${formatEnergy(fractionalEnergy)} / ${maxEnergy}` },
            { label: 'Regeneration', value: `+${ratePerHour.toFixed(2)} / heure` },
            ...(hasRegenBonus ? [
              { label: 'Regen de base', value: `+${baseRate.toFixed(2)} / heure` },
              { label: 'Bonus regen faction', value: `+${(ratePerHour - baseRate).toFixed(2)} / heure`, highlight: true },
            ] : []),
            ...(bonusEnergy !== 0 ? [
              { label: 'Capacite de base', value: String(baseMax) },
              { label: 'Bonus capacite faction', value: `${bonusEnergy > 0 ? '+' : ''}${bonusEnergy}`, highlight: true },
            ] : []),
          ]}
          onClose={() => setShowInfo(false)}
        />
      )}
    </>
  )
}
