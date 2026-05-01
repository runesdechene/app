import { useState, useEffect, useRef } from 'react'
import { ExploreMap } from '../components/map/ExploreMap'
import { EnergyIndicator } from '../components/map/EnergyIndicator'
import { CrownsBadge } from '../components/map/CrownsBadge'
import { CoupeBadge } from '../components/map/CoupeBadge'
import { useGlory, readCachedGlory } from '../hooks/useGlory'
import { PlacePanel } from '../components/places/PlacePanel'
import { AuthModal } from '../components/auth/AuthModal'
import { FactionModal } from '../components/auth/FactionModal'
import { OnboardingModal } from '../components/auth/OnboardingModal'
import { ProfileMenu } from '../components/auth/ProfileMenu'
import { FactionBar } from '../components/map/FactionBar'
import { InfluenceToggle } from '../components/map/InfluenceToggle'
import { InfoModal } from '../components/map/InfoModal'
import { GameToast } from '../components/map/GameToast'
import { PlayerProfileModal } from '../components/map/PlayerProfileModal'
import { LeaderboardModal } from '../components/map/LeaderboardModal'
import { VersionBadge } from '../components/map/VersionBadge'
import { TerritoryPanel } from '../components/map/TerritoryPanel'
import { useMapStore } from '../stores/mapStore'
import { usePlayerStore } from '../stores/playerStore'
import { useAuth } from '../hooks/useAuth'
import { usePlayer } from '../hooks/usePlayer'
import { usePresence } from '../hooks/usePresence'
import { useChat } from '../hooks/useChat'
import { useResourceTimers } from '../hooks/useResourceTimers'
import { ChatPanel } from '../components/chat/ChatPanel'
import { AddPlaceFlow } from '../components/places/AddPlaceFlow'
import { InstallPrompt } from '../components/pwa/InstallPrompt'
import { OfflineIndicator } from '../components/pwa/OfflineIndicator'
import { MobileNavbar } from '../components/map/MobileNavbar'
import { MobileHeader } from '../components/map/MobileHeader'
import { useMobileNavStore } from '../stores/mobileNavStore'
import { useAppConfigStore } from '../stores/appConfigStore'
import { AdScreen } from '../components/map/AdScreen'
import { DailyEnigma } from '../components/enigma/DailyEnigma'
import { EnigmaChestButton } from '../components/enigma/EnigmaChestButton'
import { FragmentEnigma } from '../components/enigma/FragmentEnigma'
import { NotificationBell } from '../components/notifications/NotificationBell'
import { TutorialModal } from '../components/tutorial/TutorialModal'
import type { TutorialSlide } from '../components/tutorial/TutorialModal'
import { useNotifications } from '../hooks/useNotifications'
import { useLevel } from '../hooks/useLevel'
import { useLevelUp } from '../hooks/useLevelUp'
import { LevelUpModal } from '../components/levelup/LevelUpModal'
import { VeteranWelcomeModal } from '../components/levelup/VeteranWelcomeModal'
import { xpForLevel } from '../lib/levelCalc'
import { supabase } from '../lib/supabase'
import shopIcon from '../assets/shop_icon.webp'
import '../App.css'
import '../styles/mobile.css'

function NotorietyBadge({ onClick }: { onClick: () => void }) {
  // V0.7 phase 3.5 — Gloire calculée à la volée via get_my_glory.
  // readCachedGlory évite le flash 0 au boot le temps de l'appel RPC.
  const { state: glory } = useGlory(true, 30000)
  const displayGlory = glory?.glory ?? readCachedGlory()
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
        <span className="notoriety-icon">{'🎖️'}</span>
        <span className="notoriety-value">{displayGlory}</span>
      </div>

      {showInfo && (
        <InfoModal
          icon={'🎖️'}
          title={'Gloire'}
          description={'La Gloire récompense vos actions de jeu, cumulée depuis le début. Voici le détail de votre score, action par action.'}
          rows={
            glory ? [
              { label: 'Lieux explorés',    value: `${glory.lieuxExplores} × 1 = ${glory.lieuxExplores} pts` },
              {
                label: `Énigmes résolues${glory.enigmes.total > 0 ? ` (${glory.enigmes.hard}h • ${glory.enigmes.medium}m • ${glory.enigmes.easy + glory.enigmes.veryEasy}e)` : ''}`,
                value: `${glory.enigmes.total} × 1 = ${glory.enigmes.total} pts`,
              },
              { label: 'Photos ajoutées',   value: `${glory.photos} × 1 = ${glory.photos} pts` },
              { label: 'Carnets écrits',    value: `${glory.carnets} × 3 = ${glory.carnets * 3} pts` },
              { label: 'Plantages',         value: `${glory.plantages} × 5 = ${glory.plantages * 5} pts` },
              { label: 'Lieux ajoutés',     value: `${glory.lieuxAjoutes} × 7 = ${glory.lieuxAjoutes * 7} pts` },
              { label: 'Gloire totale',     value: `${glory.glory} pts`, highlight: true },
            ] : [
              { label: 'Gloire totale', value: `${displayGlory} pts`, highlight: true },
            ]
          }
          onClose={() => setShowInfo(false)}
          action={{ label: 'Voir le classement', onClick: () => { setShowInfo(false); onClick() } }}
        />
      )}
    </>
  )
}

export default function MapPage() {
  const selectedPlaceId = useMapStore(state => state.selectedPlaceId)
  const setSelectedPlaceId = useMapStore(state => state.setSelectedPlaceId)
  const selectedPlayerId = useMapStore(state => state.selectedPlayerId)
  const setSelectedPlayerId = useMapStore(state => state.setSelectedPlayerId)
  const { user, isAuthenticated, signOut, loading: authLoading } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showFactionModal, setShowFactionModal] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showAddPlaceInfo, setShowAddPlaceInfo] = useState(false)
  const [showAdScreen, setShowAdScreen] = useState(true)
  const [showDailyEnigma, setShowDailyEnigma] = useState(false)
  const [enigmaRefreshKey, setEnigmaRefreshKey] = useState(0)
  const [fragmentEnigma, setFragmentEnigma] = useState<{ fragmentId: number; name: string; icon: string | null; iconUrl: string | null } | null>(null)
  const [tutorialPhase, setTutorialPhase] = useState<'before' | 'after' | null>(null)
  const [tutorialSlides, setTutorialSlides] = useState<TutorialSlide[]>([])
  const tutorialCompletedAt = usePlayerStore(s => s.tutorialCompletedAt)

  const userId = usePlayerStore(s => s.userId)
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const userName = usePlayerStore(s => s.userName)
  const addPlaceMode = useMapStore(s => s.addPlaceMode)
  const setAddPlaceMode = useMapStore(s => s.setAddPlaceMode)
  const selectedTerritoryData = useMapStore(s => s.selectedTerritoryData)
  const setSelectedTerritoryData = useMapStore(s => s.setSelectedTerritoryData)

  // Le FAB "+" n'est visible que si un titre débloqué contient 'add_place'
  const unlockedTitles = usePlayerStore(s => s.unlockedGeneralTitles)
  const factionTitle = usePlayerStore(s => s.factionTitle2)
  const canAddPlace = unlockedTitles.some(t => t.unlocks?.includes('add_place'))
    || (factionTitle?.unlocks?.includes('add_place') ?? false)

  // Gating niveau 3 pour Cartographier
  const playerLevel = usePlayerStore(s => s.level)
  const playerXpTotal = usePlayerStore(s => s.xpTotal)
  const canAddPlaceByLevel = playerLevel >= 3
  const xpNeededForLevel3 = Math.max(0, xpForLevel(3) - playerXpTotal)

  // Initialiser le fog state (découvertes + énergie) dès l'auth
  usePlayer()
  // Présence temps réel sur la carte
  usePresence()
  // Chat en jeu
  useChat()
  useNotifications()
  useResourceTimers()

  // V0.7 — Système de niveaux
  useLevel(true)
  const { pendingLevelUp, dismiss } = useLevelUp()
  const veteranFirstEra = usePlayerStore(s => s.veteranFirstEra)
  const [showVeteranWelcome, setShowVeteranWelcome] = useState(false)

  useEffect(() => {
    if (!userId || !veteranFirstEra) return
    const seenKey = `veteranWelcomeSeen_${userId}`
    if (!localStorage.getItem(seenKey)) {
      setShowVeteranWelcome(true)
      localStorage.setItem(seenKey, '1')
    }
  }, [userId, veteranFirstEra])

  // Auto-open auth modal si non connecté (une seule fois par session)
  const authPromptDone = useRef(false)
  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated && !authPromptDone.current) {
      authPromptDone.current = true
      setShowAuthModal(true)
    }
  }, [authLoading, isAuthenticated])

  // Fetch app-wide config (share_text_template, etc.) une seule fois au mount
  useEffect(() => {
    useAppConfigStore.getState().fetchConfig()
  }, [])

  // Flux nouveau joueur : slides "before" → onboarding → slides "after" → FactionModal
  // Edge case (existant sans nom) : useEffect auto-déclenche onboarding après fetch tutorial
  const onboardingDone = useRef(false)
  const [tutorialFetchDone, setTutorialFetchDone] = useState(false)
  useEffect(() => {
    if (!userId) return
    // Cas normal : le handler du tutorial déclenche l'onboarding au bon moment.
    // Ce useEffect ne sert QUE pour l'edge case : user sans nom et pas de slides / tutorial déjà fini.
    const tutorialUnavailableOrDone =
      tutorialCompletedAt !== null || (tutorialFetchDone && tutorialSlides.length === 0)
    if (
      userName === '' &&
      !onboardingDone.current &&
      tutorialPhase === null &&
      tutorialUnavailableOrDone
    ) {
      onboardingDone.current = true
      setShowOnboarding(true)
    }
  }, [userId, userName, tutorialPhase, tutorialCompletedAt, tutorialFetchDone, tutorialSlides.length])

  // Tutorial : fetch slides si pas encore complété
  const tutorialFetched = useRef(false)
  useEffect(() => {
    if (!userId || tutorialCompletedAt !== null || tutorialFetched.current) return
    tutorialFetched.current = true

    supabase
      .from('tutorial_slides')
      .select('id, phase, position, title, body, image_url')
      .eq('active', true)
      .order('phase')
      .order('position')
      .then(({ data }) => {
        if (data && data.length > 0) {
          setTutorialSlides(data as TutorialSlide[])
          setTutorialPhase('before')
        }
        setTutorialFetchDone(true)
      })
  }, [userId, tutorialCompletedAt])

  function handleTutorialBeforeComplete() {
    setTutorialPhase(null)
    // Nouveau joueur → onboarding (puis slides "after" → faction au onComplete de l'onboarding)
    // Existant → passer à "after" si disponibles, sinon marquer terminé
    if (userName === '') {
      onboardingDone.current = true
      setShowOnboarding(true)
    } else {
      const afterSlides = tutorialSlides.filter(s => s.phase === 'after')
      if (afterSlides.length > 0) {
        setTutorialPhase('after')
      } else {
        markTutorialComplete()
      }
    }
  }

  function handleTutorialAfterComplete() {
    setTutorialPhase(null)
    // Si nouveau joueur sans faction → ouvrir FactionModal AVANT de marquer le tuto terminé
    // (la fermeture de FactionModal marquera le tuto terminé)
    if (!usePlayerStore.getState().userFactionId) {
      setShowFactionModal(true)
    } else {
      markTutorialComplete()
    }
  }

  function markTutorialComplete() {
    if (!userId) return
    supabase.rpc('mark_tutorial_complete', { p_user_id: userId }).then(({ data, error }) => {
      if (error) {
        console.warn('[MapPage] mark_tutorial_complete failed', error)
        return
      }
      if ((data as { error?: string })?.error) {
        console.warn('[MapPage] mark_tutorial_complete error', (data as { error: string }).error)
        return
      }
      usePlayerStore.getState().setTutorialCompletedAt(new Date().toISOString())
    })
  }

  const mobilePanel = useMobileNavStore(s => s.activePanel)

  return (
    <div className="app" data-mobile-panel={mobilePanel || ''}>
      {showAdScreen && isAuthenticated && !authLoading && (
        <AdScreen onDone={() => setShowAdScreen(false)} />
      )}
      <ExploreMap />
      <InstallPrompt />
      <OfflineIndicator />

      {!addPlaceMode && !authLoading && isAuthenticated && (
        <div className="influence-area">
          <InfluenceToggle />
          <FactionBar />
        </div>
      )}
      {!addPlaceMode && !authLoading && isAuthenticated && <GameToast />}
      {!addPlaceMode && !authLoading && isAuthenticated && <ChatPanel />}

      {/* Header mobile (logo + hamburger, masqué sur desktop) */}
      {!addPlaceMode && !authLoading && isAuthenticated && user?.email && (
        <MobileHeader email={user.email} onSignOut={signOut} onFactionModal={() => setShowFactionModal(true)} />
      )}

      {/* Bouton Boutique permanent desktop (masqué sur mobile + quand auth modal ouverte) */}
      {!addPlaceMode && !showAuthModal && (
        <a
          href="https://runesdechene.com"
          target="_blank"
          rel="noopener noreferrer"
          className="desktop-shop-button"
        >
          <img src={shopIcon} alt="" className="desktop-shop-icon" />
          <span>Visiter la Boutique officielle</span>
        </a>
      )}

      {/* Toolbar flottante (masquée en mode ajout) */}
      {!addPlaceMode && (
        <div className="app-toolbar" style={showAdScreen ? { visibility: 'hidden' } : undefined}>
          {!authLoading && isAuthenticated && (
            <>
              <NotorietyBadge onClick={() => setShowLeaderboard(true)} />
              <CoupeBadge />
              <CrownsBadge />
              <EnigmaChestButton
                onOpenDaily={() => setShowDailyEnigma(true)}
                onOpenFragment={(f) => setFragmentEnigma(f)}
                refreshKey={enigmaRefreshKey}
              />
              <NotificationBell />
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

      {/* FAB Ajouter un lieu — toujours visible, verrouille si niveau < 3 ou pas le titre */}
      {!authLoading && isAuthenticated && userId && !addPlaceMode && (
        <button
          className={`add-place-fab ${(!canAddPlaceByLevel || !canAddPlace) ? 'locked' : ''}`}
          onClick={() => {
            if (!canAddPlaceByLevel || !canAddPlace) {
              setShowAddPlaceInfo(true)
            } else {
              setAddPlaceMode(true)
            }
          }}
          aria-label="Ajouter un lieu"
        >
          {(!canAddPlaceByLevel || !canAddPlace) ? '🔒' : '+'}
        </button>
      )}

      {/* Info modal ajout de lieu */}
      {showAddPlaceInfo && !canAddPlaceByLevel && (
        <InfoModal
          icon="🗺️"
          title="Cartographier"
          description={`L'ajout de lieux est réservé aux Veilleurs de niveau 3 et plus. Continue d'explorer pour le débloquer.`}
          rows={[
            { label: 'Niveau requis', value: 'Niveau 3' },
            { label: 'Ton niveau actuel', value: `Niveau ${playerLevel}` },
            { label: 'Gloire manquante', value: `${xpNeededForLevel3} avant le niveau 3` },
          ]}
          onClose={() => setShowAddPlaceInfo(false)}
        />
      )}
      {showAddPlaceInfo && canAddPlaceByLevel && !canAddPlace && (
        <InfoModal
          icon="🏛️"
          title="Ajouter un lieu"
          description="Pour pouvoir ajouter un lieu sur la carte, vous devez d'abord découvrir au moins 5 lieux et obtenir le titre d'Explorateur."
          rows={[
            { label: 'Condition', value: 'Découvrir 5 lieux' },
            { label: 'Titre requis', value: 'Explorateur' },
          ]}
          onClose={() => setShowAddPlaceInfo(false)}
        />
      )}

      {/* Daily Enigma modal */}
      {showDailyEnigma && (
        <DailyEnigma onClose={() => { setShowDailyEnigma(false); setEnigmaRefreshKey(k => k + 1) }} />
      )}

      {fragmentEnigma && (
        <FragmentEnigma fragment={fragmentEnigma} onClose={() => { setFragmentEnigma(null); setEnigmaRefreshKey(k => k + 1) }} />
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

      {tutorialPhase === 'before' && (
        <TutorialModal
          slides={tutorialSlides.filter(s => s.phase === 'before')}
          onComplete={handleTutorialBeforeComplete}
          lastSlideLabel="Commencer"
        />
      )}

      {tutorialPhase === 'after' && (
        <TutorialModal
          slides={tutorialSlides.filter(s => s.phase === 'after')}
          onComplete={handleTutorialAfterComplete}
          lastSlideLabel="C'est parti !"
        />
      )}

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}

      {showOnboarding && (
        <OnboardingModal onComplete={() => {
          setShowOnboarding(false)
          // Flux nouveau joueur : onboarding → slides "after" → FactionModal
          const afterSlides = tutorialSlides.filter(s => s.phase === 'after')
          if (afterSlides.length > 0 && !usePlayerStore.getState().tutorialCompletedAt) {
            setTutorialPhase('after')
          } else if (!usePlayerStore.getState().userFactionId) {
            // Pas de slides after → aller directement à la FactionModal
            setShowFactionModal(true)
          }
        }} />
      )}

      {showFactionModal && (
        <FactionModal
          onClose={() => {
            setShowFactionModal(false)
            // Si le tutorial n'est pas encore marqué terminé (flux nouveau joueur), le faire maintenant
            if (!usePlayerStore.getState().tutorialCompletedAt) {
              markTutorialComplete()
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

      {/* V0.7 — Modales niveau */}
      {pendingLevelUp && (
        <LevelUpModal
          levelBefore={pendingLevelUp.levelBefore}
          levelAfter={pendingLevelUp.levelAfter}
          onClose={dismiss}
        />
      )}
      {showVeteranWelcome && (
        <VeteranWelcomeModal onClose={() => setShowVeteranWelcome(false)} />
      )}

      {/* Overlay texture parchemin */}
      {!addPlaceMode && <div className="parchment-overlay" />}
    </div>
  )
}
