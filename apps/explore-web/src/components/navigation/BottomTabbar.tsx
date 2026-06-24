import { NavLink, useMatch } from 'react-router-dom'
import { useState } from 'react'
import { BottomTabbarPlusMenu } from './BottomTabbarPlusMenu'
import { AddGpsMarkModal } from '../places/modals/AddGpsMarkModal'
import './BottomTabbar.css'

interface CellProps {
  to: string
  icon: string
  label: string
  unreadBadge?: number
}

/** Cellule unique avec span indicateur explicite pour le tab actif.
 *  useMatch détermine isActive — plus prévisible que NavLink render-prop. */
function TabbarCell({ to, icon, label, unreadBadge }: CellProps) {
  const isActive = !!useMatch(to)
  return (
    <NavLink to={to} className={`bottom-tabbar-cell${isActive ? ' active' : ''}`}>
      {isActive && <span className="bottom-tabbar-active-indicator" aria-hidden />}
      <span className="bottom-tabbar-icon" aria-hidden>{icon}</span>
      <span className="bottom-tabbar-label">{label}</span>
      {unreadBadge !== undefined && unreadBadge > 0 && (
        <span className="bottom-tabbar-badge">{unreadBadge}</span>
      )}
    </NavLink>
  )
}

export function BottomTabbar() {
  const [plusOpen, setPlusOpen] = useState(false)
  const [showAddGpsMark, setShowAddGpsMark] = useState(false)

  // chatStore n'a pas de unread natif aujourd'hui — placeholder à 0.
  const unreadChat = 0

  return (
    <>
      <nav className="bottom-tabbar" aria-label="Navigation principale">
        <TabbarCell to="/accueil" icon="🏠" label="Accueil" />
        <TabbarCell to="/chat" icon="💬" label="Chat" unreadBadge={unreadChat} />

        <button
          type="button"
          className="bottom-tabbar-plus"
          onClick={() => setPlusOpen(true)}
          aria-label="Créer un élément"
        >
          <span className="bottom-tabbar-plus-circle" aria-hidden>+</span>
        </button>

        <TabbarCell to="/compagnies" icon="🛡️" label="Compagnies" />
        <TabbarCell to="/carte" icon="🗺️" label="Carte" />
      </nav>

      {plusOpen && (
        <BottomTabbarPlusMenu
          onClose={() => setPlusOpen(false)}
          onRequestAddGpsMark={() => { setPlusOpen(false); setShowAddGpsMark(true) }}
        />
      )}
      {showAddGpsMark && <AddGpsMarkModal onClose={() => setShowAddGpsMark(false)} />}
    </>
  )
}
