/**
 * QUOI     — la liste des Compagnies (les miennes, les autres, et si je peux fonder) et le geste
 *            « Rejoindre ».
 * POURQUOI — rejoindre change ma place, mes canaux de La Communauté (`canauxKey`) et la fiche : on
 *            relit les trois.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { canauxKey } from '@/shared/lib/cles'
import { fetchCompagnies, rejoindre } from '../api/compagnies'

export const compagniesKey = ['compagnies'] as const

export function useCompagnies() {
  const queryClient = useQueryClient()
  const liste = useQuery({ queryKey: compagniesKey, queryFn: fetchCompagnies })
  const entrer = useMutation({
    mutationFn: (id: string) => rejoindre(id),
    onSuccess: (_etat, id) => {
      void queryClient.invalidateQueries({ queryKey: compagniesKey })
      void queryClient.invalidateQueries({ queryKey: canauxKey })
      void queryClient.invalidateQueries({ queryKey: ['compagnie', id] })
    },
  })
  return {
    liste: liste.data,
    erreur: liste.isError,
    rejoindre: (id: string) => {
      entrer.mutate(id)
    },
    enCours: entrer.isPending ? entrer.variables : null,
  }
}
