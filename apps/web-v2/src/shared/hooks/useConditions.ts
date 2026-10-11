/**
 * QUOI     — la version des conditions acceptée par le compte, et l'action de les accepter.
 * POURQUOI — la fenêtre « Nos conditions évoluent » la compare à VERSION_DES_CONDITIONS.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { accepterConditions, mesConditions } from '@/shared/supabase/conditions'

const CLE = ['mes-conditions']

export function useMesConditions() {
  return useQuery({ queryKey: CLE, queryFn: mesConditions })
}

export function useAccepterConditions() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: accepterConditions,
    onSuccess: (_rien, version) => {
      client.setQueryData(CLE, version)
    },
  })
}
