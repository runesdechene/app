/**
 * QUOI     — une énigme touchée : son contenu (ouvert au toucher), et la réponse (une seule).
 * POURQUOI — après le verdict, la carte et « Tous les titres » se relisent : le sceau percé quitte la
 *            carte, un titre gagné apparaît.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ouvrirEnigme, percerEnigme } from '../api/enigmes'
import { messageErreur } from '../lib/enigmeEnClair'

export function useEnigme(id: number) {
  const client = useQueryClient()
  const ouverture = useQuery({
    queryKey: ['enigme', id],
    queryFn: () => ouvrirEnigme(id),
    staleTime: Infinity,
    retry: false,
  })
  const reponse = useMutation({
    mutationFn: (r: string) => percerEnigme(id, r),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['enigmes-en-attente'] })
      void client.invalidateQueries({ queryKey: ['mes-titres'] })
    },
  })
  return {
    enigme: ouverture.data,
    erreurOuverture: ouverture.isError,
    repondre: (r: string) => {
      reponse.mutate(r)
    },
    verdict: reponse.data,
    envoi: reponse.isPending,
    erreurReponse: reponse.isError ? messageErreur(reponse.error) : null,
  }
}
