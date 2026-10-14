/**
 * QUOI     — l'ouverture pour la période choisie, rafraîchie toutes les minutes.
 */
import { useQuery } from '@tanstack/react-query'
import { lireOuverture, type Periode } from '../api/ouverture'

export function useOuverture(periode: Periode) {
  return useQuery({
    queryKey: ['hub-ouverture', periode],
    queryFn: () => lireOuverture(periode),
    refetchInterval: 60_000,
  })
}
