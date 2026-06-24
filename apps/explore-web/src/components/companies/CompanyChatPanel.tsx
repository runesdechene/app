import { useState, useEffect, useRef } from 'react'
import { useCompanyChat } from '../../hooks/useCompanyChat'
import type { CompanyMember } from '../../stores/companyStore'

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** Résout le nom d'un membre à partir de son userId */
function resolveName(userId: string, members: CompanyMember[]): string {
  return members.find((m) => m.userId === userId)?.name ?? '…'
}

interface Props {
  companyId: string
  members: CompanyMember[]
  accentColor: string
  /** Remplit toute la hauteur du conteneur (colonne droite du Hall) au lieu du cadre compact. */
  fill?: boolean
}

export function CompanyChatPanel({ companyId, members, accentColor, fill }: Props) {
  const { messages, send, loading } = useCompanyChat(companyId)
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  // Auto-scroll à chaque nouveau message
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length])

  async function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setText('')
    await send(trimmed)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div style={fill ? { ...s.panel, ...s.panelFill } : s.panel}>
      <div style={{ ...s.header, borderColor: accentColor }}>
        <span style={s.headerTitle}>Messages de la Compagnie</span>
      </div>

      {/* Liste messages */}
      <div style={s.messages} ref={listRef}>
        {messages.length === 0 && (
          <p style={s.empty}>Aucun message. Soyez le premier !</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} style={s.message}>
            <span style={{ ...s.msgName, color: accentColor }}>
              {resolveName(msg.userId, members)}
            </span>
            <span style={s.msgContent}>{msg.content}</span>
            <span style={s.msgTime}>{formatTime(msg.createdAt)}</span>
          </div>
        ))}
      </div>

      {/* Saisie */}
      <div style={s.inputArea}>
        <input
          style={s.inputField}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Écrire un message…"
          maxLength={500}
          readOnly={loading}
          aria-label="Écrire un message"
        />
        <button
          style={{ ...s.sendBtn, borderColor: accentColor, color: accentColor }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleSend}
          disabled={loading || !text.trim()}
          aria-label="Envoyer"
        >
          &#10148;
        </button>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex', flexDirection: 'column',
    border: '1px solid rgba(193,154,107,0.25)',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
    minHeight: '220px', maxHeight: '340px',
  },
  panelFill: {
    height: '100%', minHeight: 0, maxHeight: 'none', flex: 1, borderRadius: 0, border: 'none',
  },
  header: {
    padding: '8px 12px',
    borderBottom: '2px solid',
    flexShrink: 0,
  },
  headerTitle: {
    fontFamily: 'var(--font-accent, sans-serif)',
    fontSize: '15px', fontWeight: 600,
    color: 'var(--color-ink, #4A3728)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  messages: {
    flex: 1, overflowY: 'auto',
    padding: '8px 12px',
    display: 'flex', flexDirection: 'column', gap: '2px',
    scrollbarWidth: 'none',
  },
  empty: {
    fontSize: '15px', color: 'var(--color-ink-light, #8d745e)',
    fontStyle: 'italic', margin: 0,
  },
  message: {
    fontFamily: 'var(--font-body, sans-serif)',
    fontSize: '15px', lineHeight: 1.4,
    color: 'var(--color-ink, #4A3728)',
  },
  msgName: {
    fontWeight: 700, marginRight: '6px',
  },
  msgContent: {
    wordBreak: 'break-word',
  },
  msgTime: {
    fontSize: '12px', opacity: 0.45,
    marginLeft: '6px',
  },
  inputArea: {
    flexShrink: 0,
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 10px',
    borderTop: '1px solid rgba(193,154,107,0.25)',
  },
  inputField: {
    flex: 1, padding: '10px 14px', fontSize: '16px',
    border: '1px solid rgba(193,154,107,0.4)',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.5)',
    color: 'var(--color-ink, #4A3728)',
    outline: 'none',
    fontFamily: 'var(--font-body, sans-serif)',
  },
  sendBtn: {
    width: '42px', height: '42px', borderRadius: '50%',
    border: '1px solid',
    background: 'transparent',
    cursor: 'pointer', fontSize: '14px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 0.15s',
  },
}
