import { useEffect, useRef, useState, useMemo } from 'react'
import { useToastStore } from '../../stores/toastStore'
import { useMapStore } from '../../stores/mapStore'
import { useMobileNavStore } from '../../stores/mobileNavStore'
import type { GameToast as GameToastType } from '../../stores/toastStore'

const isMobile = window.innerWidth <= 768

const ICONS: Record<GameToastType['type'], string> = {
  claim: '\u2694\uFE0F',     // epee
  discover: '\uD83E\uDDED',  // boussole
  explore: '\uD83E\uDDB6',   // randonnée
  new_place: '\u2B50',       // etoile
  new_user: '\uD83D\uDC64',  // silhouette
  like: '\u2764\uFE0F',      // coeur
  fortify: '\uD83D\uDEE1\uFE0F', // bouclier
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

/**
 * Segmente le message en parties texte/bold, et rend les parties
 * bold cliquables si elles ont une action associée.
 */
function renderMessage(
  message: string,
  highlights: string[],
  actions: Map<string, () => void>,
) {
  if (highlights.length === 0) return message

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
      {parts.map((p, i) => {
        if (!p.bold) return p.text
        const action = actions.get(p.text)
        if (action) {
          return (
            <strong
              key={i}
              className="game-toast-link"
              onClick={(e) => { e.stopPropagation(); action() }}
            >
              {p.text}
            </strong>
          )
        }
        return <strong key={i}>{p.text}</strong>
      })}
    </>
  )
}

function ToastItem({ toast }: { toast: GameToastType }) {
  const removeToast = useToastStore(s => s.removeToast)
  const requestFlyTo = useMapStore(s => s.requestFlyTo)
  const setSelectedPlayerId = useMapStore(s => s.setSelectedPlayerId)

  // Collecter tous les highlights
  const highlights = [
    ...(toast.highlights || []),
    ...(toast.highlight ? [toast.highlight] : []),
  ]

  // Construire les actions cliquables pour chaque highlight
  const actions = new Map<string, () => void>()

  // Nom du joueur → ouvrir profil
  if (toast.actorId && highlights.length > 0) {
    const actorName = highlights[0]
    actions.set(actorName, () => setSelectedPlayerId(toast.actorId!))
  }

  // Nom du lieu → fly to + ouvrir panel + fermer panel mobile
  if (toast.placeId && toast.placeLocation && highlights.length > 1) {
    const placeHL = highlights[1]
    actions.set(placeHL, () => {
      useMobileNavStore.getState().closePanel()
      requestFlyTo({
        lng: toast.placeLocation!.longitude,
        lat: toast.placeLocation!.latitude,
        placeId: toast.placeId,
      })
    })
  }

  // Ancien controleur → ouvrir profil
  if (toast.previousActorId && highlights.length > 2) {
    const prevName = highlights[2]
    actions.set(prevName, () => setSelectedPlayerId(toast.previousActorId!))
  }

  return (
    <div
      className="game-toast"
      style={{ borderLeftColor: toast.color || 'var(--color-sepia)' }}
    >
      {toast.contested ? (
        <span className="game-toast-faction-dot game-toast-contested">
          {'\uD83D\uDD25'}
        </span>
      ) : toast.iconUrl ? (
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
        {highlights.length > 0 ? renderMessage(toast.message, highlights, actions) : toast.message}
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
  const [minimized, setMinimized] = useState(false)
  const mobilePanel = useMobileNavStore(s => s.activePanel)

  // Sur desktop : auto-scroll vers le bas quand un nouveau toast arrive
  // Sur mobile : pas besoin, l'ordre est inversé (récent en haut)
  useEffect(() => {
    if (!isMobile && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [toasts.length, mobilePanel])

  // Sur mobile, afficher les plus récents en haut
  const sortedToasts = useMemo(() => {
    if (!isMobile) return toasts
    return [...toasts].reverse()
  }, [toasts])

  if (toasts.length === 0) return null

  return (
    <div className={`game-toast-container${minimized ? ' game-toast-minimized' : ''}`}>
      <button
        className="game-toast-minimize"
        onClick={() => setMinimized(!minimized)}
        aria-label={minimized ? 'Agrandir' : 'Réduire'}
      >
        {minimized ? `\u25BC ${toasts.length}` : '\u2013'}
      </button>
      {!minimized && (
        <div className="game-toast-list" ref={containerRef}>
          {sortedToasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} />
          ))}
        </div>
      )}
    </div>
  )
}
