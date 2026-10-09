/**
 * QUOI     — supprimer un lieu : qui le peut (l'auteur, un admin), et le geste.
 * POURQUOI — Uriel, 30/09 : « supprimer un lieu dans les options du lieu, réservé au créateur ou à
 *            un administrateur ». L'écran ne montre la ligne qu'à eux ; la base le revérifie.
 *            Après : la carte, l'Accueil et les profils se relisent, la fiche s'oublie.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supprimerLieu } from '../api/lieu'
import { ficheKey } from './useFiche'
import { useMoi } from './useMoi'

export function useSupprimer(id: string, auteur: string | null) {
  const queryClient = useQueryClient()
  const moi = useMoi()
  const mutation = useMutation({
    mutationFn: () => {
      if (!moi) throw new Error('sans session')
      return supprimerLieu(id, moi.id)
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ficheKey(id) })
      void queryClient.invalidateQueries({ queryKey: ['carte', 'lieux'] })
      void queryClient.invalidateQueries({ queryKey: ['accueil'] })
      void queryClient.invalidateQueries({ queryKey: ['explorateur'] })
    },
  })
  return {
    peut: moi ? moi.admin || moi.id === auteur : false,
    supprimer: mutation.mutate,
    enCours: mutation.isPending,
    echec: mutation.isError,
  }
}
