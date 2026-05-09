import { usePlayerStore } from '../../stores/playerStore'
import { CrownsBadge } from '../map/badges/CrownsBadge'
import { EnergyIndicator } from '../map/badges/EnergyIndicator'
import './StatsBar.css'

export function StatsBar() {
  const level = usePlayerStore((s) => s.level)
  const xpTotal = usePlayerStore((s) => s.xpTotal)

  return (
    <div className="stats-bar">
      <button type="button" className="stats-cell" aria-label="Niveau et gloire">
        <span className="stats-cell-icon" aria-hidden>⭐</span>
        <span className="stats-cell-value">Niv. {level}</span>
        <span className="stats-cell-sub">{xpTotal} G</span>
      </button>

      <div className="stats-cell stats-cell-embed">
        <CrownsBadge />
      </div>

      <div className="stats-cell stats-cell-embed">
        <EnergyIndicator />
      </div>
    </div>
  )
}
