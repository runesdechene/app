import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface FactionStat {
  factionId: string
  title: string
  color: string
  pattern: string
  claimedCount: number
  percent: number
}

export function FactionBar() {
  const [stats, setStats] = useState<FactionStat[]>([])

  useEffect(() => {
    async function fetchStats() {
      const { data: places } = await supabase
        .from('places')
        .select('faction_id')
        .not('faction_id', 'is', null)

      if (!places) return

      const counts = new Map<string, number>()
      let claimedTotal = 0
      for (const row of places) {
        const fid = (row as { faction_id: string }).faction_id
        counts.set(fid, (counts.get(fid) ?? 0) + 1)
        claimedTotal++
      }

      if (claimedTotal === 0) return

      const { data: factions } = await supabase
        .from('factions')
        .select('id, title, color, pattern')
        .order('order')

      if (!factions) return

      const result: FactionStat[] = factions
        .map(f => {
          const claimed = counts.get(f.id) ?? 0
          return {
            factionId: f.id,
            title: f.title,
            color: f.color,
            pattern: f.pattern ?? '',
            claimedCount: claimed,
            percent: claimedTotal > 0 ? (claimed / claimedTotal) * 100 : 0,
          }
        })
        .filter(f => f.claimedCount > 0)
        .sort((a, b) => b.claimedCount - a.claimedCount)

      setStats(result)
    }

    fetchStats()
  }, [])

  if (stats.length === 0) return null

  const leaderId = stats[0].factionId

  return (
    <div className="faction-scoreboard">
      {stats.map(faction => {
        const isLeader = faction.factionId === leaderId
        const pct = Math.round(faction.percent)
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
              {isLeader && <span className="faction-scoreboard-crown">👑</span>}
              <span className="faction-scoreboard-pct">{pct}%</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
