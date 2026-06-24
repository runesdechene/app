import { useState, useEffect, useRef, useMemo } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useMapStore } from '../../stores/mapStore'
import { useMobileNavStore } from '../../stores/mobileNavStore'
import { useFactionGroupStore, type MyFaction } from '../../stores/factionGroupStore'
import { sendChatMessage } from '../../hooks/useChat'
import { supabase } from '../../lib/supabase'
import type { ChatMessage } from '../../stores/chatStore'
import './ChatPanel.css'

// ---- Helpers ----

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// ---- Sub-components ----

function ChannelFilters({ companies }: { companies: MyFaction[] }) {
  const showGeneral = useChatStore((s) => s.showGeneral)
  const showBugs = useChatStore((s) => s.showBugs)
  const showCompany = useChatStore((s) => s.showCompany)
  const toggleGeneral = useChatStore((s) => s.toggleShowGeneral)
  const toggleBugs = useChatStore((s) => s.toggleShowBugs)
  const toggleCompany = useChatStore((s) => s.toggleShowCompany)

  return (
    <div className="chat-filters">
      <label className="chat-filter">
        <input type="checkbox" checked={showGeneral} onChange={toggleGeneral} />
        Général
      </label>
      {companies.map((c) => (
        <label key={c.id} className="chat-filter chat-filter-faction" style={{ color: c.color }}>
          <input
            type="checkbox"
            checked={showCompany[c.id] !== false}
            onChange={() => toggleCompany(c.id)}
            style={{ accentColor: c.color }}
          />
          {c.name}
        </label>
      ))}
      <label className="chat-filter chat-filter-bugs">
        <input type="checkbox" checked={showBugs} onChange={toggleBugs} />
        Bugs
      </label>
    </div>
  )
}

function MessageList({ messages, companies }: { messages: ChatMessage[]; companies: MyFaction[] }) {
  const listRef = useRef<HTMLDivElement>(null)
  const mobilePanel = useMobileNavStore(s => s.activePanel)
  const companyIds = useMemo(() => new Set(companies.map(c => c.id)), [companies])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length, mobilePanel])

  if (messages.length === 0) {
    return <div className="chat-messages chat-empty">Aucun message. Soyez le premier !</div>
  }

  return (
    <div className="chat-messages" ref={listRef}>
      {messages.map((msg) => {
        const isBugs = msg.channel === 'bugs'
        const isCompany = msg.channel !== 'general' && !isBugs
        const textColor = isBugs ? '#9ea03f' : isCompany ? (msg.factionColor || 'var(--color-sepia)') : undefined
        return (
          <div key={msg.id} className="chat-message">
            {isCompany && (
              <span className="chat-channel-tag" style={{ color: msg.factionColor || undefined }}>
                {companyIds.has(msg.channel) ? '[C]' : '[C]'}
              </span>
            )}
            {isBugs && <span className="chat-channel-tag chat-channel-tag-bugs">[B]</span>}
            <span
              className="chat-message-name"
              style={{ cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: '2px', ...(isCompany ? { color: msg.factionColor || undefined } : undefined) }}
              onClick={() => useMapStore.getState().setSelectedPlayerId(msg.userId)}
            >
              {msg.userName}
            </span>
            <span className="chat-message-content" style={textColor ? { color: textColor } : undefined}>
              {msg.content}
            </span>
            <span className="chat-message-time">{formatTime(msg.createdAt)}</span>
          </div>
        )
      })}
    </div>
  )
}

function ChatInput({ companies }: { companies: MyFaction[] }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const sendChannel = useChatStore((s) => s.sendChannel)
  const setSendChannel = useChatStore((s) => s.setSendChannel)

  // Si le canal d'envoi pointe une Compagnie qu'on a quittée, retomber sur Général.
  useEffect(() => {
    if (sendChannel !== 'general' && sendChannel !== 'bugs' && !companies.some(c => c.id === sendChannel)) {
      setSendChannel('general')
    }
  }, [companies, sendChannel, setSendChannel])

  async function handleSend() {
    const raw = text.trim()
    if (!raw || sending) return

    // Cheat code refill (admin)
    if (raw === '1453') {
      setText('')
      const fog = usePlayerStore.getState()
      if (!fog.userId) return
      const { data } = await supabase.rpc('cheat_refill', { p_user_id: fog.userId })
      if (data && data.success) { fog.setEnergy(data.energy); fog.setNextPointIn(0) }
      return
    }
    if (raw.startsWith('1453>') && raw.length > 5) {
      setText('')
      const targetName = raw.slice(5).trim()
      if (!targetName) return
      const fog = usePlayerStore.getState()
      if (!fog.userId) return
      const { data } = await supabase.rpc('cheat_refill_target', { p_caller_id: fog.userId, p_target_name: targetName })
      if (data && data.success) {
        await supabase.from('chat_messages').insert({
          channel: 'general', user_id: fog.userId, user_name: 'Les Dieux',
          content: `${data.targetName} a reçu un don des Dieux ⚡ Ses ressources ont été rechargées`,
        })
      }
      return
    }

    // Raccourcis : ! = général, # = bugs
    let channel = sendChannel
    let content = raw
    if (raw.startsWith('!') && raw.length > 1) { channel = 'general'; content = raw.slice(1).trimStart() }
    else if (raw.startsWith('#') && raw.length > 1) { channel = 'bugs'; content = raw.slice(1).trimStart() }

    if (!content) return
    setSending(true)
    setSendError(null)
    const result = await sendChatMessage(content, channel)
    if (result.success) setText('')
    else { setSendError(result.error ?? 'Erreur inconnue'); setTimeout(() => setSendError(null), 4000) }
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="chat-input-area">
      <div className="chat-send-channels">
        <button
          className={`chat-send-channel${sendChannel === 'general' ? ' chat-send-channel-active' : ''}`}
          onClick={() => setSendChannel('general')}
        >! Général</button>
        {companies.map((c) => (
          <button
            key={c.id}
            className={`chat-send-channel${sendChannel === c.id ? ' chat-send-channel-active' : ''}`}
            onClick={() => setSendChannel(c.id)}
            style={{ color: c.color, borderColor: sendChannel === c.id ? c.color : undefined }}
          >{c.name}</button>
        ))}
        <button
          className={`chat-send-channel chat-send-channel-bugs${sendChannel === 'bugs' ? ' chat-send-channel-active' : ''}`}
          onClick={() => setSendChannel('bugs')}
        ># Bugs</button>
      </div>

      {sendError && <div className="chat-send-error">{sendError}</div>}

      <div className="chat-input">
        <input
          ref={inputRef} type="text" value={text}
          onChange={(e) => setText(e.target.value)} onKeyDown={handleKeyDown}
          placeholder="Ecrire un message..." maxLength={500} readOnly={sending}
          className="chat-input-field"
        />
        <button
          onMouseDown={(e) => e.preventDefault()} onClick={handleSend}
          disabled={sending || !text.trim()} className="chat-send-btn" aria-label="Envoyer"
        >&#10148;</button>
      </div>
    </div>
  )
}

// ---- Main Component ----

export function ChatPanel() {
  const userId = usePlayerStore((s) => s.userId)
  const companies = useFactionGroupStore((s) => s.myFactions)

  const showGeneral = useChatStore((s) => s.showGeneral)
  const showBugs = useChatStore((s) => s.showBugs)
  const showCompany = useChatStore((s) => s.showCompany)
  const generalMessages = useChatStore((s) => s.generalMessages)
  const bugsMessages = useChatStore((s) => s.bugsMessages)
  const companyMessages = useChatStore((s) => s.companyMessages)

  const [isOpen, setIsOpen] = useState(true)
  const mobilePanel = useMobileNavStore(s => s.activePanel)

  useEffect(() => { if (mobilePanel === 'chat') setIsOpen(true) }, [mobilePanel])

  const mergedMessages = useMemo(() => {
    const all: ChatMessage[] = []
    if (showGeneral) all.push(...generalMessages)
    if (showBugs) all.push(...bugsMessages)
    for (const c of companies) {
      if (showCompany[c.id] !== false) all.push(...(companyMessages[c.id] ?? []))
    }
    return all.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [generalMessages, bugsMessages, companyMessages, companies, showGeneral, showBugs, showCompany])

  if (!userId) return null

  return (
    <div className={`chat-panel${isOpen ? '' : ' chat-panel-closed'}`}>
      <button className="chat-toggle-btn" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '–' : '💬'}
      </button>

      {isOpen && (
        <>
          <ChannelFilters companies={companies} />
          <MessageList messages={mergedMessages} companies={companies} />
          <ChatInput companies={companies} />
        </>
      )}
    </div>
  )
}
