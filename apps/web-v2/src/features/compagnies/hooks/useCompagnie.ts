/**
 * QUOI     — la fiche d'une Compagnie (migration 421), et les gestes « Rejoindre » et « Quitter ».
 * POURQUOI — chaque geste change ma place, mes canaux de La Communauté et la liste : on relit la
 *            fiche, `canauxKey` et la liste des Compagnies.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { canauxKey } from '@/shared/lib/cles'
import { fetchCompagnie, quitter, rejoindre } from '../api/compagnies'
import { compagniesKey } from './useCompagnies'

export const compagnieKey = (id: string) => ['compagnie', id] as const

export function useCompagnie(id: string) {
  const queryClient = useQueryClient()
  const fiche = useQuery({ queryKey: compagnieKey(id), queryFn: () => fetchCompagnie(id) })
  const relire = () => {
    void queryClient.invalidateQueries({ queryKey: compagnieKey(id) })
    void queryClient.invalidateQueries({ queryKey: compagniesKey })
    void queryClient.invalidateQueries({ queryKey: canauxKey })
  }
  const entrer = useMutation({ mutationFn: () => rejoindre(id), onSuccess: relire })
  const sortir = useMutation({ mutationFn: () => quitter(id), onSuccess: relire })
  return {
    fiche: fiche.data,
    erreur: fiche.isError,
    rejoindre: () => {
      entrer.mutate()
    },
    quitter: () => {
      sortir.mutate()
    },
    enCours: entrer.isPending || sortir.isPending,
  }
}
