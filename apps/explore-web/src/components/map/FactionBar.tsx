import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMapStore } from '../../stores/mapStore'
import { useFogStore } from '../../stores/fogStore'
import { FactionMembersModal } from './FactionMembersModal'

interface FactionNotoriety {
  factionId: string
  title: string
  color: string
  pattern: string
  notoriety: number
  hourlyRate: number
  placesCount: number
  percent: number
}

export function FactionBar() {
  const [stats, setStats] = useState<FactionNotoriety[]>([])
  const [selectedFaction, setSelectedFaction] = useState<FactionNotoriety | null>(null)
  const placeOverrides = useMapStore(s => s.placeOverrides)
  const userFactionId = useFogStore(s => s.userFactionId)
  const showFactions = useMapStore(s => s.showFactions)
  const setShowFactions = useMapStore(s => s.setShowFactions)

  useEffect(() => {
    async function fetchNotoriety() {
      const { data } = await supabase.rpc('get_faction_notoriety')
      if (!data || !Array.isArray(data)) return

      const totalNotoriety = (data as Array<{ notoriety: number }>)
        .reduce((sum, f) => sum + f.notoriety, 0)

      const result: FactionNotoriety[] = (data as Array<{
        factionId: string
        title: string
        color: string
        pattern: string
        notoriety: number
        hourlyRate: number
        placesCount: number
      }>)
        .map(f => ({
          factionId: f.factionId,
          title: f.title,
          color: f.color,
          pattern: f.pattern ?? '',
          notoriety: f.notoriety,
          hourlyRate: f.hourlyRate ?? 0,
          placesCount: f.placesCount ?? 0,
          percent: totalNotoriety > 0 ? (f.notoriety / totalNotoriety) * 100 : 0,
        }))
        .filter(f => f.notoriety > 0 || f.placesCount > 0)
        .sort((a, b) => b.notoriety - a.notoriety)

      setStats(result)
    }

    fetchNotoriety()
  }, [placeOverrides])

  if (stats.length === 0) return null

  const leaderId = stats[0].factionId

  return (
    <div className="faction-scoreboard">
      <label className="faction-toggle">
        <input
          type="checkbox"
          checked={showFactions}
          onChange={(e) => setShowFactions(e.target.checked)}
        />
        <span className="faction-toggle-label">Territoires</span>
      </label>
      {stats.map(faction => {
        const isLeader = faction.factionId === leaderId
        const isMine = faction.factionId === userFactionId
        return (
          <div
            key={faction.factionId}
            className={`faction-scoreboard-row${isMine ? ' faction-scoreboard-mine' : ''}`}
            style={{ '--faction-color': faction.color } as React.CSSProperties}
            onClick={() => setSelectedFaction(faction)}
          >
            <span className="faction-scoreboard-bar" style={{ width: `${faction.percent}%` }} />
            <div className="faction-scoreboard-content">
              <span className="faction-scoreboard-dot">
                {faction.pattern && (
                  <img src={faction.pattern} alt="" className="faction-scoreboard-icon" />
                )}
              </span>
              <span className="faction-scoreboard-name">{faction.title}</span>
              {isLeader && <span className="faction-scoreboard-crown">{'\uD83D\uDC51'}</span>}
              <span className="faction-scoreboard-places">{faction.placesCount}</span>
              <span className="faction-scoreboard-pct">{faction.notoriety}</span>
              {faction.hourlyRate > 0 && (
                <span className="faction-scoreboard-rate">+{faction.hourlyRate % 1 === 0 ? faction.hourlyRate : faction.hourlyRate.toFixed(1)}/h</span>
              )}
            </div>
          </div>
        )
      })}

      {selectedFaction && (
        <FactionMembersModal
          factionId={selectedFaction.factionId}
          factionTitle={selectedFaction.title}
          factionColor={selectedFaction.color}
          onClose={() => setSelectedFaction(null)}
        />
      )}
    </div>
  )
}
