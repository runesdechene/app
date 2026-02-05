import { useAuth } from './hooks/useAuth'
import { AuthForm } from './components/AuthForm'
import { AuthCallback } from './components/AuthCallback'
import { UserProfile } from './components/UserProfile'
import './App.css'

function App() {
  const { user, loading: authLoading, signOut, isAuthenticated } = useAuth()

  // Gérer le callback d'authentification
  if (window.location.pathname === '/auth/callback') {
    return <AuthCallback />
  }

  if (authLoading) {
    return (
      <div className="app">
        <div className="status loading">
          <div className="spinner" />
          <p>Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <h1>Runes de Chêne Explorer</h1>
        {isAuthenticated ? (
          <div className="user-info">
            <span>{user?.email}</span>
            <button onClick={signOut}>Déconnexion</button>
          </div>
        ) : (
          <p>Connectez-vous pour accéder à l'application</p>
        )}
      </header>

      <main>
        {!isAuthenticated ? (
          <AuthForm />
        ) : (
          <UserProfile authEmail={user?.email || ''} />
        )}
      </main>

      <footer>
        <p>Runes de Chêne © 2026</p>
      </footer>
    </div>
  )
}

export default App
