import { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePlayer } from '../hooks/usePlayer'
import { useChat } from '../hooks/useChat'
import { useResourceTimers } from '../hooks/useResourceTimers'
import { useGeolocationWatch } from '../hooks/useGeolocationWatch'
import { useNotifications } from '../hooks/useNotifications'
import { useLevel } from '../hooks/useLevel'
import { MobileTopBar } from '../components/navigation/MobileTopBar'
import { MobileStatsBar } from '../components/navigation/MobileStatsBar'
import { BottomTabbar } from '../components/navigation/BottomTabbar'
import { MobileSelectionModals } from '../components/navigation/MobileSelectionModals'
import { FactionModal } from '../components/auth/FactionModal'
import { GameToast } from '../components/map/overlays/GameToast'
import { usePlayerStore } from '../stores/playerStore'
import './MobileLayout.css'

export interface MobileLayoutContext {
  /** Ouvre la FactionModal (sélection/changement de Maison). Montée par MobileLayout. */
  openFactionModal: () => void
}

/**
 * Layout commun aux pages mobile (/accueil, /chat, /activite).
 *
 * Monte MobileTopBar + MobileStatsBar + BottomTabbar UNE SEULE FOIS,
 * la navigation entre routes ne re-monte que le contenu (via Outlet).
 *
 * Aussi monte les hooks d'init globaux : usePlayer (set userId du store,
 * pré-requis pour useChat / useResourceTimers / etc.), useChat (alimenter
 * chatStore + Realtime), useResourceTimers (tick énergie).
 *
 * /carte (MapPage) reste hors de ce layout : il a son propre wrapping
 * spécifique pour le header overlay sur la carte MapLibre.
 */
export default function MobileLayout() {
  const { user } = useAuth()
  const userFactionId = usePlayerStore((s) => s.userFactionId)
  const userId = usePlayerStore((s) => s.userId)
  const tutorialCompletedAt = usePlayerStore((s) => s.tutorialCompletedAt)
  const [showFactionModal, setShowFactionModal] = useState(false)
  const navigate = useNavigate()

  // Init globaux — appelés une seule fois au layout, partagés entre toutes
  // les routes enfants. Plus besoin de les répéter dans HomePage / ChatPage / etc.
  usePlayer()
  useResourceTimers()
  useChat()
  // V0.7.7 (10/05) — déclenche le prompt de geoloc dès le lancement de
  // l'app (avant, on attendait que l'utilisateur ouvre la carte).
  useGeolocationWatch()
  // V0.7.7 (10/05) — fetch + Realtime des notifs perso. Avant, ce hook
  // tournait UNIQUEMENT dans MapPage : si l'utilisateur démarrait sur
  // /accueil ou /activite, il n'avait aucune notification (cloche vide).
  useNotifications()
  // V0.7.11 (10/05) — fetch initial du niveau via get_player_profile (sinon
  // la stats bar reste à niveau 1 tant qu'on n'a pas ouvert la carte).
  useLevel()

  // V0.8.17 — depuis V0.7.8 (RootRedirect platform-aware) les nouveaux users
  // mobile atterrissent sur /accueil, où le flux tutoriel + onboarding +
  // sélection de Maison n'a JAMAIS été monté (il vit dans MapPage). Résultat :
  // ils voyaient UpdateBanner + pub mais aucun tuto. Redirection vers /carte
  // tant que tutorial_completed_at est null. userId set = data fetched par
  // usePlayer (sinon on attendrait sur l'état initial null du store et on
  // redirigerait à tort un user dont les data ne sont pas encore arrivées).
  useEffect(() => {
    if (userId && tutorialCompletedAt === null) {
      navigate('/carte', { replace: true })
    }
  }, [userId, tutorialCompletedAt, navigate])

  if (!user) return null
  // Pendant le redirect : pas de flash de HomePage avec UpdateBanner + pub
  if (userId && tutorialCompletedAt === null) return null

  return (
    <div className="mobile-layout">
      <MobileTopBar onFactionModal={() => setShowFactionModal(true)} />
      <MobileStatsBar />

      <Outlet context={{ openFactionModal: () => setShowFactionModal(true) } satisfies MobileLayoutContext} />

      <BottomTabbar />
      <MobileSelectionModals />

      {showFactionModal && (
        <FactionModal
          onClose={() => setShowFactionModal(false)}
          currentFactionId={userFactionId}
        />
      )}
      <GameToast />
      {/* GeolocationPrompt déplacé dans RequireAuth (overlay racine). */}
    </div>
  )
}
