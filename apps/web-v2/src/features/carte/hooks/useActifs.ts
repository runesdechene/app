/**
 * QUOI     — les Actifs, relus chaque minute.
 * POURQUOI — quelqu'un arrive, quelqu'un s'éloigne : la carte suit sans qu'on touche à rien.
 */
import { useQuery } from '@tanstack/react-query'
import type { Actif } from '../api/lireActifs'
import { fetchActifs } from '../api/actifs'

const AUCUN: Actif[] = []

export function useActifs(actifs: boolean): Actif[] {
  const { data } = useQuery({
    queryKey: ['actifs'],
    queryFn: fetchActifs,
    refetchInterval: 60_000,
    enabled: actifs,
  })
  return data ?? AUCUN
}
