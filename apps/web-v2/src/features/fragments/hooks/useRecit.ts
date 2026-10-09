/**
 * QUOI     — le récit d'un Fragment, gardé en cache : il ne change qu'aux synchros du Hub.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchRecit } from '../api/recit'

export function useRecit(id: number) {
  const query = useQuery({ queryKey: ['fragment', id], queryFn: () => fetchRecit(id), staleTime: 60 * 60 * 1000 })
  return { recit: query.data, erreur: query.isError, reessayer: query.refetch }
}
