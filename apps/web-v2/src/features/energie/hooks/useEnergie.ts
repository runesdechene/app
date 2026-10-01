/**
 * QUOI     — la jauge d'énergie, relue chaque minute.
 * POURQUOI — le compte à rebours avance et un point revient sans qu'on touche à rien. Une
 *            découverte payante invalide la clé `['energie']` (zone lieu) : la jauge suit.
 */
import { useQuery } from '@tanstack/react-query'
import { fetchEnergie } from '../api/energie'

export function useEnergie() {
  return useQuery({ queryKey: ['energie'], queryFn: fetchEnergie, refetchInterval: 60_000 }).data
}
