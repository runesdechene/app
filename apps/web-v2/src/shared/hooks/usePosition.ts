/**
 * QUOI     — ma position, ou pourquoi on ne l'a pas, pour les boutons de visite.
 * POURQUOI — le bouton de visite change d'état quand on s'approche, sans recharger : il lit le
 *            suivi de l'app (`useSuivrePosition`). « Me localiser » redemande l'autorisation.
 */
import { useAutorisationPosition } from './useAutorisationPosition'
import { useMaPosition } from './useMaPosition'

// Ma position, ou pourquoi on ne l'a pas.
export type Position = 'inconnue' | 'refusee' | { lat: number; lng: number }

export function usePosition(): { position: Position; demander: () => void } {
  const point = useMaPosition()
  const { autorisation, autoriser } = useAutorisationPosition()
  const position: Position = point
    ? { lat: point.latitude, lng: point.longitude }
    : autorisation === 'refusee' || !('geolocation' in navigator)
      ? 'refusee'
      : 'inconnue'
  return {
    position,
    demander: () => {
      void autoriser()
    },
  }
}
