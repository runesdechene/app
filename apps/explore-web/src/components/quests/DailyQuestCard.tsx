import type { DailyQuest } from '../../types/dailyQuest'

interface Props {
  quest: DailyQuest
  onClick: () => void
}

/**
 * Card minimaliste 1 ligne, alignée sur ExpeditionCard :
 * [icône 🎯] [pilule "Du jour"] [titre …]   [progress 2/3 ou ✓]
 */
export function DailyQuestCard({ quest, onClick }: Props) {
  const completed = quest.completedAt !== null
  const progress = Math.min(quest.progress, quest.target)
  const progressLabel = completed ? '✓' : `${progress}/${quest.target}`

  return (
    <li
      className={`daily-quest-card${completed ? ' daily-quest-card-completed' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick() }}
    >
      <span className="daily-quest-card-icon" aria-hidden>{quest.icon}</span>
      <span className="daily-quest-card-pill">Du jour</span>
      <span className="daily-quest-card-title">{quest.title}</span>
      <span className="daily-quest-card-progress" aria-label={`Avancement ${progress} sur ${quest.target}`}>
        {progressLabel}
      </span>
    </li>
  )
}
