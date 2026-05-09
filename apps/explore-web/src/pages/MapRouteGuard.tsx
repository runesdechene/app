import { Navigate } from 'react-router-dom'
import { useIsDesktop } from '../hooks/useMediaQuery'
import { MainShell } from './MainShell'

/**
 * Garde la route /carte :
 *  - Desktop : redirige vers /accueil (le split-view affiche déjà la carte à droite).
 *  - Mobile : rend la MapPage seule via MainShell.
 */
export default function MapRouteGuard() {
  const isDesktop = useIsDesktop()
  if (isDesktop) return <Navigate to="/accueil" replace />
  return <MainShell view="map" />
}
