/**
 * QUOI — la fiche d'une Compagnie, et la modification de son identité qui la rafraîchit avec la liste.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lireCompagnie, modifierCompagnie, type Identite } from '../api/compagnies'

export function useCompagnie(id: string) {
  return useQuery({ queryKey: ['hub-compagnie', id], queryFn: () => lireCompagnie(id) })
}

export function useModifierCompagnie(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (identite: Identite) => modifierCompagnie(id, identite),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['hub-compagnie', id] })
      void client.invalidateQueries({ queryKey: ['hub-compagnies'] })
    },
  })
}
