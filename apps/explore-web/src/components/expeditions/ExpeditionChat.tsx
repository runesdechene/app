import { useState, useRef, useEffect } from 'react'
import { useExpeditionChat } from '../../hooks/useExpeditionChat'
import { useExpeditionsStore } from '../../stores/expeditionsStore'
import { sendExpeditionMessage } from '../../lib/expeditionsApi'
import { usePlayerStore } from '../../stores/playerStore'

interface Props {
  expeditionId: string
  /** Lookup display_name + avatar_url pour chaque user_id participant. */
  participantsById: Record<string, { display_name: string; avatar_url: string | null; faction_color: string | null }>
  readOnly?: boolean
}

export function ExpeditionChat({ expeditionId, participantsById, readOnly }: Props) {
  useExpeditionChat(expeditionId)

  const messages = useExpeditionsStore((s) => s.messagesByExpedition[expeditionId] ?? [])
  const myUserId = usePlayerStore((s) => s.userId)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll au bas à chaque nouveau message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  async function handleSend() {
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    const result = await sendExpeditionMessage(expeditionId, content)
    setSending(false)
    if (result.success) setDraft('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="expedition-chat">
      <div className="expedition-chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="expedition-chat-empty">Pas encore de message. Lance la conversation.</div>
        )}
        {messages.map((m) => {
          const isMe = m.user_id === myUserId
          const author = participantsById[m.user_id]
          const initials = (author?.display_name || '?').slice(0, 2).toUpperCase()
          const factionStyle = author?.faction_color
            ? { boxShadow: `0 0 0 2px #faf2dd, 0 0 0 3px ${author.faction_color}` }
            : undefined
          return (
            <div key={m.id} className={`expedition-chat-msg${isMe ? ' is-me' : ''}`}>
              <span className="expedition-chat-avatar" style={factionStyle}>
                {author?.avatar_url ? <img src={author.avatar_url} alt="" /> : initials}
              </span>
              <div className="expedition-chat-bubble">
                <span className="expedition-chat-author">{isMe ? 'Toi' : (author?.display_name || 'Voyageur')}</span>
                {m.content}
              </div>
            </div>
          )
        })}
      </div>
      {!readOnly && (
        <div className="expedition-chat-input">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrire un message…"
            maxLength={500}
          />
          <button onClick={handleSend} disabled={!draft.trim() || sending} aria-label="Envoyer">↑</button>
        </div>
      )}
    </div>
  )
}
