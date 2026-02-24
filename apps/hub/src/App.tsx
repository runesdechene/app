import { Routes, Route, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './components/LoginPage'
import { Dashboard } from './components/Dashboard'
import { Users } from './components/Users'
import { Photos } from './components/Photos'
import { PhotoSubmit } from './components/PhotoSubmit'
import { Reviews } from './components/Reviews'
import { ReviewSubmit } from './components/ReviewSubmit'
import { TagsManager } from './components/TagsManager'
import { Factions } from './components/Factions'
import { TitlesManager } from './components/TitlesManager'
import { Divers } from './components/Divers'
import { Settings } from './components/Settings'
import { Sidebar } from './components/Sidebar'
import './App.css'

function AccessDenied({ onSignOut, email, role }: { onSignOut: () => void; email?: string; role?: string | null }) {
  return (
    <div className="access-denied">
      <h1>Accès refusé</h1>
      <p>Cette zone est réservée aux administrateurs de Runes de Chêne.</p>
      <p style={{ fontSize: '12px', opacity: 0.5, marginTop: '16px' }}>
        Email : {email ?? '?'} — Rôle : {role ?? 'null'}
      </p>
      <button onClick={onSignOut}>Se déconnecter</button>
    </div>
  )
}

function App() {
  const { user, role, loading, isAuthenticated, isAdmin, signOut } = useAuth()
  const location = useLocation()

  // Routes publiques (pas besoin d'auth)
  const publicRoutes = ['/soumettre-contenu', '/soumettre-avis']
  const isPublicRoute = publicRoutes.includes(location.pathname)

  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/soumettre-contenu" element={<PhotoSubmit />} />
        <Route path="/soumettre-avis" element={<ReviewSubmit />} />
      </Routes>
    )
  }

  if (loading) {
    return (
      <div className="app loading">
        <div className="spinner" />
        <p>Chargement...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  if (!isAdmin) {
    return <AccessDenied onSignOut={signOut} email={user?.email} role={role} />
  }

  return (
    <div className="app">
      <Sidebar user={user} />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/photos" element={<Photos />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/carte/tags" element={<TagsManager />} />
          <Route path="/carte/factions" element={<Factions />} />
          <Route path="/carte/titres" element={<TitlesManager />} />
          <Route path="/carte/reglages" element={<Settings />} />
          <Route path="/carte/divers" element={<Divers />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
