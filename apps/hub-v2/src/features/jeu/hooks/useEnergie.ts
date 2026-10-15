/**
 * QUOI     — les réglages de l'Énergie (lecture) et leur enregistrement, qui relit la table.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ecrireReglages, lireReglages } from '../api/energie'

export function useReglagesEnergie() {
  return useQuery({ queryKey: ['hub-energie'], queryFn: lireReglages })
}

export function useEcritureEnergie() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ecrireReglages,
    onSuccess: () => client.invalidateQueries({ queryKey: ['hub-energie'] }),
  })
}
