/**
 * QUOI     — la fenêtre de revendication : qui est là, mes noms d'expédition, mes Compagnies (pour
 *            laquelle revendiquer, migration 422), revendiquer.
 * POURQUOI — les compagnons sont ceux que le serveur voit présents maintenant ; on relit la liste
 *            toutes les 20 s tant que la fenêtre est ouverte.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { canauxKey } from '@/shared/lib/cles'
import { fetchCanaux } from '@/shared/supabase/canaux'
import { fetchCompagnons, fetchNomsExpedition, revendiquerLieu } from '../api/lieu'
import { ficheKey } from './useFiche'

export function useRevendication(id: string, ouverte: boolean) {
  const queryClient = useQueryClient()
  const compagnons = useQuery({
    queryKey: ['lieu', id, 'compagnons'],
    queryFn: () => fetchCompagnons(id),
    enabled: ouverte,
    refetchInterval: 20_000,
  })
  const noms = useQuery({
    queryKey: ['expeditions', 'mes-noms'],
    queryFn: fetchNomsExpedition,
    enabled: ouverte,
  })
  const compagnies = useQuery({ queryKey: canauxKey, queryFn: fetchCanaux, enabled: ouverte })
  const mutation = useMutation({
    mutationFn: ({ ids, nom, pour }: { ids: string[]; nom: string | null; pour: string | null }) =>
      revendiquerLieu(id, ids, nom, pour),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ficheKey(id) })
      void queryClient.invalidateQueries({ queryKey: ['carte', 'lieux'] })
      void queryClient.invalidateQueries({ queryKey: ['explorateur'] })
      void queryClient.invalidateQueries({ queryKey: ['expeditions', 'mes-noms'] })
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
    noms: noms.data ?? [],
    compagnies: compagnies.data ?? [],
    revendiquer: async (ids: string[], nom: string | null, pour: string | null) => {
      await mutation.mutateAsync({ ids, nom, pour })
    },
    enCours: mutation.isPending,
    erreur,
  }
}
