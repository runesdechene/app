import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Stats {
  totalUsers: number
  ambassadors: number
  photosPending: number
  photosApproved: number
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    ambassadors: 0,
    photosPending: 0,
    photosApproved: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
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
    </div>
  )
}
