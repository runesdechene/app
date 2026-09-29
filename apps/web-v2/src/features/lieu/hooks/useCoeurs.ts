/**
 * QUOI     — les cœurs d'un lieu (mig 384) : les lire, et en envoyer un de plus à chaque toucher.
 * POURQUOI — à volonté, comme les saluts (useSaluer, Accueil) : le compteur monte tout de suite
 *            (mise à jour optimiste), et quand le dernier envoi d'une rafale est revenu, les
 *            cœurs se relisent — la base fait foi, un refus s'efface de lui-même.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { aimerLieu, fetchCoeurs } from '../api/lieu'
import type { Coeurs } from '../api/lireLieu'

export const coeursKey = (id: string) => ['lieu', id, 'coeurs'] as const
const aimerKey = ['lieu', 'aimer'] as const

export function useCoeurs(id: string) {
  const queryClient = useQueryClient()
  const coeurs = useQuery({ queryKey: coeursKey(id), queryFn: () => fetchCoeurs(id) }).data ?? null

  const mutation = useMutation({
    mutationKey: aimerKey,
    mutationFn: () => aimerLieu(id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: coeursKey(id) })
      queryClient.setQueryData<Coeurs | null>(
        coeursKey(id),
        (c) => c && { ...c, total: c.total + 1, miens: c.miens + 1 },
      )
    },
    onSettled: () => {
      // Cet envoi compte encore parmi ceux en cours : 1, c'est le dernier de la rafale.
      if (queryClient.isMutating({ mutationKey: aimerKey }) === 1) {
        void queryClient.invalidateQueries({ queryKey: coeursKey(id) })
      }
    },
  })

  return {
    coeurs,
    aimer: () => {
      mutation.mutate()
    },
  }
}
