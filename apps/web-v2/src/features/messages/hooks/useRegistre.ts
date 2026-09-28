/**
 * QUOI     — le Registre en cache, relu à chaque nouveau message (temps réel), et l'écriture.
 * POURQUOI — un message arrive : on relit la liste (60 messages, c'est léger) plutôt que de la
 *            recoller à la main. Écrire relit aussi : son message apparaît tout de suite.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { Canal } from '../api/lireRegistre'
import { ecouterRegistre, ecrire, fetchRegistre } from '../api/registre'

const registreKey = ['registre'] as const

export function useRegistre() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: registreKey, queryFn: fetchRegistre })

  useEffect(
    () =>
      ecouterRegistre(() => {
        void queryClient.invalidateQueries({ queryKey: registreKey })
      }),
    [queryClient],
  )

  const envoi = useMutation({
    mutationFn: (m: { canal: Canal; texte: string; mentions: string[] }) =>
      ecrire(m.canal, m.texte, m.mentions),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: registreKey })
    },
  })

  return {
    messages: query.data,
    erreur: query.isError,
    ecrire: (canal: Canal, texte: string, mentions: string[] = []) =>
      envoi.mutateAsync({ canal, texte, mentions }),
    echecEnvoi: envoi.isError,
  }
}
