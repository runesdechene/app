// src/components/demo/DemoLiveProof.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatRelativeTime } from '../../lib/dateFormat'
import './DemoLiveProof.css'

interface Stats {
  total_places: number
  total_users: number
}

interface Activity {
  place_title: string
  discovered_at: string
}

const ROTATE_MS = 6000
const ACTIVITY_LIMIT = 15

/**
 * Bandeau « preuve vivante » de l'écran d'intro borne : compteurs réels de la
 * carte + dernières découvertes de la communauté, qui défilent. Rend la
 * communauté visible au lieu de l'affirmer.
 *
 * Réutilise les deux RPC anon de la landing publique (`get_landing_stats`,
 * `get_landing_activity`) — aucune écriture, invariant démo préservé.
 *
 * Contrat d'échec : le réseau du stand est incertain. Si les deux requêtes
 * échouent ou reviennent vides, le composant rend `null` et l'écran d'intro
 * reste complet et cohérent sans lui.
 */
export function DemoLiveProof() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [statsRes, activityRes] = await Promise.all([
        supabase.rpc('get_landing_stats'),
        supabase.rpc('get_landing_activity', { limit_count: ACTIVITY_LIMIT }),
      ])
      if (cancelled) return
      const row = statsRes.data?.[0] as Stats | undefined
      if (row) setStats(row)
      if (activityRes.data) setActivities(activityRes.data as Activity[])
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (activities.length < 2) return
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % activities.length)
    }, ROTATE_MS)
    return () => window.clearInterval(t)
  }, [activities.length])

  if (!stats && activities.length === 0) return null

  const current = activities[index]

  return (
    <div className="demo-proof">
      {stats && (
        <p className="demo-proof-stats">
          <strong>{stats.total_places.toLocaleString('fr-FR')}</strong> lieux d'Histoire
          <span className="demo-proof-sep" aria-hidden="true">·</span>
          <strong>{stats.total_users.toLocaleString('fr-FR')}</strong> Compagnons
        </p>
      )}
      {current && (
        <p className="demo-proof-toast" key={index}>
          <span className="demo-proof-pin" aria-hidden="true">📍</span>
          <span>
            Un Compagnon vient de découvrir <b>{current.place_title}</b>
            <span className="demo-proof-meta"> · {formatRelativeTime(current.discovered_at)}</span>
          </span>
        </p>
      )}
    </div>
  )
}
