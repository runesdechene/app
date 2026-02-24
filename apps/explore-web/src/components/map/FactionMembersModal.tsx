import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMapStore } from '../../stores/mapStore'

interface FactionMember {
  userId: string
  name: string
  profileImage: string | null
  notorietyPoints: number
  displayedGeneralTitles: Array<{ id: number; name: string; icon: string }> | null
  factionTitle2: { id: number; name: string; icon: string } | null
}

interface Props {
  factionId: string
  factionTitle: string
  factionColor: string
  onClose: () => void
}

export function FactionMembersModal({ factionId, factionTitle, factionColor, onClose }: Props) {
  const [members, setMembers] = useState<FactionMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc('get_faction_members', { p_faction_id: factionId })
      if (data && Array.isArray(data)) {
        setMembers(data as FactionMember[])
      }
      setLoading(false)
    }
    load()
  }, [factionId])

  function handleMemberClick(playerId: string) {
    onClose()
    useMapStore.getState().setSelectedPlayerId(playerId)
  }

  return (
    <div className="player-modal-overlay" onClick={onClose}>
      <div className="faction-members-modal" onClick={e => e.stopPropagation()}>
        <button className="player-modal-close" onClick={onClose} aria-label="Fermer">
          &#10005;
        </button>

        <h2 className="faction-members-title" style={{ color: factionColor }}>
          {factionTitle}
        </h2>

        {loading && <div className="player-modal-loading">Chargement...</div>}

        {!loading && members.length === 0 && (
          <div className="player-modal-loading">Aucun membre</div>
        )}

        {!loading && members.length > 0 && (
          <div className="faction-members-list">
            {members.map((m, i) => (
              <div
                key={m.userId}
                className="faction-member-row"
                onClick={() => handleMemberClick(m.userId)}
              >
                <span className="faction-member-rank">#{i + 1}</span>
                {m.profileImage ? (
                  <img src={m.profileImage} alt="" className="faction-member-avatar" />
                ) : (
                  <div
                    className="faction-member-avatar-fallback"
                    style={{ background: factionColor }}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="faction-member-info">
                  <span className="faction-member-name">{m.name}</span>
                  {((m.displayedGeneralTitles && m.displayedGeneralTitles.length > 0) || m.factionTitle2) && (
                    <div className="faction-member-titles">
                      {m.displayedGeneralTitles?.map(t => (
                        <span key={t.id} className="title-badge title-badge-general">
                          {t.icon} {t.name}
                        </span>
                      ))}
                      {m.factionTitle2 && (
                        <span className="title-badge title-badge-faction">
                          {m.factionTitle2.icon} {m.factionTitle2.name}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className="faction-member-notoriety">{m.notorietyPoints}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
