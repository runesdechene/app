import './NoteBubble.css'

interface NoteBubbleProps {
  text: string
  onTap?: () => void
}

export function NoteBubble({ text, onTap }: NoteBubbleProps) {
  return (
    <div
      className="note-bubble"
      onClick={(e) => {
        e.stopPropagation()
        onTap?.()
      }}
    >
      <div className="note-bubble__text">{text}</div>
    </div>
  )
}
