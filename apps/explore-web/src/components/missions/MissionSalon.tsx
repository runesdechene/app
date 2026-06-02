import { useEffect, useState } from 'react'
import { useRealtimeChat } from '../../hooks/useRealtimeChat'
import { sendMissionMessage, markMissionRead } from '../../lib/missionsApi'

export function MissionSalon({ slug, intro, readOnly }: { slug: string; intro: string | null; readOnly: boolean }) {
  const { messages } = useRealtimeChat({ table: 'mission_messages', filterField: 'mission_slug', filterValue: slug })
  const [draft, setDraft] = useState('')
  useEffect(() => { markMissionRead(slug) }, [slug, messages.length])

  async function handleSend() {
    const c = draft.trim()
    if (!c) return
    setDraft('')
    const r = await sendMissionMessage(slug, c)
    if (!r.success) setDraft(c)
  }

  return (
    <div className="mission-salon">
      {intro && <div className="mission-salon-intro">📌 {intro}</div>}
      <div className="mission-salon-messages">
        {messages.map((m) => (
          <div key={m.id} className="mission-salon-msg">
            <span className="mission-salon-author">{m.userId}</span>
            <span className="mission-salon-bubble">{m.content}</span>
          </div>
        ))}
      </div>
      {!readOnly && (
        <div className="mission-salon-input">
          <input value={draft} maxLength={500} onChange={(e) => setDraft(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Écrire au salon…" />
          <button onClick={handleSend}>➤</button>
        </div>
      )}
    </div>
  )
}
