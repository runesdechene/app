import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAnnouncementsList } from '../hooks/useAnnouncements'
import { formatFrenchLongDate } from '../lib/dateFormat'
import './NouvellesPage.css'

const TYPE_LABEL: Record<string, string> = {
  produit: 'Boutique',
  app: "L'app",
  marque: 'La marque',
}

export default function NouvellesPage() {
  const { items, loading, error } = useAnnouncementsList(30)
  useEffect(() => { document.title = 'Runes de Chêne — Nouvelles' }, [])

  return (
    <main className="nouvelles-page">
      <h1 className="nouvelles-title">Nouvelles</h1>
      {loading && <p className="nouvelles-state">Chargement…</p>}
      {error && <p className="nouvelles-state">Impossible de charger les nouvelles.</p>}
      {!loading && !error && items.length === 0 && (
        <p className="nouvelles-state">Rien à signaler pour l'instant.</p>
      )}
      <ul className="nouvelles-list">
        {items.map((a) => (
          <li key={a.id}>
            <Link to={`/article/${a.slug}`} className="nouvelles-card">
              {a.cover_image && (
                <img className="nouvelles-thumb" src={a.cover_image} alt="" loading="lazy" />
              )}
              <div className="nouvelles-card-text">
                <span className="nouvelles-tag">{TYPE_LABEL[a.type] ?? a.type}</span>
                <h2 className="nouvelles-card-title">{a.title}</h2>
                {a.published_at && (
                  <span className="nouvelles-card-date">{formatFrenchLongDate(a.published_at)}</span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
