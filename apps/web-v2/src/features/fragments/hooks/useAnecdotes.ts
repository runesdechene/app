/**
 * QUOI     — les anecdotes d'un motif sur sa fiche : le tirage gratuit d'un scan et « Creuser encore ».
 * POURQUOI — après un tirage, l'énergie, le Codex et la fiche se relisent.
 * ATTENTION — l'heure du scan (l'état de navigation posé par ScanScreen) ne sert qu'une fois : gardée
 *            ici, elle quitte aussitôt l'historique. Ni le retour ni un rechargement ne rejouent le
 *            tirage ou la découverte.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { PasAssezDEnergie, tirerAnecdote } from '../api/anecdote'
import { cleMonFragment } from './useMonFragment'

export function useAnecdotes(id: number, scanRecu: number | null) {
  const client = useQueryClient()
  const relire = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['energie'] }),
      client.invalidateQueries({ queryKey: ['codex'] }),
      client.invalidateQueries({ queryKey: cleMonFragment(id) }),
    ])

  const [scan] = useState(scanRecu)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  useEffect(() => {
    if (scanRecu !== null) void navigate(pathname, { replace: true, state: null })
  }, [scanRecu, pathname, navigate])

  const tirage = useQuery({
    queryKey: ['tirage', id, scan],
    queryFn: async () => {
      const t = await tirerAnecdote(id, false)
      await relire()
      return t
    },
    enabled: scan !== null,
    staleTime: Infinity,
    retry: false,
  })

  const creusage = useMutation({
    mutationFn: () => tirerAnecdote(id, true),
    onSuccess: async (t) => {
      client.setQueryData(['tirage', id, scan], t)
      await relire()
    },
  })
  const plusDEnergie = creusage.error instanceof PasAssezDEnergie

  return {
    tirage: tirage.data ?? null,
    creuser: () => {
      creusage.mutate()
    },
    enCours: creusage.isPending,
    plusDEnergie,
    echec: tirage.isError || (creusage.isError && !plusDEnergie),
  }
}
