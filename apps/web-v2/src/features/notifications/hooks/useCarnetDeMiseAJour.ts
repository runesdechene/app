/**
 * QUOI     — le carnet d'une mise à jour (mig 478) : le lire, y écrire (un mot, une réponse, des
 *            photos), aimer un mot (un par personne), effacer le sien.
 * POURQUOI — le même contrat que le carnet d'un lieu (`useCarnet`) : le cœur bascule tout de suite,
 *            tout se relit quand la base a répondu, et la liste des notes avec (son nombre de mots).
 * ATTENTION — `actif` : une note précédente, repliée, ne charge rien.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { basculerCoeur, type Carnet } from '@/shared/lib/carnet'
import type { Ecrit } from '@/shared/ui/EcrireAuCarnet'
import {
  basculerCoeurMotDeMiseAJour,
  ecrireSousMiseAJour,
  effacerMotDeMiseAJour,
  fetchCarnetDeMiseAJour,
} from '../api/nouveautes'
import { nouveautesKey } from './useNouveautes'

const carnetKey = (id: number) => [...nouveautesKey, id, 'carnet'] as const

export function useCarnetDeMiseAJour(id: number, actif: boolean) {
  const queryClient = useQueryClient()
  const carnet = useQuery({
    queryKey: carnetKey(id),
    queryFn: () => fetchCarnetDeMiseAJour(id),
    enabled: actif,
  }).data
  const relire = () => {
    void queryClient.invalidateQueries({ queryKey: carnetKey(id) })
    void queryClient.invalidateQueries({ queryKey: nouveautesKey, exact: true })
  }

  const ecrire = useMutation({
    mutationFn: ({ texte, photos, parent }: Ecrit) => ecrireSousMiseAJour(id, texte, photos, parent),
    onSuccess: relire,
  })

  const aimer = useMutation({
    mutationFn: basculerCoeurMotDeMiseAJour,
    onMutate: async (mot) => {
      await queryClient.cancelQueries({ queryKey: carnetKey(id) })
      queryClient.setQueryData<Carnet | null>(carnetKey(id), (c) => (c ? basculerCoeur(c, mot) : c))
    },
    onSettled: relire,
  })

  const effacer = useMutation({ mutationFn: effacerMotDeMiseAJour, onSuccess: relire })

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
