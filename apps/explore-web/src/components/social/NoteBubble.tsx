import './NoteBubble.css'

interface NoteBubbleProps {
  authorName: string
  text: string
  onTap?: () => void
}

export function NoteBubble({ authorName, text, onTap }: NoteBubbleProps) {
  return (
    <div
      className="note-bubble"
      onClick={(e) => {
        e.stopPropagation()
        onTap?.()
      }}
    >
      <span className="note-bubble__author">{authorName}</span>
      <div className="note-bubble__text">{text}</div>
    </div>
  )
}
