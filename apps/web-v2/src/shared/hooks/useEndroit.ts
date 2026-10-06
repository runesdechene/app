/**
 * QUOI     — l'endroit en mots (« Près de Colomars ») d'un point.
 * POURQUOI — partagé par l'ajout d'un lieu et la pose d'un pin : une zone n'importe pas l'autre.
 * ATTENTION — la clé arrondit à une dizaine de mètres : glisser la carte ne lance pas une rafale
 *            de questions à Nominatim.
 */
import { useQuery } from '@tanstack/react-query'
import { endroitDe } from '@/shared/lib/adresse'
import type { Point } from '@/shared/lib/distance'

function cle(point: Point | null) {
  return point ? [point.latitude.toFixed(4), point.longitude.toFixed(4)] : [null, null]
}

export function useEndroit(point: Point | null) {
  const query = useQuery({
    queryKey: ['endroit', ...cle(point)],
    queryFn: ({ signal }) => (point ? endroitDe(point, signal) : null),
    enabled: point !== null,
    staleTime: Infinity,
    retry: false,
  })
  return query.data ?? null
}
