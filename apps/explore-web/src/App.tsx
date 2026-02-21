import { useState } from 'react'
import { ExploreMap } from './components/map/ExploreMap'
import { PlacePanel } from './components/places/PlacePanel'
import { AuthModal } from './components/auth/AuthModal'
import { ProfileMenu } from './components/auth/ProfileMenu'
import { useMapStore } from './stores/mapStore'
import { useAuth } from './hooks/useAuth'
import './App.css'

function App() {
  const selectedPlaceId = useMapStore(state => state.selectedPlaceId)
  const setSelectedPlaceId = useMapStore(state => state.setSelectedPlaceId)
  const { user, isAuthenticated, signOut, loading: authLoading } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)

  return (
    <div className="app">
      <ExploreMap />

      {/* Toolbar flottante */}
      <div className="app-toolbar">
        {!authLoading && (
          isAuthenticated && user?.email ? (
            <ProfileMenu email={user.email} onSignOut={signOut} />
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
      />

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

      {/* Overlay texture parchemin */}
      <div className="parchment-overlay" />
    </div>
  )
}

export default App
