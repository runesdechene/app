import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './ActivityFeed.css'

// Types narratifs présents dans activity_log (cf. migs 001, 005, 081, 094, 095…)
const NARRATIVE_TYPES = [
  'place_taken_back_gps',
  'place_taken_remote',
  'visit_gps',
  'revisit_gps',
  'contribute',
  'fragment_enigma',
] as const

interface ActivityRow {
  id: number
  type: string
  actor_id: string | null
  place_id: string | null
  data: {
    actorName?: string
    placeTitle?: string
    fragmentName?: string
  } | null
  created_at: string
}

function formatActivity(row: ActivityRow): { icon: string; text: string } {
  const actor = row.data?.actorName ?? "Quelqu'un"
  const place = row.data?.placeTitle ?? 'un lieu'
  switch (row.type) {
    case 'visit_gps':
      return { icon: '✨', text: `${actor} a découvert ${place}` }
    case 'revisit_gps':
      return { icon: '👣', text: `${actor} est repassé sur ${place}` }
    case 'place_taken_back_gps':
      return { icon: '🚩', text: `${actor} a planté son drapeau sur ${place}` }
    case 'place_taken_remote':
      return { icon: '⚜️', text: `${actor} a pris ${place} par mécénat` }
    case 'contribute':
      return { icon: '📜', text: `${actor} a contribué à ${place}` }
    case 'fragment_enigma':
      return {
        icon: '🗝️',
        text: `${actor} a résolu une énigme${row.data?.fragmentName ? ` (${row.data.fragmentName})` : ''}`,
      }
    default:
      return { icon: '·', text: `${actor} ${row.type}` }
  }
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  const d = Math.floor(h / 24)
  return `il y a ${d}j`
}

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('activity_log')
          .select('id, type, actor_id, place_id, data, created_at')
          .in('type', NARRATIVE_TYPES as unknown as string[])
          .order('created_at', { ascending: false })
          .limit(30)
        if (cancelled) return
        if (error) {
          console.warn('[ActivityFeed] activity_log query failed', error)
          return
        }
        setItems((data ?? []) as ActivityRow[])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return null
  if (items.length === 0) return null

  return (
    <section className="activity-feed">
      <h2 className="activity-feed-title">Activités</h2>
      <ul className="activity-feed-list">
        {items.map((row) => {
          const { icon, text } = formatActivity(row)
          return (
            <li key={row.id} className="activity-feed-item">
              <span className="activity-feed-icon" aria-hidden>{icon}</span>
              <div className="activity-feed-body">
                <div className="activity-feed-text">{text}</div>
                <div className="activity-feed-time">{formatRelativeTime(row.created_at)}</div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
