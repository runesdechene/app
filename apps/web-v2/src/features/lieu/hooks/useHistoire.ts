/**
 * QUOI     — l'histoire d'une fiche (mig 387) : ses versions, et revenir à l'une d'elles.
 * POURQUOI — revenir en arrière crée une version de plus : rien ne se perd. Après, la fiche, son
 *            histoire et la carte se relisent (la clé de l'histoire est rangée sous celle de la
 *            fiche).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchHistoire, revenirAVersion } from '../api/lieu'
import { ficheKey } from './useFiche'

export function useHistoire(id: string) {
  const queryClient = useQueryClient()
  const histoire = useQuery({
    queryKey: [...ficheKey(id), 'histoire'],
    queryFn: () => fetchHistoire(id),
  })
  const revenir = useMutation({
    mutationFn: revenirAVersion,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ficheKey(id) })
      void queryClient.invalidateQueries({ queryKey: ['carte', 'lieux'] })
    },
  })
  return {
    versions: histoire.data,
    revenir: revenir.mutate,
    enCours: revenir.isPending,
    echec: revenir.isError,
  }
}
