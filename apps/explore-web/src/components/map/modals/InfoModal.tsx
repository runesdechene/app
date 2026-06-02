import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import './InfoModal.css'

interface InfoRow {
  label: string
  value: string
  highlight?: boolean
}

interface InfoModalProps {
  icon: ReactNode
  title: string
  description: string
  rows: InfoRow[]
  onClose: () => void
  action?: { label: string; onClick: () => void }
  /** Slot optionnel rendu entre la description et les rows (progress bar, image, etc.). */
  extraContent?: ReactNode
}

export function InfoModal({ icon, title, description, rows, onClose, action, extraContent }: InfoModalProps) {
  // Portal vers document.body : sort de tout stacking context parent (chatbox,
  // toastbox, map container, etc.) qui pourrait plafonner le z-index de la modal.
  // Sans portal, le z-index 100000 est relatif au stacking context du parent qui
  // peut être < à celui d'un sibling top-level. Avec portal, on est top-level.
  const node = (
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
        {extraContent && (
          <div className="info-modal-extra">{extraContent}</div>
        )}
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
  return createPortal(node, document.body)
}
