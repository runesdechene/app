/**
 * QUOI     — le Registre en cache, relu à chaque nouveau message (temps réel), et l'écriture.
 * POURQUOI — un message arrive : on relit la liste (200 messages, c'est léger) plutôt que de la
 *            recoller à la main. Écrire relit aussi : son message apparaît tout de suite.
 *            Le Registre ouvert est lu : chaque liste reçue marque « lu jusqu'ici » (migration 394),
 *            et le point des messages ratés s'éteint.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { Canal } from '../api/lireRegistre'
import {
  ecouterRegistre,
  ecrire,
  fetchRegistre,
  fetchRegistreNonLus,
  marquerRegistreLu,
} from '../api/registre'

const registreKey = ['registre'] as const
const nonLusKey = ['registre', 'nonLus'] as const

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

  // Ce qu'on voit est lu : à chaque liste reçue, le marqueur avance et le point s'éteint.
  const dernier = query.data?.at(-1)?.id
  useEffect(() => {
    if (dernier === undefined) return
    void marquerRegistreLu().then(() => queryClient.invalidateQueries({ queryKey: nonLusKey }))
  }, [dernier, queryClient])

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

const RIEN = { messages: 0, mentions: 0 }

// Depuis mon dernier passage : les messages de la communauté (le point discret) et les mentions
// de moi (la pastille rouge, comme un Murmure). Un nouveau message relance le compte.
export function useRegistreNonLus() {
  const queryClient = useQueryClient()
  useEffect(
    () =>
      ecouterRegistre(() => {
        void queryClient.invalidateQueries({ queryKey: nonLusKey })
      }),
    [queryClient],
  )
  return useQuery({ queryKey: nonLusKey, queryFn: fetchRegistreNonLus }).data ?? RIEN
}
