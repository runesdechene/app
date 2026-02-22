import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface FactionStat {
  factionId: string
  title: string
  color: string
  pattern: string
  claimedCount: number
}

export function FactionBar() {
  const [stats, setStats] = useState<FactionStat[]>([])

  useEffect(() => {
    async function fetchStats() {
      // 1. Compter les lieux par faction
      const { data: places } = await supabase
        .from('places')
        .select('faction_id')
        .not('faction_id', 'is', null)

      if (!places) return

      const counts = new Map<string, number>()
      for (const row of places) {
        const fid = (row as { faction_id: string }).faction_id
        counts.set(fid, (counts.get(fid) ?? 0) + 1)
      }

      // 2. Récupérer les factions (titre, couleur, blason)
      const { data: factions } = await supabase
        .from('factions')
        .select('id, title, color, pattern')
        .order('order')

      if (!factions) return

      const result: FactionStat[] = factions.map(f => ({
        factionId: f.id,
        title: f.title,
        color: f.color,
        pattern: f.pattern ?? '',
        claimedCount: counts.get(f.id) ?? 0,
      }))

      // Trier par nombre de lieux décroissant
      result.sort((a, b) => b.claimedCount - a.claimedCount)
      setStats(result)
    }

    fetchStats()
  }, [])

  // Ne rien afficher si aucune faction n'a de lieux
  if (stats.length === 0 || stats.every(s => s.claimedCount === 0)) return null

  const maxCount = stats[0].claimedCount

  return (
    <div className="faction-bar">
      {stats.map((faction, i) => {
        const isLeader = i === 0 && faction.claimedCount > 0 && faction.claimedCount === maxCount
        return (
          <div key={faction.factionId} className="faction-bar-item">
            {isLeader && <span className="faction-bar-crown">👑</span>}
            <span
              className="faction-bar-dot"
              style={{ backgroundColor: faction.color }}
            />
            <span className="faction-bar-count">{faction.claimedCount}</span>
            <span className="faction-bar-title">{faction.title}</span>
          </div>
        )
      })}
    </div>
  )
}
