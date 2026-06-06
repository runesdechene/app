import { useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAnnouncement } from '../hooks/useAnnouncements'
import { renderMarkdown } from '../lib/markdown'
import { formatFrenchLongDate } from '../lib/dateFormat'
import { AnnouncementSocial } from '../components/announcements/AnnouncementSocial'
import './ArticlePage.css'

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>()
  const { item, loading, error } = useAnnouncement(slug)

  useEffect(() => {
    document.title = item ? `Runes de Chêne — ${item.title}` : 'Runes de Chêne — Nouvelle'
  }, [item])

  const html = useMemo(() => (item ? renderMarkdown(item.body) : ''), [item])

  if (loading) {
    return <main className="article-page"><p className="article-state">Chargement…</p></main>
  }
  if (error || !item) {
    return (
      <main className="article-page">
        <p className="article-state">Cette nouvelle n'existe pas ou n'est plus disponible.</p>
        <Link to="/nouvelles" className="article-back">← Toutes les nouvelles</Link>
      </main>
    )
  }

  return (
    <main className="article-page">
      <Link to="/nouvelles" className="article-back">← Nouvelles</Link>
      {item.cover_image && (
        <img className="article-cover" src={item.cover_image} alt="" loading="lazy" />
      )}
      <h1 className="article-title">{item.title}</h1>
      {item.published_at && (
        <p className="article-date">{formatFrenchLongDate(item.published_at)}</p>
      )}
      <article className="article-body" dangerouslySetInnerHTML={{ __html: html }} />
      <AnnouncementSocial announcementId={item.id} />
    </main>
  )
}
