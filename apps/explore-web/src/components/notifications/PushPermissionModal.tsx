import { useEffect } from 'react'
import './PushPermissionModal.css'

interface Props {
  open: boolean
  title: string
  body: string
  onAccept: () => void
  onDismiss: () => void
}

export function PushPermissionModal({ open, title, body, onAccept, onDismiss }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onDismiss])

  if (!open) return null
  return (
    <div className="push-perm-backdrop" onClick={onDismiss}>
      <div className="push-perm-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="push-perm-title">{title}</h2>
        <p className="push-perm-body">{body}</p>
        <div className="push-perm-actions">
          <button className="push-perm-btn push-perm-btn--secondary" onClick={onDismiss}>
            Plus tard
          </button>
          <button className="push-perm-btn push-perm-btn--primary" onClick={onAccept}>
            Activer
          </button>
        </div>
      </div>
    </div>
  )
}
