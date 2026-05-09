import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { BottomTabbarPlusMenu } from './BottomTabbarPlusMenu'
import { useNotificationStore } from '../../stores/notificationStore'
import './BottomTabbar.css'

export function BottomTabbar() {
  const [plusOpen, setPlusOpen] = useState(false)

  // unreadCount est une fonction-getter dans le store (pas une propriété directe)
  const unreadActivity = useNotificationStore((s) => s.unreadCount())
  // chatStore n'a pas de unread natif aujourd'hui — placeholder à 0.
  const unreadChat = 0

  return (
    <>
      <nav className="bottom-tabbar" aria-label="Navigation principale">
        <NavLink
          to="/accueil"
          className={({ isActive }) => `bottom-tabbar-cell${isActive ? ' active' : ''}`}
        >
          <span className="bottom-tabbar-icon" aria-hidden>🏠</span>
          <span className="bottom-tabbar-label">Accueil</span>
        </NavLink>

        <NavLink
          to="/chat"
          className={({ isActive }) => `bottom-tabbar-cell${isActive ? ' active' : ''}`}
        >
          <span className="bottom-tabbar-icon" aria-hidden>💬</span>
          <span className="bottom-tabbar-label">Chat</span>
          {unreadChat > 0 && <span className="bottom-tabbar-badge">{unreadChat}</span>}
        </NavLink>

        <button
          type="button"
          className="bottom-tabbar-plus"
          onClick={() => setPlusOpen(true)}
          aria-label="Créer un élément"
        >
          <span className="bottom-tabbar-plus-circle" aria-hidden>+</span>
        </button>


        <NavLink
          to="/activite"
          className={({ isActive }) => `bottom-tabbar-cell${isActive ? ' active' : ''}`}
        >
          <span className="bottom-tabbar-icon" aria-hidden>🔔</span>
          <span className="bottom-tabbar-label">Activité</span>
          {unreadActivity > 0 && <span className="bottom-tabbar-badge">{unreadActivity}</span>}
        </NavLink>

        <NavLink
          to="/carte"
          className={({ isActive }) => `bottom-tabbar-cell${isActive ? ' active' : ''}`}
        >
          <span className="bottom-tabbar-icon" aria-hidden>🗺️</span>
          <span className="bottom-tabbar-label">Carte</span>
        </NavLink>
      </nav>

      {plusOpen && <BottomTabbarPlusMenu onClose={() => setPlusOpen(false)} />}
    </>
  )
}
