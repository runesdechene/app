/**
 * QUOI     — la création du compte d'un client du stand, qui rafraîchit la liste des comptes.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { creerCompteDuStand, type CompteDuStand } from '../api/compteDuStand'

export function useCreerCompteDuStand() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (c: CompteDuStand) => creerCompteDuStand(c),
    onSuccess: () => client.invalidateQueries({ queryKey: ['hub-comptes'] }),
  })
}
