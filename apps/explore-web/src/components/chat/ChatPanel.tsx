import { useState, useEffect, useRef, useMemo } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { useFogStore } from '../../stores/fogStore'
import { useMapStore } from '../../stores/mapStore'
import { sendChatMessage } from '../../hooks/useChat'
import type { ChatMessage } from '../../stores/chatStore'

// ---- Helpers ----

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// ---- Sub-components ----

function ChannelFilters({ hasFaction }: { hasFaction: boolean }) {
  const showGeneral = useChatStore((s) => s.showGeneral)
  const showFaction = useChatStore((s) => s.showFaction)
  const toggleGeneral = useChatStore((s) => s.toggleShowGeneral)
  const toggleFaction = useChatStore((s) => s.toggleShowFaction)
  const userFactionColor = useFogStore((s) => s.userFactionColor)

  return (
    <div className="chat-filters">
      <label className="chat-filter">
        <input type="checkbox" checked={showGeneral} onChange={toggleGeneral} />
        Général
      </label>
      {hasFaction && (
        <label className="chat-filter chat-filter-faction" style={{ color: userFactionColor || undefined }}>
          <input type="checkbox" checked={showFaction} onChange={toggleFaction} style={{ accentColor: userFactionColor || undefined }} />
          Faction
        </label>
      )}
    </div>
  )
}

function MessageList({
  messages,
  userFactionColor,
}: {
  messages: ChatMessage[]
  userFactionColor: string | null
}) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length])

  if (messages.length === 0) {
    return (
      <div className="chat-messages chat-empty">
        Aucun message. Soyez le premier !
      </div>
    )
  }

  return (
    <div className="chat-messages" ref={listRef}>
      {messages.map((msg) => {
        const isFaction = msg.channel !== 'general'
        // Faction messages: texte en couleur faction. General: texte neutre.
        const textColor = isFaction
          ? (msg.factionColor || userFactionColor || 'var(--color-sepia)')
          : undefined

        return (
          <div key={msg.id} className="chat-message">
            {isFaction && (
              <span className="chat-channel-tag" style={{ color: msg.factionColor || undefined }}>[F]</span>
            )}
            <span
              className="chat-message-name"
              style={isFaction ? { color: msg.factionColor || undefined } : undefined}
            >
              {msg.userName}
            </span>
            <span
              className="chat-message-content"
              style={textColor ? { color: textColor } : undefined}
            >
              {msg.content}
            </span>
            <span className="chat-message-time">{formatTime(msg.createdAt)}</span>
          </div>
        )
      })}
    </div>
  )
}

function ChatInput({ hasFaction }: { hasFaction: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const sendChannel = useChatStore((s) => s.sendChannel)
  const setSendChannel = useChatStore((s) => s.setSendChannel)
  const userFactionColor = useFogStore((s) => s.userFactionColor)

  async function handleSend() {
    const raw = text.trim()
    if (!raw || sending) return

    // Raccourcis : ! = général, @ = faction
    let channel = sendChannel
    let content = raw
    if (raw.startsWith('!') && raw.length > 1) {
      channel = 'general'
      content = raw.slice(1).trimStart()
    } else if (raw.startsWith('@') && hasFaction && raw.length > 1) {
      channel = 'faction'
      content = raw.slice(1).trimStart()
    }

    if (!content) return
    setSending(true)
    const result = await sendChatMessage(content, channel)
    if (result.success) {
      setText('')
    } else {
      console.error('[Chat] sendChatMessage error:', result.error)
    }
    setSending(false)
    // Focus après que React re-rende avec disabled=false
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-input-area">
      {/* Channel selector */}
      <div className="chat-send-channels">
        <button
          className={`chat-send-channel${sendChannel === 'general' ? ' chat-send-channel-active' : ''}`}
          onClick={() => setSendChannel('general')}
        >
          ! Général
        </button>
        {hasFaction && (
          <button
            className={`chat-send-channel${sendChannel === 'faction' ? ' chat-send-channel-active' : ''}`}
            onClick={() => setSendChannel('faction')}
            style={{ color: userFactionColor || undefined, borderColor: sendChannel === 'faction' ? userFactionColor || undefined : undefined }}
          >
            @ Faction
          </button>
        )}
      </div>

      {/* Input */}
      <div className="chat-input">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ecrire un message..."
          maxLength={500}
          disabled={sending}
          className="chat-input-field"
        />
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="chat-send-btn"
          aria-label="Envoyer"
        >
          &#10148;
        </button>
      </div>
    </div>
  )
}

// ---- Main Component ----

export function ChatPanel() {
  const userId = useFogStore((s) => s.userId)
  const userFactionId = useFogStore((s) => s.userFactionId)
  const userFactionColor = useFogStore((s) => s.userFactionColor)
  const selectedPlaceId = useMapStore((s) => s.selectedPlaceId)

  const showGeneral = useChatStore((s) => s.showGeneral)
  const showFaction = useChatStore((s) => s.showFaction)
  const generalMessages = useChatStore((s) => s.generalMessages)
  const factionMessages = useChatStore((s) => s.factionMessages)

  const [isOpen, setIsOpen] = useState(true)

  // Fusionner et trier les messages visibles
  const mergedMessages = useMemo(() => {
    const all: ChatMessage[] = []
    if (showGeneral) all.push(...generalMessages)
    if (showFaction) all.push(...factionMessages)
    return all.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [generalMessages, factionMessages, showGeneral, showFaction])

  if (!userId || selectedPlaceId) return null

  const hasFaction = !!userFactionId

  return (
    <div className={`chat-panel${isOpen ? '' : ' chat-panel-closed'}`}>
      {/* Toggle mobile */}
      <button className="chat-toggle-btn" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '\u00D7' : 'Discussion'}
      </button>

      {isOpen && (
        <>
          <ChannelFilters hasFaction={hasFaction} />
          <MessageList
            messages={mergedMessages}
            userFactionColor={userFactionColor}
          />
          <ChatInput hasFaction={hasFaction} />
        </>
      )}
    </div>
  )
}
