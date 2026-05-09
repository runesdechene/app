import { useState } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useFractionalEnergy, formatEnergy } from '../../../hooks/useFractionalEnergy'
import { InfoModal } from '../modals/InfoModal'
import './EnergyIndicator.css'

export function EnergyIndicator() {
  const cycleSeconds = usePlayerStore(s => s.energyCycle)
  const { energy: fractionalEnergy, maxEnergy, ratePerHour } = useFractionalEnergy()

  const fillPercent = (fractionalEnergy / maxEnergy) * 100
  const regenBonus = cycleSeconds < 7200 ? 'bonus' : cycleSeconds > 7200 ? 'malus' : ''
  const [showInfo, setShowInfo] = useState(false)

  const baseCycle = 7200
  const baseRate = 3600 / baseCycle
  const hasRegenBonus = cycleSeconds !== baseCycle

  return (
    <>
      <div className={`energy-indicator${regenBonus ? ` regen-${regenBonus}` : ''}`} onClick={() => setShowInfo(true)} style={{ cursor: 'pointer' }}>
        <div className="energy-main">
          <span className="energy-icon">{'\u26A1'}</span>
          <span className="energy-count">
            {formatEnergy(fractionalEnergy, maxEnergy)}/{maxEnergy}
          </span>
          <div className="energy-bar">
            <div className="energy-bar-fill" style={{ width: `${fillPercent}%` }} />
          </div>
        </div>

        <div className="energy-sub">
          <span className="energy-rate">+{ratePerHour.toFixed(2)}/h</span>
        </div>
      </div>

      {showInfo && (
        <InfoModal
          icon={'\u26A1'}
          title="Energie"
          description="L'energie permet de decouvrir et proteger des lieux. Le cout varie selon le type de lieu. Elle se regenere automatiquement."
          rows={[
            { label: 'Points actuels', value: `${formatEnergy(fractionalEnergy, maxEnergy)} / ${maxEnergy}` },
            { label: 'Regeneration', value: `+${ratePerHour.toFixed(2)} / heure` },
            ...(hasRegenBonus ? [
              { label: 'Regen de base', value: `+${baseRate.toFixed(2)} / heure` },
              { label: 'Bonus regen faction', value: `+${(ratePerHour - baseRate).toFixed(2)} / heure`, highlight: true },
            ] : []),
          ]}
          onClose={() => setShowInfo(false)}
        />
      )}
    </>
  )
}
