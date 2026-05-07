import { InfoModal } from '../map/modals/InfoModal'
import type { DailyQuest } from '../../types/dailyQuest'

interface Props {
  quest: DailyQuest
  onClose: () => void
}

/**
 * Modale détail d'une quête du jour. Réutilise InfoModal (portal vers
 * document.body + style canonique des badges Gloire/Couronnes/Coupe).
 *
 * extraContent = progress bar visuelle entre la description et les rows.
 */
export function DailyQuestModal({ quest, onClose }: Props) {
  const completed = quest.completedAt !== null
  const progress = Math.min(quest.progress, quest.target)
  const pct = quest.target > 0 ? (progress / quest.target) * 100 : 0
  const rewardSuffix = quest.reward.type === 'crowns' ? ' 🪙' : ''

  const rows = completed
    ? [
        { label: 'Avancement', value: `${quest.target} / ${quest.target}`, highlight: true },
        { label: 'Récompense', value: `+${quest.reward.amount}${rewardSuffix}` },
        ...(quest.completedAt ? [{ label: 'Accomplie', value: formatCompletedAt(quest.completedAt), highlight: true }] : []),
      ]
    : [
        { label: 'Avancement', value: `${progress} / ${quest.target}`, highlight: true },
        { label: 'Récompense', value: `+${quest.reward.amount}${rewardSuffix}` },
      ]

  const progressBar = (
    <div className="daily-quest-progress">
      <div className="daily-quest-progress-bar" aria-hidden>
        <div
          className={`daily-quest-progress-fill${completed ? ' completed' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )

  return (
    <InfoModal
      icon={quest.icon}
      title={quest.title}
      description={quest.description}
      rows={rows}
      onClose={onClose}
      extraContent={progressBar}
    />
  )
}

function formatCompletedAt(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const hh = d.getHours()
  const mm = String(d.getMinutes()).padStart(2, '0')
  if (sameDay) return `Aujourd'hui à ${hh}h${mm}`
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}
