import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { BottomTabbarPlusMenu } from './BottomTabbarPlusMenu'
import './BottomTabbar.css'

export function BottomTabbar() {
  const [plusOpen, setPlusOpen] = useState(false)

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

        <button
          type="button"
          className="bottom-tabbar-plus"
          onClick={() => setPlusOpen(true)}
          aria-label="Créer un élément"
        >
          +
        </button>

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
