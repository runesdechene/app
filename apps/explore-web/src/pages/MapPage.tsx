import { useState, useEffect, useRef } from 'react'
import { ExploreMap } from '../components/map/core/ExploreMap'
import { EnergyIndicator } from '../components/map/badges/EnergyIndicator'
import { CrownsBadge } from '../components/map/badges/CrownsBadge'
import { CoupeBadge } from '../components/map/badges/CoupeBadge'
import { useGlory } from '../hooks/useGlory'
import { PlacePanel } from '../components/places/views/PlacePanel'
import { AuthModal } from '../components/auth/AuthModal'
import { FactionModal } from '../components/auth/FactionModal'
import { OnboardingModal } from '../components/auth/OnboardingModal'
import { ProfileMenu } from '../components/auth/ProfileMenu'
import { FactionBar } from '../components/map/badges/FactionBar'
import { InfoModal } from '../components/map/modals/InfoModal'
import { GameToast } from '../components/map/overlays/GameToast'
import { PlayerProfileModal } from '../components/map/modals/PlayerProfileModal'
import { LeaderboardModal } from '../components/map/modals/LeaderboardModal'
import { VersionBadge } from '../components/map/badges/VersionBadge'
import { TerritoryPanel } from '../components/map/modals/TerritoryPanel'
import { useMapStore } from '../stores/mapStore'
import { usePlayerStore } from '../stores/playerStore'
import { useAuth } from '../hooks/useAuth'
import { usePlayer } from '../hooks/usePlayer'
import { usePresence } from '../hooks/usePresence'
import { useBrouillagePistes } from '../hooks/useBrouillagePistes'
import { useTimezoneSync } from '../hooks/useTimezoneSync'
import { useChat } from '../hooks/useChat'
import { useResourceTimers } from '../hooks/useResourceTimers'
import { ChatPanel } from '../components/chat/ChatPanel'
import { AddPlaceFlow } from '../components/places/modals/AddPlaceFlow'
import { InstallPrompt } from '../components/pwa/InstallPrompt'
import { OfflineIndicator } from '../components/pwa/OfflineIndicator'
import { MobileNavbar } from '../components/map/controls/MobileNavbar'
import { MobileHeader } from '../components/map/controls/MobileHeader'
import { useMobileNavStore } from '../stores/mobileNavStore'
import { useAppConfigStore } from '../stores/appConfigStore'
import { useGloryRulesStore } from '../stores/gloryRulesStore'
import { AdScreen } from '../components/map/overlays/AdScreen'
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
import { supabase } from '../lib/supabase'
import shopIcon from '../assets/shop_icon.webp'
import '../App.css'
import '../styles/mobile.css'

function NotorietyBadge({ onClick }: { onClick: () => void }) {
  // V0.7 — affiche le NIVEAU dans le badge (au lieu de la Gloire brute).
  // Au clic : modale narrative avec le détail des compteurs par axe d'action.
  const { state: glory } = useGlory(true, 30000)
  const level = usePlayerStore(s => s.level)
  const xpTotal = usePlayerStore(s => s.xpTotal)
  const xpToNextLevel = usePlayerStore(s => s.xpToNextLevel)
  const [showInfo, setShowInfo] = useState(false)

  const isCap = level >= 50
  const description = isCap
    ? `Tu as atteint le sommet — ${xpTotal} Gloire cumulée. Tu es Légende.`
    : `Ton parcours de Veilleur — ${xpTotal} Gloire récoltée au fil de tes pas. Encore ${xpToNextLevel} avant le niveau ${level + 1}.`

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
        <span className="notoriety-icon">Niv</span>
        <span className="notoriety-value">{level}</span>
      </div>

      {showInfo && (
        <InfoModal
          icon={'🎖️'}
          title={`Niveau ${level}`}
          description={description}
          rows={
            glory ? [
              { label: '🥾 Lieux foulés (GPS)',           value: `${glory.lieuxExplores}` },
              { label: '📜 Lieux cartographiés',          value: `${glory.lieuxAjoutes}` },
              { label: '🏴 Plantages de bannière',        value: `${glory.plantages}` },
              { label: '✍️ Récits écrits',                value: `${glory.carnets}` },
              { label: '📷 Photos ajoutées',              value: `${glory.photos}` },
              (() => {
                const easyTotal = glory.enigmes.easy + glory.enigmes.veryEasy
                const parts = [
                  glory.enigmes.hard   ? `${glory.enigmes.hard} difficile${glory.enigmes.hard > 1 ? 's' : ''}`     : null,
                  glory.enigmes.medium ? `${glory.enigmes.medium} moyenne${glory.enigmes.medium > 1 ? 's' : ''}`   : null,
                  easyTotal            ? `${easyTotal} facile${easyTotal > 1 ? 's' : ''} ou très facile${easyTotal > 1 ? 's' : ''}` : null,
                ].filter(Boolean).join(', ')
                return {
                  label: glory.enigmes.total > 0
                    ? `🦉 Énigmes résolues (${parts})`
                    : '🦉 Énigmes résolues',
                  value: `${glory.enigmes.total}`,
                }
              })(),
            ] : []
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

  // Gating Cartographier : 3 lieux découverts (décision Uriel 2026-05-02 — règle simple,
  // indépendante du système de niveaux/quêtes). Le titre "Explorateur" reste un titre de
  // profil mais ne gate plus l'ajout de lieu.
  const discoveriesCount = usePlayerStore(s => s.discoveredIds.size)
  const MIN_DISCOVERIES_FOR_ADD_PLACE = 3
  const canAddPlace = discoveriesCount >= MIN_DISCOVERIES_FOR_ADD_PLACE
  const discoveriesNeeded = Math.max(0, MIN_DISCOVERIES_FOR_ADD_PLACE - discoveriesCount)

  // Initialiser le fog state (découvertes + énergie) dès l'auth
  usePlayer()
  // Présence temps réel sur la carte
  usePresence()
  // V0.7+ Brouillage GPS — calcule la position floutée publiée aux autres
  useBrouillagePistes()
  // V0.7+ Mini-quêtes journalières — sync timezone du device pour le reset minuit local
  useTimezoneSync()
  // Chat en jeu
  useChat()
  useNotifications()
  useResourceTimers()

  // V0.7 — Système de niveaux
  useLevel(true)
  const { pendingLevelUp, dismiss } = useLevelUp()
  const veteranFirstEra = usePlayerStore(s => s.veteranFirstEra)
  const [showVeteranWelcome, setShowVeteranWelcome] = useState(false)

  // Veteran welcome : on lit veteran_welcomed_at en DB (mig 066) plutôt que
  // localStorage qui est purgé par le service worker PWA à chaque update.
  useEffect(() => {
    if (!userId || !veteranFirstEra) return
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('users')
        .select('veteran_welcomed_at')
        .eq('id', userId)
        .maybeSingle()
      if (cancelled || error) return
      const welcomedAt = (data as { veteran_welcomed_at: string | null } | null)?.veteran_welcomed_at
      if (!welcomedAt) setShowVeteranWelcome(true)
    })()
    return () => { cancelled = true }
  }, [userId, veteranFirstEra])

  async function handleVeteranWelcomeClose() {
    setShowVeteranWelcome(false)
    const { error } = await supabase.rpc('dismiss_veteran_welcome')
    if (error) console.warn('[MapPage] dismiss_veteran_welcome failed', error)
  }

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
    // Barème Gloire/Coupe centralisé (mig 067) — chargé une fois, lu partout
    useGloryRulesStore.getState().fetchRules()
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

      {/* FAB Ajouter un lieu — verrouillé si moins de 3 lieux découverts */}
      {!authLoading && isAuthenticated && userId && !addPlaceMode && (
        <button
          className={`add-place-fab ${!canAddPlace ? 'locked' : ''}`}
          onClick={() => {
            if (!canAddPlace) {
              setShowAddPlaceInfo(true)
            } else {
              setAddPlaceMode(true)
            }
          }}
          aria-label="Ajouter un lieu"
        >
          {!canAddPlace ? '🔒' : '+'}
        </button>
      )}

      {showAddPlaceInfo && !canAddPlace && (
        <InfoModal
          icon="🗺️"
          title="Cartographier"
          description={`Pour ajouter un lieu sur la carte, découvre d'abord ${MIN_DISCOVERIES_FOR_ADD_PLACE} lieux. Continue d'explorer pour le débloquer.`}
          rows={[
            { label: 'Condition', value: `Découvrir ${MIN_DISCOVERIES_FOR_ADD_PLACE} lieux` },
            { label: 'Découvertes actuelles', value: `${discoveriesCount} / ${MIN_DISCOVERIES_FOR_ADD_PLACE}` },
            { label: 'Reste', value: discoveriesNeeded === 0 ? 'Débloqué !' : `${discoveriesNeeded} découverte${discoveriesNeeded > 1 ? 's' : ''}` },
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
        <VeteranWelcomeModal onClose={handleVeteranWelcomeClose} />
      )}

      {/* Overlay texture parchemin */}
      {!addPlaceMode && <div className="parchment-overlay" />}
    </div>
  )
}
