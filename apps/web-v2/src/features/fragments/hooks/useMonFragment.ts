/**
 * QUOI     — l'état d'un Fragment pour moi ; un scan, un lien ou le choix du signe l'invalident
 *            (clé `['mon-fragment', id]`). Sans compte, rien n'est demandé.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchMonFragment } from '../api/monFragment'

export const cleMonFragment = (id: number) => ['mon-fragment', id] as const

export function useMonFragment(id: number, connecte: boolean) {
  const query = useQuery({
    queryKey: cleMonFragment(id),
    queryFn: () => fetchMonFragment(id),
    enabled: connecte,
  })
  return { moi: query.data, erreur: query.isError }
}
