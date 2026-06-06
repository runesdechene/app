import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useAnnouncement } from '../../hooks/useAnnouncements'
import { renderMarkdown } from '../../lib/markdown'
import { formatFrenchLongDate } from '../../lib/dateFormat'
import { AnnouncementSocial } from './AnnouncementSocial'
import './DesktopArticleModal.css'

/**
 * Lecteur d'annonce en modale, pour la carte desktop (la route /article/:slug
 * est mobile-only). Réutilise renderMarkdown + AnnouncementSocial (likes + fil).
 */
export function DesktopArticleModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { item, loading } = useAnnouncement(slug)
  const html = useMemo(() => (item ? renderMarkdown(item.body) : ''), [item])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="dam-overlay" onClick={onClose}>
      <div className="dam-modal" onClick={e => e.stopPropagation()}>
        <button className="dam-close" onClick={onClose} aria-label="Fermer">✕</button>
        {loading || !item ? (
          <p className="dam-state">Chargement…</p>
        ) : (
          <>
            {item.cover_image && <img className="dam-cover" src={item.cover_image} alt="" />}
            <h1 className="dam-title">{item.title}</h1>
            {item.published_at && <p className="dam-date">{formatFrenchLongDate(item.published_at)}</p>}
            <article className="dam-body" dangerouslySetInnerHTML={{ __html: html }} />
            <AnnouncementSocial announcementId={item.id} />
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
