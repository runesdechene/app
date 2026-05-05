import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { usePlayerStore } from '../../../stores/playerStore'
import { useMapStore } from '../../../stores/mapStore'
import './LeaderboardModal.css'

// V0.7 phase 3.5 — Onglets simplifiés. Retiré : 'exploration', 'erudition'
// (anciens compteurs abstraits, plus utilisés depuis la refonte Gloire) +
// 'explored' (qui buggait sur une table inexistante).
// Ajouté : 'planted' (étendards plantés via veille_history).
type LeaderboardTab = 'notoriety' | 'veilled' | 'authored'

interface LeaderboardEntry {
  rank: number
  userId: string
  name: string
  profileImage: string | null
  factionColor: string | null
  value: number
}

interface Props {
  onClose: () => void
}

const TAB_LABELS: Record<LeaderboardTab, string> = {
  notoriety: 'Gloire',
  veilled:   'Lieux revendiqués',
  authored:  'Lieux ajoutés',
}

const TAB_ICONS: Record<LeaderboardTab, string> = {
  notoriety: '🎖️',
  veilled:   '🚩',
  authored:  '🏛️',
}

export function LeaderboardModal({ onClose }: Props) {
  const [tab, setTab] = useState<LeaderboardTab>('notoriety')
  const [loading, setLoading] = useState(true)
  const cache = useRef<Partial<Record<LeaderboardTab, LeaderboardEntry[]>>>({})
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const currentUserId = usePlayerStore(s => s.userId)

  useEffect(() => {
    async function load() {
      if (cache.current[tab]) {
        setEntries(cache.current[tab]!)
        setLoading(false)
        return
      }
      setLoading(true)
      // p_limit élevé : on remonte tous les joueurs avec ≥ 1 point.
      // 500 couvre largement l'alpha, on bascule en pagination si on dépasse un jour.
      const { data } = await supabase.rpc('get_leaderboard', { p_type: tab, p_limit: 500 })
      const rows = (data && Array.isArray(data) ? data : []) as LeaderboardEntry[]
      cache.current[tab] = rows
      setEntries(rows)
      setLoading(false)
    }
    load()
  }, [tab])

  function handlePlayerClick(playerId: string) {
    onClose()
    useMapStore.getState().setSelectedPlayerId(playerId)
  }

  return (
    <div className="leaderboard-overlay" onClick={onClose}>
      <div className="leaderboard-modal" onClick={e => e.stopPropagation()}>
        <button className="player-modal-close" onClick={onClose} aria-label="Fermer">
          &#10005;
        </button>

        <h2 className="leaderboard-title">{'Classement'}</h2>

        <div className="leaderboard-tabs">
          {(['notoriety', 'veilled', 'authored'] as LeaderboardTab[]).map(t => (
            <button
              key={t}
              className={`leaderboard-tab${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {loading && <div className="player-modal-loading">{'Chargement...'}</div>}

        {!loading && entries.length === 0 && (
          <div className="player-modal-loading">{'Aucun joueur'}</div>
        )}

        {!loading && entries.length > 0 && (
          <div className="leaderboard-list">
            {entries.map(e => (
              <div
                key={e.userId}
                className={`leaderboard-row${e.userId === currentUserId ? ' self' : ''}`}
                onClick={() => handlePlayerClick(e.userId)}
              >
                <span className="leaderboard-rank">#{e.rank}</span>
                {e.profileImage ? (
                  <img
                    src={e.profileImage}
                    alt=""
                    className="leaderboard-avatar"
                    style={{ borderColor: e.factionColor ?? '#8A7B6A' }}
                  />
                ) : (
                  <div
                    className="leaderboard-avatar-fallback"
                    style={{ background: e.factionColor ?? '#8A7B6A' }}
                  >
                    {e.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="leaderboard-name">{e.name}</span>
                <span className="leaderboard-value">
                  {TAB_ICONS[tab]} {e.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
