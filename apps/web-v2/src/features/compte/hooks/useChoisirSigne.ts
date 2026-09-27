/**
 * QUOI     — placer son profil sous le signe d'un de ses Fragments.
 * POURQUOI — après l'écriture, le profil en cache est relu : le filigrane change aussitôt.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { choisirSigne } from '../api/monProfil'
import { explorateurKey } from './useExplorateur'

export function useChoisirSigne(profilId: string): {
  choisir: (fragmentId: number) => Promise<void>
  echec: boolean
} {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (fragmentId: number) => choisirSigne(fragmentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: explorateurKey(profilId) }),
  })
  return {
    choisir: async (fragmentId) => {
      await mutation.mutateAsync(fragmentId)
    },
    echec: mutation.isError,
  }
}
