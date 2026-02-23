import { useState, useEffect, useRef } from 'react'
import { ExploreMap } from './components/map/ExploreMap'
import { EnergyIndicator } from './components/map/EnergyIndicator'
import { PlacePanel } from './components/places/PlacePanel'
import { AuthModal } from './components/auth/AuthModal'
import { FactionModal } from './components/auth/FactionModal'
import { ProfileMenu } from './components/auth/ProfileMenu'
import { FactionBar } from './components/map/FactionBar'
import { GameToast } from './components/map/GameToast'
import { useMapStore } from './stores/mapStore'
import { useFogStore } from './stores/fogStore'
import { useAuth } from './hooks/useAuth'
import { useFog } from './hooks/useFog'
import { usePresence } from './hooks/usePresence'
import { useChat } from './hooks/useChat'
import { ChatPanel } from './components/chat/ChatPanel'
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
  // Présence temps réel sur la carte
  usePresence()
  // Chat en jeu
  useChat()

  // Auto-open auth modal si non connecté (une seule fois par session)
  const authPromptDone = useRef(false)
  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated && !authPromptDone.current) {
      authPromptDone.current = true
      setShowAuthModal(true)
    }
  }, [authLoading, isAuthenticated])

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
      <GameToast />
      <ChatPanel />

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
            >
              ⚔️ Se connecter
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
