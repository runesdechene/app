/**
 * QUOI — la liste des Compagnies.
 */
import { useQuery } from '@tanstack/react-query'
import { lireCompagnies } from '../api/compagnies'

export function useCompagnies() {
  return useQuery({ queryKey: ['hub-compagnies'], queryFn: lireCompagnies })
}
