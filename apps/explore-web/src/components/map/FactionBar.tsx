import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMapStore } from '../../stores/mapStore'
import { usePlayerStore } from '../../stores/playerStore'
import { FactionMembersModal } from './FactionMembersModal'
import './FactionBar.css'

interface FactionNotoriety {
  factionId: string
  title: string
  color: string
  pattern: string
  notoriety: number
  hourlyRate: number
  placesCount: number
  percent: number
  isUnderdog: boolean
}

export function FactionBar() {
  const [stats, setStats] = useState<FactionNotoriety[]>([])
  const [selectedFaction, setSelectedFaction] = useState<FactionNotoriety | null>(null)
  const placeOverrides = useMapStore(s => s.placeOverrides)
  const userFactionId = usePlayerStore(s => s.userFactionId)

  useEffect(() => {
    async function fetchInfluence() {
      // Score = placed_points uniquement (influence active, decay naturel)
      const [influenceRes, factionsRes] = await Promise.all([
        supabase
          .from('place_influence')
          .select('faction_id, placed_points'),
        supabase.from('factions').select('id, title, color, pattern').order('order'),
      ])

      if (!factionsRes.data) return

      // Aggregate placed influence per faction
      const influenceByFaction: Record<string, number> = {}
      if (influenceRes.data) {
        for (const row of influenceRes.data as Array<{ faction_id: string; placed_points: number }>) {
          influenceByFaction[row.faction_id] = (influenceByFaction[row.faction_id] || 0) + row.placed_points
        }
      }

      const totalInfluence = Object.values(influenceByFaction).reduce((sum, v) => sum + v, 0)

      const result: FactionNotoriety[] = (factionsRes.data as Array<{ id: string; title: string; color: string; pattern: string | null }>)
        .map(f => {
          const influence = influenceByFaction[f.id] || 0
          return {
            factionId: f.id,
            title: f.title,
            color: f.color,
            pattern: f.pattern ?? '',
            notoriety: influence,
            hourlyRate: 0,
            placesCount: 0,
            percent: totalInfluence > 0 ? (influence / totalInfluence) * 100 : 0,
            isUnderdog: false,
          }
        })
        .filter(f => f.notoriety > 0)
        .sort((a, b) => b.notoriety - a.notoriety)

      setStats(result)
    }

    fetchInfluence()
  }, [placeOverrides])

  if (stats.length === 0) return null

  const leaderId = stats[0].factionId

  return (
    <div className="faction-scoreboard">
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
              <span className="faction-scoreboard-name" style={{ flex: 1 }}>
                {faction.title}
                {isLeader && <span className="faction-scoreboard-crown"> {'\uD83D\uDC51'}</span>}
                {faction.isUnderdog && <span className="faction-scoreboard-underdog" title="Baroud d'Honneur — x2 regen"> {'\uD83D\uDC80'}</span>}
              </span>
              <span className="faction-scoreboard-pct">{faction.notoriety} {'\uD83C\uDF1F'}</span>
            </div>
          </div>
        )
      })}

      <div className="faction-scoreboard-live">
        <span className="faction-scoreboard-live-dot" />
        Influence active
      </div>

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
