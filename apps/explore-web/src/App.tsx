import { useState, useEffect, useRef } from 'react'
import { ExploreMap } from './components/map/ExploreMap'
import { EnergyIndicator } from './components/map/EnergyIndicator'
import { PlacePanel } from './components/places/PlacePanel'
import { AuthModal } from './components/auth/AuthModal'
import { FactionModal } from './components/auth/FactionModal'
import { ProfileMenu } from './components/auth/ProfileMenu'
import { FactionBar } from './components/map/FactionBar'
import { useMapStore } from './stores/mapStore'
import { useFogStore } from './stores/fogStore'
import { useAuth } from './hooks/useAuth'
import { useFog } from './hooks/useFog'
import './App.css'

function App() {
  const selectedPlaceId = useMapStore(state => state.selectedPlaceId)
  const setSelectedPlaceId = useMapStore(state => state.setSelectedPlaceId)
  const { user, isAuthenticated, signOut, loading: authLoading } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showFactionModal, setShowFactionModal] = useState(false)

  const userId = useFogStore(s => s.userId)
  const userFactionId = useFogStore(s => s.userFactionId)

  // Initialiser le fog state (découvertes + énergie) dès l'auth
  useFog()

  // Auto-open faction modal si connecté sans faction (une seule fois par session)
  // userId !== null garantit que le fog a VRAIMENT chargé les données du user
  const factionPromptDone = useRef(false)
  useEffect(() => {
    if (!userId) return
    if (userFactionId === null && !factionPromptDone.current) {
      factionPromptDone.current = true
      setShowFactionModal(true)
    }
  }, [userId, userFactionId])

  return (
    <div className="app">
      <ExploreMap />

      <FactionBar />

      {/* Toolbar flottante */}
      <div className="app-toolbar">
        {!authLoading && isAuthenticated && (
          <EnergyIndicator />
        )}

        {!authLoading && (
          isAuthenticated && user?.email ? (
            <ProfileMenu email={user.email} onSignOut={signOut} onFactionModal={() => setShowFactionModal(true)} />
          ) : (
            <button
              className="toolbar-btn auth-btn"
              onClick={() => setShowAuthModal(true)}
              aria-label="Se connecter"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
          )
        )}
      </div>

      <PlacePanel
        placeId={selectedPlaceId}
        onClose={() => setSelectedPlaceId(null)}
        userEmail={user?.email ?? null}
        onAuthPrompt={() => setShowAuthModal(true)}
      />

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

      {showFactionModal && (
        <FactionModal
          onClose={() => setShowFactionModal(false)}
          currentFactionId={userFactionId}
        />
      )}

      {/* Overlay texture parchemin */}
      <div className="parchment-overlay" />
    </div>
  )
}

export default App
