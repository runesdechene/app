/**
 * QUOI     — les Fragments qu'on peut associer, et l'écriture (associer, retirer) sur la fiche d'un compte.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { associerFragment, lireFragmentsAssociables, retirerFragment } from '../api/fragmentsDuCompte'

export function useFragmentsAssociables() {
  return useQuery({ queryKey: ['hub-fragments', 'associables'], queryFn: lireFragmentsAssociables })
}

// Un Fragment associé ou retiré rafraîchit la fiche et la liste (la colonne « Fragments »).
export function useEcritureFragmentsDuCompte(compte: string) {
  const client = useQueryClient()
  const rafraichir = () => Promise.all([
    client.invalidateQueries({ queryKey: ['hub-compte', compte] }),
    client.invalidateQueries({ queryKey: ['hub-comptes'] }),
  ])
  return {
    associer: useMutation({ mutationFn: (fragment: number) => associerFragment(compte, fragment), onSuccess: rafraichir }),
    retirer: useMutation({ mutationFn: (fragment: number) => retirerFragment(compte, fragment), onSuccess: rafraichir }),
  }
}
