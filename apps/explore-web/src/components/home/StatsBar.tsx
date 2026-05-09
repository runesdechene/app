import { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useCrownsStore } from '../../stores/crownsStore'
import { useCoupe } from '../../hooks/useCoupe'
import { useGlory } from '../../hooks/useGlory'
import { useFractionalEnergy, formatEnergy } from '../../hooks/useFractionalEnergy'
import { InfoModal } from '../map/modals/InfoModal'
import { LeaderboardModal } from '../map/modals/LeaderboardModal'
import './StatsBar.css'

type StatId = 'level' | 'coupe' | 'crowns' | 'energy' | null

/**
 * Barre de stats inline — partagée entre /accueil et /carte mobile.
 * 4 cellules cliquables : Niveau · Coupe · Couronnes · Énergie.
 * Chaque clic ouvre une InfoModal explicative.
 */
export function StatsBar() {
  const level = usePlayerStore((s) => s.level)
  const xpTotal = usePlayerStore((s) => s.xpTotal)
  const xpToNextLevel = usePlayerStore((s) => s.xpToNextLevel)
  const { energy, maxEnergy, ratePerHour } = useFractionalEnergy()
  const crownsBalance = useCrownsStore((s) => s.balance)
  const { state: coupeState } = useCoupe(true)
  const coupeScore = coupeState?.myBreakdown?.score ?? null
  const { state: glory } = useGlory(true, 30000)

  const [openInfo, setOpenInfo] = useState<StatId>(null)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const isLevelCap = level >= 50
  const levelDescription = isLevelCap
    ? `Tu as atteint le sommet — ${xpTotal} Gloire cumulée. Tu es Légende.`
    : `Ton parcours de Veilleur — ${xpTotal} Gloire récoltée au fil de tes pas. Encore ${xpToNextLevel} avant le niveau ${level + 1}.`

  return (
    <>
      <div className="stats-bar">
        <button type="button" className="stats-cell" onClick={() => setOpenInfo('level')}>
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

      {showLeaderboard && (
        <LeaderboardModal onClose={() => setShowLeaderboard(false)} />
      )}

      {openInfo === 'level' && (
        <InfoModal
          icon="🎖️"
          title={`Niveau ${level}`}
          description={levelDescription}
          rows={
            glory ? [
              { label: '🥾 Lieux foulés (GPS)',    value: `${glory.lieuxExplores}` },
              { label: '📜 Lieux cartographiés',   value: `${glory.lieuxAjoutes}` },
              { label: '🏴 Plantages de bannière', value: `${glory.plantages}` },
              { label: '✍️ Récits écrits',          value: `${glory.carnets}` },
              { label: '📷 Photos ajoutées',       value: `${glory.photos}` },
              (() => {
                const easyTotal = glory.enigmes.easy + glory.enigmes.veryEasy
                const parts = [
                  glory.enigmes.hard   ? `${glory.enigmes.hard} difficile${glory.enigmes.hard > 1 ? 's' : ''}`     : null,
                  glory.enigmes.medium ? `${glory.enigmes.medium} moyenne${glory.enigmes.medium > 1 ? 's' : ''}`   : null,
                  easyTotal            ? `${easyTotal} facile${easyTotal > 1 ? 's' : ''} ou très facile${easyTotal > 1 ? 's' : ''}` : null,
                ].filter(Boolean).join(', ')
                return {
                  label: glory.enigmes.total > 0
                    ? `🦉 Énigmes résolues (${parts})`
                    : '🦉 Énigmes résolues',
                  value: `${glory.enigmes.total}`,
                }
              })(),
            ] : []
          }
          onClose={() => setOpenInfo(null)}
          action={{
            label: 'Voir le classement',
            onClick: () => { setOpenInfo(null); setShowLeaderboard(true) },
          }}
        />
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
