import { usePlayerStore } from '../../stores/playerStore'
import { useCrownsStore } from '../../stores/crownsStore'
import { useCoupe } from '../../hooks/useCoupe'
import './StatsBar.css'

/**
 * Barre de stats épurée — partagée entre /accueil et /carte mobile.
 * 3 cellules : Niveau | Coupe (score saison) | Couronnes (balance)
 * Design plat, fond parchemin, icône + valeur. Pas de sub-text.
 */
export function StatsBar() {
  const level = usePlayerStore((s) => s.level)
  const crownsBalance = useCrownsStore((s) => s.balance)
  const { state: coupeState } = useCoupe(true)
  const coupeScore = coupeState?.myBreakdown?.score ?? null

  return (
    <div className="stats-bar">
      <div className="stats-cell">
        <span className="stats-cell-icon" aria-hidden>👑</span>
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
    </div>
  )
}
