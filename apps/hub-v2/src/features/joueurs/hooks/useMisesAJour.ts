/**
 * QUOI     — les mises à jour (liste et fiches viennent de la même lecture) et leurs écritures, qui rafraîchissent la liste.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  envoyerImage, lireMisesAJour, modifierMiseAJour, publierMiseAJour, supprimerMiseAJour,
  type MiseAJour, type MiseAJourAEcrire,
} from '../api/misesAJour'

const CLE = ['hub-mises-a-jour']

export function useMisesAJour() {
  return useQuery({ queryKey: CLE, queryFn: lireMisesAJour })
}

export function useEnregistrerMiseAJour() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ fiche, note }: { fiche: MiseAJour | null; note: MiseAJourAEcrire }) => {
      if (fiche) await modifierMiseAJour(fiche.id, note, fiche.image)
      else await publierMiseAJour(note)
    },
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

export function useEnvoyerImage() {
  return useMutation({ mutationFn: envoyerImage })
}
