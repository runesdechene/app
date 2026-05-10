import { useState, useEffect, useRef } from 'react'
import { ExploreMap } from '../components/map/core/ExploreMap'
import { EnergyIndicator } from '../components/map/badges/EnergyIndicator'
import { CrownsBadge } from '../components/map/badges/CrownsBadge'
import { CoupeBadge } from '../components/map/badges/CoupeBadge'
import { NotorietyInfoModal } from '../components/map/modals/NotorietyInfoModal'
import { PlacePanel } from '../components/places/views/PlacePanel'
import { AuthModal } from '../components/auth/AuthModal'
import { FactionModal } from '../components/auth/FactionModal'
import { OnboardingModal } from '../components/auth/OnboardingModal'
import { ProfileMenu } from '../components/auth/ProfileMenu'
import { GeolocationPrompt } from '../components/auth/GeolocationPrompt'
import { FactionBar } from '../components/map/badges/FactionBar'
import { InfoModal } from '../components/map/modals/InfoModal'
import { GameToast } from '../components/map/overlays/GameToast'
import { VoronoiTuningPanel } from '../components/map/overlays/VoronoiTuningPanel'
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
// MobileHeader legacy — import supprimé (composant désactivé, remplacé par MobileTopBar partagée)
import { useMobileNavStore } from '../stores/mobileNavStore'
import { useIsDesktop } from '../hooks/useMediaQuery'
import { MobileTopBar } from '../components/navigation/MobileTopBar'
import { MobileStatsBar } from '../components/navigation/MobileStatsBar'
import { BottomTabbar } from '../components/navigation/BottomTabbar'
import { useAppConfigStore } from '../stores/appConfigStore'
import { useGloryRulesStore } from '../stores/gloryRulesStore'
import { DailyEnigma } from '../components/enigma/DailyEnigma'
import { EnigmaChestButton } from '../components/enigma/EnigmaChestButton'
import { FragmentEnigma } from '../components/enigma/FragmentEnigma'
import { NotificationBell } from '../components/notifications/NotificationBell'
import { ExpeditionsHud } from '../components/expeditions/ExpeditionsHud'
import { CreateMenu } from '../components/map/controls/CreateMenu'
import { useExpeditionsStore } from '../stores/expeditionsStore'
import { TutorialModal } from '../components/tutorial/TutorialModal'
import type { TutorialSlide } from '../components/tutorial/TutorialModal'
import { useNotifications } from '../hooks/useNotifications'
import { useCourtNotifications } from '../hooks/useCourtNotifications'
import { PushPromptHost, PushSubscriptionSync, PushAutoPrompt } from '../hooks/useEnsurePushPermission'
import { useCourtInvestedLoad } from '../hooks/useCourtInvestedLoad'
import { HeritagesToggle } from '../components/map/controls/HeritagesToggle'
import { useLevel } from '../hooks/useLevel'
import { useLevelUp } from '../hooks/useLevelUp'
import { LevelUpModal } from '../components/levelup/LevelUpModal'
import { VeteranWelcomeModal } from '../components/levelup/VeteranWelcomeModal'
import { VictoryModal } from '../components/map/modals/VictoryModal'
import { useVictoryModalStore } from '../stores/victoryModalStore'
import { supabase } from '../lib/supabase'
import shopIcon from '../assets/shop_icon.webp'
import '../App.css'
import '../styles/mobile.css'

function NotorietyBadge({ onClick }: { onClick: () => void }) {
  // V0.7 — affiche le NIVEAU dans le badge (au lieu de la Gloire brute).
  // Au clic : NotorietyInfoModal partagée (source unique avec StatsBar).
  const level = usePlayerStore(s => s.level)
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
        <span className="notoriety-icon">Niv</span>
        <span className="notoriety-value">{level}</span>
      </div>

      {showInfo && (
        <NotorietyInfoModal
          onClose={() => setShowInfo(false)}
          onOpenLeaderboard={onClick}
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
  const [showCreateMenu, setShowCreateMenu] = useState(false)
  const [showAddPlaceInfo, setShowAddPlaceInfo] = useState(false)
  const [showDailyEnigma, setShowDailyEnigma] = useState(false)
  const [enigmaRefreshKey, setEnigmaRefreshKey] = useState(0)
  const [fragmentEnigma, setFragmentEnigma] = useState<{ fragmentId: number; name: string; icon: string | null; iconUrl: string | null } | null>(null)
  const [tutorialPhase, setTutorialPhase] = useState<'before' | 'after' | null>(null)
  const [tutorialSlides, setTutorialSlides] = useState<TutorialSlide[]>([])
  const tutorialCompletedAt = usePlayerStore(s => s.tutorialCompletedAt)
  const replayTutorial = usePlayerStore(s => s.replayTutorial)

  const userId = usePlayerStore(s => s.userId)
  const userFactionId = usePlayerStore(s => s.userFactionId)
  const userName = usePlayerStore(s => s.userName)
  const isAdmin = usePlayerStore(s => s.isAdmin)
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
  // V0.7 phase 5 — toasts La Cour (attaque, bascule, mécène principal…)
  useCourtNotifications()
  // V0.7.3 — charge les Couronnes investies par lieu pour pondérer le Voronoï
  useCourtInvestedLoad(isAuthenticated)
  useResourceTimers()

  // V0.7 — Système de niveaux
  useLevel(true)
  const { pendingLevelUp, dismiss } = useLevelUp()
  const pendingVictory = useVictoryModalStore(s => s.pending)
  const dismissVictory = useVictoryModalStore(s => s.dismiss)
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

  // Replay tutoriel via menu profil. Si slides déjà chargées, on rejoue direct ;
  // sinon on fetch puis on rejoue. Ne touche pas à tutorialCompletedAt en DB.
  useEffect(() => {
    if (!replayTutorial || !userId || tutorialPhase !== null) return
    if (tutorialSlides.length > 0) {
      setTutorialPhase('before')
    } else {
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
          } else {
            usePlayerStore.getState().setReplayTutorial(false)
          }
        })
    }
  }, [replayTutorial, userId, tutorialPhase, tutorialSlides.length])

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
    // Replay : on sort proprement, ni faction modal ni mark_complete (déjà fait).
    if (usePlayerStore.getState().replayTutorial) {
      usePlayerStore.getState().setReplayTutorial(false)
      return
    }
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
    // En replay, ne pas re-marquer le tuto en DB — on remet juste le flag à false.
    if (usePlayerStore.getState().replayTutorial) {
      usePlayerStore.getState().setReplayTutorial(false)
      return
    }
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
  const isDesktop = useIsDesktop()

  return (
    <div className="app" data-mobile-panel={mobilePanel || ''}>
      <PushPromptHost />
      <PushSubscriptionSync />
      <PushAutoPrompt />
{/* Header mobile partagé — fixé au-dessus de la carte (masqué sur desktop via CSS) */}
      {!isDesktop && (
        <div className="map-mobile-header-fixed">
          <MobileTopBar onFactionModal={() => setShowFactionModal(true)} />
          <MobileStatsBar fadeOutBottom />
        </div>
      )}

      <ExploreMap />
      <InstallPrompt />
      <OfflineIndicator />

      {!addPlaceMode && !authLoading && isAuthenticated && (
        <div className="influence-area">
          <HeritagesToggle />
          <FactionBar />
        </div>
      )}
      {!addPlaceMode && !authLoading && isAuthenticated && (
        <div className="hud-left-stack">
          <GameToast />
          <ExpeditionsHud />
        </div>
      )}
      {/* ChatPanel flottant : desktop uniquement. Sur mobile, le chat passe par /chat. */}
      {!addPlaceMode && !authLoading && isAuthenticated && isDesktop && <ChatPanel />}
      {!addPlaceMode && !authLoading && isAuthenticated && isAdmin && <VoronoiTuningPanel />}

      {/* MobileHeader legacy — désactivé : remplacé par MobileTopBar + MobileStatsBar ci-dessus.
          Garder l'import pour éviter une refacto partielle (chore: remove legacy MobileHeader plus tard).
          {!addPlaceMode && !authLoading && isAuthenticated && user?.email && (
            <MobileHeader email={user.email} onSignOut={signOut} onFactionModal={() => setShowFactionModal(true)} />
          )} */}

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
        <div className="app-toolbar">
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

      {/* FAB Créer (lieu OU expédition) — toujours actif, le menu gère le verrou lieu */}
      {!authLoading && isAuthenticated && userId && !addPlaceMode && (
        <button
          className="add-place-fab"
          onClick={() => setShowCreateMenu(true)}
          aria-label="Créer un lieu ou un événement"
        >+</button>
      )}

      {showCreateMenu && (
        <CreateMenu
          canAddPlace={canAddPlace}
          discoveriesNeeded={discoveriesNeeded}
          onAddPlace={() => {
            setShowCreateMenu(false)
            setAddPlaceMode(true)
          }}
          onAddPlaceLocked={() => {
            setShowCreateMenu(false)
            setShowAddPlaceInfo(true)
          }}
          onCreateExpedition={() => {
            setShowCreateMenu(false)
            useExpeditionsStore.getState().requestOpenCreator(true)
          }}
          onClose={() => setShowCreateMenu(false)}
        />
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
          mobileFullscreen
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

      {/* MobileNavbar legacy — supprimée sur mobile (remplacée par BottomTabbar partagée).
          Reste montée uniquement sur desktop pour ne pas casser les data-mobile-panel= CSS existants
          si jamais ce code est atteint sur desktop (MobileNavbar est de toute façon invisible via CSS). */}
      {!addPlaceMode && !authLoading && isAuthenticated && isDesktop && <MobileNavbar />}

      {/* BottomTabbar partagée — masquée sur desktop via CSS (min-width: 750px → display:none) */}
      {!isDesktop && <BottomTabbar />}

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

      {/* V0.7.6 — Modale Victoire (lieu pris par mécénat).
          Trigger via useVictoryModalStore depuis useCourtNotifications. */}
      {pendingVictory && (
        <VictoryModal
          placeTitle={pendingVictory.placeTitle}
          fromVacant={pendingVictory.fromVacant}
          factionColor={pendingVictory.factionColor}
          onClose={dismissVictory}
        />
      )}

      {/* Overlay texture parchemin */}
      {!addPlaceMode && <div className="parchment-overlay" />}

      <GeolocationPrompt />
    </div>
  )
}
