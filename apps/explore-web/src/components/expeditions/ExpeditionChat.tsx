import { useState, useRef, useEffect } from 'react'
import { useExpeditionChat } from '../../hooks/useExpeditionChat'
import { useExpeditionsStore } from '../../stores/expeditionsStore'
import { sendExpeditionMessage } from '../../lib/expeditionsApi'
import { usePlayerStore } from '../../stores/playerStore'
import type { ExpeditionMessage } from '../../types/expedition'

// Sentinelle stable pour éviter le piège du selector Zustand qui retourne
// un nouveau tableau à chaque render (cause de "infinite loop" warning).
const EMPTY_MESSAGES: ExpeditionMessage[] = []

interface Props {
  expeditionId: string
  /** Lookup display_name + avatar_url pour chaque user_id participant. */
  participantsById: Record<string, { display_name: string; avatar_url: string | null; faction_color: string | null }>
  readOnly?: boolean
  /** Click sur avatar/nom — ouvre le profil et ferme la modale parente. */
  onAuthorClick?: (userId: string) => void
  /** Le chat est-il visuellement visible ? Mobile : false quand tab=info (la
   *  chat-col est `display:none`). Sert à re-déclencher l'auto-scroll en bas
   *  quand on bascule sur le tab Chat (sinon scrollHeight=0 au mount initial). */
  active?: boolean
}

function formatChatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return time
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `Hier ${time}`
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('fr-FR', sameYear
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + time
}

export function ExpeditionChat({ expeditionId, participantsById, readOnly, onAuthorClick, active = true }: Props) {
  useExpeditionChat(expeditionId)

  // /!\ NE PAS faire `s.messagesByExpedition[id] ?? []` directement dans le selector :
  // ça retourne un nouveau [] à chaque render et déclenche une boucle infinie Zustand.
  const messagesMap = useExpeditionsStore((s) => s.messagesByExpedition)
  const messages = messagesMap[expeditionId] ?? EMPTY_MESSAGES
  const myUserId = usePlayerStore((s) => s.userId)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll au bas : à chaque nouveau message, ET quand le chat redevient
  // visible (sinon scrollHeight=0 au mount mobile avec tab=info par défaut).
  useEffect(() => {
    if (!active || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages.length, active])

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
          const authorName = author?.display_name || 'Voyageur'
          const initials = authorName.slice(0, 2).toUpperCase()
          const factionStyle = author?.faction_color
            ? { boxShadow: `0 0 0 2px #faf2dd, 0 0 0 3px ${author.faction_color}` }
            : undefined
          // Pas de profil cliquable pour soi-même (inutile).
          const handleAuthor = !isMe && onAuthorClick ? () => onAuthorClick(m.user_id) : undefined
          const avatarContent = author?.avatar_url ? <img src={author.avatar_url} alt="" /> : initials
          return (
            <div key={m.id} className={`expedition-chat-msg${isMe ? ' is-me' : ''}`}>
              {handleAuthor ? (
                <button
                  type="button"
                  className="expedition-chat-avatar is-clickable"
                  style={factionStyle}
                  onClick={handleAuthor}
                  title={`Voir le profil de ${authorName}`}
                >{avatarContent}</button>
              ) : (
                <span className="expedition-chat-avatar" style={factionStyle}>{avatarContent}</span>
              )}
              <div className="expedition-chat-bubble">
                <div className="expedition-chat-meta">
                  {isMe ? (
                    <span className="expedition-chat-author">Toi</span>
                  ) : handleAuthor ? (
                    <button
                      type="button"
                      className="expedition-chat-author is-clickable"
                      onClick={handleAuthor}
                      title={`Voir le profil de ${authorName}`}
                    >
                      {authorName}
                    </button>
                  ) : (
                    <span className="expedition-chat-author">{authorName}</span>
                  )}
                  <span className="expedition-chat-date" title={new Date(m.created_at).toLocaleString('fr-FR')}>
                    {formatChatDate(m.created_at)}
                  </span>
                </div>
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
