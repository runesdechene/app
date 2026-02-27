interface InfoRow {
  label: string
  value: string
  highlight?: boolean
}

interface InfoModalProps {
  icon: string
  title: string
  description: string
  rows: InfoRow[]
  onClose: () => void
  action?: { label: string; onClick: () => void }
}

export function InfoModal({ icon, title, description, rows, onClose, action }: InfoModalProps) {
  return (
    <div className="info-modal-overlay" onClick={onClose}>
      <div className="info-modal" onClick={e => e.stopPropagation()}>
        <button className="info-modal-close" onClick={onClose} aria-label="Fermer">
          &#10005;
        </button>
        <div className="info-modal-header">
          <span className="info-modal-icon">{icon}</span>
          <h3 className="info-modal-title">{title}</h3>
        </div>
        <p className="info-modal-desc">{description}</p>
        {rows.length > 0 && (
          <div className="info-modal-stats">
            {rows.map((row, i) => (
              <div key={i} className={`info-modal-row${row.highlight ? ' highlight' : ''}`}>
                <span className="info-modal-row-label">{row.label}</span>
                <span className="info-modal-row-value">{row.value}</span>
              </div>
            ))}
          </div>
        )}
        {action && (
          <button className="info-modal-action" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
