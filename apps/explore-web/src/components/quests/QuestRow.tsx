import type { UserQuest } from '../../hooks/useUserQuests'
import './QuestRow.css'

interface QuestRowProps {
  quest: UserQuest
}

export function QuestRow({ quest }: QuestRowProps) {
  const progressPct = Math.min(100, (quest.count / quest.threshold) * 100)
  const className = quest.completed ? 'quest-row quest-row--completed' : 'quest-row'

  return (
    <div className={className}>
      <div className="quest-row__icon">{quest.icon}</div>
      <div className="quest-row__body">
        <p className="quest-row__title">{quest.wording}</p>
        {!quest.completed && quest.threshold > 1 && (
          <div className="quest-row__progress">
            <span>{quest.count} / {quest.threshold}</span>
            <div className="quest-row__bar">
              <div className="quest-row__bar-fill" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}
        <span className="quest-row__reward">
          +{quest.rewardXp} XP
          {quest.rewardCouronnes > 0 ? ` · +${quest.rewardCouronnes} 🪙` : ''}
        </span>
      </div>
      {quest.completed && <div className="quest-row__check">✓</div>}
    </div>
  )
}
