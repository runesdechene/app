import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Stats {
  totalUsers: number
  ambassadors: number
  photosPending: number
  photosApproved: number
}

interface GrowthStats {
  newToday: number
  reactivatedToday: number
  new7d: number
  reactivated7d: number
  new30d: number
  reactivated30d: number
}

function isoDate(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString()
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    ambassadors: 0,
    photosPending: 0,
    photosApproved: 0
  })
  const [growth, setGrowth] = useState<GrowthStats>({
    newToday: 0, reactivatedToday: 0,
    new7d: 0, reactivated7d: 0,
    new30d: 0, reactivated30d: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        // Stats de base
        const [usersRes, ambassadorsRes, pendingRes, approvedRes] = await Promise.all([
          supabase.from('users').select('*', { count: 'exact', head: true }),
          supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'ambassador'),
          supabase.from('hub_photo_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('hub_photo_submissions').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        ])

        setStats({
          totalUsers: usersRes.count || 0,
          ambassadors: ambassadorsRes.count || 0,
          photosPending: pendingRes.count || 0,
          photosApproved: approvedRes.count || 0
        })

        // Stats de croissance
        // Nouveau = created_at récent (le compte n'existait pas avant)
        // Réactivé = last_login_at récent MAIS created_at ancien (> 30 jours)
        const now = new Date()
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        const ago7d = isoDate(7)
        const ago30d = isoDate(30)
        const oldThreshold = isoDate(30) // un compte est "ancien" s'il a été créé il y a > 30j

        const [
          newTodayRes, newWeekRes, newMonthRes,
          reactTodayRes, reactWeekRes, reactMonthRes,
        ] = await Promise.all([
          // Nouveaux : created_at récent
          supabase.from('users').select('*', { count: 'exact', head: true })
            .gte('created_at', startOfToday),
          supabase.from('users').select('*', { count: 'exact', head: true })
            .gte('created_at', ago7d),
          supabase.from('users').select('*', { count: 'exact', head: true })
            .gte('created_at', ago30d),
          // Réactivés : last_login_at récent mais created_at ancien
          supabase.from('users').select('*', { count: 'exact', head: true })
            .gte('last_login_at', startOfToday)
            .lt('created_at', oldThreshold),
          supabase.from('users').select('*', { count: 'exact', head: true })
            .gte('last_login_at', ago7d)
            .lt('created_at', oldThreshold),
          supabase.from('users').select('*', { count: 'exact', head: true })
            .gte('last_login_at', ago30d)
            .lt('created_at', oldThreshold),
        ])

        setGrowth({
          newToday: newTodayRes.count || 0,
          reactivatedToday: reactTodayRes.count || 0,
          new7d: newWeekRes.count || 0,
          reactivated7d: reactWeekRes.count || 0,
          new30d: newMonthRes.count || 0,
          reactivated30d: reactMonthRes.count || 0,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return <div className="loading">Chargement...</div>
  }

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Comptes</h3>
          <span className="stat-value">{stats.totalUsers}</span>
        </div>
        <div className="stat-card">
          <h3>Ambassadeurs</h3>
          <span className="stat-value" style={{ color: '#f59e0b' }}>{stats.ambassadors}</span>
        </div>
        <div className="stat-card">
          <h3>Photos en attente</h3>
          <span className="stat-value" style={{ color: stats.photosPending > 0 ? '#f59e0b' : '#22c55e' }}>
            {stats.photosPending}
          </span>
        </div>
        <div className="stat-card">
          <h3>Photos approuvees</h3>
          <span className="stat-value" style={{ color: '#22c55e' }}>{stats.photosApproved}</span>
        </div>
      </div>

      <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Croissance</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Aujourd'hui</h3>
          <div className="stat-row">
            <span className="stat-label">Nouveaux</span>
            <span className="stat-value stat-value-sm" style={{ color: '#22c55e' }}>{growth.newToday}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Reactivations</span>
            <span className="stat-value stat-value-sm" style={{ color: '#3b82f6' }}>{growth.reactivatedToday}</span>
          </div>
        </div>
        <div className="stat-card">
          <h3>7 derniers jours</h3>
          <div className="stat-row">
            <span className="stat-label">Nouveaux</span>
            <span className="stat-value stat-value-sm" style={{ color: '#22c55e' }}>{growth.new7d}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Reactivations</span>
            <span className="stat-value stat-value-sm" style={{ color: '#3b82f6' }}>{growth.reactivated7d}</span>
          </div>
        </div>
        <div className="stat-card">
          <h3>30 derniers jours</h3>
          <div className="stat-row">
            <span className="stat-label">Nouveaux</span>
            <span className="stat-value stat-value-sm" style={{ color: '#22c55e' }}>{growth.new30d}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Reactivations</span>
            <span className="stat-value stat-value-sm" style={{ color: '#3b82f6' }}>{growth.reactivated30d}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
