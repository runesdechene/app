import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useFogStore } from '../../stores/fogStore'

interface FactionData {
  id: string
  title: string
  color: string
  pattern: string | null
  description: string | null
  image_url: string | null
  bonus_energy: number
  bonus_conquest: number
  bonus_construction: number
}

interface FactionModalProps {
  onClose: () => void
  currentFactionId: string | null
}

export function FactionModal({ onClose, currentFactionId }: FactionModalProps) {
  const [factions, setFactions] = useState<FactionData[]>([])
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState(false)

  const userId = useFogStore(s => s.userId)
  const setUserFactionId = useFogStore(s => s.setUserFactionId)
  const setUserFactionColor = useFogStore(s => s.setUserFactionColor)
  const setDiscoveredIds = useFogStore(s => s.setDiscoveredIds)

  useEffect(() => {
    Promise.all([
      supabase
        .from('factions')
        .select('id, title, color, pattern, description, image_url, bonus_energy, bonus_conquest, bonus_construction')
        .order('order'),
      supabase
        .from('users')
        .select('faction_id')
        .not('faction_id', 'is', null),
    ]).then(([factionsRes, usersRes]) => {
      if (factionsRes.data) setFactions(factionsRes.data as FactionData[])
      if (usersRes.data) {
        const counts: Record<string, number> = {}
        for (const u of usersRes.data) {
          const fid = u.faction_id as string
          counts[fid] = (counts[fid] ?? 0) + 1
        }
        setMemberCounts(counts)
      }
      setLoading(false)
    })
  }, [])

  /** Recharger les discoveredIds après changement de faction (la RPC solidifie côté DB) */
  async function reloadDiscoveries() {
    if (!userId) return
    const { data } = await supabase.rpc('get_user_discoveries', { p_user_id: userId })
    if (data) setDiscoveredIds(data as string[])
  }

  async function selectFaction(factionId: string) {
    if (!userId || selecting) return
    setSelecting(true)

    await supabase.rpc('set_user_faction', {
      p_user_id: userId,
      p_faction_id: factionId,
    })

    const faction = factions.find(f => f.id === factionId)
    setUserFactionId(factionId)
    setUserFactionColor(faction?.color ?? null)
    await reloadDiscoveries()

    setSelecting(false)
    onClose()
  }

  async function leaveFaction() {
    if (!userId || selecting) return
    setSelecting(true)

    await supabase.rpc('set_user_faction', {
      p_user_id: userId,
      p_faction_id: null,
    })

    setUserFactionId(null)
    setUserFactionColor(null)
    await reloadDiscoveries()

    setSelecting(false)
    onClose()
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="faction-modal" onClick={e => e.stopPropagation()}>
        <button className="auth-modal-close" onClick={onClose} aria-label="Fermer">
          &#10005;
        </button>

        <h2 className="faction-modal-title">Choisissez votre Faction</h2>
        <p className="faction-modal-subtitle">
          Rejoignez une faction pour revendiquer des lieux et étendre votre influence.
        </p>

        {loading ? (
          <p className="faction-modal-loading">Chargement...</p>
        ) : (
          <div className="faction-modal-grid">
            {factions.map(f => {
              const isActive = currentFactionId === f.id
              return (
                <button
                  key={f.id}
                  className={`faction-card${isActive ? ' active' : ''}`}
                  style={{ '--faction-color': f.color } as React.CSSProperties}
                  onClick={() => selectFaction(f.id)}
                  disabled={selecting}
                >
                  {f.image_url ? (
                    <img src={f.image_url} alt={f.title} className="faction-card-img" />
                  ) : (
                    <div className="faction-card-placeholder" style={{ backgroundColor: f.color }} />
                  )}
                  <div className="faction-card-body">
                    <span className="faction-card-name">{f.title}</span>
                    <span className="faction-card-members">
                      {memberCounts[f.id] ?? 0} membre{(memberCounts[f.id] ?? 0) !== 1 ? 's' : ''}
                    </span>
                    {f.description && (
                      <div className="faction-card-desc" dangerouslySetInnerHTML={{ __html: f.description.replace(/\n/g, '<br>') }} />
                    )}
                    {(f.bonus_energy > 0 || f.bonus_conquest > 0 || f.bonus_construction > 0) && (
                      <div className="faction-card-bonuses">
                        {f.bonus_energy > 0 && <span className="faction-bonus-tag">+{f.bonus_energy} Energie</span>}
                        {f.bonus_conquest > 0 && <span className="faction-bonus-tag">+{f.bonus_conquest} Conquete</span>}
                        {f.bonus_construction > 0 && <span className="faction-bonus-tag">+{f.bonus_construction} Construction</span>}
                      </div>
                    )}
                    {isActive && (
                      <span className="faction-card-badge">Actuelle</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {currentFactionId && (
          <button
            className="faction-modal-leave"
            onClick={leaveFaction}
            disabled={selecting}
          >
            Quitter ma faction
          </button>
        )}
      </div>
    </div>
  )
}
