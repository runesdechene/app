/**
 * QUOI     — vrai sur un écran d'ordinateur (1024 px et plus, le seuil de la coquille), et suit
 *            le redimensionnement.
 * POURQUOI — ce que le CSS ne peut pas faire seul : ne pas monter du tout ce qui ne sert qu'au PC
 *            (la carte derrière l'onboarding, lourde à charger sur un téléphone).
 */
import { useSyncExternalStore } from 'react'

const REQUETE = '(width >= 1024px)'

function sAbonner(prevenir: () => void) {
  const media = window.matchMedia(REQUETE)
  media.addEventListener('change', prevenir)
  return () => {
    media.removeEventListener('change', prevenir)
  }
}

export function useSurOrdinateur(): boolean {
  return useSyncExternalStore(sAbonner, () => window.matchMedia(REQUETE).matches)
}
