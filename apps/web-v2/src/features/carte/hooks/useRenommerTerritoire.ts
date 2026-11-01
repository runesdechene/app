/**
 * QUOI     — « Renommer » mon territoire (renommer_territoire, migration 569).
 * POURQUOI — relire les territoires suffit : le nouveau nom arrive sur la banderole de son blason.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { renommerTerritoire } from '../api/carte'
import { territoiresKey } from './useTerritoiresSurLaCarte'

export function useRenommerTerritoire(lieu: string, onFait: () => void) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (nom: string) => renommerTerritoire(lieu, nom),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: territoiresKey })
      onFait()
    },
  })
  return {
    renommer: mutation.mutate,
    enCours: mutation.isPending,
    erreur: mutation.isError ? 'Le nom n’a pas pu être changé. Réessaie dans un instant.' : null,
  }
}
