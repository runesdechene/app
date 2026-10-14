/**
 * QUOI     — la file des signalements, et les deux décisions : traiter, masquer le lieu.
 * POURQUOI — chaque décision rafraîchit la file, la pastille du menu et la liste des lieux.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { masquerLieu } from '../api/lieux'
import { lireSignalements, traiterSignalement } from '../api/signalements'

export function useSignalements() {
  return useQuery({ queryKey: ['hub-signalements'], queryFn: lireSignalements })
}

export function useTraitement() {
  const client = useQueryClient()
  function rafraichir() {
    void client.invalidateQueries({ queryKey: ['hub-signalements'] })
    void client.invalidateQueries({ queryKey: ['hub-ouverture'] })
    void client.invalidateQueries({ queryKey: ['hub-lieux'] })
  }
  return {
    traiter: useMutation({ mutationFn: (id: number) => traiterSignalement(id), onSuccess: rafraichir }),
    masquer: useMutation({ mutationFn: (lieuId: string) => masquerLieu(lieuId, true), onSuccess: rafraichir }),
  }
}
