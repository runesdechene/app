import { useState } from 'react'
import { HomeFeed } from '../home/HomeFeed'
import { MapActivityList } from '../home/MapActivityList'
import { useUnreadActivityCount, markActivitySeen } from '../../hooks/useUnreadActivityCount'
import './DesktopSidebar.css'

type SidebarTab = 'home' | 'activite'

/**
 * Leftbar desktop — remplace les panneaux flottants top-left (Quêtes,
 * Nouvelles, Activité) et le bouton Boutique par un vrai conteneur ancré à
 * gauche de la carte. Rail de boutons (Accueil / Activité) qui pilote le
 * contenu. Réutilise HomeFeed (source unique avec la home mobile).
 */
export function DesktopSidebar({ openFactionModal }: { openFactionModal: () => void }) {
  const [tab, setTab] = useState<SidebarTab>('home')
  const unread = useUnreadActivityCount()

  function selectActivite() {
    setTab('activite')
    markActivitySeen()
  }

  return (
    <aside className="desktop-sidebar">
      <nav className="desktop-sidebar-rail" aria-label="Navigation">
        <button
          type="button"
          className={`desktop-sidebar-tab${tab === 'home' ? ' is-active' : ''}`}
          onClick={() => setTab('home')}
          aria-current={tab === 'home'}
        >
          <span className="desktop-sidebar-tab-icon" aria-hidden>🏠</span>
          <span className="desktop-sidebar-tab-label">Accueil</span>
        </button>
        <button
          type="button"
          className={`desktop-sidebar-tab${tab === 'activite' ? ' is-active' : ''}`}
          onClick={selectActivite}
          aria-current={tab === 'activite'}
        >
          <span className="desktop-sidebar-tab-icon" aria-hidden>📜</span>
          <span className="desktop-sidebar-tab-label">Activité</span>
          {unread > 0 && tab !== 'activite' && (
            <span className="desktop-sidebar-tab-badge">{unread > 99 ? '99+' : unread}</span>
          )}
        </button>
      </nav>

      <div className="desktop-sidebar-content">
        {tab === 'home' ? (
          <HomeFeed openFactionModal={openFactionModal} showActivity={false} />
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
