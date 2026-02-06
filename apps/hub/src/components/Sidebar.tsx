import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

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
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
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
      </nav>

      <div className="sidebar-footer">
        <span>{user?.email}</span>
        <button onClick={handleSignOut}>Deconnexion</button>
      </div>
    </aside>
  )
}
