/**
 * QUOI     — mes titres, pour le panneau « Tous les titres ».
 */
import { useQuery } from '@tanstack/react-query'
import { fetchMesTitres } from '../api/mesTitres'

export function useMesTitres() {
  const query = useQuery({ queryKey: ['mes-titres'], queryFn: fetchMesTitres })
  return { titres: query.data, erreur: query.isError, reessayer: query.refetch }
}
