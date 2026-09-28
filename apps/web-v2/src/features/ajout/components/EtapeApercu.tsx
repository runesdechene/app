/**
 * QUOI     — l'aperçu (ébauche, rempli dans la nuit du 29/09).
 */
import type { Ajout } from '../api/lireAjout'
import type { Brouillon } from '../lib/brouillon'

export function EtapeApercu({
  onRetour,
}: {
  brouillon: Brouillon
  onRetour: () => void
  onPose: (ajout: Ajout) => void
}) {
  return (
    <button type="button" onClick={onRetour}>
      Revenir au récit
    </button>
  )
}
