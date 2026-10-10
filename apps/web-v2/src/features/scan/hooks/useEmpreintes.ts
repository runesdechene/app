/**
 * QUOI     — les empreintes de référence et la liste des Fragments visibles, gardées en cache.
 * POURQUOI — elles ne changent qu'aux synchros du Hub et quand un admin ajoute une vue ; ce dernier
 *            invalide `['scan', 'empreintes']` (FeuilleApprendre). Gardées sur l'appareil
 *            (app/queryClient.ts) : le deuxième scan marche hors réseau.
 * ATTENTION — `offlineFirst` : hors réseau sans copie, la requête échoue au lieu de rester en pause,
 *            et l'écran peut dire que le scan n'a pas pu se préparer.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchEmpreintes, fetchFragmentsVisibles } from '../api/scan'

export function useEmpreintes() {
  const query = useQuery({
    queryKey: ['scan', 'empreintes'],
    queryFn: fetchEmpreintes,
    staleTime: 10 * 60 * 1000,
    networkMode: 'offlineFirst',
  })
  return { fragments: query.data, erreur: query.isError }
}

export function useFragmentsVisibles() {
  const query = useQuery({
    queryKey: ['scan', 'fragments'],
    queryFn: fetchFragmentsVisibles,
    staleTime: 60 * 60 * 1000,
    networkMode: 'offlineFirst',
  })
  return { fragments: query.data, erreur: query.isError }
}
