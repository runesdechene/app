/**
 * QUOI     — les Murmures en cache : la liste des correspondants, une conversation (et son
 *            en-tête), murmurer ; le tout relu à chaque murmure écrit ou lu (temps réel).
 * POURQUOI — ouvrir une conversation marque lus les murmures reçus : le sceau disparaît de la
 *            liste. Toutes les clés sont sous ['murmures'] : une seule invalidation relit tout.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import {
  ecouterMurmures,
  fetchConversation,
  fetchCorrespondant,
  fetchFils,
  lireMurmures,
  murmurer,
} from '../api/murmures'

const murmuresKey = ['murmures'] as const

// Écouter en direct, tant que l'écran qui l'appelle est monté.
function useEcoute() {
  const queryClient = useQueryClient()
  useEffect(
    () =>
      ecouterMurmures(() => {
        void queryClient.invalidateQueries({ queryKey: murmuresKey })
      }),
    [queryClient],
  )
}

export function useFils() {
  useEcoute()
  const query = useQuery({ queryKey: [...murmuresKey, 'fils'], queryFn: fetchFils })
  return { fils: query.data, erreur: query.isError }
}

// L'en-tête d'une conversation : la route le lit pour le cadre de détail.
export function useCorrespondant(avec: string) {
  return useQuery({
    queryKey: [...murmuresKey, 'correspondant', avec],
    queryFn: () => fetchCorrespondant(avec),
  }).data
}

export function useConversation(avec: string) {
  useEcoute()
  const queryClient = useQueryClient()
  const conversation = useQuery({
    queryKey: [...murmuresKey, 'avec', avec],
    queryFn: () => fetchConversation(avec),
  })
  const correspondant = useQuery({
    queryKey: [...murmuresKey, 'correspondant', avec],
    queryFn: () => fetchCorrespondant(avec),
  })

  // Des murmures reçus et pas encore lus : on les marque lus, la liste se relit.
  const aLire = conversation.data?.some((m) => !m.deMoi && m.luLe === null) ?? false
  useEffect(() => {
    if (!aLire) return
    void lireMurmures(avec).then(() => queryClient.invalidateQueries({ queryKey: murmuresKey }))
  }, [aLire, avec, queryClient])

  const envoi = useMutation({
    mutationFn: (texte: string) => murmurer(avec, texte),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: murmuresKey })
    },
  })

  return {
    murmures: conversation.data,
    correspondant: correspondant.data,
    introuvable: correspondant.data === null,
    envoyer: (texte: string) => envoi.mutateAsync(texte),
    echecEnvoi: envoi.isError,
  }
}
