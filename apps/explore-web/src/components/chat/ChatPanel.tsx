import { useState, useEffect, useRef, useMemo } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { useFogStore } from '../../stores/fogStore'
import { useMobileNavStore } from '../../stores/mobileNavStore'
import { sendChatMessage } from '../../hooks/useChat'
import { supabase } from '../../lib/supabase'
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
  const showBugs = useChatStore((s) => s.showBugs)
  const toggleGeneral = useChatStore((s) => s.toggleShowGeneral)
  const toggleFaction = useChatStore((s) => s.toggleShowFaction)
  const toggleBugs = useChatStore((s) => s.toggleShowBugs)
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
      <label className="chat-filter chat-filter-bugs">
        <input type="checkbox" checked={showBugs} onChange={toggleBugs} />
        Bugs
      </label>
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
  const mobilePanel = useMobileNavStore(s => s.activePanel)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length, mobilePanel])

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
        const isFaction = msg.channel !== 'general' && msg.channel !== 'bugs'
        const isBugs = msg.channel === 'bugs'
        // Faction messages: texte en couleur faction. Bugs: rose. General: texte neutre.
        const textColor = isBugs
          ? '#9ea03f'
          : isFaction
            ? (msg.factionColor || userFactionColor || 'var(--color-sepia)')
            : undefined

        return (
          <div key={msg.id} className="chat-message">
            {isFaction && (
              <span className="chat-channel-tag" style={{ color: msg.factionColor || undefined }}>[F]</span>
            )}
            {isBugs && (
              <span className="chat-channel-tag chat-channel-tag-bugs">[B]</span>
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
  const [sendError, setSendError] = useState<string | null>(null)
  const sendChannel = useChatStore((s) => s.sendChannel)
  const setSendChannel = useChatStore((s) => s.setSendChannel)
  const userFactionColor = useFogStore((s) => s.userFactionColor)

  async function handleSend() {
    const raw = text.trim()
    if (!raw || sending) return

    // Cheat code: recharge toutes les ressources au max (admin only, en base)
    if (raw === '1453') {
      setText('')
      const fog = useFogStore.getState()
      if (!fog.userId) return
      const { data } = await supabase.rpc('cheat_refill', { p_user_id: fog.userId })
      if (data && data.success) {
        fog.setEnergy(data.energy)
        fog.setNextPointIn(0)
        fog.setConquestPoints(data.conquestPoints)
        fog.setConquestNextPointIn(0)
        fog.setConstructionPoints(data.constructionPoints)
        fog.setConstructionNextPointIn(0)
      }
      return
    }

    // Cheat code ciblé: 1453>NomJoueur — refill un autre joueur + message système
    if (raw.startsWith('1453>') && raw.length > 5) {
      setText('')
      const targetName = raw.slice(5).trim()
      if (!targetName) return
      const fog = useFogStore.getState()
      if (!fog.userId) return
      const { data } = await supabase.rpc('cheat_refill_target', {
        p_caller_id: fog.userId,
        p_target_name: targetName,
      })
      if (data && data.success) {
        // Message système dans le chat général
        const { error: insertErr } = await supabase.from('chat_messages').insert({
          channel: 'general',
          user_id: fog.userId,
          user_name: 'Les Dieux',
          content: `${data.targetName} a re\u00E7u un don des Dieux \u26A1 Ses ressources ont \u00E9t\u00E9 recharg\u00E9es`,
        })
        if (insertErr) console.error('[Cheat] insert chat error:', insertErr)
      } else {
        console.error('[Cheat] refill_target failed:', data)
      }
      return
    }

    // Raccourcis : ! = général, @ = faction, # = bugs
    let channel = sendChannel
    let content = raw
    if (raw.startsWith('!') && raw.length > 1) {
      channel = 'general'
      content = raw.slice(1).trimStart()
    } else if (raw.startsWith('@') && hasFaction && raw.length > 1) {
      channel = 'faction'
      content = raw.slice(1).trimStart()
    } else if (raw.startsWith('#') && raw.length > 1) {
      channel = 'bugs'
      content = raw.slice(1).trimStart()
    }

    if (!content) return
    setSending(true)
    setSendError(null)
    const result = await sendChatMessage(content, channel)
    if (result.success) {
      setText('')
    } else {
      setSendError(result.error ?? 'Erreur inconnue')
      setTimeout(() => setSendError(null), 4000)
    }
    setSending(false)
    // Focus après envoi — uniquement sur desktop (évite le clavier mobile qui clignote)
    if (window.innerWidth > 768) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
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
        <button
          className={`chat-send-channel chat-send-channel-bugs${sendChannel === 'bugs' ? ' chat-send-channel-active' : ''}`}
          onClick={() => setSendChannel('bugs')}
        >
          # Bugs
        </button>
      </div>

      {/* Erreur d'envoi */}
      {sendError && (
        <div className="chat-send-error">{sendError}</div>
      )}

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

  const showGeneral = useChatStore((s) => s.showGeneral)
  const showFaction = useChatStore((s) => s.showFaction)
  const showBugs = useChatStore((s) => s.showBugs)
  const generalMessages = useChatStore((s) => s.generalMessages)
  const factionMessages = useChatStore((s) => s.factionMessages)
  const bugsMessages = useChatStore((s) => s.bugsMessages)

  const [isOpen, setIsOpen] = useState(true)
  const mobilePanel = useMobileNavStore(s => s.activePanel)

  // Ouvrir/fermer automatiquement quand la navbar mobile toggle le chat
  useEffect(() => {
    if (mobilePanel === 'chat') setIsOpen(true)
  }, [mobilePanel])

  // Fusionner et trier les messages visibles
  const mergedMessages = useMemo(() => {
    const all: ChatMessage[] = []
    if (showGeneral) all.push(...generalMessages)
    if (showFaction) all.push(...factionMessages)
    if (showBugs) all.push(...bugsMessages)
    return all.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [generalMessages, factionMessages, bugsMessages, showGeneral, showFaction, showBugs])

  if (!userId) return null

  const hasFaction = !!userFactionId

  return (
    <div className={`chat-panel${isOpen ? '' : ' chat-panel-closed'}`}>
      <button className="chat-toggle-btn" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '\u2013' : '\uD83D\uDCAC'}
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
