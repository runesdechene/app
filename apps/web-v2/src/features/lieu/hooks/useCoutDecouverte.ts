/**
 * QUOI     — le prix d'une découverte depuis ma position, avec ma jauge (migration 399).
 * POURQUOI — le voile annonce le prix avant le geste ; c'est la base qui le calcule, l'écran ne
 *            fait que l'afficher. Le prix dépend de la position : sans elle, tout coûte le prix
 *            le plus haut. Alors, si l'app ne l'a pas encore, le voile la demande — une fois — et
 *            le prix se relit avec elle.
 */
import { useEffect, useRef } from 'react'
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

  // La position trouvée rejoint celle que lit toute l'app (`useMaPosition`).
  const utiliserMaPosition = () => {
    void demanderPosition().then((p) => {
      if (p) queryClient.setQueryData(['ma-position'], p)
    })
  }

  const demandee = useRef(false)
  useEffect(() => {
    if (position || demandee.current) return
    demandee.current = true
    void demanderPosition().then((p) => {
      if (p) queryClient.setQueryData(['ma-position'], p)
    })
  }, [position, queryClient])

  return { cout: data, utiliserMaPosition }
}
