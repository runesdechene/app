import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Announcement } from '../../types/announcement'

export function AnnouncementsList() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { data } = await supabase.rpc('list_announcements_admin')
        if (active) setItems((data ?? []) as Announcement[])
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  if (loading) return <div className="loading">Chargement…</div>

  return (
    <div style={{ padding: 16 }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>Annonces</h1>
        <Link to="/annonces/nouvelle"><button>Nouvelle annonce</button></Link>
      </div>
      {items.length === 0 ? (
        <p style={{ opacity: 0.7, marginTop: 16 }}>Aucune annonce pour l'instant.</p>
      ) : (
        <table className="announcements-table" style={{ width: '100%', marginTop: 16, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
              <th>Titre</th><th>Type</th><th>Statut</th><th>Canaux</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
                <td><Link to={`/annonces/${a.id}`}>{a.title}</Link></td>
                <td>{a.type}</td>
                <td>{a.status}</td>
                <td style={{ fontSize: 12 }}>
                  {Object.entries(a.channels).filter(([, v]) => v !== 'none').map(([k, v]) => `${k}:${v}`).join(' · ') || '—'}
                </td>
                <td>{a.published_at ? new Date(a.published_at).toLocaleDateString('fr-FR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
