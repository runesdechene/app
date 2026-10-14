/**
 * QUOI     — la fiche d'un compte, et le changement de rôle qui la rafraîchit avec la liste.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { changerRole, lireCompte } from '../api/comptes'

export function useCompte(id: string) {
  return useQuery({ queryKey: ['hub-compte', id], queryFn: () => lireCompte(id) })
}

export function useChangerRole(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (role: string) => changerRole(id, role),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['hub-compte', id] })
      void client.invalidateQueries({ queryKey: ['hub-comptes'] })
    },
  })
}
