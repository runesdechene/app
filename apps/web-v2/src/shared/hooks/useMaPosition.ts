/**
 * QUOI     — la position de l'Explorateur qui regarde, ou null (pas encore trouvée, ou refusée).
 * POURQUOI — un seul suivi pour toute l'app (`useSuivrePosition`, lancé par la coquille) : la
 *            carte, la présence, les distances et la visite lisent toutes ce même point.
 */
import { skipToken, useQuery } from '@tanstack/react-query'
import type { Point } from '../lib/distance'

export const MA_POSITION = ['ma-position'] as const

export function useMaPosition(): Point | null {
  // Rien à aller chercher : le suivi écrit dans ce cache à chaque relevé du GPS.
  const { data } = useQuery<Point>({ queryKey: MA_POSITION, queryFn: skipToken })
  return data ?? null
}
