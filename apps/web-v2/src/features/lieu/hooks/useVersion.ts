/**
 * QUOI     — une version de la fiche (mig 415), lue quand on la touche dans l'histoire.
 * POURQUOI — une version ne change jamais : elle se garde en cache sans se relire.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchVersion } from '../api/lieu'

export function useVersion(id: number) {
  const version = useQuery({
    queryKey: ['version', id],
    queryFn: () => fetchVersion(id),
    staleTime: Infinity,
  })
  return { version: version.data, erreur: version.isError }
}
