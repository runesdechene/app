import { useState } from 'react'
import { usePlayerStore } from '../../../stores/playerStore'
import { useFractionalEnergy, formatEnergy } from '../../../hooks/useFractionalEnergy'
import { EnergyInfoModal } from '../modals/EnergyInfoModal'
import './EnergyIndicator.css'

// L'InfoModal est extraite dans EnergyInfoModal pour partage avec StatsBar
// (home + carte mobile) — source unique du wording.

export function EnergyIndicator() {
  const cycleSeconds = usePlayerStore(s => s.energyCycle)
  const { energy: fractionalEnergy, maxEnergy, ratePerHour } = useFractionalEnergy()

  const fillPercent = (fractionalEnergy / maxEnergy) * 100
  const regenBonus = cycleSeconds < 7200 ? 'bonus' : cycleSeconds > 7200 ? 'malus' : ''
  const [showInfo, setShowInfo] = useState(false)

  return (
    <>
      <div className={`energy-indicator${regenBonus ? ` regen-${regenBonus}` : ''}`} onClick={() => setShowInfo(true)} style={{ cursor: 'pointer' }}>
        <div className="energy-main">
          <span className="energy-icon">{'⚡'}</span>
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

      {showInfo && <EnergyInfoModal onClose={() => setShowInfo(false)} />}
    </>
  )
}
