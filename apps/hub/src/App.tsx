import { Routes, Route, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { LoginPage } from './components/LoginPage'
import { Dashboard } from './components/Dashboard'
import { Users } from './components/Users'
import { Photos } from './components/Photos'
import { PhotoSubmit } from './components/PhotoSubmit'
import { Sidebar } from './components/Sidebar'
import './App.css'

function App() {
  const { user, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  // Routes publiques (pas besoin d'auth)
  const publicRoutes = ['/soumettre-contenu']
  const isPublicRoute = publicRoutes.includes(location.pathname)

  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/soumettre-contenu" element={<PhotoSubmit />} />
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

  return (
    <div className="app">
      <Sidebar user={user} />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/photos" element={<Photos />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
