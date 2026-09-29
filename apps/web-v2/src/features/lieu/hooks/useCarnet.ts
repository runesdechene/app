/**
 * QUOI     — le Carnet de passage d'un lieu (mig 389) : le lire, y écrire (un mot, une réponse, des
 *            photos), aimer un mot, effacer le sien.
 * POURQUOI — les cœurs comptent tout de suite (mise à jour optimiste), comme partout ; le reste
 *            relit le carnet quand la base a répondu. La clé du carnet est rangée sous celle de la
 *            fiche : la fiche relue, le carnet l'est aussi.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PhotoAEnvoyer } from '@/shared/lib/photo'
import { aimerMot, ecrireAuCarnet, effacerMot, fetchCarnet } from '../api/lieu'
import type { Carnet } from '../api/lireLieu'
import { coeurDePlus } from '../lib/carnet'
import { ficheKey } from './useFiche'

const carnetKey = (id: string) => [...ficheKey(id), 'carnet'] as const
const aimerKey = ['carnet', 'aimer'] as const

export type Ecrit = { texte: string; photos: PhotoAEnvoyer[]; parent: number | null }

export function useCarnet(id: string, limite: number | null) {
  const queryClient = useQueryClient()
  const carnet = useQuery({
    queryKey: [...carnetKey(id), limite],
    queryFn: () => fetchCarnet(id, limite),
  }).data
  const relire = () => {
    void queryClient.invalidateQueries({ queryKey: carnetKey(id) })
  }

  const ecrire = useMutation({
    mutationFn: ({ texte, photos, parent }: Ecrit) => ecrireAuCarnet(id, texte, photos, parent),
    onSuccess: relire,
  })

  const aimer = useMutation({
    mutationKey: aimerKey,
    mutationFn: aimerMot,
    onMutate: async (mot) => {
      await queryClient.cancelQueries({ queryKey: carnetKey(id) })
      queryClient.setQueriesData<Carnet | null>({ queryKey: carnetKey(id) }, (c) =>
        c ? coeurDePlus(c, mot) : c,
      )
    },
    onSettled: () => {
      // Cet envoi compte encore parmi ceux en cours : 1, c'est le dernier de la rafale.
      if (queryClient.isMutating({ mutationKey: aimerKey }) === 1) relire()
    },
  })

  const effacer = useMutation({ mutationFn: effacerMot, onSuccess: relire })

  return {
    carnet,
    ecrire,
    aimer: (mot: number) => {
      aimer.mutate(mot)
    },
    effacer: (mot: number) => {
      effacer.mutate(mot)
    },
  }
}
