import { useEffect } from 'react'
import type { DailyQuest } from '../../types/dailyQuest'

interface Props {
  quest: DailyQuest
  onClose: () => void
}

/**
 * Modale légère qui s'ouvre au click sur une card de quête.
 * Pattern allégé d'ExpeditionModal : backdrop, card centrée, ESC + click backdrop ferme.
 */
export function DailyQuestModal({ quest, onClose }: Props) {
  const completed = quest.completedAt !== null
  const progress = Math.min(quest.progress, quest.target)
  const pct = quest.target > 0 ? (progress / quest.target) * 100 : 0

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="daily-quest-modal-backdrop" onClick={onClose}>
      <div
        className="daily-quest-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="daily-quest-title"
      >
        <button
          type="button"
          className="daily-quest-modal-close"
          onClick={onClose}
          aria-label="Fermer"
        >×</button>

        <div className="daily-quest-modal-header">
          <span className="daily-quest-modal-icon" aria-hidden>{quest.icon}</span>
          <span className="daily-quest-modal-pill">Quête du jour</span>
        </div>

        <h2 id="daily-quest-title" className="daily-quest-modal-title">{quest.title}</h2>
        <p className="daily-quest-modal-description">{quest.description}</p>

        <div className="daily-quest-modal-progress">
          <div className="daily-quest-modal-progress-bar" aria-hidden>
            <div
              className={`daily-quest-modal-progress-fill${completed ? ' completed' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="daily-quest-modal-progress-label">
            {progress} / {quest.target}
          </span>
        </div>

        <div className="daily-quest-modal-footer">
          {completed ? (
            <div className="daily-quest-modal-completed">
              <span className="daily-quest-modal-completed-badge">✓ Accomplie</span>
              {quest.completedAt && (
                <span className="daily-quest-modal-completed-at">
                  {formatCompletedAt(quest.completedAt)}
                </span>
              )}
            </div>
          ) : (
            <div className="daily-quest-modal-reward">
              <span className="daily-quest-modal-reward-label">Récompense</span>
              <span className="daily-quest-modal-reward-value">
                +{quest.reward.amount} {quest.reward.type === 'crowns' ? '🪙' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
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
