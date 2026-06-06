import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Announcement } from '../../types/announcement'
import './ComposerAnnonce.css'

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
    <div>
      <div className="annonces-header">
        <h1>Annonces</h1>
        <Link to="/annonces/nouvelle" className="annonces-new-btn">Nouvelle annonce</Link>
      </div>
      {items.length === 0 ? (
        <p className="annonces-empty">Aucune annonce pour l'instant.</p>
      ) : (
        <table className="announcements-table">
          <thead>
            <tr>
              <th>Titre</th><th>Type</th><th>Statut</th><th>Canaux</th><th>Date</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td><Link to={`/annonces/${a.id}`}>{a.title}</Link></td>
                <td>{a.type}</td>
                <td><span className="annonces-status">{a.status}</span></td>
                <td className="annonces-channels">
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
