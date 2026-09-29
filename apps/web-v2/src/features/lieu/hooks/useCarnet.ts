/**
 * QUOI     — le Carnet de passage d'un lieu (migs 389-390) : le lire, y écrire (un mot, une
 *            réponse, des photos), aimer un mot (un cœur par personne), effacer le sien.
 * POURQUOI — le cœur bascule tout de suite (mise à jour optimiste) ; tout relit le carnet quand la
 *            base a répondu. La clé du carnet est rangée sous celle de la
 *            fiche : la fiche relue, le carnet l'est aussi.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PhotoAEnvoyer } from '@/shared/lib/photo'
import { basculerCoeurMot, ecrireAuCarnet, effacerMot, fetchCarnet } from '../api/lieu'
import type { Carnet } from '../api/lireLieu'
import { basculerCoeur } from '../lib/carnet'
import { ficheKey } from './useFiche'

const carnetKey = (id: string) => [...ficheKey(id), 'carnet'] as const

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
    mutationFn: basculerCoeurMot,
    onMutate: async (mot) => {
      await queryClient.cancelQueries({ queryKey: carnetKey(id) })
      queryClient.setQueriesData<Carnet | null>({ queryKey: carnetKey(id) }, (c) =>
        c ? basculerCoeur(c, mot) : c,
      )
    },
    onSettled: relire,
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
