/**
 * QUOI     — les listes et les ambassadeurs, et les gestes qui les changent (les deux se relisent après).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lireAmbassadeurs, lireListes, nommerAmbassadeur, retirerAmbassadeur, type Role } from '../api/listes'

export function useListes() {
  return useQuery({ queryKey: ['missives-listes'], queryFn: lireListes })
}

export function useAmbassadeurs() {
  const client = useQueryClient()
  // Un ambassadeur de plus ou de moins change aussi le compte de sa liste.
  const relire = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['missives-listes'] }),
      client.invalidateQueries({ queryKey: ['missives-ambassadeurs'] }),
    ])
  return {
    ambassadeurs: useQuery({ queryKey: ['missives-ambassadeurs'], queryFn: lireAmbassadeurs }),
    nommer: useMutation({
      mutationFn: ({ id, role }: { id: string; role: Role }) => nommerAmbassadeur(id, role),
      onSuccess: relire,
    }),
    retirer: useMutation({ mutationFn: retirerAmbassadeur, onSuccess: relire }),
  }
}
