import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import './LandingActivityFeed.css'

interface Stats {
  total_places: number
  total_users: number
}

interface Activity {
  place_title: string
  discovered_at: string
}

interface LandingActivityFeedProps {
  onToastClick?: () => void
}

export default function LandingActivityFeed({ onToastClick }: LandingActivityFeedProps) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [statsRes, activityRes] = await Promise.all([
        supabase.rpc('get_landing_stats'),
        supabase.rpc('get_landing_activity', { limit_count: 15 }),
      ])
      if (cancelled) return
      const statRow = statsRes.data?.[0] as Stats | undefined
      if (statRow) setStats(statRow)
      if (activityRes.data) setActivities(activityRes.data as Activity[])
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (activities.length < 2) return
    const t = setInterval(() => {
      setCurrentIndex(i => (i + 1) % activities.length)
    }, 6000)
    return () => clearInterval(t)
  }, [activities.length])

  if (!stats && activities.length === 0) return null

  const current = activities[currentIndex]

  return (
    <div className="landing-activity">
      {stats && (
        <div className="landing-activity__stats">
          <span className="landing-activity__stat">
            <strong>{stats.total_places.toLocaleString('fr-FR')}</strong> lieux d'Histoire
          </span>
          <span className="landing-activity__stat-sep" aria-hidden="true">·</span>
          <span className="landing-activity__stat">
            <strong>{stats.total_users.toLocaleString('fr-FR')}</strong> Compagnons
          </span>
        </div>
      )}
      {current && (
        <button
          key={currentIndex}
          type="button"
          className="landing-activity__toast"
          onClick={onToastClick}
          aria-label="Entrer sur la carte"
        >
          <span className="landing-activity__toast-pin" aria-hidden="true">📍</span>
          <span className="landing-activity__toast-text">
            Un Compagnon vient de découvrir <strong>{current.place_title}</strong>
            <span className="landing-activity__toast-meta"> · {formatAgo(current.discovered_at)}</span>
          </span>
        </button>
      )}
    </div>
  )
}

function formatAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'à l\'instant'
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  return `il y a ${d} j`
}
