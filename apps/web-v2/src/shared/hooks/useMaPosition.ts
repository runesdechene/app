/**
 * QUOI     — la position de l'Explorateur qui regarde, ou null (pas autorisée, pas trouvée).
 * POURQUOI — lue une fois et gardée dix minutes : toutes les cartes du profil s'en servent.
 */
import { useQuery } from '@tanstack/react-query'
import { positionSiAutorisee } from '../lib/position'
import type { Point } from '../lib/distance'

export function useMaPosition(): Point | null {
  const { data } = useQuery({
    queryKey: ['ma-position'],
    queryFn: positionSiAutorisee,
    staleTime: 10 * 60 * 1000,
  })
  return data ?? null
}
