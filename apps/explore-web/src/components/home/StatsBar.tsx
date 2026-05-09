import { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useCrownsStore } from '../../stores/crownsStore'
import { useCoupe } from '../../hooks/useCoupe'
import { useFractionalEnergy, formatEnergy } from '../../hooks/useFractionalEnergy'
import { InfoModal } from '../map/modals/InfoModal'
import { LeaderboardModal } from '../map/modals/LeaderboardModal'
import './StatsBar.css'

type StatId = 'coupe' | 'crowns' | 'energy' | null

/**
 * Barre de stats inline — partagée entre /accueil et /carte mobile.
 * 4 cellules cliquables : Niveau · Coupe · Couronnes · Énergie.
 * Chaque clic ouvre une InfoModal explicative.
 */
export function StatsBar() {
  const level = usePlayerStore((s) => s.level)
  const { energy, maxEnergy, ratePerHour } = useFractionalEnergy()
  const crownsBalance = useCrownsStore((s) => s.balance)
  const { state: coupeState } = useCoupe(true)
  const coupeScore = coupeState?.myBreakdown?.score ?? null

  const [openInfo, setOpenInfo] = useState<StatId>(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  return (
    <>
      <div className="stats-bar">
        <button type="button" className="stats-cell" onClick={() => setShowLeaderboard(true)}>
          <span className="stats-cell-icon" aria-hidden>🎖️</span>
          <span className="stats-cell-value">Niv. {level}</span>
        </button>

        <button type="button" className="stats-cell" onClick={() => setOpenInfo('coupe')}>
          <span className="stats-cell-icon" aria-hidden>🏆</span>
          <span className="stats-cell-value">
            {coupeScore !== null ? coupeScore : '—'}
          </span>
        </button>

        <button type="button" className="stats-cell" onClick={() => setOpenInfo('crowns')}>
          <span className="stats-cell-icon" aria-hidden>🪙</span>
          <span className="stats-cell-value">{crownsBalance}</span>
        </button>

        <button type="button" className="stats-cell" onClick={() => setOpenInfo('energy')}>
          <span className="stats-cell-icon" aria-hidden>⚡</span>
          <span className="stats-cell-value">
            {formatEnergy(energy, maxEnergy)}/{maxEnergy}
          </span>
        </button>
      </div>

      {showLeaderboard && (
        <LeaderboardModal onClose={() => setShowLeaderboard(false)} />
      )}

      {openInfo === 'coupe' && (
        <InfoModal
          icon="🏆"
          title="Coupe des Héritages"
          description="La Coupe est le score de la saison en cours, partagé avec ta Maison. Énigmes, plantages, contributions, mécénats — tout y rapporte."
          rows={[
            { label: 'Ton score saison', value: coupeScore !== null ? `${coupeScore}` : '—' },
          ]}
          onClose={() => setOpenInfo(null)}
        />
      )}

      {openInfo === 'crowns' && (
        <InfoModal
          icon="🪙"
          title="Couronnes de Chêne"
          description="Les Couronnes sont la monnaie d'influence. Tu en gagnes en résolvant des énigmes ou en découvrant des lieux à distance, et tu les investis dans des lieux pour devenir Mécène."
          rows={[
            { label: 'Solde', value: `${crownsBalance}` },
          ]}
          onClose={() => setOpenInfo(null)}
        />
      )}

      {openInfo === 'energy' && (
        <InfoModal
          icon="⚡"
          title="Énergie"
          description="L'énergie permet de découvrir et protéger des lieux. Elle se régénère automatiquement avec le temps."
          rows={[
            { label: 'Points actuels', value: `${formatEnergy(energy, maxEnergy)} / ${maxEnergy}` },
            { label: 'Régénération', value: `+${ratePerHour.toFixed(2)} / heure` },
          ]}
          onClose={() => setOpenInfo(null)}
        />
      )}
    </>
  )
}
