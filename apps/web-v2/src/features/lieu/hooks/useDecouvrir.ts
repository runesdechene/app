/**
 * QUOI     — découvrir un lieu : la base l'inscrit et rend la récompense (rang, expérience).
 * POURQUOI — la carte (le sceau devient crème) et les profils (le niveau) se relisent tout de
 *            suite ; la fiche, elle, reste « à découvrir » tant que la récompense est à l'écran —
 *            `acceder` la marque découverte, et la route ouvre alors la fiche.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { decouvrirLieu } from '../api/lieu'
import type { FicheLieu } from '../api/lireLieu'
import { ficheKey } from './useFiche'

export function useDecouvrir(id: string) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => decouvrirLieu(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['carte', 'lieux'] })
      void queryClient.invalidateQueries({ queryKey: ['explorateur'] })
    },
  })
  return {
    decouvrir: () => {
      mutation.mutate()
    },
    recompense: mutation.data ?? null,
    echec: mutation.isError,
    acceder: () => {
      queryClient.setQueryData<FicheLieu>(ficheKey(id), (f) =>
        f && { ...f, moi: { ...f.moi, decouvert: true } },
      )
    },
  }
}
