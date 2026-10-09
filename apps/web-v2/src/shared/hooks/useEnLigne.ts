/**
 * QUOI     — le téléphone a-t-il du réseau ? (au sens du navigateur)
 * POURQUOI — le pin se pose sans réseau (Uriel, 06/10) : l'écran le dit, et le retour du réseau
 *            déclenche l'envoi des pins en attente.
 */
import { useSyncExternalStore } from 'react'

function suivre(rappel: () => void) {
  window.addEventListener('online', rappel)
  window.addEventListener('offline', rappel)
  return () => {
    window.removeEventListener('online', rappel)
    window.removeEventListener('offline', rappel)
  }
}

export function useEnLigne(): boolean {
  return useSyncExternalStore(suivre, () => navigator.onLine, () => true)
}
