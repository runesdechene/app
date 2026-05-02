import type { ReactionCount } from '../../hooks/useNoteReactions'
import './NoteReactionsRow.css'

interface NoteReactionsRowProps {
  reactions: ReactionCount[]
}

export function NoteReactionsRow({ reactions }: NoteReactionsRowProps) {
  if (reactions.length === 0) return null
  return (
    <div className="note-reactions-row">
      {reactions.map(r => (
        <span key={r.emoji} className="note-reaction-pill">
          <span>{r.emoji}</span>
          <span className="note-reaction-pill__count">{r.count}</span>
        </span>
      ))}
    </div>
  )
}
