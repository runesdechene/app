/**
 * QUOI     — découvrir un lieu depuis ma position : la base l'inscrit, fait payer l'énergie s'il
 *            est loin, et rend la récompense (rang, expérience).
 * POURQUOI — la carte (le sceau devient crème), les profils (le niveau) et la jauge d'énergie se
 *            relisent tout de suite ; la fiche, elle, reste « à découvrir » tant que la récompense
 *            est à l'écran — `acceder` la marque découverte, et la route ouvre alors la fiche.
 *            Un refus (la jauge a baissé entre-temps) relit le prix : le voile se recale sur les
 *            chiffres du serveur.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Point } from '@/shared/lib/distance'
import { decouvrirLieu } from '../api/lieu'
import type { FicheLieu } from '../api/lireLieu'
import { coutKey } from './useCoutDecouverte'
import { ficheKey } from './useFiche'

export function useDecouvrir(id: string, position: Point | null) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => decouvrirLieu(id, position),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['carte', 'lieux'] })
      void queryClient.invalidateQueries({ queryKey: ['explorateur'] })
      void queryClient.invalidateQueries({ queryKey: ['energie'] })
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: coutKey(id) })
    },
  })
  return {
    decouvrir: () => {
      mutation.mutate()
    },
    recompense: mutation.data ?? null,
    echec: mutation.isError,
    acceder: () => {
      queryClient.setQueryData<FicheLieu>(
        ficheKey(id),
        (f) => f && { ...f, moi: { ...f.moi, decouvert: true } },
      )
    },
  }
}
