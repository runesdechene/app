import { Link } from 'react-router-dom'
import { useAnnouncementsList } from '../../hooks/useAnnouncements'
import './HomeNouvellesSection.css'

/**
 * Section home — dernières « Nouvelles » (annonces multi-canal).
 * Point d'entrée discret vers le lecteur in-app. Auto-masquée si aucune
 * annonce publiée (pas de section vide sur la home).
 */
export function HomeNouvellesSection() {
  const { items, loading } = useAnnouncementsList(3)
  if (loading || items.length === 0) return null

  return (
    <section className="home-section home-nouvelles">
      <header className="home-nouvelles-header">
        <h2 className="home-section-title">Nouvelles</h2>
        <Link to="/nouvelles" className="home-nouvelles-all">Tout voir →</Link>
      </header>
      <div className="home-nouvelles-row">
        {items.map((a) => (
          <Link key={a.id} to={`/article/${a.slug}`} className="home-nouvelles-card">
            {a.cover_image && (
              <img className="home-nouvelles-thumb" src={a.cover_image} alt="" loading="lazy" />
            )}
            <span className="home-nouvelles-card-title">{a.title}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
