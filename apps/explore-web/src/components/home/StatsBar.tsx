import { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useCrownsStore } from '../../stores/crownsStore'
import { useCoupe } from '../../hooks/useCoupe'
import { useFractionalEnergy, formatEnergy } from '../../hooks/useFractionalEnergy'
import { NotorietyInfoModal } from '../map/modals/NotorietyInfoModal'
import { CrownsInfoModal } from '../map/modals/CrownsInfoModal'
import { EnergyInfoModal } from '../map/modals/EnergyInfoModal'
import { LeaderboardModal } from '../map/modals/LeaderboardModal'
import { CoupeModal } from '../map/modals/CoupeModal'
import { CoupeRulesModal } from '../map/modals/CoupeRulesModal'
import './StatsBar.css'

type StatId = 'level' | 'crowns' | 'energy' | null

/**
 * Barre de stats inline — partagée entre /accueil et /carte mobile.
 * 4 cellules cliquables : Niveau · Coupe · Couronnes · Énergie.
 *
 * Les 4 InfoModals sont des composants partagés (NotorietyInfoModal,
 * CoupeRulesModal, CrownsInfoModal, EnergyInfoModal) pour avoir une
 * SOURCE UNIQUE du wording entre les badges desktop (carte) et la
 * StatsBar mobile (home + carte mobile).
 */
export function StatsBar() {
  const level = usePlayerStore((s) => s.level)
  const { energy, maxEnergy, ratePerHour } = useFractionalEnergy()
  const crownsBalance = useCrownsStore((s) => s.balance)
  const { state: coupeState } = useCoupe(true)
  const coupeScore = coupeState?.myBreakdown?.score ?? null

  const [openInfo, setOpenInfo] = useState<StatId>(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showCoupeRules, setShowCoupeRules] = useState(false)
  const [showCoupeScores, setShowCoupeScores] = useState(false)

  return (
    <>
      <div className="stats-bar">
        <button type="button" className="stats-cell" onClick={() => setOpenInfo('level')}>
          <span className="stats-cell-icon" aria-hidden>🎖️</span>
          <span className="stats-cell-value">Niv. {level}</span>
        </button>

        <button type="button" className="stats-cell" onClick={() => setShowCoupeRules(true)}>
          <span className="stats-cell-icon" aria-hidden>🏆</span>
          <span className="stats-cell-value">
            {coupeScore !== null ? coupeScore : '—'}
          </span>
        </button>

        <button type="button" className="stats-cell" onClick={() => setOpenInfo('crowns')}>
          <span className="stats-cell-icon" aria-hidden>🪙</span>
          <span className="stats-cell-value">{crownsBalance}</span>
        </button>

        <button type="button" className="stats-cell stats-cell--energy" onClick={() => setOpenInfo('energy')}>
          <span className="stats-cell-icon" aria-hidden>⚡</span>
          <span className="stats-cell-stack">
            <span className="stats-cell-value">
              {formatEnergy(energy, maxEnergy)}/{maxEnergy}
            </span>
            <span className="stats-cell-rate">+{ratePerHour.toFixed(1)}/h</span>
          </span>
        </button>
      </div>

      {openInfo === 'level' && (
        <NotorietyInfoModal
          onClose={() => setOpenInfo(null)}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
        />
      )}

      {showCoupeRules && (
        <CoupeRulesModal
          onClose={() => setShowCoupeRules(false)}
          onOpenScores={() => { setShowCoupeRules(false); setShowCoupeScores(true) }}
        />
      )}

      {openInfo === 'crowns' && (
        <CrownsInfoModal onClose={() => setOpenInfo(null)} />
      )}

      {openInfo === 'energy' && (
        <EnergyInfoModal onClose={() => setOpenInfo(null)} />
      )}

      {showLeaderboard && (
        <LeaderboardModal onClose={() => setShowLeaderboard(false)} />
      )}

      {showCoupeScores && (
        <CoupeModal onClose={() => setShowCoupeScores(false)} />
      )}
    </>
  )
}
