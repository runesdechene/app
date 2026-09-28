/**
 * QUOI     — visiter le lieu en GPS : le serveur juge la portée.
 * POURQUOI — un refus (trop loin, réseau) se dit sous le bouton ; une réussite relit la fiche et
 *            la carte (le sceau devient « visité »). La clé ['carte', 'lieux'] est le contrat
 *            avec la zone Carte (useCarteLieux) : aucune zone n'importe l'autre.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { visiterLieu } from '../api/lieu'
import { ficheKey } from './useFiche'

export function useVisite(id: string) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (p: { lat: number; lng: number }) => visiterLieu(id, p.lat, p.lng),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ficheKey(id) })
      void queryClient.invalidateQueries({ queryKey: ['carte', 'lieux'] })
    },
  })
  const erreur = mutation.isError
    ? mutation.error.message === 'Trop loin'
      ? 'Tu es encore trop loin pour marquer ta visite.'
      : 'La visite n’a pas pu être enregistrée. Réessaie dans un instant.'
    : null
  return {
    visiter: async (p: { lat: number; lng: number }) => {
      await mutation.mutateAsync(p)
    },
    enCours: mutation.isPending,
    erreur,
  }
}
