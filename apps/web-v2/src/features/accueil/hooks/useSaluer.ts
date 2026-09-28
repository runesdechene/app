/**
 * QUOI     — saluer une ligne du fil, ou retirer son salut.
 * POURQUOI — la feuille de chêne se colore tout de suite (mise à jour optimiste) ; si la base
 *            refuse, la ligne revient comme avant. La réponse de la base fait foi.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { saluer } from '../api/accueil'
import type { Chemin } from '../api/lireAccueil'
import { cheminsKey } from './useAccueil'

type Salut = { saluts: number; salue: boolean }

export function useSaluer() {
  const queryClient = useQueryClient()

  const poser = (id: string, salut: (c: Chemin) => Salut) => {
    queryClient.setQueryData<Chemin[]>(cheminsKey, (chemins) =>
      chemins?.map((c) => (c.id === id ? { ...c, ...salut(c) } : c)),
    )
  }

  const mutation = useMutation({
    mutationFn: (id: string) => saluer(id),
    onMutate: (id) => {
      const avant = queryClient.getQueryData<Chemin[]>(cheminsKey)
      poser(id, (c) => ({ salue: !c.salue, saluts: c.saluts + (c.salue ? -1 : 1) }))
      return { avant }
    },
    onError: (_erreur, _id, contexte) => {
      queryClient.setQueryData(cheminsKey, contexte?.avant)
    },
    onSuccess: (salut, id) => {
      poser(id, () => salut)
    },
  })

  return (id: string) => {
    mutation.mutate(id)
  }
}
