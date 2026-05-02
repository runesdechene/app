import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NoteBubble } from './NoteBubble'
import { NoteReactionsRow } from './NoteReactionsRow'
import type { ReactionCount } from '../../hooks/useNoteReactions'

interface Props {
  anchorEl: HTMLElement | null
  text: string
  reactions: ReactionCount[]
  onTap: () => void
  /** Mode dézoomé : remplace la bulle par une petite icône 📜 cliquable.
   *  Aère la carte quand on a une vue large avec beaucoup d'avatars. */
  compact?: boolean
}

/**
 * V0.7+ NoteBubble + NoteReactionsRow rendus via createPortal vers document.body
 * pour échapper au stack context des Markers MapLibre. Z-index 5 → au-dessus
 * des icônes/markers de la carte mais SOUS toute interface fixée (toolbar 15,
 * mobile-header 9998, mobile-navbar 10000, conquest-indicator 10). La position
 * suit l'avatar via requestAnimationFrame (suit pan/zoom de la carte).
 */
export function NoteOverlay({ anchorEl, text, reactions, onTap, compact = false }: Props) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    if (!anchorEl) {
      setPos(null)
      return
    }
    let frame = 0
    function tick() {
      const rect = anchorEl?.getBoundingClientRect()
      if (rect) {
        setPos({ left: rect.left + rect.width / 2, top: rect.top })
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [anchorEl])

  if (!pos) return null

  const node = (
    <div
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top - 8,
        transform: 'translate(-50%, -100%)',
        zIndex: 5,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column-reverse',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {compact ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onTap() }}
          aria-label="Voir la note"
          title={text}
          style={{
            background: '#fdf3d6',
            border: '1px solid #c8a874',
            borderRadius: '50%',
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
            padding: 0,
            lineHeight: 1,
          }}
        >
          📜
        </button>
      ) : (
        <>
          <NoteReactionsRow reactions={reactions} />
          <NoteBubble text={text} onTap={onTap} />
        </>
      )}
    </div>
  )

  return createPortal(node, document.body)
}
