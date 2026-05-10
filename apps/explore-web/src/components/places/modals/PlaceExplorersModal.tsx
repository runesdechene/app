import { createPortal } from 'react-dom'
import { useMapStore } from '../../../stores/mapStore'
import './PlaceExplorersModal.css'

interface Explorer {
  userId: string
  userName: string
  userAvatar: string | null
  factionId: string
  visitedAt: string
}

interface Props {
  explorers: Explorer[]
  authorId: string | null
  guardianId: string | null
  factionColors: Map<string, string>
  onClose: () => void
}

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

export function PlaceExplorersModal({ explorers, authorId, guardianId, factionColors, onClose }: Props) {
  const handleClick = (userId: string) => {
    onClose()
    useMapStore.getState().setSelectedPlayerId(userId)
  }

  const node = (
    <div className="explorers-modal-overlay" onClick={onClose}>
      <div className="explorers-modal" onClick={e => e.stopPropagation()}>
        <button className="explorers-modal-close" onClick={onClose} aria-label="Fermer">✕</button>
        <h3 className="explorers-modal-title">
          Ils ont foulé ces terres
          <span className="explorers-modal-count">({explorers.length})</span>
        </h3>
        <div className="explorers-modal-list">
          {explorers.map(exp => {
            const isAuthor = exp.userId === authorId
            const isGuardian = exp.userId === guardianId
            const color = factionColors.get(exp.factionId) ?? '#8A7B6A'
            return (
              <button
                key={exp.userId}
                className="explorers-modal-row"
                onClick={() => handleClick(exp.userId)}
              >
                {exp.userAvatar ? (
                  <img src={exp.userAvatar} alt="" className="explorers-modal-avatar" style={{ borderColor: color }} />
                ) : (
                  <div
                    className="explorers-modal-avatar explorers-modal-avatar-fallback"
                    style={{ backgroundColor: color, borderColor: color }}
                  >
                    {(exp.userName || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="explorers-modal-info">
                  <span className="explorers-modal-name">
                    {exp.userName}
                    {isAuthor && <span className="explorers-modal-tag explorers-modal-tag-author"> ⭐ Découvreur</span>}
                    {isGuardian && <span className="explorers-modal-tag explorers-modal-tag-guardian"> 🛡️ Gardien</span>}
                  </span>
                  <span className="explorers-modal-date">{DATE_FMT.format(new Date(exp.visitedAt))}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
