/**
 * QUOI     — les titres (liste et fiches viennent de la même lecture) et leurs écritures, qui rafraîchissent la liste.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { creerTitre, lireTitres, modifierTitre, supprimerTitre, type TitreAEcrire } from '../api/titres'

export function useTitres() {
  return useQuery({ queryKey: ['hub-titres'], queryFn: lireTitres })
}

export function useEcritureTitre() {
  const client = useQueryClient()
  // On attend la liste à jour : une création ouvre sa fiche aussitôt.
  const rafraichir = () => client.invalidateQueries({ queryKey: ['hub-titres'] })
  return {
    creer: useMutation({
      mutationFn: ({ titre, ordre }: { titre: TitreAEcrire & { condition: { stat: string; min: number } }; ordre: number }) => creerTitre(titre, ordre),
      onSuccess: rafraichir,
    }),
    modifier: useMutation({
      mutationFn: ({ id, titre }: { id: number; titre: TitreAEcrire }) => modifierTitre(id, titre),
      onSuccess: rafraichir,
    }),
    supprimer: useMutation({ mutationFn: supprimerTitre, onSuccess: rafraichir }),
  }
}
