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
    async function fetchGlory() {
      // Récupérer la Gloire totale par Héritage (somme de notoriety_points des membres)
      const [notorietyRes, factionsRes] = await Promise.all([
        supabase.rpc('get_faction_notoriety'),
        supabase.from('factions').select('id, title, color, pattern'),
      ])

      if (!notorietyRes.data || !factionsRes.data) return

      // Calculer la Gloire totale par faction depuis les users
      const { data: gloryData } = await supabase
        .from('users')
        .select('faction_id, notoriety_points')
        .not('faction_id', 'is', null)

      const gloryByFaction: Record<string, number> = {}
      const countByFaction: Record<string, number> = {}
      if (gloryData) {
        for (const u of gloryData as Array<{ faction_id: string; notoriety_points: number }>) {
          gloryByFaction[u.faction_id] = (gloryByFaction[u.faction_id] || 0) + (u.notoriety_points || 0)
          countByFaction[u.faction_id] = (countByFaction[u.faction_id] || 0) + 1
        }
      }

      // Données de notoriété pour les lieux et hourlyRate
      const notoMap = new Map<string, { placesCount: number; hourlyRate: number; isUnderdog: boolean }>()
      for (const f of notorietyRes.data as Array<{ factionId: string; placesCount: number; hourlyRate: number; isUnderdog: boolean }>) {
        notoMap.set(f.factionId, { placesCount: f.placesCount ?? 0, hourlyRate: f.hourlyRate ?? 0, isUnderdog: f.isUnderdog ?? false })
      }

      const totalGlory = Object.values(gloryByFaction).reduce((sum, v) => sum + v, 0)

      const result: FactionNotoriety[] = (factionsRes.data as Array<{ id: string; title: string; color: string; pattern: string | null }>)
        .map(f => {
          const glory = gloryByFaction[f.id] || 0
          const noto = notoMap.get(f.id)
          return {
            factionId: f.id,
            title: f.title,
            color: f.color,
            pattern: f.pattern ?? '',
            notoriety: glory,
            hourlyRate: noto?.hourlyRate ?? 0,
            placesCount: noto?.placesCount ?? 0,
            percent: totalGlory > 0 ? (glory / totalGlory) * 100 : 0,
            isUnderdog: noto?.isUnderdog ?? false,
          }
        })
        .filter(f => f.notoriety > 0 || f.placesCount > 0)
        .sort((a, b) => b.notoriety - a.notoriety)

      setStats(result)
    }

    fetchGlory()
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
              <span className="faction-scoreboard-pct">{faction.notoriety} {'\uD83C\uDF96\uFE0F'}</span>
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
