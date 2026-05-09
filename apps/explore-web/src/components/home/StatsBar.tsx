import { useState } from 'react'
import { usePlayerStore } from '../../stores/playerStore'
import { useCrownsStore } from '../../stores/crownsStore'
import { useCoupe } from '../../hooks/useCoupe'
import { useGlory } from '../../hooks/useGlory'
import { useFractionalEnergy, formatEnergy } from '../../hooks/useFractionalEnergy'
import { InfoModal } from '../map/modals/InfoModal'
import { LeaderboardModal } from '../map/modals/LeaderboardModal'
import { CoupeModal } from '../map/modals/CoupeModal'
import './StatsBar.css'

type StatId = 'level' | 'crowns' | 'energy' | null

// Wording exact repris de CrownsBadge.tsx — cohérence app
const CROWNS_DESCRIPTION = "La monnaie du royaume. Tu en gagnes en récoltant les coffres qui poussent chaque jour sur tes lieux veillés, en sortant de nouveaux lieux du brouillard, et en résolvant des énigmes. Tu peux ensuite les investir en mécénat sur un lieu pour soutenir son veilleur ou y poser ta marque à distance — plus un lieu reçoit de Couronnes, plus il rayonne sur la carte."

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
  const [showCoupe, setShowCoupe] = useState(false)

  // Bonus regen faction (cf. EnergyIndicator) — pour rows InfoModal énergie
  const energyCycle = usePlayerStore((s) => s.energyCycle)
  const baseCycle = 7200
  const baseRate = 3600 / baseCycle
  const hasRegenBonus = energyCycle !== baseCycle

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

        <button type="button" className="stats-cell" onClick={() => setShowCoupe(true)}>
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

      {showCoupe && (
        <CoupeModal onClose={() => setShowCoupe(false)} />
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

      {/* Couronnes : reprise EXACTE de CrownsBadge — wording + rows complets. */}
      {openInfo === 'crowns' && (
        <InfoModal
          icon="🪙"
          title="Couronnes de Chêne"
          description={CROWNS_DESCRIPTION}
          rows={[
            { label: 'Stock actuel', value: `${crownsBalance} / 500`, highlight: true },
            { label: 'Coffre aléatoire — lieu veillé seul', value: '+1 🪙' },
            { label: 'Coffre aléatoire — lieu veillé à plusieurs', value: '+2 🪙' },
            { label: 'Sortir un lieu du brouillard', value: '+1 🪙' },
            { label: '3 lieux découverts à distance / jour', value: '+1 🪙 bonus' },
            { label: 'Énigme résolue', value: '+1 à +3 🪙 selon la difficulté' },
          ]}
          onClose={() => setOpenInfo(null)}
        />
      )}

      {/* Énergie : reprise EXACTE de EnergyIndicator — wording + rows + bonus regen faction. */}
      {openInfo === 'energy' && (
        <InfoModal
          icon="⚡"
          title="Energie"
          description="L'energie permet de decouvrir et proteger des lieux. Le cout varie selon le type de lieu. Elle se regenere automatiquement."
          rows={[
            { label: 'Points actuels', value: `${formatEnergy(energy, maxEnergy)} / ${maxEnergy}` },
            { label: 'Regeneration', value: `+${ratePerHour.toFixed(2)} / heure` },
            ...(hasRegenBonus ? [
              { label: 'Regen de base', value: `+${baseRate.toFixed(2)} / heure` },
              { label: 'Bonus regen faction', value: `+${(ratePerHour - baseRate).toFixed(2)} / heure`, highlight: true },
            ] : []),
          ]}
          onClose={() => setOpenInfo(null)}
        />
      )}
    </>
  )
}
