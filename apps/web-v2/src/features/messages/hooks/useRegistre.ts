/**
 * QUOI     — le Registre en cache, relu à chaque nouveau message (temps réel), et l'écriture.
 * POURQUOI — un message arrive : on relit la liste (200 messages, c'est léger) plutôt que de la
 *            recoller à la main. Écrire relit aussi : son message apparaît tout de suite.
 *            Le Registre ouvert est lu : chaque liste reçue marque « lu jusqu'ici » (migration 394),
 *            et le point des messages ratés s'éteint.
 *            Un cœur sur un message (migration 410) : celui qu'on envoie se montre tout de suite
 *            (`aimeEnCours`), puis le Registre se relit et la base fait foi.
 *            Les gens qui passent (migration 408) n'arrivent pas en temps réel : ils sont relus
 *            chaque minute, et à chaque nouveau message. Ils ne comptent pas dans les non-lus.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { Canal } from '../api/lireRegistre'
import {
  ecouterRegistre,
  ecrire,
  fetchPassages,
  fetchRegistre,
  fetchRegistreNonLus,
  aimerMessage,
  marquerRegistreLu,
} from '../api/registre'

const registreKey = ['registre'] as const
const filKey = ['registre', 'fil'] as const
const nonLusKey = ['registre', 'nonLus'] as const
const passagesKey = ['registre', 'passages'] as const

// `canaux` : le général, les bugs et mes Compagnies (mig 422) ; en changer relit le fil.
export function useRegistre(canaux: readonly Canal[]) {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: [...filKey, ...canaux], queryFn: () => fetchRegistre(canaux) })
  const passages = useQuery({
    queryKey: passagesKey,
    queryFn: fetchPassages,
    refetchInterval: 60 * 1000,
  })

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

  const coeur = useMutation({
    mutationFn: (v: { id: number; aime: boolean }) => aimerMessage(v.id, v.aime),
    onSettled: () => queryClient.invalidateQueries({ queryKey: filKey }),
  })

  return {
    messages: query.data,
    aimer: (id: number, aime: boolean) => {
      coeur.mutate({ id, aime })
    },
    // Le cœur parti, pas encore compté par la base.
    aimeEnCours: coeur.isPending ? coeur.variables : null,
    // Sans eux, le Registre reste entier : un passage manqué ne vaut pas une alerte.
    passages: passages.data ?? [],
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
