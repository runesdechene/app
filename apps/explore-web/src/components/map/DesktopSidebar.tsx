import { useState } from 'react'
import { HomeFeed } from '../home/HomeFeed'
import { MapActivityList } from '../home/MapActivityList'
import { useUnreadActivityCount, markActivitySeen } from '../../hooks/useUnreadActivityCount'
import './DesktopSidebar.css'

type SidebarTab = 'home' | 'activite'

interface Props {
  openFactionModal: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
}

/**
 * Leftbar desktop — remplace les panneaux flottants top-left (Quêtes,
 * Nouvelles, Activité) et le bouton Boutique par un vrai conteneur ancré à
 * gauche de la carte. Rail de boutons (Accueil / Activité) qui pilote le
 * contenu. Réutilise HomeFeed (source unique avec la home mobile).
 *
 * Repliable : un chevron réduit la sidebar à son rail (64px). Le contenu reste
 * monté (orchestration expéditions + modales préservées), réduit à 0 via
 * --sidebar-w (piloté par MapPage sur .app) + overflow:hidden.
 */
export function DesktopSidebar({ openFactionModal, collapsed, onToggleCollapsed }: Props) {
  const [tab, setTab] = useState<SidebarTab>('home')
  const unread = useUnreadActivityCount()

  function pick(next: SidebarTab) {
    // Replié → un clic d'onglet déplie ET sélectionne.
    if (collapsed) onToggleCollapsed()
    setTab(next)
    if (next === 'activite') markActivitySeen()
  }

  return (
    <aside className={`desktop-sidebar${collapsed ? ' is-collapsed' : ''}`}>
      <nav className="desktop-sidebar-rail" aria-label="Navigation">
        <button
          type="button"
          className="desktop-sidebar-collapse"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Déplier le panneau' : 'Replier le panneau'}
          title={collapsed ? 'Déplier' : 'Replier'}
        >
          {collapsed ? '»' : '«'}
        </button>

        <button
          type="button"
          className={`desktop-sidebar-tab${tab === 'home' && !collapsed ? ' is-active' : ''}`}
          onClick={() => pick('home')}
          aria-current={tab === 'home' && !collapsed}
        >
          <span className="desktop-sidebar-tab-icon" aria-hidden>🏠</span>
          <span className="desktop-sidebar-tab-label">Accueil</span>
        </button>
        <button
          type="button"
          className={`desktop-sidebar-tab${tab === 'activite' && !collapsed ? ' is-active' : ''}`}
          onClick={() => pick('activite')}
          aria-current={tab === 'activite' && !collapsed}
        >
          <span className="desktop-sidebar-tab-icon" aria-hidden>📜</span>
          <span className="desktop-sidebar-tab-label">Activité</span>
          {unread > 0 && (tab !== 'activite' || collapsed) && (
            <span className="desktop-sidebar-tab-badge">{unread > 99 ? '99+' : unread}</span>
          )}
        </button>
      </nav>

      <div className="desktop-sidebar-content" aria-hidden={collapsed}>
        {tab === 'home' ? (
          <HomeFeed openFactionModal={openFactionModal} showActivity={false} showCoupe={false} placesFirst articleAsModal />
        ) : (
          <main className="activity-page-scroll">
            <h1 className="activity-page-title">Activité de la carte</h1>
            <MapActivityList limit={50} />
          </main>
        )}
      </div>
    </aside>
  )
}
