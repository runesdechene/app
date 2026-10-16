/**
 * QUOI     — les cœurs d'une mise à jour (mig 478) : en envoyer un de plus à chaque toucher, et la
 *            liste de ceux qui en ont envoyé, pour la feuille.
 * POURQUOI — à volonté, comme les cœurs d'un lieu (`useCoeurs`) : le compte de la note monte tout de
 *            suite dans la liste des notes (mise à jour optimiste), et quand le dernier envoi d'une
 *            rafale est revenu, tout se relit — la base fait foi.
 * ATTENTION — le compte vit dans la liste des notes (`mises_a_jour_publiees`) : la liste des gens ne
 *            se lit qu'à l'ouverture de la feuille (`ouverte`).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { aimerMiseAJour, fetchCoeursDeMiseAJour, type MiseAJour } from '../api/nouveautes'
import { nouveautesKey } from './useNouveautes'

const coeursKey = (id: number) => [...nouveautesKey, id, 'coeurs'] as const
const aimerKey = (id: number) => [...nouveautesKey, 'aimer', id] as const

export function useCoeursDeMiseAJour(id: number, ouverte: boolean) {
  const queryClient = useQueryClient()
  const gens =
    useQuery({
      queryKey: coeursKey(id),
      queryFn: () => fetchCoeursDeMiseAJour(id),
      enabled: ouverte,
    }).data ?? null

  const mutation = useMutation({
    mutationKey: aimerKey(id),
    mutationFn: () => aimerMiseAJour(id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: nouveautesKey, exact: true })
      queryClient.setQueryData<MiseAJour[]>(nouveautesKey, (liste) =>
        liste?.map((m) => (m.id === id ? { ...m, coeurs: m.coeurs + 1, miens: m.miens + 1 } : m)),
      )
    },
    onSettled: () => {
      // Cet envoi compte encore parmi ceux en cours : 1, c'est le dernier de la rafale.
      if (queryClient.isMutating({ mutationKey: aimerKey(id) }) === 1) {
        void queryClient.invalidateQueries({ queryKey: nouveautesKey, exact: true })
        void queryClient.invalidateQueries({ queryKey: coeursKey(id) })
      }
    },
  })

  return {
    gens,
    aimer: () => {
      mutation.mutate()
    },
  }
}
