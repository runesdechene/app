/**
 * QUOI     — saluer une ligne du fil : un cœur de plus à chaque toucher, à volonté (migration 374).
 * POURQUOI — le cœur compte tout de suite (mise à jour optimiste), pour qu'une rafale se voie.
 *            Quand le dernier envoi de la rafale est revenu, le fil se relit : la base fait foi,
 *            et un refus s'efface de lui-même. C'est le motif de TanStack Query pour des mises à
 *            jour optimistes qui se chevauchent : appliquer la réponse de chaque envoi ferait
 *            redescendre le compteur en pleine rafale.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { saluer } from '../api/accueil'
import type { Chemin } from '../api/lireAccueil'
import { cheminsKey } from './useAccueil'

const saluerKey = ['saluer'] as const

export function useSaluer() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationKey: saluerKey,
    mutationFn: (id: string) => saluer(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: cheminsKey })
      queryClient.setQueryData<Chemin[]>(cheminsKey, (chemins) =>
        chemins?.map((c) => (c.id === id ? { ...c, saluts: c.saluts + 1, salue: true } : c)),
      )
    },
    onSettled: () => {
      // Cet envoi compte encore parmi ceux en cours : 1, c'est le dernier de la rafale.
      if (queryClient.isMutating({ mutationKey: saluerKey }) === 1) {
        void queryClient.invalidateQueries({ queryKey: cheminsKey })
      }
    },
  })

  return (id: string) => {
    mutation.mutate(id)
  }
}
