import { useEffect, useState } from 'react'
import { useRealtimeChat } from '../../hooks/useRealtimeChat'
import { useUserProfiles } from '../../hooks/useUserProfiles'
import { useMapStore } from '../../stores/mapStore'
import { sendMissionMessage, markMissionRead } from '../../lib/missionsApi'

export function MissionSalon({ slug, intro, readOnly }: { slug: string; intro: string | null; readOnly: boolean }) {
  const { messages } = useRealtimeChat({ table: 'mission_messages', filterField: 'mission_slug', filterValue: slug })
  const profiles = useUserProfiles(messages.map((m) => m.userId))
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
        {messages.map((m) => {
          const p = profiles[m.userId]
          return (
            <div key={m.id} className="mission-salon-msg">
              <button
                className="mission-salon-av-btn"
                onClick={() => useMapStore.getState().setSelectedPlayerId(m.userId)}
                aria-label={p?.name ?? 'Joueur'}
              >
                {p?.avatar
                  ? <img className="mission-salon-av" src={p.avatar} alt="" />
                  : <span className="mission-salon-av mission-salon-av-fb">{(p?.name ?? '?').charAt(0).toUpperCase()}</span>}
              </button>
              <div className="mission-salon-msg-body">
                <span className="mission-salon-author">{p?.name ?? '…'}</span>
                <span className="mission-salon-bubble">{m.content}</span>
              </div>
            </div>
          )
        })}
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
