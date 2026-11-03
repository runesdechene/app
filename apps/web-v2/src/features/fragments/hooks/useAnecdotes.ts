/**
 * QUOI     — les anecdotes d'un motif sur sa fiche : le tirage d'un scan (la gratuite du jour, ou une
 *            creusée si le rescan l'a choisi sur la caméra) et « Creuser encore ».
 * POURQUOI — après un tirage, l'énergie, le Codex et la fiche se relisent.
 * ATTENTION — l'arrivée d'un scan (l'état de navigation posé par ScanScreen) ne sert qu'une fois :
 *            gardée ici, elle quitte aussitôt l'historique. Ni le retour ni un rechargement ne
 *            rejouent le tirage ou la découverte.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { debloquerSon } from '@/shared/lib/son'
import { PasAssezDEnergie, tirerAnecdote } from '../api/anecdote'
import type { ArriveeDuScan } from '../lib/arrivee'
import { cleMonFragment } from './useMonFragment'

export function useAnecdotes(id: number, arriveeRecue: ArriveeDuScan | null) {
  const client = useQueryClient()
  const relire = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['energie'] }),
      client.invalidateQueries({ queryKey: ['codex'] }),
      client.invalidateQueries({ queryKey: cleMonFragment(id) }),
    ])

  const [arrivee] = useState(arriveeRecue)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    if (arriveeRecue !== null) void navigate(pathname, { replace: true, state: null })
  }, [arriveeRecue, pathname, navigate])

  const tirage = useQuery({
    queryKey: ['tirage', id, arrivee?.scan],
    queryFn: async () => {
      const t = await tirerAnecdote(id, arrivee?.creuser ?? false)
      await relire()
      return t
    },
    enabled: arrivee !== null,
    staleTime: Infinity,
    retry: false,
  })

  const creusage = useMutation({
    mutationFn: () => tirerAnecdote(id, true),
    onSuccess: async (t) => {
      client.setQueryData(['tirage', id, arrivee?.scan], t)
      await relire()
    },
  })
  const plusDEnergie =
    creusage.error instanceof PasAssezDEnergie || tirage.error instanceof PasAssezDEnergie

  return {
    tirage: tirage.data ?? null,
    enAttente: tirage.isLoading, // le tirage d'un scan n'est pas encore là : la fiche attend
    creuser: () => {
      debloquerSon() // dans le geste : les applaudissements de la révélation pourront jouer
      creusage.mutate()
    },
    enCours: creusage.isPending,
    plusDEnergie,
    echec: (tirage.isError && !plusDEnergie) || (creusage.isError && !plusDEnergie),
  }
}
