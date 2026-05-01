import { createPortal } from 'react-dom'
import './RewardModal.css'

interface RewardGain {
  label: string
  value: number
  /** V0.6 — 'glory' / 'coupe' = nouveaux types V0.7 ; 'erudition' / 'influence'
      gardés pour compat (V0.5 figé). Les classes CSS `.reward-modal-gain.X`
      définissent les couleurs par type. */
  type: 'glory' | 'coupe' | 'erudition' | 'influence'
}

interface RewardModalProps {
  title: string
  gains: RewardGain[]
  onClose: () => void
}

export function RewardModal({ title, gains, onClose }: RewardModalProps) {
  return createPortal(
    <div
      className="reward-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="reward-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reward-modal-icon">
          <img src="/res/coffre_ouvert.webp" alt="" className="reward-modal-chest" />
        </div>

        <div className="reward-modal-title">{title}</div>

        {gains.length > 0 && (
          <div className="reward-modal-gains">
            {gains.map((gain) => (
              <div key={gain.type} className={`reward-modal-gain ${gain.type}`}>
                +{gain.value} {gain.label}
              </div>
            ))}
          </div>
        )}

        <button className="reward-modal-close" onClick={onClose}>
          Fermer
        </button>
      </div>
    </div>,
    document.body
  )
}
