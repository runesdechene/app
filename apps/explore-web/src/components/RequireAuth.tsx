import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usePlayerStore } from '../stores/playerStore'
import { AdScreen } from './map/overlays/AdScreen'
import { ChangelogModal } from './map/badges/VersionBadge'
import { GeolocationPrompt } from './auth/GeolocationPrompt'
import { isDemoMode } from '../lib/demo/isDemoMode'

export default function RequireAuth() {
  const { user, loading } = useAuth()
  const tutorialCompletedAt = usePlayerStore(s => s.tutorialCompletedAt)
  // One-shot par session : true au mount de RequireAuth, false après dismiss.
  // Reset uniquement au F5 / relance app — cohérent avec l'attente "une seule
  // fois quand on lance l'app" (peu importe la route d'arrivée).
  const [showAd, setShowAd] = useState(true)

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', minHeight: '100vh' }}>
        Chargement...
      </div>
    )
  }

  if (!user) {
    // En démo, l'auto-login de la borne est en cours : afficher le loader plutôt
    // que rediriger (évite un ping-pong avec la redirection /→/carte du mode démo).
    if (isDemoMode()) {
      return (
        <div style={{ padding: '4rem', textAlign: 'center', minHeight: '100vh' }}>
          Chargement...
        </div>
      )
    }
    return <Navigate to="/" replace />
  }

  // Gating : seulement après que le tuto soit complété en DB.
  // L'AdScreen gère déjà le cas userName === '' (onboarding) en s'auto-fermant.
  const canShowAd = showAd && tutorialCompletedAt !== null

  return (
    <>
      <Outlet />
      {/* Mode démo borne : aucun pop-up (changelog, GPS, pub) — expérience nette. */}
      {!isDemoMode() && <ChangelogModal />}
      {!isDemoMode() && <GeolocationPrompt />}
      {!isDemoMode() && canShowAd && <AdScreen onDone={() => setShowAd(false)} />}
    </>
  )
}
