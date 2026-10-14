/**
 * QUOI     — la file des énigmes signalées, et la décision.
 * POURQUOI — une décision rafraîchit la file, la pastille du menu, et la fiche et la liste des énigmes
 *            (accepter ajoute une variante).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lireSignalementsEnigme, traiterSignalementEnigme } from '../api/signalementsEnigme'

export function useSignalementsEnigme() {
  return useQuery({ queryKey: ['hub-signalements-enigme'], queryFn: lireSignalementsEnigme })
}

export function useTraitementEnigme() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, accepter }: { id: number; accepter: boolean }) => traiterSignalementEnigme(id, accepter),
    onSuccess: () => {
      for (const cle of ['hub-signalements-enigme', 'hub-ouverture', 'hub-enigme', 'hub-enigmes']) {
        void client.invalidateQueries({ queryKey: [cle] })
      }
    },
  })
}
