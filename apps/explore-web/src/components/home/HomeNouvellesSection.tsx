import { Link } from 'react-router-dom'
import { useAnnouncementsList } from '../../hooks/useAnnouncements'
import { useDragScroll } from '../../hooks/useDragScroll'
import './HomeNouvellesSection.css'

interface Props {
  /** Desktop : ouvre la nouvelle en modale au lieu de naviguer vers
   *  /article/:slug (route mobile-only). Si absent → navigation (mobile). */
  onOpenArticle?: (slug: string) => void
}

/**
 * Section home — dernières « Nouvelles » (annonces multi-canal).
 * Point d'entrée discret vers le lecteur in-app. Auto-masquée si aucune
 * annonce publiée (pas de section vide sur la home).
 */
export function HomeNouvellesSection({ onOpenArticle }: Props = {}) {
  const { items, loading } = useAnnouncementsList(3)
  const rowRef = useDragScroll<HTMLDivElement>()
  if (loading || items.length === 0) return null

  return (
    <section className="home-section home-nouvelles">
      <header className="home-nouvelles-header">
        <h2 className="home-section-title">Nouveautés</h2>
        {/* "Tout voir" → /nouvelles (mobile-only). Masqué en mode modale desktop. */}
        {!onOpenArticle && <Link to="/nouvelles" className="home-nouvelles-all">Tout voir →</Link>}
      </header>
      <div className="home-nouvelles-row" ref={rowRef}>
        {items.map((a) =>
          onOpenArticle ? (
            <button
              key={a.id}
              type="button"
              onClick={() => onOpenArticle(a.slug)}
              className="home-nouvelles-card"
            >
              {a.cover_image && (
                <img className="home-nouvelles-thumb" src={a.cover_image} alt="" loading="lazy" />
              )}
              <span className="home-nouvelles-card-title">{a.title}</span>
            </button>
          ) : (
            <Link key={a.id} to={`/article/${a.slug}`} className="home-nouvelles-card">
              {a.cover_image && (
                <img className="home-nouvelles-thumb" src={a.cover_image} alt="" loading="lazy" />
              )}
              <span className="home-nouvelles-card-title">{a.title}</span>
            </Link>
          ),
        )}
      </div>
    </section>
  )
}
