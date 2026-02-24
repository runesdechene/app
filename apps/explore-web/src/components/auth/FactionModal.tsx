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
}

interface FactionModalProps {
  onClose: () => void
  currentFactionId: string | null
}

export function FactionModal({ onClose, currentFactionId }: FactionModalProps) {
  const [factions, setFactions] = useState<FactionData[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState(false)

  const userId = useFogStore(s => s.userId)
  const setUserFactionId = useFogStore(s => s.setUserFactionId)
  const setUserFactionColor = useFogStore(s => s.setUserFactionColor)
  const setDiscoveredIds = useFogStore(s => s.setDiscoveredIds)

  useEffect(() => {
    supabase
      .from('factions')
      .select('id, title, color, pattern, description, image_url')
      .order('order')
      .then(({ data }) => {
        if (data) setFactions(data as FactionData[])
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
                    {f.description && (
                      <div className="faction-card-desc" dangerouslySetInnerHTML={{ __html: f.description }} />
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
