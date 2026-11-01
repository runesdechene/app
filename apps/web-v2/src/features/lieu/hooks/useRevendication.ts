/**
 * QUOI     — « Plante ton étendard » : qui est là, revendiquer ; rend la conquête (mig 537).
 * POURQUOI — les compagnons sont ceux que le serveur voit présents maintenant ; on relit la liste
 *            toutes les 20 s tant que la fenêtre est ouverte.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCompagnons, revendiquerLieu } from '../api/lieu'
import { ficheKey } from './useFiche'

export function useRevendication(id: string, ouverte: boolean) {
  const queryClient = useQueryClient()
  const compagnons = useQuery({
    queryKey: ['lieu', id, 'compagnons'],
    queryFn: () => fetchCompagnons(id),
    enabled: ouverte,
    refetchInterval: 20_000,
  })
  const mutation = useMutation({
    mutationFn: ({ ids, nom }: { ids: string[]; nom: string | null }) =>
      revendiquerLieu(id, ids, nom),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ficheKey(id) })
      void queryClient.invalidateQueries({ queryKey: ['carte', 'lieux'] })
      void queryClient.invalidateQueries({ queryKey: ['explorateur'] })
    },
  })
  const erreur = mutation.isError
    ? mutation.error.message === 'Visite trop ancienne'
      ? 'Ta visite date de plus de 30 minutes : marque-la à nouveau sur place.'
      : mutation.error.message === 'Pas sur place'
        ? 'Tu n’es plus sur place : reviens près du lieu pour le revendiquer.'
        : 'La revendication n’a pas pu être enregistrée. Réessaie dans un instant.'
    : null
  return {
    compagnons: compagnons.data ?? [],
    revendiquer: (ids: string[], nom: string | null) => mutation.mutateAsync({ ids, nom }),
    enCours: mutation.isPending,
    erreur,
  }
}
