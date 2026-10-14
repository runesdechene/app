/**
 * QUOI — la liste des lieux pour des critères donnés (gardée pendant qu'on change de page).
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { lireLieux, type Criteres } from '../api/lieux'

export function useLieux(criteres: Criteres) {
  return useQuery({ queryKey: ['hub-lieux', criteres], queryFn: () => lireLieux(criteres), placeholderData: keepPreviousData })
}
