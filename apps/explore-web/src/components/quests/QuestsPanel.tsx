import { createPortal } from 'react-dom'
import type { UserQuest } from '../../hooks/useUserQuests'
import { QuestRow } from './QuestRow'
import './QuestsPanel.css'

interface QuestsPanelProps {
  isOpen: boolean
  onClose: () => void
  quests: UserQuest[]
  loading: boolean
}

function formatDateLocal(): string {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formatResetTime(): string {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  return tomorrow.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function QuestsPanel({ isOpen, onClose, quests, loading }: QuestsPanelProps) {
  if (!isOpen) return null

  const completedCount = quests.filter(q => q.completed).length

  const node = (
    <div className="quests-panel-backdrop" onClick={onClose}>
      <div className="quests-panel" onClick={e => e.stopPropagation()}>
        <div className="quests-panel__header">
          <div className="quests-panel__title-block">
            <h2 className="quests-panel__title">Quêtes du jour</h2>
            <span className="quests-panel__date">
              {formatDateLocal()} · {completedCount} / {quests.length} accomplies
            </span>
          </div>
          <button className="quests-panel__close" onClick={onClose} aria-label="Fermer">×</button>
        </div>
        <div className="quests-panel__body">
          {loading ? (
            <p style={{ opacity: 0.7, textAlign: 'center', padding: '1rem 0' }}>Chargement…</p>
          ) : quests.length === 0 ? (
            <p style={{ opacity: 0.7, textAlign: 'center', padding: '1rem 0' }}>
              Pas de quêtes aujourd'hui.
            </p>
          ) : (
            quests.map(q => <QuestRow key={q.templateId} quest={q} />)
          )}
        </div>
        <div className="quests-panel__footer">
          Reset à minuit · prochain ≈ {formatResetTime()}
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
