import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMapStore } from '../../stores/mapStore'

interface FactionNotoriety {
  factionId: string
  title: string
  color: string
  pattern: string
  notoriety: number
  percent: number
}

export function FactionBar() {
  const [stats, setStats] = useState<FactionNotoriety[]>([])
  const placeOverrides = useMapStore(s => s.placeOverrides)

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
      }>)
        .map(f => ({
          factionId: f.factionId,
          title: f.title,
          color: f.color,
          pattern: f.pattern ?? '',
          notoriety: f.notoriety,
          percent: totalNotoriety > 0 ? (f.notoriety / totalNotoriety) * 100 : 0,
        }))
        .filter(f => f.notoriety > 0)
        .sort((a, b) => b.notoriety - a.notoriety)

      setStats(result)
    }

    fetchNotoriety()
  }, [placeOverrides])

  if (stats.length === 0) return null

  const leaderId = stats[0].factionId

  return (
    <div className="faction-scoreboard">
      {stats.map(faction => {
        const isLeader = faction.factionId === leaderId
        return (
          <div
            key={faction.factionId}
            className={`faction-scoreboard-row${isLeader ? ' faction-scoreboard-leader' : ''}`}
            style={{ '--faction-color': faction.color } as React.CSSProperties}
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
              <span className="faction-scoreboard-pct">{faction.notoriety}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
