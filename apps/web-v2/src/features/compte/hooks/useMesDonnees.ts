/**
 * QUOI     — télécharger ses données, supprimer son compte : deux actions qui attendent la base.
 */
import { useMutation } from '@tanstack/react-query'
import { supprimerMonCompte, telechargerMesDonnees } from '../api/mesDonnees'

export function useTelechargerMesDonnees() {
  return useMutation({ mutationFn: telechargerMesDonnees })
}

export function useSupprimerMonCompte() {
  return useMutation({ mutationFn: supprimerMonCompte })
}
