/**
 * QUOI     — la file des achats à associer et les deux décisions sur une ligne.
 * POURQUOI — une décision rafraîchit la file, la pastille de l'ouverture, les fiches de compte
 *            (le Fragment associé y apparaît) et la liste des comptes.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { associerAchat, classerAchat, lireAchats } from '../api/achats'

export function useAchats() {
  return useQuery({ queryKey: ['hub-achats'], queryFn: lireAchats })
}

function useDecision<T>(decider: (v: T) => Promise<void>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: decider,
    onSuccess: async () => {
      await Promise.all(['hub-achats', 'hub-ouverture', 'hub-compte', 'hub-comptes'].map((k) => client.invalidateQueries({ queryKey: [k] })))
    },
  })
}

export function useAssocierAchat() {
  return useDecision(({ id, fragment }: { id: number; fragment: number }) => associerAchat(id, fragment))
}

export function useClasserAchat() {
  return useDecision((id: number) => classerAchat(id))
}
