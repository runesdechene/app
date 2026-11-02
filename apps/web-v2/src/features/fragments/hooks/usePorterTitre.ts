/**
 * QUOI     — porter le titre d'un Fragment sous son nom ; la fiche et le profil se relisent.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { porterTitres } from '../api/titres'
import { cleMonFragment } from './useMonFragment'

export function usePorterTitre(id: number) {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: (ids: number[]) => porterTitres(ids),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: cleMonFragment(id) }),
        // Le profil (zone Compte) lit les titres portés : sa clé commence par « explorateur ».
        client.invalidateQueries({ queryKey: ['explorateur'] }),
      ]),
  })
  return {
    porter: (ids: number[]) => {
      mutation.mutate(ids)
    },
    enCours: mutation.isPending,
  }
}
