import './RewardModal.css'

interface RewardGain {
  label: string
  value: number
  type: 'erudition' | 'influence'
}

interface RewardModalProps {
  title: string
  gains: RewardGain[]
  onClose: () => void
}

export function RewardModal({ title, gains, onClose }: RewardModalProps) {
  return (
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
    </div>
  )
}
