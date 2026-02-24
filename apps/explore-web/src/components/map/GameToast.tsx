import { useEffect, useRef } from 'react'
import { useToastStore } from '../../stores/toastStore'
import { useMapStore } from '../../stores/mapStore'
import type { GameToast as GameToastType } from '../../stores/toastStore'

const ICONS: Record<GameToastType['type'], string> = {
  claim: '\u2694\uFE0F',     // epee
  discover: '\uD83E\uDDED',  // boussole
  explore: '\uD83E\uDDB6',   // randonnée
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

/** Met en gras tous les segments qui matchent un des highlights */
function renderWithHighlights(message: string, highlights: string[]) {
  if (highlights.length === 0) return message

  // Construire les segments : trouver chaque highlight dans le message
  const parts: { text: string; bold: boolean }[] = []
  let remaining = message

  while (remaining.length > 0) {
    let earliest = -1
    let earliestHL = ''
    for (const hl of highlights) {
      const idx = remaining.indexOf(hl)
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx
        earliestHL = hl
      }
    }
    if (earliest === -1) {
      parts.push({ text: remaining, bold: false })
      break
    }
    if (earliest > 0) {
      parts.push({ text: remaining.slice(0, earliest), bold: false })
    }
    parts.push({ text: earliestHL, bold: true })
    remaining = remaining.slice(earliest + earliestHL.length)
  }

  return (
    <>
      {parts.map((p, i) =>
        p.bold ? <strong key={i}>{p.text}</strong> : p.text
      )}
    </>
  )
}

function ToastItem({ toast }: { toast: GameToastType }) {
  const removeToast = useToastStore(s => s.removeToast)
  const requestFlyTo = useMapStore(s => s.requestFlyTo)

  const isClickable = !!toast.placeId && !!toast.placeLocation

  // Collecter tous les highlights
  const highlights = [
    ...(toast.highlights || []),
    ...(toast.highlight ? [toast.highlight] : []),
  ]

  function handleClick() {
    if (!toast.placeLocation || !toast.placeId) return
    requestFlyTo({
      lng: toast.placeLocation.longitude,
      lat: toast.placeLocation.latitude,
      placeId: toast.placeId,
    })
  }

  return (
    <div
      className={`game-toast${isClickable ? ' game-toast-clickable' : ''}`}
      style={{ borderLeftColor: toast.color || 'var(--color-sepia)' }}
      onClick={isClickable ? handleClick : undefined}
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
        {highlights.length > 0 ? renderWithHighlights(toast.message, highlights) : toast.message}
      </span>
      <span className="game-toast-time">{formatTimeAgo(toast.timestamp)}</span>
      <button
        className="game-toast-close"
        onClick={(e) => { e.stopPropagation(); removeToast(toast.id) }}
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
