/**
 * QUOI     — les suites et les gestes qui les changent ; chaque geste relit les suites.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { activerSuite, ajouterEtape, lireSuites, reglerEtape, retirerEtape, type CleSuite } from '../api/suites'

export function useSuites() {
  const client = useQueryClient()
  const relire = () => client.invalidateQueries({ queryKey: ['missives-suites'] })
  return {
    suites: useQuery({ queryKey: ['missives-suites'], queryFn: lireSuites }),
    activer: useMutation({
      mutationFn: ({ cle, active }: { cle: CleSuite; active: boolean }) => activerSuite(cle, active),
      onSuccess: relire,
    }),
    ajouter: useMutation({
      mutationFn: ({ cle, jour }: { cle: CleSuite; jour: number }) => ajouterEtape(cle, jour),
      onSuccess: relire,
    }),
    regler: useMutation({
      mutationFn: ({ id, jour }: { id: number; jour: number }) => reglerEtape(id, jour),
      onSuccess: relire,
    }),
    retirer: useMutation({ mutationFn: (id: number) => retirerEtape(id), onSuccess: relire }),
  }
}
