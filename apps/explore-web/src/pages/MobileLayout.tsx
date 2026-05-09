import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePlayer } from '../hooks/usePlayer'
import { useChat } from '../hooks/useChat'
import { useResourceTimers } from '../hooks/useResourceTimers'
import { MobileTopBar } from '../components/navigation/MobileTopBar'
import { MobileStatsBar } from '../components/navigation/MobileStatsBar'
import { BottomTabbar } from '../components/navigation/BottomTabbar'
import { MobileSelectionModals } from '../components/navigation/MobileSelectionModals'
import { FactionModal } from '../components/auth/FactionModal'
import { GameToast } from '../components/map/overlays/GameToast'
import { usePlayerStore } from '../stores/playerStore'
import './MobileLayout.css'

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
  const [showFactionModal, setShowFactionModal] = useState(false)

  // Init globaux — appelés une seule fois au layout, partagés entre toutes
  // les routes enfants. Plus besoin de les répéter dans HomePage / ChatPage / etc.
  usePlayer()
  useResourceTimers()
  useChat()

  if (!user) return null

  return (
    <div className="mobile-layout">
      <MobileTopBar onFactionModal={() => setShowFactionModal(true)} />
      <MobileStatsBar />

      <Outlet />

      <BottomTabbar />
      <MobileSelectionModals />

      {showFactionModal && (
        <FactionModal
          onClose={() => setShowFactionModal(false)}
          currentFactionId={userFactionId}
        />
      )}
      <GameToast />
    </div>
  )
}
