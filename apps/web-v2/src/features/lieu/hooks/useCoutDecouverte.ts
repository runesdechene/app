/**
 * QUOI     — le prix d'une découverte depuis ma position, avec ma jauge (migration 399).
 * POURQUOI — le voile annonce le prix avant le geste ; c'est la base qui le calcule, l'écran ne
 *            fait que l'afficher. Quand la position arrive, le prix se relit avec elle.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Point } from '@/shared/lib/distance'
import { demanderPosition } from '@/shared/lib/position'
import { fetchCoutDecouverte } from '../api/lieu'

export const coutKey = (id: string) => ['cout-decouverte', id] as const

export function useCoutDecouverte(id: string, position: Point | null) {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: [...coutKey(id), position],
    queryFn: () => fetchCoutDecouverte(id, position),
  })
  return {
    cout: data,
    // Sur un geste : le navigateur peut demander la permission. La position trouvée rejoint
    // celle que lit toute l'app (`useMaPosition`).
    utiliserMaPosition: () => {
      void demanderPosition().then((p) => {
        if (p) queryClient.setQueryData(['ma-position'], p)
      })
    },
  }
}
