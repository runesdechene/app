import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { ShopifyHealthBadge } from './ShopifyHealthBadge'

interface SidebarProps {
  user: User | null
}

export function Sidebar({ user }: SidebarProps) {
  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>HUB</h2>
        <span>Runes de Chene</span>
        <span className="sidebar-version">v1.2.0</span>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''} end>
          Dashboard
        </NavLink>
        <NavLink to="/users" className={({ isActive }) => isActive ? 'active' : ''}>
          Utilisateurs
        </NavLink>
        <NavLink to="/photos" className={({ isActive }) => isActive ? 'active' : ''}>
          Photos
        </NavLink>
        <NavLink to="/reviews" className={({ isActive }) => isActive ? 'active' : ''}>
          Avis
        </NavLink>

        <div className="sidebar-section-label">La Carte</div>
        <NavLink to="/carte/tags" className={({ isActive }) => isActive ? 'active' : ''}>
          Tags
        </NavLink>
        <NavLink to="/carte/factions" className={({ isActive }) => isActive ? 'active' : ''}>
          Factions
        </NavLink>
        <NavLink to="/carte/constructions" className={({ isActive }) => isActive ? 'active' : ''}>
          Constructions
        </NavLink>
        <NavLink to="/carte/titres" className={({ isActive }) => isActive ? 'active' : ''}>
          Titres
        </NavLink>
        <NavLink to="/carte/fragments" className={({ isActive }) => isActive ? 'active' : ''}>
          Fragments
        </NavLink>
        <NavLink to="/carte/associer" className={({ isActive }) => isActive ? 'active' : ''}>
          Associer Fragments
        </NavLink>
        <NavLink to="/carte/shopify" className={({ isActive }) => isActive ? 'active' : ''}>
          Shopify Unlocks
        </NavLink>
        <NavLink to="/carte/publicites" className={({ isActive }) => isActive ? 'active' : ''}>
          Publicites
        </NavLink>
        <NavLink to="/carte/bannieres" className={({ isActive }) => isActive ? 'active' : ''}>
          Bannières
        </NavLink>
        <NavLink to="/carte/enigmes" className={({ isActive }) => isActive ? 'active' : ''}>
          Enigmes
        </NavLink>
        <NavLink to="/carte/reglages" className={({ isActive }) => isActive ? 'active' : ''}>
          Reglages
        </NavLink>
        <NavLink to="/carte/divers" className={({ isActive }) => isActive ? 'active' : ''}>
          Divers
        </NavLink>
        <NavLink to="/carte/landing" className={({ isActive }) => isActive ? 'active' : ''}>
          Page d'accueil
        </NavLink>
        <NavLink to="/carte/regles" className={({ isActive }) => isActive ? 'active' : ''}>
          Règles
        </NavLink>
        <NavLink to="/carte/tutoriel" className={({ isActive }) => isActive ? 'active' : ''}>
          Tutoriel
        </NavLink>

        <div className="sidebar-section-label">Shopify</div>
        <NavLink to="/shopify/sync" className={({ isActive }) => isActive ? 'active' : ''}>
          Synchro Emails
        </NavLink>
      </nav>

      <ShopifyHealthBadge />

      <div className="sidebar-footer">
        <span>{user?.email}</span>
        <button onClick={handleSignOut}>Deconnexion</button>
      </div>
    </aside>
  )
}
