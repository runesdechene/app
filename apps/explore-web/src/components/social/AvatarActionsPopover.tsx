import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EmojiPicker } from './EmojiPicker'
import './AvatarActionsPopover.css'

type Mode = 'self' | 'other'
type SubView = 'menu' | 'picker'

interface PropsBase {
  mode: Mode
  /**
   * Élément DOM de l'avatar à ancrer. Le popover sera positionné en `fixed` au-dessus
   * de cet élément, rendu via createPortal vers document.body pour échapper au DOM
   * du Marker MapLibre (qui interceptait clavier/souris/wheel).
   */
  anchorEl: HTMLElement | null
  onClose: () => void
  onViewProfile: () => void
}

interface PropsSelf extends PropsBase {
  mode: 'self'
}

interface PropsOther extends PropsBase {
  mode: 'other'
  onSendEmoji: (emoji: string) => void
}

type Props = PropsSelf | PropsOther

/**
 * V0.7+ Mini popover qui s'ouvre au tap d'un avatar sur la carte.
 * - Mode self  : "Voir le profil"
 * - Mode other : "Voir le profil" + "Envoyer un emoji" (picker inline)
 *
 * Rendu via createPortal au document.body pour que les inputs du picker reçoivent
 * correctement les events natifs sans interception par MapLibre. Suit l'avatar via
 * requestAnimationFrame loop tant qu'il est ouvert (suit le pan/zoom de la carte).
 */
export function AvatarActionsPopover(props: Props) {
  const [view, setView] = useState<SubView>('menu')
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Suit la position de l'avatar en continu (tolère pan/zoom de la carte)
  useEffect(() => {
    if (!props.anchorEl) {
      setPos(null)
      return
    }
    let frame = 0
    function tick() {
      const rect = props.anchorEl?.getBoundingClientRect()
      if (rect) {
        setPos({ left: rect.left + rect.width / 2, top: rect.top })
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [props.anchorEl])

  // Click outside ferme — sauf clic sur le picker (qui est nested) ou sur l'avatar
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (popoverRef.current?.contains(target)) return
      if (target.closest('.other-player-marker') || target.closest('.user-position-marker')) return
      props.onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [props])

  if (!pos) return null

  const node = (
    <div
      ref={popoverRef}
      className="avatar-actions-popover"
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top - 12,
        transform: 'translate(-50%, -100%)',
        zIndex: 10000,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Escape') props.onClose()
      }}
      onWheel={(e) => e.stopPropagation()}
    >
      {view === 'menu' && (
        <>
          <button
            type="button"
            className="avatar-actions-popover__btn"
            onClick={() => {
              props.onViewProfile()
              props.onClose()
            }}
          >
            👁️ Voir le profil
          </button>

          {props.mode === 'other' && (
            <button
              type="button"
              className="avatar-actions-popover__btn"
              onClick={() => setView('picker')}
            >
              👋 Envoyer un emoji
            </button>
          )}

          <button
            type="button"
            className="avatar-actions-popover__btn avatar-actions-popover__btn-cancel"
            onClick={props.onClose}
          >
            Fermer
          </button>
        </>
      )}

      {view === 'picker' && props.mode === 'other' && (
        <EmojiPicker
          onPick={(emoji) => {
            props.onSendEmoji(emoji)
          }}
        />
      )}
    </div>
  )

  return createPortal(node, document.body)
}
