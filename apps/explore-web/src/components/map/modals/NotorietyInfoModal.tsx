import { usePlayerStore } from '../../../stores/playerStore'
import { useGlory } from '../../../hooks/useGlory'
import { InfoModal } from './InfoModal'

interface Props {
  onClose: () => void
  /** Si défini, ajoute un bouton 'Voir le classement' au pied de l'InfoModal
   *  qui ferme cette modale et appelle ce callback (ouverture LeaderboardModal). */
  onOpenLeaderboard?: () => void
}

/**
 * InfoModal Niveau / parcours du Veilleur — source unique partagée entre
 * NotorietyBadge (carte desktop) et StatsBar (home + carte mobile). Wording
 * et rows extraits depuis NotorietyBadge.
 */
export function NotorietyInfoModal({ onClose, onOpenLeaderboard }: Props) {
  const level = usePlayerStore(s => s.level)
  const xpTotal = usePlayerStore(s => s.xpTotal)
  const xpToNextLevel = usePlayerStore(s => s.xpToNextLevel)
  const { state: glory } = useGlory(true, 30000)

  const isCap = level >= 50
  const description = isCap
    ? `Tu as atteint le sommet — ${xpTotal} Gloire cumulée. Tu es Légende.`
    : `Ton parcours de Veilleur — ${xpTotal} Gloire récoltée au fil de tes pas. Encore ${xpToNextLevel} avant le niveau ${level + 1}.`

  return (
    <InfoModal
      icon={'🎖️'}
      title={`Niveau ${level}`}
      description={description}
      rows={
        glory ? [
          { label: '🥾 Lieux foulés (GPS)',           value: `${glory.lieuxExplores}` },
          { label: '📜 Lieux cartographiés',          value: `${glory.lieuxAjoutes}` },
          { label: '🏴 Plantages de bannière',        value: `${glory.plantages}` },
          { label: '📷 Photos ajoutées',              value: `${glory.photos}` },
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
      onClose={onClose}
      action={onOpenLeaderboard ? {
        label: 'Voir le classement',
        onClick: () => { onClose(); onOpenLeaderboard() },
      } : undefined}
    />
  )
}
