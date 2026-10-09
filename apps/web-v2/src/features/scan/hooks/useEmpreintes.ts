/**
 * QUOI     — les empreintes de référence et la liste des Fragments visibles, gardées en cache.
 * POURQUOI — elles ne changent qu'aux synchros du Hub et quand un admin ajoute une vue ; ce dernier
 *            invalide `['scan', 'empreintes']` (FeuilleApprendre).
 */
import { useQuery } from '@tanstack/react-query'
import { fetchEmpreintes, fetchFragmentsVisibles } from '../api/scan'

export function useEmpreintes() {
  const query = useQuery({
    queryKey: ['scan', 'empreintes'],
    queryFn: fetchEmpreintes,
    staleTime: 10 * 60 * 1000,
  })
  return { fragments: query.data, erreur: query.isError }
}

export function useFragmentsVisibles() {
  return useQuery({
    queryKey: ['scan', 'fragments'],
    queryFn: fetchFragmentsVisibles,
    staleTime: 60 * 60 * 1000,
  }).data
}
