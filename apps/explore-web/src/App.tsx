import { useState, useEffect, useRef } from 'react'
import { ExploreMap } from './components/map/ExploreMap'
import { EnergyIndicator } from './components/map/EnergyIndicator'
import { ResourceIndicator } from './components/map/ResourceIndicator'
import { PlacePanel } from './components/places/PlacePanel'
import { AuthModal } from './components/auth/AuthModal'
import { FactionModal } from './components/auth/FactionModal'
import { OnboardingModal } from './components/auth/OnboardingModal'
import { ProfileMenu } from './components/auth/ProfileMenu'
import { FactionBar } from './components/map/FactionBar'
import { GameModeModal } from './components/auth/GameModeModal'
import { ConquestToggle } from './components/map/ConquestToggle'
import { InfoModal } from './components/map/InfoModal'
import { GameToast } from './components/map/GameToast'
import { PlayerProfileModal } from './components/map/PlayerProfileModal'
import { LeaderboardModal } from './components/map/LeaderboardModal'
import { VersionBadge } from './components/map/VersionBadge'
import { TerritoryPanel } from './components/map/TerritoryPanel'
import { useMapStore } from './stores/mapStore'
import { useFogStore } from './stores/fogStore'
import { useToastStore } from './stores/toastStore'
import { useAuth } from './hooks/useAuth'
import { useFog } from './hooks/useFog'
import { usePresence } from './hooks/usePresence'
import { useChat } from './hooks/useChat'
import { ChatPanel } from './components/chat/ChatPanel'
import { AddPlaceFlow } from './components/places/AddPlaceFlow'
import { InstallPrompt } from './components/pwa/InstallPrompt'
import { OfflineIndicator } from './components/pwa/OfflineIndicator'
import { MobileNavbar } from './components/map/MobileNavbar'
import { MobileHeader } from './components/map/MobileHeader'
import { useMobileNavStore } from './stores/mobileNavStore'
import './App.css'

function NotorietyBadge({ onClick }: { onClick: () => void }) {
  const notoriety = useFogStore(s => s.notorietyPoints)
  const [showInfo, setShowInfo] = useState(false)

  return (
    <>
      <div
        className="notoriety-badge"
        onClick={(e) => {
          e.stopPropagation()
          setShowInfo(true)
        }}
        onContextMenu={(e) => { e.preventDefault(); onClick() }}
      >
        <span className="notoriety-icon">{'\uD83C\uDF96\uFE0F'}</span>
        <span className="notoriety-value">{notoriety}</span>
      </div>

      {showInfo && (
        <InfoModal
          icon={'\uD83C\uDF96\uFE0F'}
          title="Notoriete"
          description="La notoriete represente votre prestige personnel dans votre faction. Vous gagnez des points en revendiquant et fortifiant des lieux."
          rows={[
            { label: 'Points actuels', value: String(notoriety), highlight: true },
            { label: 'Revendiquer un lieu', value: '+10 pts' },
            { label: 'Fortifier un lieu', value: '+5 pts' },
            { label: 'Changer de faction', value: 'Notoriete / 2' },
          ]}
          onClose={() => setShowInfo(false)}
          action={{ label: 'Voir le classement', onClick: () => { setShowInfo(false); onClick() } }}
        />
      )}
    </>
  )
}

function App() {
  const selectedPlaceId = useMapStore(state => state.selectedPlaceId)
  const setSelectedPlaceId = useMapStore(state => state.setSelectedPlaceId)
  const selectedPlayerId = useMapStore(state => state.selectedPlayerId)
  const setSelectedPlayerId = useMapStore(state => state.setSelectedPlayerId)
  const { user, isAuthenticated, signOut, loading: authLoading } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showGameModeModal, setShowGameModeModal] = useState(false)
  const [showFactionModal, setShowFactionModal] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  const userId = useFogStore(s => s.userId)
  const userFactionId = useFogStore(s => s.userFactionId)
  const userName = useFogStore(s => s.userName)
  const addPlaceMode = useMapStore(s => s.addPlaceMode)
  const setAddPlaceMode = useMapStore(s => s.setAddPlaceMode)
  const selectedTerritoryData = useMapStore(s => s.selectedTerritoryData)
  const setSelectedTerritoryData = useMapStore(s => s.setSelectedTerritoryData)

  // Mode de jeu (exploration masque toute l'UI faction)
  const gameMode = useFogStore(s => s.gameMode)
  const isConquestMode = gameMode === 'conquest'

  // Le FAB "+" n'est visible que si un titre débloqué contient 'add_place'
  const unlockedTitles = useFogStore(s => s.unlockedGeneralTitles)
  const factionTitle = useFogStore(s => s.factionTitle2)
  const canAddPlace = unlockedTitles.some(t => t.unlocks?.includes('add_place'))
    || (factionTitle?.unlocks?.includes('add_place') ?? false)

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

  // Auto-open onboarding selon l'etat du joueur
  // Nouveau joueur (first_name vide) → onboarding → GameModeModal → (conquest → FactionModal)
  const onboardingDone = useRef(false)
  useEffect(() => {
    if (!userId) return
    if (userName === '' && !onboardingDone.current) {
      onboardingDone.current = true
      setShowOnboarding(true)
    }
  }, [userId, userName])

  const mobilePanel = useMobileNavStore(s => s.activePanel)

  return (
    <div className="app" data-mobile-panel={mobilePanel || ''}>
      <ExploreMap />
      <InstallPrompt />
      <OfflineIndicator />

      {!addPlaceMode && !authLoading && isAuthenticated && isConquestMode && <FactionBar />}
      {!addPlaceMode && !authLoading && isAuthenticated && <GameToast />}
      {!addPlaceMode && !authLoading && isAuthenticated && <ChatPanel />}

      {/* Toggle Conquete (mini-bandeau permanent sur la carte) */}
      {!addPlaceMode && !authLoading && isAuthenticated && <ConquestToggle />}

      {/* Header mobile (logo + hamburger, masqué sur desktop) */}
      {!addPlaceMode && !authLoading && isAuthenticated && user?.email && (
        <MobileHeader email={user.email} onSignOut={signOut} onFactionModal={() => setShowFactionModal(true)} />
      )}

      {/* Toolbar flottante (masquée en mode ajout) */}
      {!addPlaceMode && (
        <div className="app-toolbar">
          {!authLoading && isAuthenticated && (
            <>
              {isConquestMode && <NotorietyBadge onClick={() => setShowLeaderboard(true)} />}
              {isConquestMode && <ResourceIndicator type="conquest" />}
              {isConquestMode && <ResourceIndicator type="construction" />}
              <EnergyIndicator />
            </>
          )}

          {!authLoading && (
            isAuthenticated && user?.email ? (
              <ProfileMenu email={user.email} onSignOut={signOut} onFactionModal={() => setShowFactionModal(true)} />
            ) : (
              <button
                className="toolbar-btn auth-btn"
                onClick={() => setShowAuthModal(true)}
              >
                ⚔️ Commencer à jouer
              </button>
            )
          )}
        </div>
      )}

      {/* FAB Ajouter un lieu — toujours visible, verrouille si pas le titre */}
      {!authLoading && isAuthenticated && userId && !addPlaceMode && (
        <button
          className={`add-place-fab ${!canAddPlace ? 'locked' : ''}`}
          onClick={() => {
            if (canAddPlace) {
              setAddPlaceMode(true)
            } else {
              useToastStore.getState().addToast({
                type: 'discover',
                message: 'Vous devez etre Explorateur Novice — decouvrez au moins 5 lieux !',
                timestamp: Date.now(),
              })
            }
          }}
          aria-label="Ajouter un lieu"
        >
          +
        </button>
      )}

      {/* Flow ajout de lieu (immersif) */}
      {addPlaceMode && <AddPlaceFlow />}

      {!addPlaceMode && (
        <PlacePanel
          placeId={selectedPlaceId}
          onClose={() => setSelectedPlaceId(null)}
          userEmail={user?.email ?? null}
          onAuthPrompt={() => setShowAuthModal(true)}
        />
      )}

      {!addPlaceMode && selectedTerritoryData && (
        <TerritoryPanel
          data={selectedTerritoryData}
          onClose={() => setSelectedTerritoryData(null)}
          onNameSaved={(anchorPlaceId, customName: string | null) => {
            setSelectedTerritoryData({
              ...selectedTerritoryData,
              customName,
              anchorPlaceId,
            })
          }}
          onFactionModal={() => setShowFactionModal(true)}
        />
      )}

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

      {showOnboarding && (
        <OnboardingModal onComplete={() => {
          setShowOnboarding(false)
          setShowGameModeModal(true)
        }} />
      )}

      {showGameModeModal && (
        <GameModeModal onComplete={(mode) => {
          setShowGameModeModal(false)
          if (mode === 'conquest') {
            setShowFactionModal(true)
          }
        }} />
      )}

      {showFactionModal && (
        <FactionModal
          onClose={(joined) => {
            setShowFactionModal(false)
            if (!joined && gameMode === 'conquest' && !userFactionId) {
              // Pas de faction choisie en mode conquete → repasser en exploration
              useFogStore.getState().setGameMode('exploration')
            }
          }}
          currentFactionId={userFactionId}
        />
      )}

      {showLeaderboard && (
        <LeaderboardModal onClose={() => setShowLeaderboard(false)} />
      )}

      {selectedPlayerId && (
        <PlayerProfileModal
          playerId={selectedPlayerId}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}

      {!addPlaceMode && !authLoading && isAuthenticated && <VersionBadge />}

      {/* Navbar mobile (masquée sur desktop via CSS) */}
      {!addPlaceMode && !authLoading && isAuthenticated && <MobileNavbar />}

      {/* Overlay texture parchemin */}
      {!addPlaceMode && <div className="parchment-overlay" />}
    </div>
  )
}

export default App
