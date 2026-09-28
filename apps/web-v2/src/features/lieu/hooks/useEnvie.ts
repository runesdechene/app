/**
 * QUOI     — « Envie d'y aller » : le signet bascule tout de suite ; si la base refuse, il
 *            revient à sa place et `echec` passe à vrai.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { basculerEnvie } from '../api/lieu'
import type { FicheLieu } from '../api/lireLieu'
import { ficheKey } from './useFiche'

export function useEnvie(id: string): { basculer: () => void; echec: boolean } {
  const queryClient = useQueryClient()
  const [echec, setEchec] = useState(false)
  const inverser = () => {
    queryClient.setQueryData<FicheLieu | null>(
      ficheKey(id),
      (f) => f && { ...f, moi: { ...f.moi, envie: !f.moi.envie } },
    )
  }
  const mutation = useMutation({
    mutationFn: () => basculerEnvie(id),
    onMutate: async () => {
      setEchec(false)
      await queryClient.cancelQueries({ queryKey: ficheKey(id) })
      inverser()
    },
    onError: () => {
      inverser()
      setEchec(true)
    },
  })
  return {
    basculer: () => {
      mutation.mutate()
    },
    echec,
  }
}
