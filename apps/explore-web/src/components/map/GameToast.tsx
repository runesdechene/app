import { useEffect, useRef } from 'react'
import { useToastStore } from '../../stores/toastStore'
import type { GameToast as GameToastType } from '../../stores/toastStore'

const ICONS: Record<GameToastType['type'], string> = {
  claim: '\u2694\uFE0F',     // epee
  discover: '\uD83E\uDDED',  // boussole
  new_place: '\u2B50',       // etoile
  new_user: '\uD83D\uDC64',  // silhouette
  like: '\u2764\uFE0F',      // coeur
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "\u00e0 l'instant"
  if (minutes < 60) return `il y a ${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `il y a ${days}j`
}

function renderHighlighted(message: string, highlight: string, color?: string) {
  const idx = message.indexOf(highlight)
  if (idx === -1) return message
  const before = message.slice(0, idx)
  const after = message.slice(idx + highlight.length)
  return (
    <>
      {before}
      <strong style={{ color: color || 'inherit' }}>{highlight}</strong>
      {after}
    </>
  )
}

function ToastItem({ toast }: { toast: GameToastType }) {
  const removeToast = useToastStore(s => s.removeToast)

  return (
    <div
      className="game-toast"
      style={{
        borderLeftColor: toast.color || 'var(--color-sepia)',
      }}
    >
      {toast.iconUrl ? (
        <span
          className="game-toast-faction-dot"
          style={{ background: toast.color || 'var(--color-sepia)' }}
        >
          <img src={toast.iconUrl} alt="" className="game-toast-faction-icon" />
        </span>
      ) : (
        <span className="game-toast-icon">{ICONS[toast.type]}</span>
      )}
      <span className="game-toast-message">
        {toast.highlight ? renderHighlighted(toast.message, toast.highlight, toast.color) : toast.message}
      </span>
      <span className="game-toast-time">{formatTimeAgo(toast.timestamp)}</span>
      <button
        className="game-toast-close"
        onClick={() => removeToast(toast.id)}
        aria-label="Fermer"
      >
        &#10005;
      </button>
    </div>
  )
}

export function GameToast() {
  const toasts = useToastStore(s => s.toasts)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll vers le bas quand un nouveau toast arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [toasts.length])

  if (toasts.length === 0) return null

  return (
    <div className="game-toast-container" ref={containerRef}>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
