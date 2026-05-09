import { usePlayerStore } from '../../stores/playerStore'
import { useCrownsStore } from '../../stores/crownsStore'
import { useCoupe } from '../../hooks/useCoupe'
import './StatsBar.css'

/**
 * Barre de stats inline — partagée entre /accueil et /carte mobile.
 * 4 cellules : Niveau · Coupe · Couronnes · Énergie.
 * Format : icône + valeur sur la même ligne (pas en colonne).
 */
export function StatsBar() {
  const level = usePlayerStore((s) => s.level)
  const energy = usePlayerStore((s) => s.energy)
  const maxEnergy = usePlayerStore((s) => s.maxEnergy)
  const crownsBalance = useCrownsStore((s) => s.balance)
  const { state: coupeState } = useCoupe(true)
  const coupeScore = coupeState?.myBreakdown?.score ?? null

  return (
    <div className="stats-bar">
      <div className="stats-cell">
        <span className="stats-cell-icon" aria-hidden>🎖️</span>
        <span className="stats-cell-value">Niv. {level}</span>
      </div>

      <div className="stats-cell">
        <span className="stats-cell-icon" aria-hidden>🏆</span>
        <span className="stats-cell-value">
          {coupeScore !== null ? coupeScore : '—'}
        </span>
      </div>

      <div className="stats-cell">
        <span className="stats-cell-icon" aria-hidden>🪙</span>
        <span className="stats-cell-value">{crownsBalance}</span>
      </div>

      <div className="stats-cell">
        <span className="stats-cell-icon" aria-hidden>⚡</span>
        <span className="stats-cell-value">
          {energy.toFixed(1)}/{maxEnergy}
        </span>
      </div>
    </div>
  )
}
