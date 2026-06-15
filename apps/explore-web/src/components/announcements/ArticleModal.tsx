import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useAnnouncement } from '../../hooks/useAnnouncements'
import { renderMarkdown } from '../../lib/markdown'
import { formatFrenchLongDate } from '../../lib/dateFormat'
import { AnnouncementSocial } from './AnnouncementSocial'
import { AnnouncementCta } from './AnnouncementCta'
import '../../pages/ArticlePage.css'
import './ArticleModal.css'

/**
 * Lecteur d'une « Nouvelle » en modale (desktop) — équivalent d'ArticlePage
 * (route mobile-only /article/:slug) mais sans navigation : ouvert depuis la
 * leftbar. Portail vers document.body pour s'affranchir du contexte
 * d'empilement / overflow de la sidebar.
 */
export function ArticleModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { item, loading, error } = useAnnouncement(slug)
  const html = useMemo(() => (item ? renderMarkdown(item.body) : ''), [item])

  return createPortal(
    <div className="article-modal-overlay" onClick={onClose}>
      <div className="article-modal" onClick={(e) => e.stopPropagation()}>
        <button className="article-modal-close" onClick={onClose} aria-label="Fermer">
          {'✕'}
        </button>

        {loading && <p className="article-state">Chargement…</p>}
        {(error || (!loading && !item)) && (
          <p className="article-state">Cette nouvelle n'existe pas ou n'est plus disponible.</p>
        )}

        {item && (
          <>
            {item.cover_image && (
              <img className="article-cover" src={item.cover_image} alt="" loading="lazy" />
            )}
            <h1 className="article-title">{item.title}</h1>
            {item.published_at && (
              <p className="article-date">{formatFrenchLongDate(item.published_at)}</p>
            )}
            <article className="article-body" dangerouslySetInnerHTML={{ __html: html }} />
            <AnnouncementCta url={item.cta_url} label={item.cta_label} />
            <AnnouncementSocial announcementId={item.id} />
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
