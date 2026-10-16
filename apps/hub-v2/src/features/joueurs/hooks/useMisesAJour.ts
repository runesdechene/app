/**
 * QUOI     — les mises à jour (liste et fiches viennent de la même lecture) et leurs écritures, qui rafraîchissent la liste.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { enregistrerMiseAJour, lireMisesAJour, supprimerMiseAJour, type Brouillon, type MiseAJour } from '../api/misesAJour'

const CLE = ['hub-mises-a-jour']

export function useMisesAJour() {
  return useQuery({ queryKey: CLE, queryFn: lireMisesAJour })
}

export function useEnregistrerMiseAJour() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ fiche, brouillon }: { fiche: MiseAJour | null; brouillon: Brouillon }) => enregistrerMiseAJour(fiche, brouillon),
    // La base a changé même si le retrait de l'ancienne image a échoué.
    onSettled: () => client.invalidateQueries({ queryKey: CLE }),
  })
}

export function useSupprimerMiseAJour() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (fiche: MiseAJour) => supprimerMiseAJour(fiche.id, fiche.image),
    onSettled: () => client.invalidateQueries({ queryKey: CLE }),
  })
}
