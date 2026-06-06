import { useState } from 'react'
import { useIsDesktop } from '../../hooks/useMediaQuery'
import { useAnnouncementsList } from '../../hooks/useAnnouncements'
import { formatFrenchLongDate } from '../../lib/dateFormat'
import { DesktopArticleModal } from './DesktopArticleModal'
import '../quests/QuestsBoardPanel.css' // réutilise la coque .qbp pour un look identique
import './DesktopNewsPanel.css'

/**
 * Bloc « Nouvelles » sur la carte desktop, empilé sous le panneau
 * Quêtes & Expéditions (.hud-left-stack). Desktop uniquement (sur mobile, les
 * Nouvelles vivent sur /accueil + /nouvelles). Auto-masqué si aucune annonce.
 * Le lecteur in-app étant mobile-only, on ouvre l'article dans une modale.
 */
export function DesktopNewsPanel() {
  const isDesktop = useIsDesktop()
  const { items } = useAnnouncementsList(6)
  const [openSlug, setOpenSlug] = useState<string | null>(null)

  if (!isDesktop || items.length === 0) return null

  return (
    <aside className="qbp news-panel" role="complementary" aria-label="Nouvelles">
      <header className="qbp-header">
        <div className="qbp-titlewrap"><h2 className="qbp-title">Nouvelles</h2></div>
      </header>
      <div className="qbp-content news-list">
        {items.map(a => (
          <button key={a.id} className="news-item" onClick={() => setOpenSlug(a.slug)}>
            {a.cover_image && <img className="news-item-thumb" src={a.cover_image} alt="" loading="lazy" />}
            <span className="news-item-text">
              <span className="news-item-title">{a.title}</span>
              {a.published_at && <span className="news-item-date">{formatFrenchLongDate(a.published_at)}</span>}
            </span>
          </button>
        ))}
      </div>

      {openSlug && <DesktopArticleModal slug={openSlug} onClose={() => setOpenSlug(null)} />}
    </aside>
  )
}
