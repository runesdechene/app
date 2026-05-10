import { useEffect, useRef, useState, useMemo } from 'react'
import { useToastStore } from '../../../stores/toastStore'
import { useMapStore } from '../../../stores/mapStore'
import { useMobileNavStore } from '../../../stores/mobileNavStore'
import { usePlayerStore } from '../../../stores/playerStore'
import { useUserAvatars } from '../../../hooks/useUserAvatars'
import type { GameToast as GameToastType } from '../../../stores/toastStore'
import './GameToast.css'

const isMobile = window.innerWidth <= 768

const ICONS: Record<GameToastType['type'], string> = {
  claim: '\u2694\uFE0F',     // epee
  discover: '\uD83E\uDDED',  // boussole
  explore: '\uD83E\uDDB6',   // randonnée
  new_place: '\u2B50',       // etoile
  new_user: '\uD83D\uDC64',  // silhouette
  like: '\u2764\uFE0F',      // coeur
  fortify: '\uD83D\uDEE1\uFE0F', // bouclier
  contribute: '\uD83D\uDCD5', // livre fermé rouge (récit/photo)
  revisit: '\uD83D\uDD04',   // flèches rotation (re-exploration)
  enigma: '\uD83D\uDD2E',  // boule de cristal (érudition)
  influence: '\uD83C\uDFF4',  // drapeau noir (V0.5 fig\u00E9)
  info: '\uD83D\uDCCB',      // presse-papiers (copie, info)
  error: '\u26A0\uFE0F',     // avertissement (erreur)
  // V0.7 ajouts
  plant_flag: '\uD83D\uDEA9',     // drapeau rouge (\u00E9tendard plant\u00E9)
  harvest_crown: '\uD83E\uDE99',  // pi\u00E8ce (Couronne r\u00E9colt\u00E9e)
  // V0.7+ mini-qu\u00EAtes journali\u00E8res
  quest_completed: '\uD83C\uDFAF', // cible (qu\u00EAte accomplie)
  // V0.7 phase 5 \u2014 La Cour (attaque, bascule, m\u00E9c\u00E8ne principal)
  court: '\uD83D\uDC51', // couronne
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
  highlightColors: Map<string, string>,
) {
  // Filtrer les highlights vides pour éviter une boucle infinie
  const safeHL = highlights.filter(h => h.length > 0)
  if (safeHL.length === 0) return message

  const parts: { text: string; bold: boolean }[] = []
  let remaining = message

  while (remaining.length > 0) {
    let earliest = -1
    let earliestHL = ''
    for (const hl of safeHL) {
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
        const color = highlightColors.get(p.text)
        if (action) {
          return (
            <strong
              key={i}
              className="game-toast-link"
              style={color ? { color } : undefined}
              onClick={(e) => { e.stopPropagation(); action() }}
            >
              {p.text}
            </strong>
          )
        }
        return <strong key={i} style={color ? { color } : undefined}>{p.text}</strong>
      })}
    </>
  )
}

export function ToastItem({ toast, fetchedAvatar }: { toast: GameToastType; fetchedAvatar?: string | null }) {
  const removeToast = useToastStore(s => s.removeToast)
  const requestFlyTo = useMapStore(s => s.requestFlyTo)
  const setSelectedPlayerId = useMapStore(s => s.setSelectedPlayerId)
  // Priorité à l'avatar embarqué dans le toast (évite flicker au mount) ;
  // fallback sur celui fetché en batch via useUserAvatars dans le container.
  const resolvedAvatar = toast.actorAvatarUrl || fetchedAvatar || null

  // Collecter tous les highlights
  const highlights = toast.highlights || []

  // Construire les actions cliquables pour chaque highlight
  const actions = new Map<string, () => void>()

  // Couleurs des noms d'utilisateurs (faction color)
  const highlightColors = new Map<string, string>()

  // Nom du joueur → ouvrir profil + couleur faction
  // Convention: quand actorId est set, highlights[0] = nom du joueur
  if (toast.actorId && highlights.length > 0) {
    const actorName = highlights[0]
    actions.set(actorName, () => setSelectedPlayerId(toast.actorId!))
    if (toast.color) highlightColors.set(actorName, toast.color)
  }

  // Nom du lieu → fly to + ouvrir panel
  // Le lieu est highlights[1] quand il y a un acteur, ou highlights[0] quand c'est un toast self sans actorId
  if (toast.placeId) {
    const placeIdx = toast.actorId ? 1 : 0
    if (highlights.length > placeIdx) {
      const placeHL = highlights[placeIdx]
      if (toast.placeLocation) {
        actions.set(placeHL, () => {
          useMobileNavStore.getState().closePanel()
          // setSelectedPlaceId d'abord pour que le PlacePanel s'ouvre dans
          // tous les contextes (carte ET home — où la map n'est pas montée
          // pour consommer pendingFlyTo). flyTo en plus si la carte est là.
          useMapStore.getState().setSelectedPlaceId(toast.placeId!)
          requestFlyTo({
            lng: toast.placeLocation!.longitude,
            lat: toast.placeLocation!.latitude,
            placeId: toast.placeId,
          })
        })
      } else {
        // V097.1 — fallback : pas de coords (cas toasts Cour) → ouvre la fiche
        // sans fly-to. Mieux que pas d'action du tout.
        actions.set(placeHL, () => {
          useMobileNavStore.getState().closePanel()
          useMapStore.getState().setSelectedPlaceId(toast.placeId!)
        })
      }
    }
  }

  // Ancien controleur → ouvrir profil + couleur faction
  if (toast.previousActorId && highlights.length > 2) {
    const prevName = highlights[2]
    actions.set(prevName, () => setSelectedPlayerId(toast.previousActorId!))
    if (toast.previousActorColor) highlightColors.set(prevName, toast.previousActorColor)
  }

  // V070 — nom du fragment cliquable (énigme de fragment) → ouvre la galerie
  // Fragments dans le PlayerProfileModal de SOI-MÊME (le but est de "découvrir"
  // les fragments depuis le toast, pas de relancer l'énigme).
  if (toast.fragmentId && toast.fragmentName) {
    actions.set(toast.fragmentName, () => {
      const myId = usePlayerStore.getState().userId
      if (!myId) return
      useMapStore.getState().setSelectedPlayerId(myId)
      useMapStore.getState().requestOpenFragmentStore()
    })
  }

  return (
    <div
      className="game-toast"
      style={toast.type === 'contribute' || toast.type === 'new_place' ? { borderLeftColor: toast.color || 'var(--color-sepia)' } : undefined}
    >
      {toast.contested ? (
        // Conqu\u00EAte contest\u00E9e : feu rouge prioritaire, plus expressif que l'avatar.
        <span className="game-toast-icon-bubble">{'\uD83D\uDD25'}</span>
      ) : toast.actorId && resolvedAvatar ? (
        // Action personnelle avec avatar dispo \u2192 on humanise.
        <img src={resolvedAvatar} alt="" className="game-toast-avatar" />
      ) : toast.type === 'new_user' ? (
        // new_user sans avatar URL : silhouette avec bordure faction.
        <span className="game-toast-avatar-fallback" style={{ borderColor: toast.color || 'var(--color-sepia)' }}>
          {'\uD83D\uDC64'}
        </span>
      ) : (
        // Pas d'acteur (info g\u00E9n\u00E9raliste, lieu) ou avatar pas encore r\u00E9solu \u2192 ic\u00F4ne type.
        <span className="game-toast-icon-bubble">{ICONS[toast.type]}</span>
      )}
      <span className="game-toast-message">
        {highlights.length > 0 ? renderMessage(toast.message, highlights, actions, highlightColors) : toast.message}
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
  const [, setTick] = useState(0)
  const mobilePanel = useMobileNavStore(s => s.activePanel)
  // Batch fetch des avatars de tous les acteurs présents dans les toasts —
  // une seule query DB pour tous les toasts. Les toasts qui embarquent déjà
  // actorAvatarUrl (new_user) n'attendront pas le fetch (fallback prioritaire).
  const actorIds = toasts.map(t => t.actorId)
  const avatars = useUserAvatars(actorIds)

  // Rafraîchir les timestamps toutes les 30s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

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
      <header className="game-toast-header">
        <h2 className="game-toast-title">Activité de la carte</h2>
        <button
        className="game-toast-collapse"
        onClick={() => setMinimized(!minimized)}
        aria-label={minimized ? 'Agrandir' : 'Réduire'}
      >
        {minimized ? '\u25BE' : '\u25B4'}
      </button>
      </header>
      <div className={`game-toast-content${minimized ? ' is-minimized' : ''}`}>
        <div className="game-toast-list" ref={containerRef}>
          {sortedToasts.map(toast => (
            <ToastItem
              key={toast.id}
              toast={toast}
              fetchedAvatar={toast.actorId ? avatars[toast.actorId] : null}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
