/**
 * QUOI     — les bannières (liste et fiches viennent de la même lecture) et leurs écritures, qui rafraîchissent la liste.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  changerImage, creerBanniere, lireBannieres, modifierBanniere, supprimerBanniere,
  type Banniere, type BanniereAEcrire,
} from '../api/bannieres'

export function useBannieres() {
  return useQuery({ queryKey: ['hub-bannieres'], queryFn: lireBannieres })
}

export function useEcritureBanniere() {
  const client = useQueryClient()
  // On attend la liste à jour : une création ouvre sa fiche aussitôt.
  const rafraichir = () => client.invalidateQueries({ queryKey: ['hub-bannieres'] })
  return {
    creer: useMutation({ mutationFn: creerBanniere, onSuccess: rafraichir }),
    modifier: useMutation({
      mutationFn: ({ id, banniere }: { id: number; banniere: BanniereAEcrire }) => modifierBanniere(id, banniere),
      onSuccess: rafraichir,
    }),
    changerImage: useMutation({
      mutationFn: ({ banniere, fichier }: { banniere: Banniere; fichier: File }) => changerImage(banniere, fichier),
      onSuccess: rafraichir,
    }),
    supprimer: useMutation({ mutationFn: supprimerBanniere, onSuccess: rafraichir }),
  }
}
