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
}

/**
 * V0.7+ NoteBubble + NoteReactionsRow rendus via createPortal vers document.body
 * pour échapper au stack context des Markers MapLibre. Z-index 25 → au-dessus
 * des icônes/markers (qui sont dans le stacking context de la carte, donc 0-15
 * au niveau body) mais SOUS les modales UI (30+). La position suit l'avatar via
 * requestAnimationFrame (suit pan/zoom de la carte).
 */
export function NoteOverlay({ anchorEl, text, reactions, onTap }: Props) {
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
        zIndex: 25,
        pointerEvents: 'auto',
        display: 'flex',
        flexDirection: 'column-reverse',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <NoteReactionsRow reactions={reactions} />
      <NoteBubble text={text} onTap={onTap} />
    </div>
  )

  return createPortal(node, document.body)
}
